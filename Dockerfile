FROM mcr.microsoft.com/playwright:v1.62.0-jammy AS base
WORKDIR /app

# Chromium is already installed in this base image; skip re-downloading it.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]