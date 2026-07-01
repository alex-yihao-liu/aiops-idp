# This dockerfile builds an image for the backend package.
# It should be executed with the root of the repo as docker context.
#
# Before building this image, be sure to have run the following commands in the repo root:
#
# yarn install --immutable
# yarn tsc
# yarn build:backend
#
# Once the commands have been run, you can build the image using `yarn build-image`
#
# Alternatively, there is also a multi-stage Dockerfile documented here:
# https://backstage.io/docs/deployment/docker#multi-stage-build

FROM node:24-trixie-slim

ARG APT_MIRROR
ARG APT_SECURITY_MIRROR
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy

# Set Python interpreter for `node-gyp` to use
ENV PYTHON=/usr/bin/python3

# Install isolate-vm dependencies, these are needed by the @backstage/plugin-scaffolder-backend.
# Also install sqlite3 dependencies. You can skip libsqlite3-dev if you don't use sqlite3 in the image,
# in which case you should also move better-sqlite3 to "devDependencies" in package.json.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    if [ -n "$APT_MIRROR" ]; then \
      sed -i "s|^URIs: http://deb.debian.org/debian$|URIs: $APT_MIRROR|" /etc/apt/sources.list.d/debian.sources; \
    fi && \
    if [ -n "$APT_SECURITY_MIRROR" ]; then \
      sed -i "s|^URIs: http://deb.debian.org/debian-security$|URIs: $APT_SECURITY_MIRROR|" /etc/apt/sources.list.d/debian.sources; \
    fi && \
    apt-get update -o Acquire::Retries=3 && \
    apt-get install -y --no-install-recommends python3 g++ build-essential pkg-config libsecret-1-dev libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# From here on we use the least-privileged `node` user to run the backend.
USER node

# This should create the app dir as `node`.
# If it is instead created as `root` then the `tar` command below will fail: `can't create directory 'packages/': Permission denied`.
# If this occurs, then ensure BuildKit is enabled (`DOCKER_BUILDKIT=1`) so the app dir is correctly created as `node`.
WORKDIR /app

# Copy files needed by Yarn
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node .yarnrc.yml ./
COPY --chown=node:node backstage.json ./

# This switches many Node.js dependencies to production mode.
ENV NODE_ENV=production

# This disables node snapshot for Node 20 to work with the Scaffolder
ENV NODE_OPTIONS="--no-node-snapshot"

# Copy repo skeleton first, to avoid unnecessary docker cache invalidation.
# The skeleton contains the package.json of each package in the monorepo,
# and along with yarn.lock and the root package.json, that's enough to run yarn install.
COPY --chown=node:node yarn.lock package.json packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    export HTTP_PROXY="${HTTP_PROXY:-$http_proxy}" && \
    export HTTPS_PROXY="${HTTPS_PROXY:-$https_proxy}" && \
    export NO_PROXY="${NO_PROXY:-$no_proxy}" && \
    export http_proxy="$HTTP_PROXY" && \
    export https_proxy="$HTTPS_PROXY" && \
    export no_proxy="$NO_PROXY" && \
    export YARN_HTTP_PROXY="$HTTP_PROXY" && \
    export YARN_HTTPS_PROXY="$HTTPS_PROXY" && \
    yarn workspaces focus --all --production && rm -rf "$(yarn cache clean)"

# This will include the examples, if you don't need these simply remove this line
COPY --chown=node:node examples ./examples

# Then copy the rest of the backend bundle, along with any other files we might want.
COPY --chown=node:node packages/backend/dist/bundle.tar.gz app-config*.yaml ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
