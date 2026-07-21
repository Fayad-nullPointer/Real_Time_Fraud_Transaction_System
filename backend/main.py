"""
main.py  (backend entry point)
==============================
Run with:  uv run uvicorn backend.main:app --reload --port 8005
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.postgres import apply_schema, close_db_pool
from backend.core.pipeline_wrapper import load_pipeline, warm_start_pipeline
from backend.routers import auth, transactions, terminals, dashboard


from backend.routers.transactions import start_otp_expiry_sweeper, stop_otp_expiry_sweeper
from backend.db.redis_client import check_redis_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[startup] Clearing real-time CSV transactions log...")
    from backend.db.realtime_csv import clear_csv
    clear_csv()
    print("[startup] Checking Redis status...")
    await check_redis_connection()
    print("[startup] Applying DB schema...")
    await apply_schema()
    print("[startup] Loading ML pipeline...")
    load_pipeline()
    await warm_start_pipeline(hours=48)   # <-- new
    start_otp_expiry_sweeper()
    print("[startup] Ready.")
    yield
    stop_otp_expiry_sweeper()
    await close_db_pool()


app = FastAPI(
    title="Real-Time Fraud Detection API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8005",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(terminals.router)
app.include_router(dashboard.router)


@app.get("/")
async def root():
    return {"status": "Fraud Detection API running", "docs": "/docs"}
