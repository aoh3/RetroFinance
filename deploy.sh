#!/usr/bin/env bash
set -e

# This script automates deployment on an Ubuntu DigitalOcean droplet.
# Usage: curl -sSL <repo_url>/deploy.sh | bash

# Update and install prerequisites
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential ufw

# Open ports for HTTP (80) and backend API (4000)
echo "Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 4000/tcp
sudo ufw --force enable

# Install Node.js (v18)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# Clone or update the repo
if [ -d RetroFinance ]; then
  echo "Updating existing repository..."
  cd RetroFinance && git pull
else
  echo "Cloning repository..."
  git clone https://github.com/aoh3/RetroFinance.git
  cd RetroFinance
fi

# Install and build backend
 echo "Installing backend dependencies..."
 cd backend
 export PORT=4000
 npm install --production

 # Start backend with PM2
 echo "Starting backend service..."
 pm2 delete retro-backend || true
 pm2 start server.js --name retro-backend

 # Install and build client
 echo "Installing client dependencies..."
 cd ../client
 npm install
 npm run build

 # Serve client with PM2
 # using `serve` package to host static files
 echo "Installing and starting frontend service..."
 sudo npm install -g serve
 pm2 delete retro-frontend || true
 pm2 start serve --name retro-frontend -- -s build -l 80

 # Save PM2 process list and enable startup on reboot
 echo "Configuring PM2 startup..."
 pm2 save
 pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))

 # Show status
 echo "Deployment complete."
 echo "Public IP: $(curl -s http://ifconfig.co)"
 pm2 ls