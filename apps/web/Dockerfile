FROM node:24-trixie AS builder
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/configs/package.json packages/configs/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY apps/web apps/web
COPY packages/configs packages/configs
RUN pnpm -F @zhblogs/web run build

FROM node:24-trixie-slim AS runner
WORKDIR /workspace

ENV NODE_ENV=production

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/packages/configs ./packages/configs
COPY --from=builder /workspace/apps/web/package.json ./apps/web/package.json
COPY --from=builder /workspace/apps/web/dist ./apps/web/dist

EXPOSE 9101
CMD ["node", "apps/web/dist/server/index.mjs"]
