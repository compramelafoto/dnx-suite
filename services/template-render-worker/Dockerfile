# Build from monorepo root:
#   docker build -f services/template-render-worker/Dockerfile -t dnx-template-render-worker .
#
# Requires Chromium (Playwright base image). Do not run on Vercel serverless.

FROM mcr.microsoft.com/playwright:v1.51.1-jammy

WORKDIR /app

ENV NODE_ENV=staging \
    TEMPLATE_RENDER_WORKER_PORT=8787 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/typescript-config ./packages/typescript-config
COPY packages/template-engine ./packages/template-engine
COPY packages/template-engine-renderer ./packages/template-engine-renderer
COPY services/template-render-worker ./services/template-render-worker

RUN pnpm install --filter @repo/template-render-worker... --frozen-lockfile \
  && chown -R pwuser:pwuser /app

USER pwuser

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.TEMPLATE_RENDER_WORKER_PORT||8787)+'/internal/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "--filter", "@repo/template-render-worker", "start"]
