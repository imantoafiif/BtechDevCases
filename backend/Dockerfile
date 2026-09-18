FROM node:24-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY backend/src backend/src

RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production \
    DATABASE_PATH=/data/app.db
USER node
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "--import", "tsx", "src/server.ts"]
