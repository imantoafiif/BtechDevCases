FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY frontend frontend

ARG VITE_API_BASE_URL=http://localhost:3000/api
RUN npm run build --workspace frontend

FROM node:24-slim
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/frontend/dist ./dist

ENV NODE_ENV=production
USER node
EXPOSE 8080

CMD ["serve", "-s", "dist", "-l", "8080"]
