import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CircleAlert, LoaderCircle, Plus } from 'lucide-react'
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
      <h1>No projects yet</h1>
      <p>Submit a rough idea and it will be sent to the agent pipeline for analysis.</p>
      <Link className="button button-primary" to={api.getProfile() ? '/create' : '/onboarding'}>Start my first project <ArrowRight size={16} /></Link>
    </div>
  )

  return (
    <>
      <header className="page-header">
        <div><h1>My projects</h1></div>
        <div className="run-actions"><Link className="button button-primary" to="/create"><Plus size={16} /> New idea</Link></div>
      </header>
      <ul className="project-list">
        {projects.map(p => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="project-row">
              <div><strong>{p.title}</strong><span>{DOMAIN_LABELS[p.domain]} · {p.durationWeeks} weeks · {new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              <ArrowUpRight size={17} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
