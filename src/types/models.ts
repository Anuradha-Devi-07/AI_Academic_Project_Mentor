/**
 * Student–project data models shared by the UI, the API client and the demo pipeline.
 * Keep in sync with the backend contract in docs/ARCHITECTURE.md.
 */

export type ISODate = string

// ── Accounts ───────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  createdAt: ISODate
}

/** Returned by /auth/register and /auth/login; the token is sent as `Authorization: Bearer <token>`. */
export interface AuthSession {
  user: User
  token: string
}

// ── Student & skill assessment ─────────────────────────────────────────────

export type SkillCategory = 'programming' | 'web' | 'data' | 'design' | 'tools'

/** 1 = beginner, 2 = intermediate, 3 = advanced */
export type Proficiency = 1 | 2 | 3

export interface SkillQuizResult {
  correct: number
  total: number
  /** Level demonstrated in the quiz, weighted by question difficulty. */
  level: Proficiency
  takenAt: ISODate
}

export interface SkillRating {
  skill: string
  category: SkillCategory
  /** Effective level used by the agents: the quiz result when available, otherwise the self-rating. */
  level: Proficiency
  selfLevel: Proficiency
  quiz?: SkillQuizResult
}

export type PriorExperience = 'none' | 'one' | 'several'
export type BuilderLevel = 'beginner' | 'intermediate' | 'advanced'

export interface SkillAssessment {
  /** 0–100 readiness score derived from skills, experience and available time. */
  score: number
  level: BuilderLevel
  strengths: string[]
  growthAreas: string[]
  /** Share of skills whose level was verified by the quiz rather than self-rated (0–1). */
  verifiedShare: number
  assessedAt: ISODate
}

export interface StudentProfile {
  id: string
  /** The account this profile belongs to (one profile per user). */
  userId: string
  name: string
  course?: string
  year?: string
  skills: SkillRating[]
  priorProjects: PriorExperience
  weeklyHours: number
  teamSize: number
  assessment: SkillAssessment
  createdAt: ISODate
  updatedAt: ISODate
}

// ── Project ideas ──────────────────────────────────────────────────────────

export type ProjectDomain = 'ai_ml' | 'web' | 'mobile' | 'iot' | 'data' | 'other'

export interface ProjectIdea {
  id: string
  studentId: string
  title: string
  description: string
  domain: ProjectDomain
  durationWeeks: number
  createdAt: ISODate
  latestRunId?: string
}

export type NewProjectIdea = Pick<ProjectIdea, 'title' | 'description' | 'domain' | 'durationWeeks'>

// ── Agent pipeline ─────────────────────────────────────────────────────────

export type AgentId = 'feasibility' | 'tech_stack' | 'risk' | 'planner' | 'mentor' | 'documentation'
export type StepStatus = 'queued' | 'running' | 'completed' | 'failed'
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface AgentStep {
  agentId: AgentId
  status: StepStatus
  startedAt?: ISODate
  finishedAt?: ISODate
  /** One-line result shown in the pipeline timeline once the agent completes. */
  summary?: string
  error?: string
}

export interface PipelineRun {
  id: string
  projectId: string
  status: RunStatus
  steps: AgentStep[]
  createdAt: ISODate
  finishedAt?: ISODate
  /** Present only when status is 'completed'. */
  blueprint?: ProjectBlueprint
}

export type Severity = 'low' | 'medium' | 'high'

export interface ProjectBlueprint {
  feasibility: { score: number; verdict: 'strong' | 'workable' | 'stretch'; notes: string[] }
  techStack: { layer: string; choice: string; reason: string }[]
  risks: { title: string; severity: Severity; mitigation: string }[]
  milestones: { weeks: string; title: string; deliverables: string[] }[]
  mentorTips: string[]
  synopsis: string
}
