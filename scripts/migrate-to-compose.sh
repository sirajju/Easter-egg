#!/usr/bin/env bash
# Move a running NIGHTSHIFT container onto docker-compose.yml without losing
# data. Run it from the repository folder on the server:
#
#   bash scripts/migrate-to-compose.sh            # auto-detects the container
#   bash scripts/migrate-to-compose.sh my-name    # or name it
#
# What it does, in order:
#   1. finds the running game and the volume that holds /data
#   2. backs up the database and secret while the game keeps running
#   3. pulls the new image first, so the switch itself takes seconds
#   4. writes .env so compose reuses the SAME volume (no copying)
#   5. stops the old container and keeps it, renamed, for rollback
#   6. starts the compose version and checks players are all still there;
#      if anything fails, it brings the old container back
set -euo pipefail

say() { printf '\033[1m[migrate]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[migrate] %s\033[0m\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")/.."
[ -f docker-compose.yml ] || die "Run this from the NIGHTSHIFT repository (docker-compose.yml not found)."
command -v docker >/dev/null || die "docker is not installed."
docker compose version >/dev/null 2>&1 || die "docker compose (v2) is not available."

# ---- 1. find the running game ------------------------------------------------
OLD="${1:-}"
if [ -z "$OLD" ]; then
  # A running container with something mounted at /data and a NIGHTSHIFT image.
  for c in $(docker ps --format '{{.Names}}'); do
    image=$(docker inspect -f '{{.Config.Image}}' "$c")
    mounts=$(docker inspect -f '{{range .Mounts}}{{.Destination}} {{end}}' "$c")
    if [[ "$mounts" == *"/data"* && "$image" =~ (nightshift|archie) ]]; then
      [ -n "$OLD" ] && die "Several NIGHTSHIFT containers are running ($OLD, $c). Pass the name: $0 <name>"
      OLD="$c"
    fi
  done
fi
[ -n "$OLD" ] || die "No running NIGHTSHIFT container found. Pass its name: $0 <name>"
[ "$(docker inspect -f '{{.State.Running}}' "$OLD" 2>/dev/null)" = "true" ] || die "Container '$OLD' isn't running."

MOUNT_TYPE=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Type}}{{end}}{{end}}' "$OLD")
MOUNT_NAME=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$OLD")
MOUNT_SRC=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' "$OLD")
# Docker lists a binding per address family (IPv4 and IPv6): take the first.
HOST_PORT=$(docker inspect -f '{{range $p, $b := .NetworkSettings.Ports}}{{if eq $p "4404/tcp"}}{{range $b}}{{.HostPort}} {{end}}{{end}}{{end}}' "$OLD" | awk '{print $1}')
HOST_PORT="${HOST_PORT:-4404}"
envval() { docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$OLD" | sed -n "s/^$1=//p" | head -1; }
OLD_TZ=$(envval TZ); OLD_ADMIN=$(envval NIGHTSHIFT_ADMIN_KEY); OLD_JOIN=$(envval NIGHTSHIFT_JOIN_LIMIT)

players() { curl -fsS "http://127.0.0.1:${1}/api/desks" 2>/dev/null | sed -n 's/.*"players":\([0-9]*\).*/\1/p'; }
BEFORE=$(players "$HOST_PORT" || true)

say "Game container: $OLD (port $HOST_PORT, ${BEFORE:-?} players)"
say "Data at /data:  $MOUNT_TYPE ${MOUNT_NAME:-$MOUNT_SRC}"

# ---- 2. backup while running ---------------------------------------------------
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="nightshift-backup-$STAMP"
mkdir -p "$BACKUP"
docker exec "$OLD" node -e "
  const { DatabaseSync } = require('node:sqlite');
  new DatabaseSync('/data/nightshift.db').exec(\"VACUUM INTO '/data/backup-$STAMP.db'\");
" || die "Couldn't snapshot the database. Nothing was changed."
docker cp "$OLD:/data/backup-$STAMP.db" "$BACKUP/nightshift.db"
docker cp "$OLD:/data/secret.key" "$BACKUP/secret.key"
docker exec "$OLD" rm -f "/data/backup-$STAMP.db"
say "Backup saved in ./$BACKUP (database + secret.key)"

# ---- 3/4. point compose at the same data ---------------------------------------
if [ "$MOUNT_TYPE" = "volume" ]; then
  VOLUME="$MOUNT_NAME"
else
  # A bind-mounted folder: copy it into a named volume once, then use that.
  VOLUME="nightshift-data"
  docker volume inspect "$VOLUME" >/dev/null 2>&1 && die "Volume $VOLUME already exists; not overwriting it. Remove or rename it first."
  say "Data is a host folder ($MOUNT_SRC); it will be copied into volume $VOLUME after the game stops."
fi

touch .env
setenv() { # replace or append KEY=VALUE in .env
  grep -v "^$1=" .env > .env.tmp || true
  printf '%s=%s\n' "$1" "$2" >> .env.tmp
  mv .env.tmp .env
}
cp .env ".env.before-$STAMP"
# Until the switch starts, any failure just restores .env: the game was never touched.
trap 'mv ".env.before-$STAMP" .env; die "Stopped before switching. The game is still running, untouched."' ERR
setenv NIGHTSHIFT_VOLUME "$VOLUME"
setenv NIGHTSHIFT_PORT "$HOST_PORT"
[ -n "$OLD_TZ" ] && setenv TZ "$OLD_TZ"
[ -n "$OLD_ADMIN" ] && setenv NIGHTSHIFT_ADMIN_KEY "$OLD_ADMIN"
[ -n "$OLD_JOIN" ] && setenv NIGHTSHIFT_JOIN_LIMIT "$OLD_JOIN"
say "Wrote .env: compose will use volume $VOLUME on port $HOST_PORT"

say "Pulling the image now so the switch is quick..."
docker compose pull --quiet

# ---- 5/6. switch -----------------------------------------------------------------
RETIRED="$OLD-old-$STAMP"
rollback() {
  say "Rolling back to the old container..."
  docker compose down --remove-orphans >/dev/null 2>&1 || true   # never -v
  docker rename "$RETIRED" "$OLD" >/dev/null 2>&1 || true
  docker start "$OLD" >/dev/null && say "Old container is running again. Your data is untouched; backup in ./$BACKUP"
  mv ".env.before-$STAMP" .env 2>/dev/null || true
  exit 1
}

trap - ERR
say "Stopping $OLD (players will see a few seconds of reconnecting)..."
# Older images don't handle SIGTERM (Docker then waits the full timeout and
# kills it; SQLite's journal makes that safe). Keep the wait short.
docker stop -t 5 "$OLD" >/dev/null
docker rename "$OLD" "$RETIRED"

if [ "$MOUNT_TYPE" != "volume" ]; then
  docker volume create "$VOLUME" >/dev/null
  docker run --rm -v "$MOUNT_SRC":/old:ro -v "$VOLUME":/data alpine \
    sh -c 'cp -a /old/. /data/ && chown -R 1000:1000 /data' || rollback
fi

docker compose up -d --pull never || rollback   # already pulled above

for _ in $(seq 1 60); do
  AFTER=$(players "$HOST_PORT" || true)
  [ -n "$AFTER" ] && break
  sleep 1
done
[ -n "${AFTER:-}" ] || { say "The new container didn't answer within 60s."; rollback; }
if [ -n "$BEFORE" ] && [ "$AFTER" -lt "$BEFORE" ]; then
  say "Player count dropped ($BEFORE -> $AFTER): the new container isn't on the same data."
  rollback
fi

say "Done. ${AFTER} players, same data, now running from docker-compose.yml."
say "Old container kept (stopped) as $RETIRED. Once you're happy:  docker rm $RETIRED"
say "Never use 'down -v' or 'docker volume rm $VOLUME' on this server."
