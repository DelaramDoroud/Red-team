FROM node:25-alpine AS builder

RUN npm install -g npm@11
RUN apk add --no-cache git

ARG BRANCH
ARG VITE_API_REST_BASE=/api/rest
ARG VITE_AUTH_API_BASE

WORKDIR /usr/app

COPY ./package*.json ./

RUN npm ci

COPY . .

ENV VITE_API_REST_BASE=${VITE_API_REST_BASE}
ENV VITE_AUTH_API_BASE=${VITE_AUTH_API_BASE}

RUN npm run build

FROM node:25-alpine

WORKDIR /usr/app

ENV NODE_ENV=production

COPY --from=builder /usr/app/package*.json ./
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/app/dist ./dist

EXPOSE 3000

CMD ["npm", "run", "start"]
