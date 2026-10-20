/**
 * Single entry point for data access. With VITE_API_BASE_URL set, calls the backend
 * (contract in docs/ARCHITECTURE.md); otherwise runs fully in the browser in demo mode.
 * Pages only ever import `api`, so switching to the real backend needs no UI changes.
 * All data belongs to the signed-in user.
 */
import { assessSkills } from '../lib/skills'
import { load, newId, save } from '../lib/storage'
import type { NewProjectIdea, PipelineRun, ProjectIdea, StudentProfile } from '../types/models'
import { deleteDemoRuns, getDemoRun, triggerDemoRun } from './demoPipeline'
import { ApiError, http, isDemoMode } from './http'
import { getSession } from './session'

export { ApiError, isDemoMode }

export type ProfileInput = Omit<StudentProfile, 'id' | 'userId' | 'assessment' | 'createdAt' | 'updatedAt'>

const userId = () => {
  const id = getSession()?.user.id
  if (!id) throw new ApiError('Please sign in to continue.', 401)
  return id
}
// Local cache keys are per user, so accounts on a shared device never see each other's data.
const profileKey = (uid: string) => `profile:${uid}`
const projectsKey = (uid: string) => `projects:${uid}`
const readProjects = (uid: string) => load<ProjectIdea[]>(projectsKey(uid), [])
const cacheProject = (uid: string, project: ProjectIdea) => save(projectsKey(uid), [project, ...readProjects(uid).filter(p => p.id !== project.id)])

export const api = {
  /** The signed-in student's profile, cached locally so the UI can render instantly. */
  getProfile(): StudentProfile | null {
    const uid = getSession()?.user.id
    return uid ? load<StudentProfile | null>(profileKey(uid), null) : null
  },

  /** Creates or updates the profile; the skill assessment is (re)computed on every save. */
  async saveProfile(input: ProfileInput): Promise<StudentProfile> {
    const uid = userId()
    const existing = api.getProfile()
    const now = new Date().toISOString()
    let profile: StudentProfile = {
      ...input,
      id: existing?.id ?? newId('stu'),
      userId: uid,
      assessment: assessSkills(input.skills, input.priorProjects, input.weeklyHours),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    if (!isDemoMode) {
      // The client-side assessment is sent along; the backend may store it or replace it with its own.
      const body = JSON.stringify({ ...input, assessment: profile.assessment })
      profile = existing
        ? await http<StudentProfile>(`/students/${existing.id}`, { method: 'PUT', body })
        : await http<StudentProfile>('/students', { method: 'POST', body })
    }
    save(profileKey(uid), profile)
    return profile
  },

  async listProjects(): Promise<ProjectIdea[]> {
    const uid = userId()
    const profile = api.getProfile()
    if (isDemoMode || !profile) return readProjects(uid)
    return http<ProjectIdea[]>(`/students/${profile.id}/projects`)
  },

  async getProject(id: string): Promise<ProjectIdea | null> {
    if (isDemoMode) return readProjects(userId()).find(p => p.id === id) ?? null
    return http<ProjectIdea>(`/projects/${id}`).catch(e => { if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null; throw e })
  },

  /**
   * Submits an idea and triggers the agent pipeline in one step (Milestone 1).
   * Returns the stored project (with latestRunId) and the new, queued run.
   */
  async submitIdea(idea: NewProjectIdea): Promise<{ project: ProjectIdea; run: PipelineRun }> {
    const uid = userId()
    const profile = api.getProfile()
    if (!profile) throw new ApiError('Please create your profile before submitting an idea.')

    if (!isDemoMode) {
      const project = await http<ProjectIdea>('/projects', { method: 'POST', body: JSON.stringify({ ...idea, studentId: profile.id }) })
      const run = await api.triggerPipeline(project.id)
      const stored = { ...project, latestRunId: run.id }
      cacheProject(uid, stored)
      return { project: stored, run }
    }

    const project: ProjectIdea = { ...idea, id: newId('prj'), studentId: profile.id, createdAt: new Date().toISOString() }
    const run = triggerDemoRun(project)
    const stored = { ...project, latestRunId: run.id }
    cacheProject(uid, stored)
    return { project: stored, run }
  },

  /** Deletes a project and its pipeline runs. */
  async deleteProject(id: string): Promise<void> {
    const uid = userId()
    if (!isDemoMode) await http<void>(`/projects/${id}`, { method: 'DELETE' })
    else deleteDemoRuns(id)
    save(projectsKey(uid), readProjects(uid).filter(p => p.id !== id))
  },

  /** Triggers a new agent pipeline run for an existing project. */
  async triggerPipeline(projectId: string): Promise<PipelineRun> {
    if (!isDemoMode) return http<PipelineRun>(`/projects/${projectId}/pipeline-runs`, { method: 'POST' })
    const uid = userId()
    const project = readProjects(uid).find(p => p.id === projectId)
    if (!project) throw new ApiError('Project not found.', 404)
    const run = triggerDemoRun(project)
    cacheProject(uid, { ...project, latestRunId: run.id })
    return run
  },

  async getPipelineRun(runId: string): Promise<PipelineRun | null> {
    if (isDemoMode) return getDemoRun(runId)
    return http<PipelineRun>(`/pipeline-runs/${runId}`).catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e })
  },
}
