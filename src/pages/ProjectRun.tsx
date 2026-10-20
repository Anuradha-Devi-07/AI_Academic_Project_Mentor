import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, CircleAlert, Clock3, LoaderCircle, Plus, Send } from 'lucide-react'
import { AGENTS, INTERACTIVE_MODULES } from '../agents/registry'
import { errorMessage } from '../components/ui'
import { usePipelineRun } from '../hooks/usePipelineRun'
import { api } from '../services/api'
import { projectTypeLabel } from '../lib/skills'
import type { PipelineRun, ProjectIdea, RunStatus, StepStatus } from '../types/models'

const RUN_LABELS: Record<RunStatus, string> = { queued: 'Queued', running: 'In progress', completed: 'Completed', failed: 'Failed' }
const STEP_LABELS: Record<StepStatus, string> = { queued: 'Pending', running: 'Running', completed: 'Done', failed: 'Failed' }
const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function ProjectRun() {
  const { projectId = '' } = useParams()
  const [project, setProject] = useState<ProjectIdea | null | undefined>(undefined)
  const [actionError, setActionError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const { run, error: runError, loading } = usePipelineRun(project?.latestRunId)

  useEffect(() => {
    let cancelled = false
    setProject(undefined)
    api.getProject(projectId).then(p => { if (!cancelled) setProject(p) }).catch(e => { if (!cancelled) { setActionError(errorMessage(e)); setProject(null) } })
    return () => { cancelled = true }
  }, [projectId])

  /** For projects without a run (e.g. created before the trigger existed). */
  const trigger = async () => {
    if (!project) return
    setTriggering(true)
    setActionError(null)
    try {
      const next = await api.triggerPipeline(project.id)
      setProject({ ...project, latestRunId: next.id })
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setTriggering(false)
    }
  }

  if (project === undefined) return <p className="page-loading"><LoaderCircle className="spin" size={18} /> Loading your project…</p>
  if (project === null) return (
    <div className="empty-state">
      <h1>We couldn't find that project.</h1>
      <p>{actionError ?? 'It may have been created in a different browser. Projects in demo mode are saved only on the device you used.'}</p>
      <div className="summary-actions"><Link className="button button-ghost" to="/projects">See my projects</Link><Link className="button button-primary" to="/create"><Plus size={16} /> Submit a new idea</Link></div>
    </div>
  )

  return (
    <>
      <header className="run-header">
        <div>
          <div className="eyebrow">{projectTypeLabel(project)} · {project.durationWeeks} weeks · Submitted {formatDate(project.createdAt)}</div>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
        </div>
        <div className="run-actions"><Link className="button button-ghost" to="/create"><Plus size={15} /> New idea</Link></div>
      </header>

      {actionError && <p className="form-error" role="alert"><CircleAlert size={15} /> {actionError}</p>}
      {runError && <p className="form-error" role="alert"><CircleAlert size={15} /> {runError}</p>}

      {loading ? <p className="page-loading"><LoaderCircle className="spin" size={18} /> Loading pipeline status…</p>
        : run ? <PipelinePanel run={run} />
          : (
            <div className="callout">
              <div><strong>Not submitted for analysis yet</strong><span>Send this idea to the agent pipeline.</span></div>
              <button type="button" className="button button-primary" onClick={trigger} disabled={triggering}>{triggering ? <><LoaderCircle size={16} className="spin" /> Submitting…</> : <><Send size={16} /> Submit for analysis</>}</button>
            </div>
          )}
    </>
  )
}

function PipelinePanel({ run }: { run: PipelineRun }) {
  const steps = new Map(run.steps.map(s => [s.agentId, s]))
  return (
    <section className="pipeline-card" aria-labelledby="pipeline-title">
      <div className="pipeline-head">
        <h2 id="pipeline-title">Analysis pipeline</h2>
        <span className={`run-status ${run.status}`}>{RUN_LABELS[run.status]}</span>
      </div>
      <p className="pipeline-note" aria-live="polite">
        {run.status === 'queued'
          ? <>Your idea has been submitted and the agent pipeline was triggered on {formatDate(run.createdAt)}. The agents below will analyse it in order; their results will appear here once they're connected.</>
          : run.status === 'completed' ? 'All agents have finished.' : run.status === 'failed' ? 'The pipeline stopped before finishing.' : 'The agents are working on your idea.'}
      </p>

      <ol className="agent-steps">
        {AGENTS.map((agent, i) => {
          const step = steps.get(agent.id)
          const status = step?.status ?? 'queued'
          return (
            <li key={agent.id} className={`agent-step ${status}`}>
              <span className="agent-step-index" aria-hidden="true">{status === 'completed' ? <Check size={14} /> : i + 1}</span>
              <span className="agent-icon"><agent.icon size={17} /></span>
              <div className="agent-body">
                <strong>{agent.name}</strong>
                <p>{step?.error ?? step?.summary ?? agent.role}</p>
              </div>
              <span className="agent-badge">{status === 'running' ? <LoaderCircle size={12} className="spin" /> : status === 'queued' ? <Clock3 size={12} /> : null} {STEP_LABELS[status]}</span>
            </li>
          )
        })}
      </ol>

      <div className="pipeline-later">
        <span className="muted-label">AVAILABLE AFTER ANALYSIS</span>
        <ul>{INTERACTIVE_MODULES.map(m => <li key={m.module}><m.icon size={15} /> <strong>{m.name}</strong> — {m.role}</li>)}</ul>
      </div>
    </section>
  )
}
