# RPS admin web image. Build from the REPO ROOT (it needs packages/shared and the lockfile):
#   docker build -f apps/admin-web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://<site>/api/v1 -t rps-admin .
# The API address is fixed into the page code at build time — a new address needs a new build.

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin-web/package.json apps/admin-web/
RUN pnpm install --frozen-lockfile --filter admin-web...

COPY packages/shared packages/shared
COPY apps/admin-web apps/admin-web

ARG NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL build arg is required" && exit 1)
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter admin-web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/admin-web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/admin-web/.next/static ./apps/admin-web/.next/static
COPY --from=build --chown=node:node /repo/apps/admin-web/public ./apps/admin-web/public
USER node
EXPOSE 3000
CMD ["node", "apps/admin-web/server.js"]
