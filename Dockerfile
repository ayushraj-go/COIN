# COIN — one container serving the API and the web app (AWS ECS / App Runner; database on RDS PostgreSQL)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_DATA_MODE=api
RUN npx vite build && npm run build:api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 SERVE_STATIC=true
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY db ./db
EXPOSE 8787
USER node
CMD ["node", "server/dist/main.mjs"]
