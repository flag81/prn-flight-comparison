FROM mcr.microsoft.com/playwright:v1.62.0-jammy AS base
WORKDIR /app

# Chromium is already installed in this base image; skip re-downloading it.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy package files and install ALL dependencies (including devDependencies needed for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy rest of application code and run Next.js build
COPY . .
RUN npm run build

# Switch to production environment for runtime
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]