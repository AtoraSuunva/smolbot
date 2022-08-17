# Step that pulls in everything needed to build the app and builds it
FROM node:18-alpine as dev-build
WORKDIR /usr/app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN pnpm fetch
RUN pnpm install -r --offline
COPY . ./
RUN pnpm run build

# Step that only pulls in (production) deps required to run the app
FROM node:18-alpine as prod-build
WORKDIR /usr/app
RUN npm install -g pnpm
COPY --from=dev-build /usr/app/package.json /usr/app/pnpm-lock.yaml ./
COPY --from=dev-build /usr/app/dist ./dist
COPY prisma/ ./prisma/
RUN pnpm fetch --prod
RUN pnpm install -r --offline --prod
RUN pnpx prisma generate

# Minimal Linux runtime, with effectively only the absolute basics needed to run Node.js
# https://github.com/GoogleContainerTools/distroless/blob/main/nodejs/README.md
FROM gcr.io/distroless/nodejs:18
WORKDIR /usr/app
COPY --from=prod-build /usr/app ./
USER 1000
CMD [ "dist/index.js" ]
