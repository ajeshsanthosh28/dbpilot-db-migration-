# DBPilot — DevOps Database Control Panel

A full-stack web application for managing PostgreSQL, MySQL, and ClickHouse databases with monitoring, SQL editor, one-click restore, and cross-database migration.

---

## Quick start

### 1. Prerequisites
- Docker & Docker Compose installed
- Ports 80 and 3000 available

### 2. Configure environment
```bash
cp .env .env.local
# Edit .env and set a strong SECRET_KEY
```

### 3. Start all services
```bash
docker compose up --build -d
```

### 4. Create your first user
```bash
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","username":"admin","password":"yourpassword"}'
```

### 5. Open the app
Visit **http://localhost** and sign in.

---

## Services

| Service         | URL                        | Description                    |
|-----------------|----------------------------|--------------------------------|
| Frontend        | http://localhost            | React UI via Nginx             |
| Backend API     | http://localhost/api        | FastAPI REST API               |
| API Docs        | http://localhost/api/docs   | Swagger UI                     |
| Flower          | http://localhost/flower     | Celery task monitor            |

---

## Features

### DB Monitor
- Real-time CPU, memory, disk metrics (auto-refreshes every 10s)
- Per-database metrics: active connections, DB size, slow queries
- Historical CPU/memory charts

### SQL Query Editor
- Monaco Editor (VS Code engine) with SQL syntax highlighting
- Schema browser — explore tables and columns
- Sortable results table with CSV export
- Ctrl+Enter to run queries

### One-click Restore
- Drag & drop .sql, .dump, .pgdump files
- Auto-detects file type and chooses correct tool (psql / pg_restore / mysql)
- Background Celery task with real-time progress bar
- Supports PostgreSQL and MySQL

### Multi-DB Migration
- Migrate schema and data between PostgreSQL ↔ MySQL
- Automatic data type mapping with compatibility warnings
- Background task with step-by-step progress tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (port 80)                   │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   Frontend               Backend
   React/Vite            FastAPI
   Tailwind            (port 8000)
   Monaco Editor            │
                    ┌────────┼──────────┐
                    │        │          │
               Celery    PostgreSQL    Redis
               Worker    (meta DB)   (broker)
```

---

## Development (local)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## Adding a ClickHouse connection

ClickHouse supports query execution and schema browsing. Use port **9000** (native protocol).

Restore for ClickHouse uses the native `clickhouse-client` — ensure it's available in your environment.

---

## Security notes

- All database passwords are encrypted with Fernet (AES-128) before storage
- JWT tokens expire after 60 minutes (configurable in `.env`)
- Set `SECRET_KEY` to a strong random string in production
- For production, add HTTPS via Let's Encrypt / Certbot to the Nginx config
