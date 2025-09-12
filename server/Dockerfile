# server/Dockerfile
# Multi-stage: build then run
FROM node:20-slim AS build
WORKDIR /app

# Install deps
COPY server/package*.json ./
RUN npm ci

# Copy source & prisma
COPY server ./
# Generate prisma client and build
RUN npx prisma generate && npm run build

# ---- runtime image ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# openssl needed by Prisma engines on some distros
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy artifacts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY server/package*.json ./

EXPOSE 8080
# Safe for local/dev; for prod you may separate migrations
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
