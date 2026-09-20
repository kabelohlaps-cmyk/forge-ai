FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/crypto/package.json packages/crypto/package.json
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY . .
RUN pnpm --filter @forge/web build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /repo ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@forge/web", "start"]
