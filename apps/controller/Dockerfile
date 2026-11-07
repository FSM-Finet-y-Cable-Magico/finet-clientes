# Backend del portal (NestJS + Prisma). Se construye desde la raíz del repo:
#   docker build -f apps/controller/Dockerfile .
# Las variables van en el env_file del compose (deploy/vps), nunca en la imagen.
FROM node:24-bookworm-slim

# openssl: lo usa el motor de migraciones de Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@11.5.0

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/controller/package.json apps/controller/
COPY apps/view/package.json apps/view/
RUN pnpm install --frozen-lockfile --filter ./apps/controller

COPY apps/controller apps/controller
WORKDIR /app/apps/controller
# Lo mismo que el paso 3 del README, más el script que corre después de
# generar (postgenerate en package.json). Generar no se conecta a la base: la
# URL de mentira solo cumple con prisma.config.ts.
RUN DATABASE_URL=postgresql://build@localhost:5432/build pnpm exec prisma generate \
  && node scripts/fix-prisma-client.mjs \
  && pnpm build \
  && chown -R node:node /app/apps/controller

ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
