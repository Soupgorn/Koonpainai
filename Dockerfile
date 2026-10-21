FROM node:24-bookworm-slim@sha256:8cabefbd444809cf0e319b5831c65da1ea202200ca552a5e75fd7938a6f86658 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
WORKDIR /app
COPY src ./src
COPY public ./public
COPY runtime ./runtime
COPY scripts/package-runtime.mjs ./scripts/package-runtime.mjs
COPY next.config.ts tsconfig.json postcss.config.mjs ./
ENV NEXT_TELEMETRY_DISABLED=1
ARG KOONPINAI_BUILD_ID
RUN test -n "$KOONPINAI_BUILD_ID" && KOONPINAI_BUILD_ID="$KOONPINAI_BUILD_ID" npm run build && node scripts/package-runtime.mjs /artifact

FROM node:24-bookworm-slim@sha256:8cabefbd444809cf0e319b5831c65da1ea202200ca552a5e75fd7938a6f86658 AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --gid 1001 nodeapp && useradd --uid 1001 --gid nodeapp --no-create-home nodeapp
COPY --from=builder --chown=nodeapp:nodeapp /artifact ./
USER nodeapp
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=6s --start-period=45s --retries=3 CMD ["node", "runtime/healthcheck.mjs"]
CMD ["node", "runtime/launch.mjs", "/run/secrets/koonpinai-runtime-manifest.json"]
