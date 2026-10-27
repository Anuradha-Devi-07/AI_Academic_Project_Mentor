"""Password hashing (Argon2) and login tokens (JWT backed by a login_sessions row)."""
from datetime import timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlmodel import Session, delete

from .config import get_settings
from .db import get_session
from .models import LoginSession, User, utcnow

_hasher = PasswordHash.recommended()
# Verified against when the email is unknown, so a sign-in takes the same time either way.
_DUMMY_HASH = _hasher.hash("not-a-real-password-0")
_ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    return _hasher.verify(password, password_hash or _DUMMY_HASH) and password_hash is not None


def issue_token(db: Session, user: User) -> str:
    settings = get_settings()
    login = LoginSession(user_id=user.id, expires_at=utcnow() + timedelta(hours=settings.jwt_expire_hours))
    db.add(login)
    db.commit()
    claims = {"sub": user.id, "sid": login.id, "exp": login.expires_at}
    return jwt.encode(claims, settings.jwt_secret, algorithm=_ALGORITHM)


def end_all_sessions(db: Session, user_id: str) -> None:
    db.exec(delete(LoginSession).where(LoginSession.user_id == user_id))


def _unauthorized(message: str = "Please sign in to continue.") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, message, headers={"WWW-Authenticate": "Bearer"})


def current_login(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_session)],
) -> tuple[User, LoginSession]:
    if credentials is None:
        raise _unauthorized()
    try:
        claims = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=[_ALGORITHM], options={"require": ["sub", "sid", "exp"]})
    except jwt.PyJWTError:
        raise _unauthorized("Your session has expired. Please sign in again.")
    # The token is only valid while its session row exists (deleted on sign out / password reset).
    login = db.get(LoginSession, claims["sid"])
    user = db.get(User, claims["sub"])
    if login is None or user is None or login.user_id != user.id:
        raise _unauthorized("Your session has expired. Please sign in again.")
    return user, login


def current_user(login: Annotated[tuple[User, LoginSession], Depends(current_login)]) -> User:
    return login[0]


CurrentUser = Annotated[User, Depends(current_user)]
DB = Annotated[Session, Depends(get_session)]
