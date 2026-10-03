"""
Supabase Auth Token Verification and User Dependency for FastAPI.

Validates Supabase JWTs:
- Signature verification against Supabase Auth JWKS (ES256 / RS256) or JWT secret (HS256)
- Claims verification: expiration (exp), issuer (iss), audience (aud == 'authenticated')
- Live validation fallback against Supabase Auth API
- Contextual user resolution for access control
"""
import time
import logging
from typing import Optional, Dict, Any
import jwt
from jwt import PyJWKClient
import httpx
from fastapi import Request, Header, HTTPException, status
from pydantic import BaseModel

from backend.app.config import settings

logger = logging.getLogger("uatlens.auth")


class AuthUser(BaseModel):
    id: str
    email: str
    role: str = "QA Lead"
    name: str = ""
    app_metadata: Dict[str, Any] = {}
    user_metadata: Dict[str, Any] = {}


# In-memory cache for JWKS client and user tokens
_jwk_client: Optional[PyJWKClient] = None
_token_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 300  # 5 minutes


def get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwk_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
    return _jwk_client


def verify_supabase_token(token: str) -> AuthUser:
    """
    Verifies a Supabase JWT token string:
    1. Checks in-memory cache
    2. Verifies cryptographic signature using Supabase JWKS or JWT secret
    3. Validates issuer, audience, and expiration
    4. Fallback live validation against Supabase Auth /user endpoint
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer error=\"missing_token\""}
        )

    token = token.strip()
    now = time.time()

    # 1. Check local cache
    cached = _token_cache.get(token)
    if cached and cached.get("expires_at", 0) > now:
        return cached["user"]

    expected_issuer = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
    payload = None

    # 2. Try JWKS verification
    try:
        jwk_client = get_jwk_client()
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=expected_issuer,
            options={"require": ["exp", "iss", "aud", "sub"]}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer error=\"token_expired\""}
        )
    except Exception as jwks_err:
        logger.debug(f"JWKS verification did not resolve: {jwks_err}. Trying secret or live verification.")

    # 3. Try JWT Secret verification if configured
    if payload is None and settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=expected_issuer,
                options={"require": ["exp", "iss", "aud", "sub"]}
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer error=\"token_expired\""}
            )
        except Exception as hs_err:
            logger.debug(f"HS256 secret verification failed: {hs_err}")

    # 4. Fallback to Supabase Auth /user endpoint validation
    if payload is None:
        try:
            user_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
            with httpx.Client(timeout=4.0) as client:
                res = client.get(
                    user_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": settings.SUPABASE_ANON_KEY
                    }
                )
            if res.status_code == 200:
                user_data = res.json()
                meta = user_data.get("user_metadata", {})
                user = AuthUser(
                    id=user_data.get("id", ""),
                    email=user_data.get("email", ""),
                    role=meta.get("role", "QA Lead"),
                    name=meta.get("name", meta.get("full_name", user_data.get("email", "").split("@")[0])),
                    app_metadata=user_data.get("app_metadata", {}),
                    user_metadata=meta
                )
                _token_cache[token] = {"user": user, "expires_at": now + CACHE_TTL}
                return user
            elif res.status_code == 401 or res.status_code == 403:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token.",
                    headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""}
                )
        except HTTPException:
            raise
        except Exception as live_err:
            logger.error(f"Live Supabase token validation error: {live_err}")

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to authenticate request: Invalid token signature or issuer.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""}
        )

    # Build AuthUser from verified JWT payload
    user_meta = payload.get("user_metadata", {})
    user_id = payload.get("sub", "")
    email = payload.get("email", "") or user_meta.get("email", "")
    role = user_meta.get("role", "QA Lead")
    name = user_meta.get("name", user_meta.get("full_name", email.split("@")[0] if email else "User"))

    user = AuthUser(
        id=user_id,
        email=email,
        role=role,
        name=name,
        app_metadata=payload.get("app_metadata", {}),
        user_metadata=user_meta
    )

    exp = payload.get("exp", now + CACHE_TTL)
    _token_cache[token] = {"user": user, "expires_at": min(exp, now + CACHE_TTL)}
    return user


def extract_token_from_request(request: Request, authorization: Optional[str] = None) -> Optional[str]:
    """
    Extracts Bearer token from Authorization header or cookies.
    """
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()

    # Check cookies
    cookie_token = request.cookies.get("sb-access-token") or request.cookies.get("uatlens_token")
    if cookie_token:
        return cookie_token.strip()

    return None


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> AuthUser:
    """
    FastAPI dependency requiring a valid Supabase authenticated user.
    """
    if settings.AUTH_DISABLED:
        # Dev / test bypass mode
        return AuthUser(
            id="00000000-0000-0000-0000-000000000001",
            email="developer@local.test",
            role="QA Lead",
            name="Local Developer"
        )

    token = extract_token_from_request(request, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer error=\"missing_token\""}
        )

    return verify_supabase_token(token)


async def get_optional_user(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Optional[AuthUser]:
    """
    FastAPI dependency that returns AuthUser if valid token present, or None.
    """
    if settings.AUTH_DISABLED:
        return AuthUser(
            id="00000000-0000-0000-0000-000000000001",
            email="developer@local.test",
            role="QA Lead",
            name="Local Developer"
        )

    token = extract_token_from_request(request, authorization)
    if not token:
        return None
    try:
        return verify_supabase_token(token)
    except Exception:
        return None


def clear_token_cache() -> None:
    """Clears the in-memory JWT validation cache."""
    global _token_cache
    _token_cache.clear()

