from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import select

from ..config import get_settings
from ..models import LoginSession, User
from ..schemas import AuthSessionOut, LoginIn, RegisterIn, ResetPasswordIn, UserOut
from ..security import DB, current_login, end_all_sessions, hash_password, issue_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalise(email: str) -> str:
    return email.strip().lower()


def _session_out(db: DB, user: User) -> AuthSessionOut:
    return AuthSessionOut(user=UserOut.model_validate(user), token=issue_token(db, user))


@router.post("/register", response_model=AuthSessionOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DB):
    email = _normalise(body.email)
    if db.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(name=body.name, email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _session_out(db, user)


@router.post("/login", response_model=AuthSessionOut)
def login(body: LoginIn, db: DB):
    user = db.exec(select(User).where(User.email == _normalise(body.email))).first()
    # Same message for unknown email and wrong password, so the form doesn't reveal which accounts exist.
    if not verify_password(body.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    return _session_out(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(login: Annotated[tuple[User, LoginSession], Depends(current_login)], db: DB):
    db.delete(db.get(LoginSession, login[1].id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetPasswordIn, db: DB):
    """Known risk (docs/ARCHITECTURE.md §4): no emailed code yet, so this is off unless
    ALLOW_UNVERIFIED_PASSWORD_RESET=true. Never enable it for real students."""
    if not get_settings().allow_unverified_password_reset:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Password reset isn't available yet. Please ask your mentor to reset it.")
    user = db.exec(select(User).where(User.email == _normalise(body.email))).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No account found with this email.")
    user.password_hash = hash_password(body.password)
    end_all_sessions(db, user.id)  # sign out every device that used the old password
    db.add(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
