import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, Orbit, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { ScoreRing } from '../components/ui'
import { api } from '../services/api'
import { DOMAIN_LABELS, LEVEL_LABELS } from '../lib/skills'
import type { ProjectIdea, StudentProfile } from '../types/models'

/** Signed out: a short welcome. Signed in: the student's dashboard. */
export default function Home({ profile }: { profile: StudentProfile | null }) {
  const { user } = useAuth()
  return user ? <Dashboard name={user.name} profile={profile} /> : <Welcome />
}

function Welcome() {
  return (
    <div className="welcome-card">
      <span className="welcome-mark"><Orbit size={24} /></span>
      <h1>Plan your academic project with AI</h1>
      <p>Share a rough idea and get a plan tailored to your skills.</p>
      <ul className="check-list">
        <li><Check size={16} /> Feasibility check and tech stack advice</li>
        <li><Check size={16} /> Week-by-week milestones and risks</li>
        <li><Check size={16} /> A skill check so the plan fits you</li>
      </ul>
      <div className="welcome-actions">
        <Link className="button button-primary" to="/register">Create account</Link>
        <Link className="button button-ghost" to="/sign-in">Sign in</Link>
      </div>
    </div>
  )
}

function Dashboard({ name, profile }: { name: string; profile: StudentProfile | null }) {
  const [projects, setProjects] = useState<ProjectIdea[] | null>(null)
  useEffect(() => {
    let cancelled = false
    api.listProjects().then(p => { if (!cancelled) setProjects(p) }).catch(() => { if (!cancelled) setProjects([]) })
    return () => { cancelled = true }
  }, [])
  const verified = profile?.skills.filter(s => s.quiz).length ?? 0
  const recent = projects?.slice(0, 5) ?? []

  return (
    <>
      <header className="page-header">
        <div><h1>Welcome back, {name.split(' ')[0]}</h1><p>{profile ? 'Pick up a project or start a new one.' : 'Finish setting up so the agents can tailor your plans.'}</p></div>
        {profile && <Link className="button button-primary" to="/create"><Plus size={16} /> New idea</Link>}
      </header>

      {!profile && (
        <div className="callout">
          <div><strong>Complete your profile</strong><span>About 5 minutes: your details, skills and a short skill quiz.</span></div>
          <Link className="button button-primary" to="/onboarding">Continue setup <ArrowRight size={16} /></Link>
        </div>
      )}

      <div className="dash-grid">
        <section className="panel" aria-labelledby="dash-projects">
          <div className="panel-head"><h2 id="dash-projects">Recent projects</h2>{projects && projects.length > 5 && <Link className="link-button" to="/projects">View all</Link>}</div>
          {projects === null ? <p className="panel-empty">Loading…</p>
            : recent.length === 0 ? <p className="panel-empty">No projects yet.{profile && <> <Link className="link-button" to="/create">Submit your first idea</Link></>}</p>
              : <ul className="row-list">{recent.map(p => (
                <li key={p.id}><Link to={`/projects/${p.id}`}><div><strong>{p.title}</strong><span>{DOMAIN_LABELS[p.domain]} · {p.durationWeeks} weeks · {new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></div><ChevronRight size={18} /></Link></li>
              ))}</ul>}
        </section>

        {profile && (
          <section className="panel" aria-labelledby="dash-profile">
            <div className="panel-head"><h2 id="dash-profile">Your profile</h2><Link className="link-button" to="/onboarding">Edit</Link></div>
            <div className="profile-summary">
              <ScoreRing score={profile.assessment.score} label="Readiness score" />
              <div><strong>{LEVEL_LABELS[profile.assessment.level]}</strong><span>Readiness {profile.assessment.score}/100</span></div>
            </div>
            <dl className="facts">
              <div><dt>Skills</dt><dd>{profile.skills.length} ({verified} verified by quiz)</dd></div>
              <div><dt>Time</dt><dd>{profile.weeklyHours} h/week</dd></div>
              <div><dt>Team</dt><dd>{profile.teamSize === 1 ? 'Solo' : `${profile.teamSize} people`}</dd></div>
            </dl>
          </section>
        )}
      </div>
    </>
  )
}
