FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

# Copy rarely changing files first
COPY tsconfig.json ./

# Copy package.json files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build server
COPY src ./src

RUN pnpm build

# Install production dependencies
RUN rm -rf node_modules
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="Automa Codex Bot"
LABEL org.opencontainers.image.description="Codex Bot for Automa"

ENV NODE_ENV=production
ENV PORT=8000

WORKDIR /app

RUN apk add --no-cache bash git ripgrep

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "build/index.js"]
