from fastapi import Header, HTTPException
from jose import jwt, JWTError
from .config import JWT_SECRET, JWT_ALG


def _decode(token: str) -> dict:
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as e:
        raise HTTPException(401, f"invalid token: {e}") from e
    if claims.get("type") != "access":
        raise HTTPException(401, "expected access token")
    return claims


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    return _decode(authorization.split(" ", 1)[1])


def require_role(*roles: str):
    def _dep(user: dict) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(403, f"requires role in {roles}")
        return user
    return _dep
