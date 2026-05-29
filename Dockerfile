FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist/ dist/

RUN groupadd --system mcpgroup && useradd --system --gid mcpgroup --no-create-home mcpuser
RUN chown -R mcpuser:mcpgroup /app

USER mcpuser

ENTRYPOINT ["node", "dist/index.js"]
