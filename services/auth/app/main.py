from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from .config import ROLES
from .db import init_db, connect
from .seed import seed_if_empty
from .security import (
    hash_password, verify_password,
    make_access_token, make_refresh_token, decode,
)

app = FastAPI(title="FairGig Auth", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()
    n = seed_if_empty()
    if n:
        print(f"[auth] seeded {n} users")


# ------------ schemas ------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: str
    city: str | None = None
    category: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "Bearer"
    user: dict


# ------------ helpers ------------
def _row_to_user(row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "city": row["city"],
        "category": row["category"],
    }


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        claims = decode(token, expected_type="access")
    except ValueError as e:
        raise HTTPException(401, str(e)) from e
    return claims


# ------------ routes ------------
@app.get("/healthz")
def health():
    return {"status": "ok", "service": "auth"}


@app.post("/auth/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn):
    if body.role not in ROLES:
        raise HTTPException(400, f"role must be one of {sorted(ROLES)}")
    with connect() as c:
        exists = c.execute("SELECT 1 FROM users WHERE email=?", (body.email,)).fetchone()
        if exists:
            raise HTTPException(409, "email already registered")
        cur = c.execute(
            "INSERT INTO users(email,password,role,name,city,category) VALUES (?,?,?,?,?,?)",
            (body.email, hash_password(body.password), body.role, body.name, body.city, body.category),
        )
        row = c.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    user = _row_to_user(row)
    return TokenOut(
        access_token=make_access_token(user),
        refresh_token=make_refresh_token(user),
        user=user,
    )


@app.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn):
    with connect() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
    if not row or not verify_password(body.password, row["password"]):
        raise HTTPException(401, "invalid credentials")
    user = _row_to_user(row)
    return TokenOut(
        access_token=make_access_token(user),
        refresh_token=make_refresh_token(user),
        user=user,
    )


@app.post("/auth/refresh", response_model=TokenOut)
def refresh(body: RefreshIn):
    try:
        claims = decode(body.refresh_token, expected_type="refresh")
    except ValueError as e:
        raise HTTPException(401, str(e)) from e
    with connect() as c:
        row = c.execute("SELECT * FROM users WHERE id=?", (int(claims["sub"]),)).fetchone()
    if not row:
        raise HTTPException(401, "user no longer exists")
    user = _row_to_user(row)
    return TokenOut(access_token=make_access_token(user), user=user)


@app.get("/auth/me")
def me(claims: dict = Depends(current_user)):
    with connect() as c:
        row = c.execute("SELECT * FROM users WHERE id=?", (int(claims["sub"]),)).fetchone()
    if not row:
        raise HTTPException(404, "user not found")
    return _row_to_user(row)


@app.get("/auth/users/{user_id}")
def get_user(user_id: int):
    with connect() as c:
        row = c.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "user not found")
    return _row_to_user(row)


@app.get("/auth/users")
def list_users(role: str | None = None):
    q = "SELECT * FROM users"
    params: tuple = ()
    if role:
        q += " WHERE role=?"
        params = (role,)
    with connect() as c:
        rows = c.execute(q, params).fetchall()
    return [_row_to_user(r) for r in rows]
