FROM node:24.19.0-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:node

FROM node:24.19.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1 SATOR_DATA_DIR=/var/data/sator
COPY --from=builder --chown=node:node /app/.next/standalone ./
RUN mkdir -p /var/data/sator && chown -R node:node /var/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
