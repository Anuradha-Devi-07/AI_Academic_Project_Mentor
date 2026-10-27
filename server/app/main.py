"""ProjectMentor AI backend. Run: `uvicorn app.main:app --reload` (API docs at /docs)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .db import init_db
from .routers import auth, projects, students


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # creates missing tables; schema migrations (Alembic) can come later
    yield


app = FastAPI(title="ProjectMentor AI API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# The frontend reads errors as { "message": string } (src/services/http.ts).
@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"message": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    if first.get("type") == "json_invalid":
        hint = (first.get("ctx") or {}).get("error", "")
        message = f"The request body isn't valid JSON ({hint}). Check for missing or extra quotes and commas."
    else:
        field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
        message = f"{field}: " + str(first.get("msg", "Invalid request.")).removeprefix("Value error, ")
    return JSONResponse({"message": message, "errors": jsonable_encoder(exc.errors())}, status_code=422)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(students.router)
app.include_router(projects.router)
