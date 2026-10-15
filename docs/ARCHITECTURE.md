# ProjectMentor AI — Architecture

This document covers Milestone 1, items 1–2: the research basis and the multi-agent system design. Items 3–4 (onboarding with skill assessment, and idea submission that triggers the pipeline) are implemented in this frontend and described in [Frontend implementation](#5-frontend-implementation).

---

## 1. Research basis

### 1.1 Agentic AI workflow patterns

| Pattern | What it is | How we use it |
|---|---|---|
| **Orchestrator–workers** | A coordinator splits a task and hands sub-tasks to specialist agents, then combines their results. | The **Orchestrator** receives a submitted idea and runs six specialist agents. |
| **Prompt chaining / DAG** | Each agent's output becomes the next agent's input, and agents that don't depend on each other run in parallel. | Agents are declared with `dependsOn`, and the orchestrator runs them in topological stages (§2.2). |
| **Specialisation** | Narrow agents with focused prompts and tools beat one general prompt on reliability and are easier to evaluate. | One agent per mentoring concern: feasibility, stack, risk, plan, mentoring, documentation. |
| **Human-in-the-loop** | People review or override agent output at checkpoints. | Students can edit their profile and re-run the analysis. Faculty review is planned for a later milestone. |
| **Asynchronous runs + polling** | Long LLM jobs run in the background; the client polls (or subscribes to) run status. | `POST …/pipeline-runs` returns at once; the UI polls `GET /pipeline-runs/:id` and shows per-agent progress. |

### 1.2 Academic project mentoring methodology

These principles shape what the agents produce:

- **Scaffolding / zone of proximal development.** Guidance is pitched just above the student's current level. The skill assessment feeds every agent, so a beginner gets a tutorial-sized first step and an advanced student gets "prototype the riskiest part first".
- **Milestone-based supervision.** Academic projects are assessed in phases (synopsis → design → implementation → testing → report). The planner always produces these phases, scaled to the available weeks.
- **Early risk identification.** Supervisors ask "what could stop you?" in week 1. The Risk Assessor does the same, and every risk comes with a mitigation.
- **Socratic mentoring.** The Mentor agent ends with a reflection question instead of only giving answers, which supports learning rather than replacing it.
- **Academic integrity.** Generated synopsis text is labelled a *starting point to rewrite in your own words*.

---

## 2. Multi-agent system

### 2.1 Agent roles

| Agent | `id` | Inputs | Output (`ProjectBlueprint` field) |
|---|---|---|---|
| Orchestrator | — | Project idea + student profile | Runs the DAG, tracks step status, assembles the blueprint |
| Feasibility Analyst | `feasibility` | Idea, skills, hours, team size, duration | `feasibility` — score 0–100, verdict, notes |
| Tech Stack Advisor | `tech_stack` | Idea domain, skills, feasibility | `techStack[]` — layer, choice, reason |
| Risk Assessor | `risk` | Idea, skills, feasibility | `risks[]` — title, severity, mitigation |
| Milestone Planner | `planner` | Duration, stack, risks | `milestones[]` — weeks, title, deliverables |
| Mentor | `mentor` | Plan, assessment | `mentorTips[]` — first steps + reflection question |
| Documentation Assistant | `documentation` | Everything above | `synopsis` — draft paragraph |

The source of truth for roles and dependencies is `src/agents/registry.ts`.

### 2.2 Execution graph

```
                 ┌──► Tech Stack Advisor ─┐
Feasibility ─────┤                        ├──► Milestone Planner ──┬──► Mentor
                 └──► Risk Assessor ──────┘                        └──► Documentation
  stage 1             stage 2 (parallel)        stage 3                stage 4 (parallel)
```

A failure in one agent marks its step `failed`. Its dependants are not run, and the run's status becomes `failed`.

### 2.3 Sequence: submitting an idea

```
Student        Frontend                         Backend / Orchestrator           Agents
  │ submit idea   │                                    │                            │
  │──────────────►│ POST /projects                     │                            │
  │               │───────────────────────────────────►│ store project              │
  │               │ POST /projects/:id/pipeline-runs   │                            │
  │               │───────────────────────────────────►│ create run (queued) ──────►│ stage 1…4
  │               │◄─────────────── 201 PipelineRun ───│                            │
  │  /projects/:id│ GET /pipeline-runs/:id  (poll 2s)  │◄──── step status updates ──│
  │◄──────────────│◄───────────────────────────────────│                            │
  │ live progress │   … until status = completed       │ assemble blueprint         │
```

---

## 3. Data models

TypeScript definitions live in `src/types/models.ts`. Summary:

```
StudentProfile 1 ──── * ProjectIdea 1 ──── * PipelineRun 1 ──── 6 AgentStep
      │                                          │
      └── SkillRating[]                          └── ProjectBlueprint (when completed)
      └── SkillAssessment
```

| Entity | Key fields |
|---|---|
| **StudentProfile** | `id`, `name`, `course?`, `year?`, `skills: SkillRating[]`, `priorProjects: none\|one\|several`, `weeklyHours`, `teamSize`, `assessment`, timestamps |
| **SkillRating** | `skill`, `category: programming\|web\|data\|design\|tools`, `level: 1\|2\|3` (beginner/intermediate/advanced) |
| **SkillAssessment** | `score 0–100`, `level: beginner\|intermediate\|advanced`, `strengths[]`, `growthAreas[]`, `assessedAt` |
| **ProjectIdea** | `id`, `studentId`, `title`, `description`, `domain: ai_ml\|web\|mobile\|iot\|data\|other`, `durationWeeks`, `latestRunId?`, `createdAt` |
| **PipelineRun** | `id`, `projectId`, `status: queued\|running\|completed\|failed`, `steps: AgentStep[]`, `blueprint?`, `createdAt`, `finishedAt?` |
| **AgentStep** | `agentId`, `status`, `startedAt?`, `finishedAt?`, `summary?`, `error?` |
| **ProjectBlueprint** | `feasibility`, `techStack[]`, `risks[]`, `milestones[]`, `mentorTips[]`, `synopsis` |

### Skill quiz

Students first rate each skill themselves (`selfLevel`), then take a short multiple-choice quiz (`src/lib/questionBank.ts`, `src/components/SkillQuiz.tsx`):

- The bank has 39 questions: 3 for each of the 13 skills, one easy, one medium and one hard. Answer options are shuffled every time the quiz starts.
- The quiz covers up to 5 skills (about 15 questions), starting with the highest self-rated, since an over-estimate there would hurt the plan most.
- Each skill's level from the quiz is the sum of the difficulties answered correctly, out of 6. A score of 5–6 is advanced, 2–4 is intermediate and 0–1 is beginner.
- `SkillRating.level` is the quiz level when there is one, otherwise the self-rating. All agents use `level`.
- Skipping the quiz keeps the self-ratings and any earlier quiz results.

Answers are currently shipped to the browser, which is fine for a self-check. For graded use, the backend should serve questions without answers and score them on the server.

### Skill assessment scoring

The score is calculated in `src/lib/skills.ts` and is out of 100:

- **Skills (up to 60 points):** the sum of the proficiency levels, which maxes out at 12 (for example, four advanced skills).
- **Experience (up to 25 points):** 0 for no prior projects, 12 for one, 25 for several.
- **Time (up to 15 points):** one point per weekly hour, up to 15 hours.

The level is advanced at 70 or above, intermediate at 40–69, and beginner below 40. Strengths are the skills rated advanced. Growth areas first list any skill where the quiz came out lower than the self-rating, then gaps such as no Git, no data skills, no UI skills, no prior projects, or fewer than 5 hours a week.

---

## 4. API contract (proposed for the backend team)

All bodies are JSON and use the models above. Errors return `{ "message": string }` with a 4xx/5xx status.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/auth/register` | `{ name, email, password }` | `AuthSession` `{ user, token }` (409 if email exists) |
| `POST` | `/auth/login` | `{ email, password }` | `AuthSession` (401 on bad credentials) |
| `POST` | `/auth/logout` | — | 204 (invalidates token) |
| `POST` | `/students` | Profile fields (+ client `assessment`) | `StudentProfile` |
| `PUT` | `/students/:id` | Profile fields (+ client `assessment`) | `StudentProfile` |
| `GET` | `/students/:id/projects` | — | `ProjectIdea[]` |
| `POST` | `/projects` | `{ studentId, title, description, domain, durationWeeks }` | `ProjectIdea` |
| `GET` | `/projects/:id` | — | `ProjectIdea` (incl. `latestRunId`) |
| `POST` | `/projects/:id/pipeline-runs` | — | `PipelineRun` (status `queued`) — **pipeline trigger** |
| `GET` | `/pipeline-runs/:id` | — | `PipelineRun` with live step statuses |

**Authentication.** Every endpoint except `/auth/register` and `/auth/login` expects `Authorization: Bearer <token>` and acts only on the signed-in user's data (return 403/404 for anyone else's). A 401 makes the frontend clear the session and send the user to sign in. Passwords must be hashed server-side with bcrypt or argon2. Rate-limit the login endpoint.

---

## 5. Frontend implementation

| Concern | File |
|---|---|
| Data models | `src/types/models.ts` |
| Agent registry + DAG stages | `src/agents/registry.ts` |
| Skill catalog + assessment scoring | `src/lib/skills.ts` |
| API client (real backend or demo mode) | `src/services/api.ts` |
| Demo orchestrator (time-based, refresh-safe) | `src/services/demoPipeline.ts` |
| Demo rule-based agents | `src/services/demoAgents.ts` |
| Run polling hook | `src/hooks/usePipelineRun.ts` |
| Onboarding: profile → skill check → assessment | `src/pages/Onboarding.tsx` |
| Idea submission + pipeline trigger | `src/pages/CreateProject.tsx` |
| Live pipeline progress + blueprint | `src/pages/ProjectRun.tsx` |
| Project list | `src/pages/Projects.tsx` |

**Demo mode vs. real backend.** If `VITE_API_BASE_URL` is empty, everything runs in the browser and is stored in `localStorage`. The "agents" are deterministic rules that respond to the student's inputs, so the full flow can be shown and tested without a backend. Once the URL is set, `api.ts` calls the endpoints above, and no page code changes are needed.

**Accounts:** `src/services/auth.ts`, `src/auth/AuthContext.tsx` (`useAuth`, `RequireAuth`), `src/pages/Auth.tsx`, `src/components/UserMenu.tsx`. In demo mode, accounts live in this browser with salted SHA-256 hashes. That only makes the flow demonstrable; it is not real security.

**Routes:** `/` · `/register` · `/sign-in` are public. `/onboarding` · `/create` · `/projects` · `/projects/:projectId` require sign-in.
