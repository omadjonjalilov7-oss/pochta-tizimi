#!/bin/bash

set -e

echo "🚀 Pochta EDO - Ubuntu Server Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Update system
echo -e "${BLUE}1️⃣  Sistemani yangilash...${NC}"
sudo apt update
sudo apt upgrade -y

# 2. Install PostgreSQL
echo -e "${BLUE}2️⃣  PostgreSQL o'rnatish...${NC}"
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. Install Node.js
echo -e "${BLUE}3️⃣  Node.js 18 o'rnatish...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install other tools
echo -e "${BLUE}4️⃣  Qo'shimcha paketlar o'rnatish...${NC}"
sudo apt install -y git nginx curl wget

# 5. Create app directory
echo -e "${BLUE}5️⃣  Application direktoriyasini yaratish...${NC}"
sudo mkdir -p /var/www/pochta
sudo chown -R $USER:$USER /var/www/pochta

# 6. Clone or copy repository
echo -e "${BLUE}6️⃣  Code-ni joylashtirish...${NC}"
echo "🔗 Git repository URL kiriting (yoki Enter bossan skip qilsin):"
read REPO_URL

if [ ! -z "$REPO_URL" ]; then
    cd /var/www/pochta
    git clone "$REPO_URL" .
else
    echo "⚠️  Git URL kiritilmadi. Kod qo'lda nusxalayin."
fi

# 7. Install Node dependencies
echo -e "${BLUE}7️⃣  NPM dependencieslarini o'rnatish...${NC}"
cd /var/www/pochta/server
npm install
npm run build

cd /var/www/pochta/web
npm install
npm run build

# 8. Create PostgreSQL database
echo -e "${BLUE}8️⃣  PostgreSQL database yaratish...${NC}"
sudo -u postgres psql << EOF
CREATE DATABASE pochta_prod;
CREATE USER pochta_user WITH PASSWORD 'pochta_secure_password_123';
ALTER ROLE pochta_user SET client_encoding TO 'utf8';
ALTER ROLE pochta_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE pochta_user SET default_transaction_deferrable TO on;
ALTER ROLE pochta_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE pochta_prod TO pochta_user;
EOF

# 9. Create .env file
echo -e "${BLUE}9️⃣  .env fayli yaratish...${NC}"
cat > /var/www/pochta/server/.env << EOF
# Database
DATABASE_URL="postgresql://pochta_user:pochta_secure_password_123@localhost:5432/pochta_prod"

# JWT
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=12h
JWT_REMEMBER_EXPIRES_IN=30d

# IMAP
EXTERNAL_MAIL_IMAP_HOST=imap.gmail.com
EXTERNAL_MAIL_IMAP_PORT=993

# Login security
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15

# Server
NODE_ENV=production
PORT=7000
EOF

# 10. Run Prisma migrations
echo -e "${BLUE}🔟 Database migrations...${NC}"
cd /var/www/pochta/server
npx prisma generate
npx prisma migrate deploy

# 11. Create systemd service for backend
echo -e "${BLUE}1️⃣1️⃣ Systemd service o'rnatish...${NC}"
sudo tee /etc/systemd/system/pochta-api.service > /dev/null << EOF
[Unit]
Description=Pochta API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/var/www/pochta/server
ExecStart=/usr/bin/node /var/www/pochta/server/dist/main.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 12. Configure Nginx
echo -e "${BLUE}1️⃣2️⃣ Nginx sozlash...${NC}"
sudo tee /etc/nginx/sites-available/pochta > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        root /var/www/pochta/web/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:7000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/pochta /etc/nginx/sites-enabled/pochta
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# 13. Start services
echo -e "${BLUE}1️⃣3️⃣ Xizmatlarni ishga tushirish...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable pochta-api
sudo systemctl start pochta-api

sudo systemctl restart nginx
sudo systemctl enable nginx

# 14. Summary
echo ""
echo -e "${GREEN}✅ TAYYORLIK TUGADI!${NC}"
echo ""
echo "📊 Server ma'lumotlari:"
echo "  🌐 Frontend: http://192.168.100.252"
echo "  🔌 Backend API: http://192.168.100.252/api"
echo "  🗄️  Database: pochta_prod"
echo ""
echo "📝 Admin hissobi:"
echo "  Login: admin"
echo "  Parol: (databaseda mavjud)"
echo ""
echo "📋 Kerakli qo'shimcha sozlamalar:"
echo "  1. Admin parolini o'zgartir"
echo "  2. External mail servers sozla"
echo "  3. SSL sertifikat qo'sh (HTTPS)"
echo ""
echo "🔍 Log ko'rish:"
echo "  sudo journalctl -u pochta-api -f"
echo ""
