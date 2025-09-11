# ---------- builder ----------
FROM node:24-alpine3.21 AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:24-alpine3.21 AS runner

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built output
COPY --from=builder /app/dist ./dist

USER node

ENV NODE_ENV=production
ENV PORT=7464

EXPOSE 7464

# Run compiled JS
CMD ["node", "dist/index.js"]
