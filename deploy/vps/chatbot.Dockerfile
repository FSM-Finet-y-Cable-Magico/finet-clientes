# Asistente virtual (finet-chatbot, otro repo). El código llega como contexto
# `fuente` desde el compose; las variables van en chatbot.env, nunca en la imagen.
FROM node:24-bookworm-slim

RUN npm install -g pnpm@11.5.0

WORKDIR /app
COPY --from=fuente package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY --from=fuente . .
RUN pnpm build

ENV NODE_ENV=production
USER node
CMD ["node", "dist/main.js"]
