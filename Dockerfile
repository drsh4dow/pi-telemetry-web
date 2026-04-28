FROM oven/bun:1-alpine AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run build:docker

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_BACKEND=local
ENV DATA_DIR=/data
ENV DB_PATH=/data/pi-telemetry-web.sqlite
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown -R app:app /data /app
COPY --from=build --chown=app:app /app/.output ./.output
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT}/healthz >/dev/null || exit 1
CMD ["bun", ".output/server/index.mjs"]
