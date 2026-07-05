# Mycelium enrichment worker — includes ffmpeg + yt-dlp, which Render's
# default Node environment does not have. Deploy this on Render as a
# Docker-based service (see README.md in this folder).
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src ./src
RUN npm install && npm run build && npm prune --omit=dev

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
