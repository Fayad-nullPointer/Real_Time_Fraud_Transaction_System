"""
core/security.py
================
Password hashing (Argon2 via pwdlib) and JWT token creation / verification.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from pwdlib import PasswordHash

SECRET_KEY = os.environ.get("JWT_SECRET", "change_me_in_production_please")
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24

# Recommended password hasher (Argon2)
password_hash = PasswordHash.recommended()


def hash_password(plain: str) -> str:
    """Hash a plaintext password."""
    return password_hash.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against its hash."""
    return password_hash.verify(plain, hashed)


def create_access_token(customer_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    payload = {
        "sub": str(customer_id),
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    """Returns customer_id or raises JWTError."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return int(payload["sub"])