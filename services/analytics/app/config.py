import os

EARNINGS_URL  = os.getenv("EARNINGS_URL",  "http://localhost:4002")
GRIEVANCE_URL = os.getenv("GRIEVANCE_URL", "http://localhost:4004")
AUTH_URL      = os.getenv("AUTH_URL",      "http://localhost:4001")
INTERNAL_KEY  = os.getenv("INTERNAL_KEY",  "dev-fairgig-internal")
JWT_SECRET    = os.getenv("JWT_SECRET",    "dev-fairgig-secret")
JWT_ALG       = os.getenv("JWT_ALG",       "HS256")

MIN_COHORT = int(os.getenv("MIN_COHORT", "3"))
CACHE_TTL  = float(os.getenv("CACHE_TTL", "20"))
