# Step that pulls in everything needed to build the app and builds it
# Pinned to this sha because newer versions broke
# https://github.com/getsentry/sentry-javascript/issues/12169
FROM node:22-alpine@sha256:ed9736a13b88ba55cbc08c75c9edac8ae7f72840482e40324670b299336680c1 AS dev-build
ARG GIT_COMMIT_SHA
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA:-development}
WORKDIR /home/node/app
RUN npm install -g pnpm
COPY pnpm-lock.yaml ./
RUN pnpm fetch
COPY package.json ./
RUN pnpm install --frozen-lockfile --offline
COPY src/ ./src/
COPY tsconfig.json ./
COPY /prisma ./prisma/
RUN pnpm exec prisma generate && pnpm run build
COPY /resources ./resources/
RUN pnpm sentry:sourcemaps:inject


# Step that only pulls in (production) deps required to run the app
FROM node:22-alpine@sha256:ed9736a13b88ba55cbc08c75c9edac8ae7f72840482e40324670b299336680c1 AS prod-build
WORKDIR /home/node/app
RUN npm install -g pnpm
COPY --from=dev-build /home/node/app/pnpm-lock.yaml ./
COPY --from=dev-build /home/node/app/node_modules ./node_modules/
COPY --from=dev-build /home/node/app/package.json ./
COPY --from=dev-build /home/node/app/prisma ./prisma/
RUN pnpm install --prod --frozen-lockfile
COPY --from=dev-build /home/node/app/dist ./dist/
COPY --from=dev-build /home/node/app/resources ./resources/


# The actual runtime itself
FROM node:22-alpine@sha256:ed9736a13b88ba55cbc08c75c9edac8ae7f72840482e40324670b299336680c1 AS prod-runtime
# See https://github.com/prisma/prisma/issues/19729
RUN apk upgrade --update-cache --available && \
    apk add openssl && \
    rm -rf /var/cache/apk/*
WORKDIR /home/node/app
COPY --from=prod-build /home/node/app ./
USER node
CMD [ "npm", "run", "start:prod" ]
