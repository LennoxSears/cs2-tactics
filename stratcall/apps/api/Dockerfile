FROM node:20-slim
RUN npm install -g pnpm@10

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/
COPY packages/db/package.json packages/db/tsconfig.json ./packages/db/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build shared packages only
RUN pnpm turbo build --filter=@stratcall/types --filter=@stratcall/db

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "src/index.ts"]
