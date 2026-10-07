# Next.js frontend, for self-hosting only. Production runs on Vercel (vercel.json, region sin1);
# this image is not part of backendR's deploy/docker-compose.prod.yml. Kept memory-light for
# building on a small server: Node's heap is capped at 1.5 GB for `next build`.
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so the API URL is a
# build arg (docker build --build-arg NEXT_PUBLIC_API_URL=https://api.jachai.com .).

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=1536
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# Promo creative rendering reads public/fonts from the working directory and loads its native
# rasterizer / WASM shaper from node_modules at runtime, so both ship as-is.
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs ./
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
