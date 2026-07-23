#!/usr/bin/env bash
# ==============================================================================
# AWS EC2 Automated Deployment Script for Real-Time Fraud Detection System
# ==============================================================================

set -e

echo "🚀 Starting AWS EC2 Deployment Setup for Fraud Detection System..."

# 1. Update and install basic dependencies
echo "📦 Updating system packages..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

# 2. Add 2GB Swap space (Crucial for preventing OOM errors during docker builds)
if [ ! -f /swapfile ]; then
    echo "🧠 Creating 2GB swap file..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap memory enabled."
else
    echo "ℹ️ Swap file already exists."
fi

# 3. Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker installed successfully."
else
    echo "ℹ️ Docker is already installed."
fi

# Ensure docker daemon is running
sudo systemctl enable docker
sudo systemctl start docker

# 4. Check for .env file
if [ ! -f .env ]; then
    echo "⚙️ Creating .env configuration file..."
    cat <<EOT > .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=fraud_db
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/fraud_db
REDIS_URL=redis://redis:6379
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "super_secret_fraud_key_2026")
VITE_API_URL=
VITE_API_HOST=
VITE_WS_URL=
EOT
    echo "✅ .env file created."
fi

# 5. Build and run Docker containers
echo "🔨 Building and starting Docker containers (PostgreSQL, Redis, Backend, Frontend)..."
sudo docker compose up --build -d

echo ""
echo "🎉 Deployment Process Initiated!"
echo "--------------------------------------------------------"
echo "Check container status with:  sudo docker compose ps"
echo "View container logs with:    sudo docker compose logs -f"
echo "--------------------------------------------------------"
echo "Frontend UI:  http://<YOUR-EC2-PUBLIC-IP>:3000"
echo "Backend API:  http://<YOUR-EC2-PUBLIC-IP>:8005/docs"
echo "--------------------------------------------------------"
