# Monkstore - Monkey NFT Marketplace 🐒

A lightweight NFT marketplace for trading unique Monkey NFTs. Monkstore focuses on simplicity, performance, and a clean architecture while demonstrating a practical full‑stack setup.

---

# Overview

Monkstore is a minimal full‑stack web application that demonstrates how to build an NFT marketplace with a small and understandable technology stack.

Key ideas:

* Minimal backend using Node.js
* Fast frontend served by Nginx
* JWT authentication
* Clean architecture with PostgreSQL

The project is intended as a learning example and a base for further development.

---

# Tech Stack

## Frontend

* HTML5
* CSS3
* Vanilla JavaScript (ES6)
* Nginx for static file serving

## Backend

* Node.js 20
* Simple HTTP server
* PostgreSQL
* JWT authentication

## Infrastructure

* Nginx — web server and reverse proxy
* PM2 — Node.js process manager
* PostgreSQL — database

---

# Architecture

```
Browser
   │
   ▼
Nginx (Port 80)
   │
   ├── Static files → /frontend
   │
   └── /api → Node.js backend (PM2)
                │
                ▼
            PostgreSQL
```

Nginx serves the frontend and forwards `/api` requests to the Node backend.

---

# Deployment Guide (Nginx + PM2)

## 1. Install requirements

Example for Ubuntu / Debian:

```bash
sudo apt update
sudo apt install nginx postgresql nodejs npm
```

Install PM2:

```bash
sudo npm install -g pm2
```

---

## 2. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/monkstore.git
cd monkstore
```

---

## 3. Backend setup

```bash
cd backend
npm install
```

Create environment file:

```
backend/.env
```

Example:

```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/monkstore
JWT_SECRET=your-secret-key
FRONTEND_ORIGIN=*
```

---

## 4. Start backend with PM2

```bash
pm2 start server.js --name monkstore
pm2 save
pm2 startup
```

Check status:

```bash
pm2 status
```

Logs:

```bash
pm2 logs monkstore
```

---

## 5. Configure Nginx

Create a site configuration:

```
/etc/nginx/sites-available/monkstore
```

Example:

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/monkstore/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/monkstore /etc/nginx/sites-enabled/
```

Test configuration:

```bash
sudo nginx -t
```

Reload Nginx:

```bash
sudo systemctl reload nginx
```

---

## 6. Access the application

Open the server in your browser:

```
http://your-server-ip
```

API requests are automatically forwarded to the Node backend.

---

# Security Notes

* Never commit `.env`
* Use a strong `JWT_SECRET`
* Do not expose PostgreSQL publicly
* Use HTTPS in production

---

# Contributing

This project is intended for learning and experimentation. Feel free to fork and extend it.

---

# License

Open source — for educational and learning purposes.
