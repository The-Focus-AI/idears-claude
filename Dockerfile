FROM node:18-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY . .

RUN mkdir -p /app/data /app/data/uploads

EXPOSE 3000

ENV DATA_DIR=/app/data
ENV NODE_ENV=production

USER node

CMD ["pnpm", "start"]