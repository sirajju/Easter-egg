#!/usr/bin/env bash
# Move a running NIGHTSHIFT container onto the published compose setup without
# losing data. Self-contained: run it from anywhere, it never reads or touches
# any other compose project.
#
#   bash migrate-to-compose.sh            # auto-detects the game container
#   bash migrate-to-compose.sh my-name    # or name it
#
# Everything it creates lives in ~/nightshift (override with NIGHTSHIFT_DIR):
# a docker-compose.yml, a .env, and backups.
#
# What it does, in order:
#   1. finds the running game and the volume that holds /data
#   2. backs up the database and secret while the game keeps running
#   3. pulls the new image first, so the switch itself takes seconds
#   4. writes ~/nightshift/.env so compose reuses the SAME volume (no copying)
#   5. stops the old container and keeps it, renamed, for rollback
#   6. starts the new one and checks every player is still there; if not,
#      it removes only the new container and brings the old one back
set -euo pipefail

say() { printf '\033[1m[migrate]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[migrate] %s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is not installed."
docker compose version >/dev/null 2>&1 || die "docker compose (v2) is not available."
command -v curl >/dev/null || die "curl is not installed."

DIR="${NIGHTSHIFT_DIR:-$HOME/nightshift}"
PROJECT=nightshift          # its own compose project: never mixes with others
mkdir -p "$DIR"
cd "$DIR"
# Every compose call names this file and project explicitly.
dc() { docker compose -p "$PROJECT" -f "$DIR/docker-compose.yml" "$@"; }

# ---- 1. find the running game ------------------------------------------------
OLD="${1:-}"
if [ -z "$OLD" ]; then
  # A running container with /data mounted and a NIGHTSHIFT image.
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
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$OLD")" = "$PROJECT" ] &&
  die "'$OLD' is already managed by this setup in $DIR. Nothing to migrate."

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
say "Working folder: $DIR"

# ---- 2. backup while running ---------------------------------------------------
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$DIR/backup-$STAMP"
mkdir -p "$BACKUP"
docker exec "$OLD" node -e "
  const { DatabaseSync } = require('node:sqlite');
  new DatabaseSync('/data/nightshift.db').exec(\"VACUUM INTO '/data/backup-$STAMP.db'\");
" || die "Couldn't snapshot the database. Nothing was changed."
docker cp "$OLD:/data/backup-$STAMP.db" "$BACKUP/nightshift.db" >/dev/null
docker cp "$OLD:/data/secret.key" "$BACKUP/secret.key" >/dev/null
docker exec "$OLD" rm -f "/data/backup-$STAMP.db"
say "Backup saved in $BACKUP (database + secret.key)"

# ---- 3/4. compose file and .env --------------------------------------------------
if [ "$MOUNT_TYPE" = "volume" ]; then
  VOLUME="$MOUNT_NAME"
else
  VOLUME="nightshift-data"   # a bind-mounted folder gets copied into this, once
  docker volume inspect "$VOLUME" >/dev/null 2>&1 && die "Volume $VOLUME already exists; not overwriting it."
  say "Data is a host folder ($MOUNT_SRC); it will be copied into volume $VOLUME after the game stops."
fi

# Keep any previous files so a failure can put them back exactly.
for f in docker-compose.yml .env; do [ -f "$f" ] && cp "$f" "$BACKUP/$f.before"; done
restore_files() {
  for f in docker-compose.yml .env; do
    if [ -f "$BACKUP/$f.before" ]; then cp "$BACKUP/$f.before" "$f"; else rm -f "$f"; fi
  done
}
trap 'restore_files; die "Stopped before switching. The game is still running, untouched."' ERR

cat > docker-compose.yml <<'YAML'
# NIGHTSHIFT, written by migrate-to-compose.sh. Settings are in .env.
services:
  nightshift:
    image: sirajju/archie:${NIGHTSHIFT_TAG:-latest}
    pull_policy: always
    container_name: nightshift
    restart: unless-stopped
    ports:
      - "${NIGHTSHIFT_PORT:-4404}:4404"
    environment:
      TZ: ${TZ:-Asia/Kolkata}
      NIGHTSHIFT_ADMIN_KEY: ${NIGHTSHIFT_ADMIN_KEY:-}
      NIGHTSHIFT_JOIN_LIMIT: ${NIGHTSHIFT_JOIN_LIMIT:-60}
    volumes:
      - nightshift-data:/data

volumes:
  nightshift-data:
    # The game's data. Survives restarts, updates and `down`.
    # Never run `down -v` or `docker volume rm` on it.
    name: ${NIGHTSHIFT_VOLUME:-nightshift-data}
    external: true
YAML

touch .env
setenv() { # replace or append KEY=VALUE in .env
  grep -v "^$1=" .env > .env.tmp || true
  printf '%s=%s\n' "$1" "$2" >> .env.tmp
  mv .env.tmp .env
}
setenv COMPOSE_PROJECT_NAME "$PROJECT"   # so a plain `docker compose` here finds it
setenv NIGHTSHIFT_VOLUME "$VOLUME"
setenv NIGHTSHIFT_PORT "$HOST_PORT"
[ -n "$OLD_TZ" ] && setenv TZ "$OLD_TZ"
[ -n "$OLD_ADMIN" ] && setenv NIGHTSHIFT_ADMIN_KEY "$OLD_ADMIN"
[ -n "$OLD_JOIN" ] && setenv NIGHTSHIFT_JOIN_LIMIT "$OLD_JOIN"
chmod 600 .env
say "Wrote $DIR/docker-compose.yml and .env (volume $VOLUME, port $HOST_PORT)"

say "Pulling the image now so the switch is quick..."
dc pull --quiet nightshift

# ---- 5/6. switch -----------------------------------------------------------------
RETIRED="$OLD-old-$STAMP"
rollback() {
  say "Rolling back to the old container..."
  dc rm --stop --force nightshift >/dev/null 2>&1 || true   # only the new container; never volumes
  docker rename "$RETIRED" "$OLD" >/dev/null 2>&1 || true
  docker start "$OLD" >/dev/null && say "Old container is running again. Data untouched; backup in $BACKUP"
  restore_files
  exit 1
}

trap - ERR
if [ "$MOUNT_TYPE" != "volume" ]; then docker volume create "$VOLUME" >/dev/null; fi
say "Stopping $OLD (players will see a few seconds of reconnecting)..."
# Older images don't handle SIGTERM (Docker then waits and kills it; SQLite's
# journal makes that safe). Keep the wait short.
docker stop -t 5 "$OLD" >/dev/null
docker rename "$OLD" "$RETIRED"

if [ "$MOUNT_TYPE" != "volume" ]; then
  docker run --rm -v "$MOUNT_SRC":/old:ro -v "$VOLUME":/data alpine \
    sh -c 'cp -a /old/. /data/ && chown -R 1000:1000 /data' || rollback
fi

dc up -d --pull never nightshift || rollback   # already pulled above

AFTER=""
for _ in $(seq 1 60); do
  AFTER=$(players "$HOST_PORT" || true)
  [ -n "$AFTER" ] && break
  sleep 1
done
[ -n "$AFTER" ] || { say "The new container didn't answer within 60s."; rollback; }
if [ -n "$BEFORE" ] && [ "$AFTER" -lt "$BEFORE" ]; then
  say "Player count dropped ($BEFORE -> $AFTER): the new container isn't on the same data."
  rollback
fi

say "Done. ${AFTER} players, same data, running from $DIR."
say "Old container kept (stopped) as $RETIRED. Once you're happy:  docker rm $RETIRED"
say "Update later with:  cd $DIR && docker compose up -d"
say "Never run 'down -v' or 'docker volume rm $VOLUME' on this server."
