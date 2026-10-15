import { BrainCircuit, Clock3, FileText, Layers3, MessageCircle, ShieldAlert, type LucideIcon } from 'lucide-react'
import type { AgentId } from '../types/models'

export interface AgentDefinition {
  id: AgentId
  name: string
  /** What the agent is responsible for, shown in the pipeline view. */
  role: string
  /** Agents whose output this agent needs before it can start. */
  dependsOn: AgentId[]
  icon: LucideIcon
}

/**
 * The specialist agents coordinated by the orchestrator. Together they form a DAG:
 *
 *   feasibility ──► tech_stack ─┐
 *              └──► risk ───────┴──► planner ──► mentor
 *                                            └──► documentation
 */
export const AGENTS: AgentDefinition[] = [
  { id: 'feasibility', name: 'Feasibility Analyst', role: 'Checks scope against your skills, time and team size.', dependsOn: [], icon: BrainCircuit },
  { id: 'tech_stack', name: 'Tech Stack Advisor', role: 'Recommends technologies that fit the idea and what you already know.', dependsOn: ['feasibility'], icon: Layers3 },
  { id: 'risk', name: 'Risk Assessor', role: 'Flags likely blockers and suggests fallbacks.', dependsOn: ['feasibility'], icon: ShieldAlert },
  { id: 'planner', name: 'Milestone Planner', role: 'Breaks the project into a week-by-week roadmap.', dependsOn: ['tech_stack', 'risk'], icon: Clock3 },
  { id: 'mentor', name: 'Mentor', role: 'Suggests your first steps and questions to reflect on.', dependsOn: ['planner'], icon: MessageCircle },
  { id: 'documentation', name: 'Documentation Assistant', role: 'Drafts a synopsis you can build your report from.', dependsOn: ['planner'], icon: FileText },
]

export const agentById = Object.fromEntries(AGENTS.map(a => [a.id, a])) as Record<AgentId, AgentDefinition>

/** Topological layers of the DAG: agents in the same stage can run in parallel. */
export function pipelineStages(): AgentDefinition[][] {
  const stages: AgentDefinition[][] = []
  const placed = new Set<AgentId>()
  while (placed.size < AGENTS.length) {
    const ready = AGENTS.filter(a => !placed.has(a.id) && a.dependsOn.every(d => placed.has(d)))
    if (!ready.length) throw new Error('Agent registry contains a dependency cycle')
    ready.forEach(a => placed.add(a.id))
    stages.push(ready)
  }
  return stages
}
