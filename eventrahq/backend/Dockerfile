FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci
COPY packages/contracts packages/contracts
COPY backend backend
RUN npm run build -w @eventrahq/contracts && npm run build -w @eventrahq/backend

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --omit=dev
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/backend/dist backend/dist
USER node
EXPOSE 5050
CMD ["node", "backend/dist/server.js"]
