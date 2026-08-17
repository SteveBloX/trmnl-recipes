# syntax=docker/dockerfile:1

# Debian rather than Alpine: Playwright ships no musl builds of Chromium, and
# `playwright install --with-deps` installs its system libraries through apt.
ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime state lives on a volume: the scraped caches and the proverb counters.
# Without this the app would write inside the image layer and lose everything
# on redeploy — and `astrobin.json`, refreshed only once a day, would stay
# missing for hours.
ENV DATA_DIR=/app/data

# Installed as root, so the default cache would land in /root and be unreadable
# once the process drops to the unprivileged user.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Dependency layers first: they are the slow ones, and they only need to be
# rebuilt when the manifests change rather than on every code edit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Chromium alone — the code never launches Firefox or WebKit, and each extra
# browser costs a few hundred megabytes. `--with-deps` pulls the shared
# libraries a headless browser needs on a slim image.
RUN npx playwright install --with-deps chromium \
  && chmod -R a+rX /ms-playwright \
  && rm -rf /var/lib/apt/lists/*

# --chown rather than a bare COPY: the build context carries whatever mode the
# checkout happened to have, and a directory that arrives as 0700 owned by root
# is unreadable once the process drops to `node` — the app then dies on its
# first import with a misleading "Cannot find module".
COPY --chown=node:node . .

RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

USER node
EXPOSE 4200

# Deliberately not /api/health: that endpoint runs every check, launching a
# browser and hitting external APIs — far too heavy to repeat every 30 seconds,
# and it would report the app as dead whenever a third-party service is down.
# Shakespeare quotes are served from a bundled JSON file, so a 200 here proves
# the process is up and routing without depending on anything external.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4200/api/shakespeare-quotes').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The server runs straight from TypeScript through tsx, which is why tsx is a
# production dependency rather than a build tool here.
CMD ["npx", "tsx", "index.ts"]
