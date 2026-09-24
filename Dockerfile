FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:worker && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN useradd --uid 10001 --create-home app && mkdir -p /data/uploads && chown app /data/uploads
COPY --from=build --chown=app /app /app
USER app
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
