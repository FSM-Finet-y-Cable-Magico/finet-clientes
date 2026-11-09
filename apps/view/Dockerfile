# Vista del portal (Next.js). Se construye desde la raíz del repo:
#   docker build -f apps/view/Dockerfile .
#
# `next build` corre al arrancar el contenedor, no al armar la imagen: el
# sitemap (CU-74) lee el catálogo del backend y está hecho para que el build
# falle si no lo encuentra. Así, además, las NEXT_PUBLIC_* salen del env_file
# del servidor y no quedan dentro de la imagen.
FROM node:24-bookworm-slim

RUN npm install -g pnpm@11.5.0

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/controller/package.json apps/controller/
COPY apps/view/package.json apps/view/
RUN pnpm install --frozen-lockfile --filter ./apps/view

COPY apps/view apps/view
WORKDIR /app/apps/view
RUN chown -R node:node /app/apps/view

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
CMD ["sh", "-c", "pnpm build && exec pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]
