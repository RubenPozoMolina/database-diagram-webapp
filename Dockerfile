# Multi-stage Dockerfile: build the frontend and serve it with nginx.
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 2: serve
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=builder /work/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1
