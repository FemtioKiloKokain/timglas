# Backend (Node + WebSocket + SQLite). Bygger även frontenden så att
# backendens egen URL också fungerar fristående (bra för test).
FROM node:22-slim

# Byggverktyg ifall better-sqlite3 inte har en färdig binär för plattformen.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

ENV PORT=3000
# SQLite-filen på en monterad volym (se fly.toml [mounts]).
ENV DB_PATH=/data/tournament.db
EXPOSE 3000

CMD ["yarn", "start"]
