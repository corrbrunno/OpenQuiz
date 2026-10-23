# SvelteKit (adapter-node) em container — deploy no bruno-server atras do Cloudflare Tunnel.
# Duas instalacoes (deps de producao + build) em vez de `npm prune`: nesta maquina o prune
# levava >9 min (I/O + swap) enquanto os dois `npm ci` rodam em paralelo.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV BUILD_ADAPTER=node
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    BODY_SIZE_LIMIT=6M
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "build"]
