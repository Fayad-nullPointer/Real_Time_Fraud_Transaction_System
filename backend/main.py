"""
main.py  (backend entry point)
==============================
Run with:  uv run uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.postgres import apply_schema, close_db_pool
from backend.core.pipeline_wrapper import load_pipeline
from backend.routers import auth, transactions, terminals, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── startup ──────────────────────────────────────────────────────────────
    print("[startup] Applying DB schema...")
    await apply_schema()
    print("[startup] Loading ML pipeline...")
    load_pipeline()
    print("[startup] Ready.")
    yield
    # ── shutdown ─────────────────────────────────────────────────────────────
    await close_db_pool()


app = FastAPI(
    title="Real-Time Fraud Detection API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict to frontend origin in production
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
