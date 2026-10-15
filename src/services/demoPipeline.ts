/**
 * In-browser orchestrator used in demo mode. It schedules each agent after its dependencies
 * (see agents/registry.ts) and derives every step's status from elapsed time, so a run keeps
 * progressing correctly across page refreshes.
 */
import { AGENTS } from '../agents/registry'
import { load, newId, save } from '../lib/storage'
import type { AgentId, AgentStep, PipelineRun, ProjectBlueprint, ProjectIdea, StudentProfile } from '../types/models'
import { runDemoAgents } from './demoAgents'

const QUEUE_DELAY_MS = 800
const AGENT_DURATION_MS: Record<AgentId, number> = { feasibility: 2400, tech_stack: 2800, risk: 2200, planner: 3000, mentor: 2000, documentation: 2600 }

interface DemoRunRecord {
  id: string
  projectId: string
  createdAt: number
  schedule: Record<AgentId, { start: number; end: number }>
  summaries: Record<AgentId, string>
  blueprint: ProjectBlueprint
}

const RUNS_KEY = 'demo-runs'
const readRuns = () => load<Record<string, DemoRunRecord>>(RUNS_KEY, {})

export function startDemoRun(profile: StudentProfile, project: ProjectIdea): PipelineRun {
  const schedule = {} as DemoRunRecord['schedule']
  for (const agent of AGENTS) { // registry order is already topological
    const start = Math.max(QUEUE_DELAY_MS, ...agent.dependsOn.map(dep => schedule[dep].end))
    schedule[agent.id] = { start, end: start + AGENT_DURATION_MS[agent.id] }
  }
  const { blueprint, summaries } = runDemoAgents(profile, project)
  const record: DemoRunRecord = { id: newId('run'), projectId: project.id, createdAt: Date.now(), schedule, summaries, blueprint }
  save(RUNS_KEY, { ...readRuns(), [record.id]: record })
  return snapshot(record)
}

export function getDemoRun(runId: string): PipelineRun | null {
  const record = readRuns()[runId]
  return record ? snapshot(record) : null
}

function snapshot(record: DemoRunRecord, now = Date.now()): PipelineRun {
  const elapsed = now - record.createdAt
  const at = (offset: number) => new Date(record.createdAt + offset).toISOString()
  const steps: AgentStep[] = AGENTS.map(({ id }) => {
    const { start, end } = record.schedule[id]
    if (elapsed >= end) return { agentId: id, status: 'completed', startedAt: at(start), finishedAt: at(end), summary: record.summaries[id] }
    if (elapsed >= start) return { agentId: id, status: 'running', startedAt: at(start) }
    return { agentId: id, status: 'queued' }
  })
  const done = steps.every(s => s.status === 'completed')
  const lastEnd = Math.max(...Object.values(record.schedule).map(s => s.end))
  return {
    id: record.id,
    projectId: record.projectId,
    status: done ? 'completed' : elapsed < QUEUE_DELAY_MS ? 'queued' : 'running',
    steps,
    createdAt: at(0),
    finishedAt: done ? at(lastEnd) : undefined,
    blueprint: done ? record.blueprint : undefined,
  }
}
