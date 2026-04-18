"""Simple TTL-cached clients for the upstream services."""
import time
import httpx
from .config import EARNINGS_URL, GRIEVANCE_URL, AUTH_URL, INTERNAL_KEY, CACHE_TTL

_cache: dict[str, tuple[float, object]] = {}


def _cached(key: str, fetch):
    hit = _cache.get(key)
    if hit and (time.time() - hit[0]) < CACHE_TTL:
        return hit[1]
    data = fetch()
    _cache[key] = (time.time(), data)
    return data


def fetch_shifts() -> list[dict]:
    def f():
        r = httpx.get(
            f"{EARNINGS_URL}/analytics/shifts",
            headers={"X-Internal-Key": INTERNAL_KEY},
            timeout=10.0,
        )
        r.raise_for_status()
        return r.json()
    return _cached("shifts", f)


def fetch_complaints() -> list[dict]:
    def f():
        r = httpx.get(
            f"{GRIEVANCE_URL}/analytics/complaints",
            headers={"X-Internal-Key": INTERNAL_KEY},
            timeout=10.0,
        )
        r.raise_for_status()
        return r.json()
    return _cached("complaints", f)


def fetch_users() -> list[dict]:
    def f():
        r = httpx.get(f"{AUTH_URL}/auth/users", timeout=10.0)
        r.raise_for_status()
        return r.json()
    return _cached("users", f)


def invalidate():
    _cache.clear()
