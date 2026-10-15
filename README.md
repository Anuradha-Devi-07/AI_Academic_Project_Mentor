# ProjectMentor AI — Frontend

Frontend starter for the Infosys **AI Academic Project Mentor** team project.

## Current scope (Milestone 1)

- **Home:** a short welcome card when signed out, and a dashboard (profile summary, recent projects) when signed in
- **Accounts:** register, sign in and sign out. App pages require sign-in, and each account has its own profile and projects.
- **Student onboarding:** profile creation, then a skill check (skills rated beginner/intermediate/advanced, prior projects, weekly hours, team size), then a readiness assessment with strengths and growth areas
- **Project idea submission:** validated form (title, description, domain, duration) that **triggers the multi-agent pipeline**
- **Live pipeline view:** six specialist agents run in dependency stages with per-agent progress, then show the project blueprint (feasibility, tech stack, roadmap, risks, mentor tips, synopsis draft)
- "My projects" list; re-run analysis after changing your profile
- Typed data models, an agent registry and a backend API client ready for integration

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the research basis, agent roles, data models and the proposed API contract.

**Demo mode:** with `VITE_API_BASE_URL` empty, data is stored in the browser and the "agents" are built-in rules, not AI. Set the variable in `.env.local` to call the real backend. No UI changes are needed.

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4
- Motion for React
- Lucide React icons
- React Router installed for future routes

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Git collaboration

1. Create a **public** repository on GitHub named `ai-academic-project-mentor-frontend`.
2. Do **not** initialize the GitHub repo with another README if you are pushing this starter as-is.
3. Extract this project folder, open a terminal inside it, then run:

```bash
git init
git add .
git commit -m "feat: add Milestone 1 frontend starter"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ai-academic-project-mentor-frontend.git
git push -u origin main
```

4. Share the repository link with the team. For the public repo, anyone can view and clone it; to push directly, teammates need write access. Add teammates in **Settings → Collaborators** or use pull requests from their own forks.
5. Agree on branch names and avoid everyone editing the same files at once. Suggested branches: `feat/onboarding`, `feat/project-submission`, `feat/api-integration`.

## Suggested team split

- Frontend owner: landing page, shared design system, integration coordination
- Teammate: onboarding and skill assessment improvements
- Teammate: project idea submission and API integration
- Teammate: AI/backend endpoints and OpenAPI contract
- Teammate: database/auth or testing/documentation (confirm the real team allocation together)

## Integration checklist

- [ ] Share `docs/ARCHITECTURE.md` §4 with the backend team and reconcile it with their OpenAPI/Swagger document
- [ ] Confirm API base URL, authentication, request/response schemas, and error formats
- [ ] Add `VITE_API_BASE_URL` to `.env.local` (never commit secrets)
- [x] API service layer (`src/services/api.ts`). Pages already call it.
- [x] Loading, success, empty, and error states
- [ ] Test student and faculty access separately if role-based authentication is required

## UI library policy

This starter uses a custom design built on React, Tailwind CSS, Motion, and Lucide. Before copying in components from shadcn/ui, Aceternity UI, Magic UI, Kokonut UI, React Bits, or other repositories, verify current framework compatibility, dependencies, component-specific licensing, and attribution requirements.

## Security

- Never commit API keys, tokens, passwords, private `.env` files, or real student data.
- `.env*` files are ignored by Git; `.env.example` contains only a blank placeholder.
- A public repository makes its source code visible to everyone. Keep secrets and sensitive information out of it.
