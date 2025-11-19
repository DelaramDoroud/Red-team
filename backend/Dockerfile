FROM node:23-alpine AS builder

RUN npm install -g npm@11.4.0
RUN apk add --no-cache git

ARG BRANCH

WORKDIR /usr/app

COPY ./package*.json ./

RUN npm ci

COPY . .

FROM node:23-alpine

WORKDIR /usr/app

ENV NODE_ENV=production

COPY --from=builder /usr/app /usr/app

CMD ["sh", "-c", "npm start"]
