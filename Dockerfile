# syntax=docker/dockerfile:1

# --- Builder: install deps and compile TypeScript ---
FROM node:20.19.0-slim AS builder
WORKDIR /app

# Enable pnpm via corepack and install deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
 && corepack prepare pnpm@9.12.0 --activate \
 && pnpm install --frozen-lockfile

# Copy sources and build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build


# --- Runtime: minimal image with compiled JS ---
FROM node:20.19.0-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled app and production deps
COPY --from=builder /app/dist ./dist
COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
 && corepack prepare pnpm@9.12.0 --activate \
 && pnpm install --prod --frozen-lockfile

# Copy entrypoint to optionally source .env at runtime
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose nothing; this is a daemon process
ENTRYPOINT ["/entrypoint.sh"]


