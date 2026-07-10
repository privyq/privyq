# syntax=docker/dockerfile:1
# Multi-stage build for the PrivyQ Next.js frontend.
# Produces a small runtime image using Next.js standalone output.

# ── deps: install production + dev deps for the build ──
FROM node:22-alpine AS deps
WORKDIR /app
# Don't let the @playwright/test dep try to pull browsers during install.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json* ./
# Make the install resilient to flaky networks (retry on ECONNRESET/timeout).
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 180000 \
  && npm config set fetch-timeout 600000
# A cache mount lets retried builds resume from already-downloaded packages.
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── builder: compile the Next.js app ──
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runner: minimal image running `next start` on port 3000 ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy the standalone server + static assets (next.config.mjs → output: "standalone").
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# `next build` with output:"standalone" emits server.js; this is the documented
# equivalent of `next start` for the standalone runtime.
CMD ["node", "server.js"]
