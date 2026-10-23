FROM oven/bun:1.4.3 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile --ignore-scripts
FROM oven/bun:1.4.3 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts && bun run build && rm -rf /app/node_modules
FROM oven/bun:1.4.3
WORKDIR /app
COPY --from=build --chown=bun:bun /app /app
COPY --from=dependencies --chown=bun:bun /app/node_modules /app/node_modules
RUN mkdir -p /data && chown bun:bun /data
ENV CADENCE_PERSONAL_DIRECTORY=/data
VOLUME /data
USER bun
EXPOSE 9915
CMD ["bun", "next/apps/personal/server.ts"]
