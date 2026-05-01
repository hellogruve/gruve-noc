# =============================================================================
# Gruve AI NOC Agent — Frontend
# =============================================================================
FROM node:20-slim AS builder

LABEL org.opencontainers.image.title="Gruve NOC Agent Frontend" \
      org.opencontainers.image.vendor="Gruve AI"

WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

ARG VITE_API_BASE_URL=
ARG VITE_NETWORK_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_NETWORK_ID=$VITE_NETWORK_ID

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="Gruve NOC Agent Frontend" \
      org.opencontainers.image.vendor="Gruve AI"

RUN chmod -R 777 /var/cache/nginx /var/run /var/log/nginx \
    && sed -i '/^user /d' /etc/nginx/nginx.conf \
    && sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html

USER 1001
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
