FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p data uploads outputs

ENV NODE_ENV=production
ENV PORT=38024

EXPOSE 38024

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:38024/api/health', r => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
