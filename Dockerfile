FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Платформа подставит PORT (Render, Fly, Railway и т.д.)
EXPOSE 8787

CMD ["node", "tutor_server.mjs"]
