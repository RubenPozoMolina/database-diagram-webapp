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
