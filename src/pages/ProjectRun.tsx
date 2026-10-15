import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, CircleAlert, CircleHelp, Clock3, Copy, FileText, Layers3, LoaderCircle, MessageCircle, Plus, RotateCw, ShieldAlert, Target } from 'lucide-react'
import { AGENTS, agentById, pipelineStages, type AgentDefinition } from '../agents/registry'
import { ScoreRing, errorMessage } from '../components/ui'
import { usePipelineRun } from '../hooks/usePipelineRun'
import { api, isDemoMode } from '../services/api'
import { DOMAIN_LABELS } from '../lib/skills'
import type { AgentStep, PipelineRun, ProjectBlueprint, ProjectIdea } from '../types/models'

const STAGES = pipelineStages()
const VERDICT_LABELS = { strong: 'Strong fit', workable: 'Workable with focus', stretch: 'A stretch — scope down' }

export default function ProjectRun() {
  const { projectId = '' } = useParams()
  const [project, setProject] = useState<ProjectIdea | null | undefined>(undefined)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rerunning, setRerunning] = useState(false)
  const { run, error: runError, loading } = usePipelineRun(project?.latestRunId)

  useEffect(() => {
    let cancelled = false
    setProject(undefined)
    api.getProject(projectId).then(p => { if (!cancelled) setProject(p) }).catch(e => { if (!cancelled) { setActionError(errorMessage(e)); setProject(null) } })
    return () => { cancelled = true }
  }, [projectId])

  const rerun = async () => {
    if (!project) return
    setRerunning(true)
    setActionError(null)
    try {
      const next = await api.triggerPipeline(project.id)
      setProject({ ...project, latestRunId: next.id })
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setRerunning(false)
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

  const busy = run?.status === 'queued' || run?.status === 'running'
  return (
    <>
      <header className="run-header">
        <div>
          <div className="eyebrow">{DOMAIN_LABELS[project.domain].toUpperCase()} · {project.durationWeeks} WEEKS</div>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
        </div>
        <div className="run-actions">
          <button type="button" className="button button-ghost" onClick={rerun} disabled={busy || rerunning}><RotateCw size={15} className={rerunning ? 'spin' : undefined} /> Re-run analysis</button>
          <Link className="button button-ghost" to="/create"><Plus size={15} /> New idea</Link>
        </div>
      </header>

      {actionError && <p className="form-error" role="alert"><CircleAlert size={15} /> {actionError}</p>}
      {runError && <p className="form-error" role="alert"><CircleAlert size={15} /> {runError}</p>}
      {!loading && !run && !runError && <p className="form-error"><CircleAlert size={15} /> No analysis found for this project. Use “Re-run analysis” to start one.</p>}

      {(run || loading) && <PipelinePanel run={run} />}
      {run?.status === 'completed' && run.blueprint && <Blueprint blueprint={run.blueprint} />}
    </>
  )
}

function PipelinePanel({ run }: { run: PipelineRun | null }) {
  const steps = new Map(run?.steps.map(s => [s.agentId, s]))
  const done = run?.steps.filter(s => s.status === 'completed').length ?? 0
  const working = run?.steps.filter(s => s.status === 'running').map(s => agentById[s.agentId].name) ?? []
  const heading = !run || run.status === 'queued' ? 'Sending your idea to the agents…'
    : run.status === 'running' ? `Working: ${working.join(' & ') || 'handing off'}`
      : run.status === 'completed' ? 'Your blueprint is ready' : 'The analysis stopped early'
  const finished = run?.status === 'completed'
  // Once finished, the agent details are history: collapse them so the blueprint comes first.
  const [showDetails, setShowDetails] = useState(false)
  const expanded = !finished || showDetails

  return (
    <section className={finished ? 'pipeline-card compact' : 'pipeline-card'} aria-labelledby="pipeline-title">
      <div className="pipeline-head">
        <h2 id="pipeline-title"><span className={finished ? 'status-dot ok' : 'live-dot'} /> {heading}</h2>
        {finished
          ? <button type="button" className="link-button" aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}>{showDetails ? 'Hide' : 'Show'} agent details</button>
          : <span className="pipeline-count">{done} of {AGENTS.length} agents done</span>}
      </div>
      <p className="visually-hidden" aria-live="polite">{heading}</p>
      {!finished && <div className="progress-track" role="progressbar" aria-label="Agents completed" aria-valuemin={0} aria-valuemax={AGENTS.length} aria-valuenow={done}><span style={{ width: `${(done / AGENTS.length) * 100}%` }} /></div>}
      {expanded && <ol className="pipeline-stages">
        {STAGES.map((stage, i) => (
          <li key={i} className="pipeline-stage">
            <span className="stage-label">STAGE {i + 1}{stage.length > 1 ? ' · IN PARALLEL' : ''}</span>
            <div className="stage-agents">{stage.map(agent => <AgentCard key={agent.id} agent={agent} step={steps.get(agent.id)} />)}</div>
          </li>
        ))}
      </ol>}
    </section>
  )
}

function AgentCard({ agent, step }: { agent: AgentDefinition; step?: AgentStep }) {
  const status = step?.status ?? 'queued'
  const badge = {
    queued: <><Clock3 size={12} /> Waiting</>,
    running: <><LoaderCircle size={12} className="spin" /> Working</>,
    completed: <><Check size={12} /> Done</>,
    failed: <><CircleAlert size={12} /> Failed</>,
  }[status]
  return (
    <div className={`agent-card ${status}`}>
      <span className="agent-icon"><agent.icon size={17} /></span>
      <div className="agent-body">
        <div className="agent-title"><strong>{agent.name}</strong><span className="agent-badge">{badge}</span></div>
        <p>{step?.error ?? step?.summary ?? agent.role}</p>
      </div>
    </div>
  )
}

function Blueprint({ blueprint: b }: { blueprint: ProjectBlueprint }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(b.synopsis); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked: text is still selectable */ }
  }
  const reveal = (i: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * .07 } })

  return (
    <section className="blueprint" aria-label="Project blueprint">
      {isDemoMode && <div className="demo-note"><CircleHelp size={16} /><p><strong>Demo mode:</strong> these results come from built-in rules, not AI.</p></div>}
      <div className="blueprint-grid">
        <motion.article className="bp-card bp-feasibility" {...reveal(0)}>
          <h3><Target size={17} /> Feasibility</h3>
          <div className="bp-score"><ScoreRing score={b.feasibility.score} size="lg" label="Feasibility score" /><div><strong>{VERDICT_LABELS[b.feasibility.verdict]}</strong><span>{b.feasibility.score} / 100</span></div></div>
          <ul className="plain-list">{b.feasibility.notes.map(n => <li key={n}>{n}</li>)}</ul>
        </motion.article>

        <motion.article className="bp-card" {...reveal(1)}>
          <h3><Layers3 size={17} /> Recommended tech stack</h3>
          <dl className="stack-list">{b.techStack.map(t => <div key={t.layer}><dt>{t.layer}</dt><dd><strong>{t.choice}</strong><span>{t.reason}</span></dd></div>)}</dl>
        </motion.article>

        <motion.article className="bp-card bp-wide" {...reveal(2)}>
          <h3><Clock3 size={17} /> Milestone roadmap</h3>
          <ol className="milestones">{b.milestones.map((m, i) => <li key={m.title}><span className="ms-index">{i + 1}</span><div><span className="ms-weeks">{m.weeks}</span><strong>{m.title}</strong><ul>{m.deliverables.map(d => <li key={d}>{d}</li>)}</ul></div></li>)}</ol>
        </motion.article>

        <motion.article className="bp-card" {...reveal(3)}>
          <h3><ShieldAlert size={17} /> Risks to watch</h3>
          <ul className="risk-list">{b.risks.map(r => <li key={r.title}><div><strong>{r.title}</strong><span className={`severity ${r.severity}`}>{r.severity}</span></div><p>{r.mitigation}</p></li>)}</ul>
        </motion.article>

        <motion.article className="bp-card" {...reveal(4)}>
          <h3><MessageCircle size={17} /> Your mentor's first steps</h3>
          <ol className="tip-list">{b.mentorTips.map(t => <li key={t}>{t}</li>)}</ol>
        </motion.article>

        <motion.article className="bp-card bp-wide" {...reveal(5)}>
          <div className="bp-card-head"><h3><FileText size={17} /> Synopsis draft</h3><button type="button" className="button button-ghost button-small" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button></div>
          <p className="synopsis">{b.synopsis}</p>
          <p className="submit-hint left">A starting point — rewrite it in your own words before submitting.</p>
        </motion.article>
      </div>
    </section>
  )
}
