# NIGHTSHIFT: zero npm dependencies, so the image is just Node and the source.
# node:sqlite needs Node 22.13+; Node 24 ships it unflagged.
FROM node:24-alpine

# TZ decides when the night shift starts (19:00-06:00 office time). Containers
# default to UTC, so set TZ to the office's zone, e.g. -e TZ=Asia/Kolkata.
ENV NODE_ENV=production \
    PORT=4404 \
    NIGHTSHIFT_DATA=/data \
    TZ=UTC

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY content ./content
COPY public ./public
COPY scripts ./scripts

# The database and the server secret live on a volume, owned by the
# unprivileged "node" user the image already has.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node

EXPOSE 4404
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4404)+'/api/desks').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server/server.js"]
