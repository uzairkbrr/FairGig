import os

JWT_SECRET = os.getenv("JWT_SECRET", "dev-fairgig-secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "60"))
REFRESH_TTL_DAYS = int(os.getenv("REFRESH_TTL_DAYS", "14"))
AUTH_DB = os.getenv("AUTH_DB", "auth.db")

ROLES = {"worker", "verifier", "advocate"}
