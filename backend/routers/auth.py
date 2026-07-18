"""
routers/auth.py
===============
POST /api/auth/register  – create a new customer account
POST /api/auth/login     – authenticate and receive JWT
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator

from backend.db.postgres import get_db_pool
from backend.core.security import hash_password, verify_password, create_access_token
from backend.core.geolocation import resolve_location_from_ip

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    phone_number: str
    password: str
    full_name: str | None = None
    lat: float | None = None
    lon: float | None = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("+") or len(v) < 8:
            raise ValueError("phone_number must be in international format (e.g. +201012345678)")
        return v


class LoginRequest(BaseModel):
    customer_id: int
    password: str


class AuthResponse(BaseModel):
    customer_id: int
    phone_number: str
    full_name: str | None
    token: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, request: Request):
    """Register a new customer. Customer ID is auto-incremented."""
    pool = await get_db_pool()

    # Resolve location
    lat, lon = body.lat, body.lon
    if lat is None or lon is None:
        client_ip = request.client.host if request.client else "127.0.0.1"
        lat, lon = await resolve_location_from_ip(client_ip)
    ip_addr = request.client.host if request.client else None

    pw_hash = hash_password(body.password)

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO customers (phone_number, password_hash, full_name,
                                       registration_lat, registration_lon, registration_ip)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING customer_id, phone_number, full_name
                """,
                body.phone_number, pw_hash, body.full_name, lat, lon, ip_addr,
            )
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise HTTPException(status_code=409, detail="Phone number already registered.")
        raise HTTPException(status_code=500, detail=str(exc))

    token = create_access_token(row["customer_id"])
    return AuthResponse(
        customer_id=row["customer_id"],
        phone_number=row["phone_number"],
        full_name=row["full_name"],
        token=token,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """Login with customer_id (card number) and password."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT customer_id, phone_number, full_name, password_hash FROM customers WHERE customer_id = $1",
            body.customer_id,
        )
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    token = create_access_token(row["customer_id"])
    return AuthResponse(
        customer_id=row["customer_id"],
        phone_number=row["phone_number"],
        full_name=row["full_name"],
        token=token,
    )
