from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from .config import JWT_SECRET, JWT_ALG, ACCESS_TTL_MIN, REFRESH_TTL_DAYS

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return pwd.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd.verify(raw, hashed)


def _make_token(claims: dict[str, Any], ttl: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        **claims,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "type": token_type,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def make_access_token(user: dict) -> str:
    return _make_token(
        {
            "sub": str(user["id"]),
            "role": user["role"],
            "email": user["email"],
            "name": user["name"],
            "city": user.get("city"),
            "category": user.get("category"),
        },
        timedelta(minutes=ACCESS_TTL_MIN),
        "access",
    )


def make_refresh_token(user: dict) -> str:
    return _make_token({"sub": str(user["id"]), "role": user["role"]},
                       timedelta(days=REFRESH_TTL_DAYS), "refresh")


def decode(token: str, expected_type: str | None = None) -> dict:
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as e:
        raise ValueError(f"invalid token: {e}") from e
    if expected_type and claims.get("type") != expected_type:
        raise ValueError(f"expected {expected_type} token, got {claims.get('type')}")
    return claims
