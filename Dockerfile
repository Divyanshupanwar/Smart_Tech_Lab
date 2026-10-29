FROM node:22-bookworm-slim

WORKDIR /app

# Install root dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install backend dependencies
COPY src/package.json src/package-lock.json ./src/
RUN npm ci --prefix src

# Install frontend dependencies
COPY Frontend/frontend/package.json Frontend/frontend/package-lock.json ./Frontend/frontend/
RUN npm ci --prefix Frontend/frontend

# Copy application source code
COPY . .

# Build the React frontend
RUN npm run build

# Configure runtime
ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node", "src/index.js"]