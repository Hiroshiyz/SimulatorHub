# Stage 1: Build the client React application
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build the NestJS application
FROM node:20-alpine AS app-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
# Generate Prisma Client (uses prisma from devDependencies)
RUN npx prisma generate
COPY . .
# Copy static files built in Stage 1 to /app/public
COPY --from=client-builder /app/public ./public
RUN npm run build

# Stage 3: Clean runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# Install prisma globally to support running migration deploy at startup
RUN npm install -g prisma@7.8.0
COPY prisma ./prisma/
# Copy Prisma configuration file for runtime migrations
COPY --from=app-builder /app/prisma.config.js ./
# Copy the built NestJS code and the static client files
COPY --from=app-builder /app/dist ./dist
COPY --from=app-builder /app/public ./public
# Copy the generated Prisma Client files from builder stage
COPY --from=app-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=app-builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3030
# Run migrations and seed data before starting the NestJS application
CMD ["sh", "-c", "prisma migrate deploy && node prisma/seed.js && node dist/main.js"]
