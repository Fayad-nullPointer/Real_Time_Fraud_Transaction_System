# FraudShield — How to Run

## 1. Setup Database

### PostgreSQL
```bash
# Create the database (first time only)
psql -U postgres -c "CREATE DATABASE fraud_db;"
```

### Update .env
Edit `.env` in the project root and set your PostgreSQL password:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fraud_db
```

---

## 2. Install Dependencies

```bash
uv sync
```

---

## 3. Seed the Terminals

Loads terminal lat/lon from the trained feature engineer (or generates 100 mock Cairo terminals):

```bash
uv run python -m backend.db.seed
```

---

## 4. Start the Backend API

```bash
uv run uvicorn backend.main:app --reload --port 8008
```

The API will:
- Apply the PostgreSQL schema automatically
- Load the ML pipeline (may take ~30s if rebuilding feature engineer)
- Expose: http://localhost:8008/docs (Swagger UI)

---

## 5. Open the Frontends

Simply open in your browser (no build step needed):

### Admin Dashboard
```
frontend/dashboard/index.html
```

### User Portal
```
frontend/user_portal/index.html
```

Or serve them with Python:
```bash
cd frontend/dashboard && python -m http.server 5500
cd frontend/user_portal && python -m http.server 5501
```

---

## 6. Seed Terminals (optional shortcut)

If you just want to run the seed after the server is up:

```bash
uv run python -m backend.db.seed
```

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (default: `redis://localhost:6379`) |
| `JWT_SECRET` | Secret key for JWT tokens — change in production! |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp Sandbox number |
