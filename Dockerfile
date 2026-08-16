FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm --prefix server install && npm --prefix client install

COPY . .

RUN npm run build:all

ENV PORT=4000
EXPOSE 4000

CMD ["npm", "start"]