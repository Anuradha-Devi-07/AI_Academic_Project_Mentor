/**
 * Demo-mode pipeline trigger (no VITE_API_BASE_URL). Milestone 1 scope: submitting an idea
 * creates and stores a pipeline run with one queued step per agent. Nothing processes the run
 * yet — the agents are implemented in later milestones (on the backend).
 */
import { AGENTS } from '../agents/registry'
import { load, newId, save } from '../lib/storage'
import type { PipelineRun, ProjectIdea } from '../types/models'

const RUNS_KEY = 'pipeline-runs'
const readRuns = () => load<Record<string, PipelineRun>>(RUNS_KEY, {})

export function triggerDemoRun(project: ProjectIdea): PipelineRun {
  const run: PipelineRun = {
    id: newId('run'),
    projectId: project.id,
    status: 'queued',
    steps: AGENTS.map(agent => ({ agentId: agent.id, status: 'queued' })),
    createdAt: new Date().toISOString(),
  }
  save(RUNS_KEY, { ...readRuns(), [run.id]: run })
  return run
}

/** Removes every run of a deleted project. */
export function deleteDemoRuns(projectId: string) {
  save(RUNS_KEY, Object.fromEntries(Object.entries(readRuns()).filter(([, run]) => run.projectId !== projectId)))
}

export function getDemoRun(runId: string): PipelineRun | null {
  return readRuns()[runId] ?? null
}
