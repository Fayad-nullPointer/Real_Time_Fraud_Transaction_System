# syntax=docker/dockerfile:1.7

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time env vars so Vite can bake them in
ARG VITE_API_URL=""
ARG VITE_API_HOST="localhost:8000"
ARG VITE_WS_URL="ws://localhost:8000"
ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_HOST=$VITE_API_HOST \
    VITE_WS_URL=$VITE_WS_URL \
    NITRO_PRESET=node-server

# Install deps first (better layer caching)
COPY package.json bun.lock* ./
RUN npm install

# Copy the rest of the source
COPY . .

# Build the TanStack Start production bundle (Nitro output in .output/)
RUN NITRO_PRESET=node-server npm run build


# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Copy only the built Nitro server output
COPY --from=builder /app/.output ./.output

# Non-root user
RUN addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app
USER app

EXPOSE 3000

# Nitro emits a Node server entry at .output/server/index.mjs
CMD ["node", ".output/server/index.mjs"]
