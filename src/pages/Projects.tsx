import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CircleAlert, FolderKanban, LoaderCircle, Plus } from 'lucide-react'
import { errorMessage } from '../components/ui'
import { api } from '../services/api'
import { DOMAIN_LABELS } from '../lib/skills'
import type { ProjectIdea } from '../types/models'

export default function Projects() {
  const [projects, setProjects] = useState<ProjectIdea[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.listProjects().then(p => { if (!cancelled) setProjects(p) }).catch(e => { if (!cancelled) setError(errorMessage(e)) })
    return () => { cancelled = true }
  }, [])

  if (error) return <p className="form-error" role="alert"><CircleAlert size={15} /> {error}</p>
  if (!projects) return <p className="page-loading"><LoaderCircle className="spin" size={18} /> Loading your projects…</p>

  if (!projects.length) return (
    <div className="empty-state">
      <span className="empty-state-icon"><FolderKanban size={23} /></span>
      <span className="muted-label">YOUR WORKSPACE</span>
      <h1>Your first project starts with an idea.</h1>
      <p>Share a rough idea to save it here and create a pipeline run. In demo mode, that run stays queued.</p>
      <Link className="button button-primary" to={api.getProfile() ? '/create' : '/onboarding'}>Start my first project <ArrowRight size={16} /></Link>
    </div>
  )

  return (
    <>
      <header className="page-header">
        <div><span className="muted-label">YOUR WORKSPACE</span><h1>My projects</h1><p>Ideas you have submitted and their current pipeline availability.</p></div>
        <div className="run-actions"><Link className="button button-primary" to="/create"><Plus size={16} /> New idea</Link></div>
      </header>
      <ul className="projects-workspace">
        {projects.map(p => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="project-card">
              <span className="project-card-main">
                <strong>{p.title}</strong>
                <span className="project-card-meta">
                  <span className="project-card-domain">{DOMAIN_LABELS[p.domain]}</span>
                  <span>{p.durationWeeks} weeks</span>
                  <span>Submitted {new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
                <span className={`project-card-state ${p.latestRunId ? 'available' : ''}`}>
                  <span aria-hidden="true" /> {p.latestRunId ? 'Pipeline run available' : 'Not yet sent for analysis'}
                </span>
              </span>
              <span className="project-card-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
