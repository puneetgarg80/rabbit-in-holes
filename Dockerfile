# Stage 1: Build the React client
FROM node:18-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm i
COPY client/ ./
RUN npm run build

# Stage 2: Build the Node server
FROM node:18-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm i
COPY server/ ./
RUN npm run build

# Stage 3: Final Production Image
FROM node:18-alpine
WORKDIR /app

# Copy server build and dependencies
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/package*.json ./server/
COPY --from=server-build /app/server/node_modules ./server/node_modules

# Copy client build to server's public folder
COPY --from=client-build /app/client/dist ./server/public

# Set working directory to server
WORKDIR /app/server

# Environment variables
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]