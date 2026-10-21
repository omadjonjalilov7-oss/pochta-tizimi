#!/usr/bin/env bash
# Pochta/EDO — serverga o'rnatish (deploy) skripti
# Ishlatish:  cd /var/www/pochta && bash deploy.sh
# Biror qadam xato bersa — skript to'xtaydi (set -e).

set -e

echo "==> [1/9] git pull"
git pull

echo "==> [2/9] Backend paketlari (server)"
cd server
npm install --include=dev

echo "==> [3/9] Prisma migratsiya (accountant_marks + buxgalter roli)"
npx prisma migrate deploy

echo "==> [4/9] Prisma generate"
npx prisma generate

echo "==> [5/9] Backend build"
npm run build

echo "==> [6/9] Frontend paketlari (web)"
cd ../web
npm install --include=dev

echo "==> [7/9] Frontend build"
npm run build

echo "==> [8/9] Backend qayta ishga tushirish"
cd ..
pm2 restart pochta-backend --update-env

echo "==> [9/9] Frontend qayta ishga tushirish"
pm2 restart pochta-frontend --update-env

echo ""
echo "✅ TAYYOR! Endi admin paneldan kerakli xodimga 'Buxgalter' rolini bering."
