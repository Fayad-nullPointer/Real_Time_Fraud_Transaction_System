# Running PostgreSQL in Docker for the Fraud Detection System

## Overview

This guide explains how to create and run a dedicated PostgreSQL Docker container for the Fraud Detection System without interfering with any existing PostgreSQL instances running on the machine. Since another PostgreSQL container was already using port **5432**, the new container is exposed on **port 5433**.

---

# Step 1: Configure the Application

Before starting PostgreSQL, configure the application by adding the database connection string to the project's `.env` file.

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/fraud_db
```

### Connection Details

| Parameter | Value     |
| --------- | --------- |
| Host      | localhost |
| Port      | 5433      |
| Database  | fraud_db  |
| Username  | postgres  |
| Password  | postgres  |

---

# Step 2: Start a Dedicated PostgreSQL Container

Run the following command from PowerShell:

```powershell
docker run -d `
  --name fraud-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=fraud_db `
  -p 5433:5432 `
  postgres:17
```

### Explanation

* `--name fraud-postgres`

  * Assigns a name to the container.

* `POSTGRES_USER=postgres`

  * Creates the PostgreSQL administrator user.

* `POSTGRES_PASSWORD=postgres`

  * Sets the password for the administrator.

* `POSTGRES_DB=fraud_db`

  * Automatically creates the database named **fraud_db** when the container starts for the first time.

* `-p 5433:5432`

  * Maps host port **5433** to PostgreSQL's internal port **5432**.

This configuration allows the new PostgreSQL instance to coexist with another PostgreSQL container already using port **5432**.

---

# Step 3: Verify the Container

Verify that the container is running successfully.

```bash
docker ps
```

Example output:

```text
CONTAINER ID   IMAGE         PORTS
xxxxxxxxxxxx   postgres:17   0.0.0.0:5433->5432/tcp
```

If the container appears in the list with status **Up**, PostgreSQL has started successfully.

---

# Step 4: Enter the Container

Open a shell inside the running PostgreSQL container.

```bash
docker exec -it fraud-postgres bash
```

If the image does not contain **bash**, use:

```bash
docker exec -it fraud-postgres sh
```

---

# Step 5: Access PostgreSQL

Once inside the container, connect to PostgreSQL.

```bash
psql -U postgres
```

You should see the PostgreSQL prompt:

```text
fraud_db=#
```

Because the environment variable

```text
POSTGRES_DB=fraud_db
```

was provided during container creation, the database has already been created automatically.

---

# Step 6: Verify the Database

List all databases.

```sql
\l
```

The output should include:

```text
fraud_db
postgres
template0
template1
```

Connect to the project database if needed:

```sql
\c fraud_db
```

---

# Step 7: Exit PostgreSQL

Leave the PostgreSQL console.

```sql
\q
```

Then exit the container shell.

```bash
exit
```

---

# Step 8: Connect the Application

The Fraud Detection System can now connect using the following configuration.

### Connection Parameters

| Property | Value     |
| -------- | --------- |
| Host     | localhost |
| Port     | 5433      |
| Database | fraud_db  |
| Username | postgres  |
| Password | postgres  |

Connection URL:

```text
postgresql://postgres:postgres@localhost:5433/fraud_db
```

The application should use this URL through the `DATABASE_URL` environment variable defined in the `.env` file.

---

# Docker Commands Reference

### Show running containers

```bash
docker ps
```

### Show all containers

```bash
docker ps -a
```

### Stop the PostgreSQL container

```bash
docker stop fraud-postgres
```

### Start the PostgreSQL container again

```bash
docker start fraud-postgres
```

### Restart the PostgreSQL container

```bash
docker restart fraud-postgres
```

### View container logs

```bash
docker logs fraud-postgres
```

### Remove the container

```bash
docker stop fraud-postgres
docker rm fraud-postgres
```

---

# Summary

A dedicated PostgreSQL container was created for the Fraud Detection System using Docker. Because another PostgreSQL instance was already occupying the default host port (5432), the new container was mapped to host port **5433**. The database **fraud_db** is automatically initialized on first startup, and the application connects to it using the `DATABASE_URL` defined in the `.env` file. This setup provides complete isolation from other PostgreSQL instances while maintaining a straightforward development workflow.
