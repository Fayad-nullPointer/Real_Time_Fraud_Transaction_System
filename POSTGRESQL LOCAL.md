# Running PostgreSQL Locally for the Fraud Detection System

## Overview

Instead of running PostgreSQL inside Docker, you can install PostgreSQL directly on your operating system.

The Fraud Detection System only requires a PostgreSQL server with:

- **Database:** `fraud_db`
- **Username:** `postgres`
- **Password:** `postgres` (or your own password)
- **Default port:** `5432`

---

## Step 1: Install PostgreSQL

Download PostgreSQL from the official website:

👉 https://www.postgresql.org/download/

During installation, select:
- Install PostgreSQL Server
- Install pgAdmin 4
- Install Command Line Tools

When prompted:

- **Username:** `postgres`
- **Password:** `postgres` (or choose another password if you prefer)
- **Port:** leave as `5432`

Finish the installation.

---

## Step 2: Verify PostgreSQL is Running

1. Open **Services** on Windows.
2. Look for `postgresql-x64-17` (or your installed version).
3. Its status should be **Running**.

If it isn't running: right-click it → **Start**.

---

## Step 3: Open pgAdmin

Launch **pgAdmin 4** and connect using the password you selected during installation.

---

## Step 4: Create the Database

Inside pgAdmin:

```
Servers
  └── PostgreSQL
        └── Databases
```

Right-click **Databases** → **Create** → **Database**.

- **Database name:** `fraud_db`
- **Owner:** `postgres`

Save.

---

## Step 5: Configure the Application

Open the project's `.env` file.

Replace the Docker connection string:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/fraud_db
```

with:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fraud_db
```

If you selected another password:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fraud_db
```

---

## Step 6: Test the Connection

Open Command Prompt and run:

```bash
psql -U postgres -d fraud_db
```

If PostgreSQL asks for a password, enter `postgres`.

You should see:

```
fraud_db=#
```

Verify the connection:

```sql
SELECT version();
```

Example output:

```
PostgreSQL 17.x
```

Exit:

```sql
\q
```

---

## Step 7: Install Project Dependencies

From the project root:

```bash
uv sync
```

---

## Step 8: Seed the Database

```bash
uv run python -m backend.db.seed
```

This will create and populate the required terminal records.

---

## Step 9: Start the Backend

```bash
uv run uvicorn backend.main:app --reload --port 8008
```

During startup the backend will:
- Connect to PostgreSQL
- Automatically create tables
- Load the ML pipeline
- Start the REST API

Swagger UI: http://localhost:8008/docs

---

## Step 10: Open the Frontends

- **Dashboard:** `frontend/dashboard/index.html`
- **User Portal:** `frontend/user_portal/index.html`

You have three ways to open these — pick whichever is easiest for you.

### Option A: Open the file directly in a browser

Just double-click `index.html`, or drag it into your browser window. This works, but some browsers restrict features (like `fetch`/WebSocket calls) more strictly on `file://` pages than on pages served over `http://`, so Option B or C is recommended if you run into issues.

### Option B: Serve with Python's built-in server

```bash
# Dashboard
cd frontend/dashboard
python -m http.server 5500
```

```bash
# User Portal
cd frontend/user_portal
python -m http.server 5501
```

Then open:
- Dashboard: http://localhost:5500
- User Portal: http://localhost:5501

### Option C: Serve with the VS Code "Live Server" extension (recommended)

Live Server spins up a local dev server with auto-reload, so it's the most convenient option while developing.

**If you already have Live Server installed:**

1. Open the project folder in VS Code.
2. In the Explorer panel, right-click `frontend/dashboard/index.html` (or `frontend/user_portal/index.html`).
3. Select **"Open with Live Server."**
4. Your browser will open automatically, typically at `http://127.0.0.1:5500`.
5. Repeat for the other `index.html` file — Live Server will open it on the next available port (e.g. `5501`) if the first one is already in use.

**If Live Server is not installed yet:**

1. Open VS Code.
2. Click the **Extensions** icon in the left sidebar (or press `Ctrl+Shift+X`).
3. In the search box, type `Live Server`.
4. Find the extension published by **Ritwick Dey** (the most popular one, usually the top result).
5. Click **Install**.
6. Once installed, reload VS Code if prompted.
7. Right-click any `index.html` file in the Explorer panel and select **"Open with Live Server"** as described above.

> 💡 Tip: You can also click **"Go Live"** in the blue status bar at the bottom-right of VS Code to launch Live Server for the currently open HTML file.

---

## Step 11: Register an Account

Use the User Portal, or register via PowerShell:

```powershell
Invoke-RestMethod `
    -Uri "http://localhost:8008/api/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"phone_number":"+201012345678","password":"123456789"}'
```

The response contains:

```json
{
  "customer_id": 1,
  "role": "user",
  "token": "..."
}
```

---

## Step 12: Promote the User to Admin

Open pgAdmin, open the Query Tool for `fraud_db`, and run:

```sql
UPDATE customers
SET role = 'admin'
WHERE customer_id = 1;
```

Verify:

```sql
SELECT customer_id,
       phone_number,
       role
FROM customers;
```

Example:

```
 customer_id | phone_number  | role
-------------+---------------+-------
1            | +201012345678 | admin
```

---

## Step 13: Login

Login from `frontend/user_portal` using:

- Customer ID
- Password

You'll now be able to access the admin dashboard.

---

## Common Commands

| Action | Command |
|---|---|
| Connect using psql | `psql -U postgres -d fraud_db` |
| List databases | `\l` |
| Connect to another database | `\c fraud_db` |
| List tables | `\dt` |
| Describe a table | `\d customers` |
| Exit PostgreSQL | `\q` |

---

## Updated Environment Variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/fraud_db` |
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_SECRET` | Your JWT secret |
| `TWILIO_ACCOUNT_SID` | Twilio SID |
| `TWILIO_AUTH_TOKEN` | Twilio Token |
| `TWILIO_WHATSAPP_NUMBER` | WhatsApp Sandbox Number |

---

## Summary of Changes from the Docker Setup

| Docker Setup | Local PostgreSQL Setup |
|---|---|
| Install Docker | Install PostgreSQL |
| Run `docker run ...` | Install via PostgreSQL installer |
| Port 5433 | Port 5432 (default) |
| Database auto-created by container | Create `fraud_db` once in pgAdmin or with SQL |
| `docker exec` to access PostgreSQL | Use pgAdmin or `psql` directly |
| `docker start`/`stop` | PostgreSQL runs as a Windows service |