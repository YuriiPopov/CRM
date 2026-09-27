# syntax=docker/dockerfile:1
# Образ backend для сервиса `app` в docker-compose.yml. Debian slim, а не alpine: Prisma
# и нативный bcrypt собираются/работают на glibc без дополнительных движков под musl.

# ── build: полные зависимости, генерация Prisma Client, компиляция TypeScript ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build \
    # Только runtime-зависимости; prisma CLI остаётся (он в dependencies) — нужен для migrate deploy
    && npm prune --omit=dev

# ── runtime ──
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    # Каталог файловых логов winston в production (см. logger.module.ts) — его читает filebeat
    && mkdir -p /var/log/b4u-crm && chown node:node /var/log/b4u-crm

ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000
# Миграции применяются при старте контейнера — к этому моменту postgres уже доступен по сети compose
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
