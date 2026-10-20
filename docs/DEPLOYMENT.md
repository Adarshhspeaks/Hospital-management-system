# Hospital Management System (HMS) — Production Deployment Guide

This guide covers production deployment options for the Hospital Management System across containerized environments, cloud hosting platforms, and traditional Linux servers.

---

## 1. Architecture Overview

In production, the application consists of three decoupled components:
- **Database**: PostgreSQL 16+ with persistent volume and relational integrity constraints.
- **Backend API**: Node.js / Express application listening on port `5000` with Helmet security headers, rate limiting, and JWT authentication.
- **Frontend Client**: React Single Page Application (SPA) compiled into static assets by Vite, served via Nginx (or cloud CDN) with client-side SPA routing and an API reverse proxy.

---

## 2. Option A: Containerized Deployment via Docker Compose (Recommended)

Docker Compose orchestrates PostgreSQL, the backend API, and the Nginx frontend reverse proxy with a single command.

### Prerequisites
- Docker Engine 24+ and Docker Compose v2 installed.

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Adarshhspeaks/Hospital-management-system.git
   cd Hospital-management-system
   ```

2. **Start all services**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify running containers**:
   ```bash
   docker compose ps
   ```
   You should see:
   - `hms-postgres` on port `5432` (healthy)
   - `hms-backend` on port `5000` (healthy)
   - `hms-frontend` on port `80` and `3000`

4. **Seed initial demo data (First-time setup)**:
   ```bash
   docker compose exec backend npm run db:seed
   ```

5. **Access the Application**:
   - Open your browser at: `http://localhost` (or `http://localhost:3000`)
   - Default demo logins:
     - **Admin**: `admin` / `admin123`
     - **Doctor**: `doctor1` / `doctor123`
     - **Receptionist**: `reception` / `reception123`
     - **Pharmacist**: `pharmacy` / `pharmacy123`

### Stopping & Managing Containers

- **Stop services**: `docker compose down`
- **Stop and remove data volumes**: `docker compose down -v`
- **View backend logs**: `docker compose logs -f backend`
- **View database logs**: `docker compose logs -f db`

---

## 3. Option B: 1-Click Cloud Deployment on Render

The repository includes a ready-to-use [`render.yaml`](file:///c:/Imp-Projects/hms-step2/hms/render.yaml) Blueprint that automatically provisions:
1. A managed PostgreSQL database (`hms-db`)
2. An Express Web Service (`hms-backend`) running on Node.js
3. A React Static Site (`hms-frontend`) with SPA rewrites

### Steps:
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com).
3. Navigate to **Blueprints** -> **New Blueprint Instance**.
4. Connect your `Hospital-management-system` repository.
5. Render reads `render.yaml` and will provision all three resources.
6. Once deployed, the frontend URL will automatically communicate with the backend API.

---

## 4. Option C: Hybrid Serverless (Vercel Frontend + Railway/Neon Backend)

### 1. Database (Neon or Supabase)
- Create a free PostgreSQL instance on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
- Copy the PostgreSQL connection URI:
  ```text
  postgresql://user:password@ep-xyz.region.neon.tech/hms?sslmode=require
  ```
- Run initial schema and seed:
  ```bash
  DATABASE_URL="<your-neon-url>" npm run db:init
  DATABASE_URL="<your-neon-url>" npm run db:seed
  ```

### 2. Backend (Railway or Render)
- Deploy the `backend/` directory as a Node.js web service.
- Set environment variables:
  - `PORT`: `5000`
  - `DATABASE_URL`: `<your-neon-url>`
  - `JWT_SECRET`: `<secure-random-32-byte-string>`
  - `CLIENT_ORIGIN`: `https://your-frontend.vercel.app`

### 3. Frontend (Vercel)
- Deploy the `frontend/` directory to [Vercel](https://vercel.com).
- Set Environment Variable:
  - `VITE_API_URL`: `https://your-backend-api.up.railway.app`
- The included [`vercel.json`](file:///c:/Imp-Projects/hms-step2/hms/frontend/vercel.json) automatically handles React Router path rewrites.

---

## 5. Option D: Traditional Linux Server (Ubuntu / Debian VPS)

### 1. System Packages & Node.js
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Configure PostgreSQL
```bash
sudo -u postgres psql
CREATE DATABASE hms;
CREATE USER hms_user WITH ENCRYPTED PASSWORD 'StrongPassword123';
GRANT ALL PRIVILEGES ON DATABASE hms TO hms_user;
\q
```

### 3. Backend Deployment with PM2
```bash
cd /var/www/hms/backend
npm ci --omit=dev
cp .env.example .env
# Edit .env with your PostgreSQL credentials and JWT_SECRET
nano .env

# Initialize database
npm run db:init
npm run db:seed

# Start service with PM2
pm2 start src/server.js --name "hms-api"
pm2 startup
pm2 save
```

### 4. Frontend Build
```bash
cd /var/www/hms/frontend
npm ci
npm run build
# Built files are in /var/www/hms/frontend/dist
```

### 5. Nginx Reverse Proxy Configuration
Create `/etc/nginx/sites-available/hms`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/hms/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
Enable site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/hms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `PORT` | No | `5000` | Port for Express HTTP server |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgres://user:pass@host:5432/hms`) |
| `JWT_SECRET` | **Yes** | — | Secret key used for HMAC-SHA256 signing of authentication tokens |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origins (can be comma-separated or `*`) |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `VITE_API_URL` | No | `""` (same-origin `/api`) | Base URL of backend API if deployed on a different domain |

---

## 7. Database Backups & Maintenance

### Creating Backups
```bash
# Docker Compose
docker compose exec db pg_dump -U postgres hms > backup_$(date +%Y%m%d).sql

# Native Linux
pg_dump -U hms_user -d hms > backup_$(date +%Y%m%d).sql
```

### Restoring Backups
```bash
# Docker Compose
cat backup.sql | docker compose exec -T db psql -U postgres hms

# Native Linux
psql -U hms_user -d hms < backup.sql
```
