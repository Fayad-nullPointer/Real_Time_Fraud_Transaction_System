"""
core/security.py
================
Password hashing (Argon2 via pwdlib) and JWT token creation / verification.

Tokens now carry the customer's `role` ("user" or "admin") alongside their
customer_id, so downstream dependencies (see routers/auth.py:
get_current_customer / get_current_admin) can gate access without an extra
DB round trip on every request.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

password_hash = PasswordHash((BcryptHasher(),))

SECRET_KEY = os.environ.get("JWT_SECRET", "change_me_in_production_please")
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24

# Recommended password hasher (Argon2)
# password_hash = PasswordHash.recommended()


def hash_password(plain: str) -> str:
    """Hash a plaintext password."""
    return password_hash.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against its hash."""
    return password_hash.verify(plain, hashed)


def create_access_token(customer_id: int, role: str = "user") -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    payload = {
        "sub": str(customer_id),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Returns {"customer_id": int, "role": str} or raises JWTError.

    NOTE: this used to return a bare int (customer_id). Any caller written
    against the old signature (e.g. `customer_id = decode_token(token)`)
    needs updating to `decode_token(token)["customer_id"]` — see
    routers/auth.py's get_current_customer / get_current_admin for the
    canonical way to consume this.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return {"customer_id": int(payload["sub"]), "role": payload.get("role", "user")}