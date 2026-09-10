#!/bin/bash
set -e

GITHUB_TOKEN="${1:-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}"
REPO_URL="https://${GITHUB_TOKEN}@github.com/fast-order-eg/einasouq.bird-ads.com.git"
APP_DIR="/home/bird-ads.com/einasouq.bird-ads.com"

echo "🚀 Updating einasouq.bird-ads.com from GitHub..."
cd "${APP_DIR}"
git fetch "${REPO_URL}" main
git reset --hard FETCH_HEAD

echo "📦 Installing production dependencies..."
npm install --production=false

echo "⚙️ Generating Prisma Client..."
npx prisma generate

echo "🏗️ Building Next.js production build..."
npm run build

echo "🔄 Zero-Downtime Reloading PM2 process einasouq-app..."
pm2 reload einasouq-app --update-env || pm2 restart einasouq-app --update-env

echo "🎉 Deployment completed successfully without downtime!"
