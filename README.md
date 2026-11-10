# ProjectMentor AI

An AI academic project mentor for students (Infosys **AI Academic Project Mentor** team project).
A student creates a profile, proves their skill level with a short quiz, and submits a rough project idea.
The idea is sent to a pipeline of AI agents that check feasibility, define scope, recommend a tech stack,
plan a week-by-week timeline and flag risks.

```
React app (5173)  →  FastAPI backend (8000)  →  PostgreSQL in Docker (5432)
                              └── LangGraph AI agents (next)
```

## Status

| Milestone | Work | Status |
|---|---|---|
| **1** | Study agentic AI workflows; design the multi-agent architecture, agent roles and data models | ✅ Done |
| **1** | Student onboarding: profile + skill assessment (quiz) | ✅ Done |
| **1** | Idea submission + pipeline trigger (run created as *Queued*) | ✅ Done |
| **2** | Backend (FastAPI) and database (PostgreSQL in Docker) | ✅ Done |
| **2** | Authentication: register, sign in, sign out, reset password | ✅ Done |
| **2** | Frontend connected to the backend (tested end to end) | ✅ Done |
| **2** | AI agents: Feasibility, Scope, Tech Stack (with reasons), Timeline | ⏳ Next |
| **2** | Validate the pipeline with sample student ideas | ⏳ Next |
| Later | Risk agent, Conversational Mentor, Report Generation | Designed |

The seven modules, agent roles, data models and API contract are in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Features

**Student journey**
1. **Register / sign in:** password strength meter, Caps Lock warning, forgot password.
2. **Profile:** name, course and year.
3. **Skills:** pick from 13 common college skills and rate each one.
4. **Skill quiz:** 3 questions per skill (easy, medium, hard) for up to 5 skills, so levels are checked, not just self-rated. Editing skills later re-tests only the skills that changed.
5. **Readiness score (0–100):** skills up to 60 + project experience up to 25 + weekly time up to 15, with a "How is my score calculated?" popup and tips to improve.
6. **New idea:** title, description, project type (or your own type for "Something else") and duration. Unsent text is saved as a draft.
7. **Voice input:** speak the idea in English, Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Bengali or Gujarati (Chrome/Edge, needs internet).
8. **Pipeline trigger:** submitting creates a run with one *Queued* step per agent.
9. **My projects:** see ideas and their status; delete with an "Are you sure?" confirmation.

**Experience:** dark theme by default with Light/Dark/Device options, mobile-friendly layout, keyboard accessible,
intro animation once per visit (with Skip), clear loading, empty and error states.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, React Hook Form + Zod, Motion, Lucide icons, Tailwind CSS v4 (reset), Web Speech API |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic, pydantic-settings |
| Database | PostgreSQL 16 in Docker, SQLModel (SQLAlchemy). SQLite also works for quick local runs |
| Security | Argon2 password hashing (pwdlib), JWT login tokens (PyJWT) |
| Testing | pytest + httpx |
| AI agents (next) | LangGraph, with the LLM provider chosen in `.env` (Gemini, Groq, NVIDIA, Claude, GPT…) |

## Project structure

```
├── src/                     React frontend
│   ├── pages/               Home, Auth, Onboarding, CreateProject, Projects, ProjectRun
│   ├── components/          SkillQuiz, VoiceInput, IntroAnimation, UserMenu, ThemeMenu, ui
│   ├── services/            api.ts (all data access), auth.ts, http.ts, session.ts, demoPipeline.ts
│   ├── agents/registry.ts   Agent definitions and pipeline order
│   ├── lib/                 skills + readiness score, quiz question bank, storage, theme
│   └── types/models.ts      Shared data models
├── server/                  FastAPI backend (see server/README.md)
│   ├── app/                 main, config, db, models, schemas, security, assessment, pipeline
│   ├── app/routers/         auth, students, projects
│   ├── tests/               API tests
│   └── docker-compose.yml   PostgreSQL
└── docs/ARCHITECTURE.md     Modules, agents, data models, API contract
```

## Run locally

Needs **Node.js 20.19+ or 22.12+**, **Python 3.11+** and **Docker Desktop**.

### Option A: frontend only (demo mode)

No backend needed. Data is stored in your browser.

```bash
npm install
npm run dev
```

Make sure `.env.local` does **not** set `VITE_API_BASE_URL` (or leave it empty).

### Option B: full app (frontend + backend + database)

**1. First-time backend setup** (in `server/`):

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
```

Edit `server/.env`: set `DB_PASSWORD` (and the same password inside `DATABASE_URL`) and a long random `JWT_SECRET`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

**2. Point the frontend at the backend** (in the main folder):

```bash
copy .env.example .env.local
```

This sets `VITE_API_BASE_URL=http://127.0.0.1:8000`.

**3. Start everything** (Docker Desktop must be open):

```bash
# terminal 1, in server/
docker compose up -d
.venv\Scripts\activate
uvicorn app.main:app --reload

# terminal 2, in the main folder
npm install
npm run dev
```

| Open | What |
|---|---|
| http://localhost:5173 | The app |
| http://127.0.0.1:8000/docs | API docs (try every endpoint in the browser) |

**Stop:** `Ctrl + C` in each terminal, then `docker compose down` in `server/`.
Your data is kept; `docker compose down -v` deletes it.

To view the database, connect a tool such as DBeaver to `127.0.0.1:5432`, database and user `projectmentor`,
password from `server/.env`. Use `127.0.0.1`, not `localhost`, on Windows.

## Tests and checks

```bash
# backend (in server/, venv active) — uses an in-memory database, no Docker needed
pytest

# frontend type check + production build
npm run build
```

The backend tests cover registration and login, sign out, weak passwords, protected routes, server-side
readiness scoring, quiz limits, idea submission, pipeline trigger, delete, custom project types,
privacy between students, password reset and readable error messages.

## Security

- Passwords are hashed with Argon2; the database never stores plain passwords.
- Login tokens only work while their session exists, so sign out and password reset end sessions on the server.
- Every route checks ownership: students can only see and change their own data.
- The server recalculates the readiness score instead of trusting the browser.
- Secrets live in `server/.env` and `.env.local`, which Git ignores. Only `.env.example` files are committed.
  Never commit API keys, passwords, tokens or real student data.

## Known limitations

- **Forgot password has no emailed code yet**, so anyone who knows an email could change that password.
  It is enabled only for the classroom demo (`ALLOW_UNVERIFIED_PASSWORD_RESET=true`). Keep it `false` for real students.
- No limit on wrong login attempts yet.
- No database migrations yet (tables are created at start-up).
- The team chose the FastAPI login over Firebase Authentication, so all data stays in one PostgreSQL database.

## Next steps

1. AI model setup that works with any provider, configured in `server/.env`
2. Feasibility, Scope, Tech Stack and Timeline agents connected with LangGraph
3. Run the pipeline in the background: *Queued → Running → Completed*
4. Show agent results live on the project page
5. Validate with 5 sample ideas (AI/ML, Web, Mobile, IoT, Data)
6. Password reset by email code and login attempt limits

## Working as a team

```bash
git pull origin main          # get teammates' changes first
git add .
git commit -m "Short description of the change"
git push origin main
```

After pulling, run `npm install` (frontend) and `pip install -r requirements-dev.txt` (backend) if dependencies changed.
Use separate branches (for example `feat/agents`) for larger work, and avoid editing the same files at the same time.
