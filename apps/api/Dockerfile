FROM node:24-trixie AS builder
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/configs/package.json packages/configs/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY scripts scripts
COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @zhblogs/db --filter @zhblogs/utils --if-present run build \
  && pnpm -F @zhblogs/api run build

FROM node:24-trixie-slim AS runner
WORKDIR /workspace

ENV NODE_ENV=production

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/packages ./packages
COPY --from=builder /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist

EXPOSE 9201
CMD ["node", "apps/api/dist/index.mjs"]
