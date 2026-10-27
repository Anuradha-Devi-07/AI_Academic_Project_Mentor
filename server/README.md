# ProjectMentor AI — backend

FastAPI + SQLModel + PostgreSQL (in Docker). Implements the API contract in `../docs/ARCHITECTURE.md` §4.

## First-time setup (Windows, from this `server/` folder)

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
```

Then edit `.env`:
- set `DB_PASSWORD` and use the **same** password inside `DATABASE_URL`
- set `JWT_SECRET` to a long random string: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

Never commit or share `.env`. It is in `.gitignore`.

## Run

```
docker compose up -d                 # start PostgreSQL (Docker Desktop must be open)
uvicorn app.main:app --reload        # start the API on http://127.0.0.1:8000
```

- API docs (try every endpoint in the browser): http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health
- Stop the database: `docker compose down` (your data is kept in a Docker volume;
  `docker compose down -v` deletes it)

To use the backend from the frontend, create `../.env.local` with
`VITE_API_BASE_URL=http://127.0.0.1:8000` and restart `npm run dev`.

## Tests

```
pytest
```

The tests use an in-memory SQLite database, so they don't need Docker.

## Folder map

| Path | What it does |
|---|---|
| `app/main.py` | App setup, CORS, error format `{ message }`, routes |
| `app/config.py` | Settings from `.env` |
| `app/db.py` | Database connection (PostgreSQL or SQLite via `DATABASE_URL`) |
| `app/models.py` | Database tables: users, login_sessions, student_profiles, projects, pipeline_runs |
| `app/schemas.py` | Request/response shapes (camelCase, same as `src/types/models.ts`) |
| `app/security.py` | Argon2 password hashing, JWT tokens, "who is signed in" |
| `app/assessment.py` | Readiness score (same rules as `src/lib/skills.ts`), recomputed on the server |
| `app/pipeline.py` | Creates queued pipeline runs (the agents come next) |
| `app/routers/` | API routes: `auth`, `students`, `projects` |
| `tests/test_api.py` | End-to-end API tests |

## Security notes

- Passwords are hashed with Argon2; tokens are JWTs that only work while their login session exists,
  so sign out and password reset really end sessions.
- Every route checks ownership: a student gets `404` for anyone else's profile, project or run.
- `/auth/reset-password` has **no emailed code yet** (known risk). It is disabled unless
  `ALLOW_UNVERIFIED_PASSWORD_RESET=true`. Keep it `false` for real students.
- Not done yet: login rate limiting, database migrations (Alembic).
