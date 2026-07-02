# Dockerfile for TicTacToe with Socket.IO support
# This builds both the Next.js app and the Socket.IO server

FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/socketGameCore.js ./socketGameCore.js
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

# Expose the HTTP server. Socket.IO is attached to the same server.
EXPOSE 3000

# Start the custom Next.js + Socket.IO server.
CMD ["node", "server.js"]
