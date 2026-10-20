import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BrainCircuit, Calculator, Check, ChevronDown, ChevronRight, ClipboardCheck, Clock3, FolderKanban, Gauge, Lightbulb, Orbit, Package, Plus, Rocket, Sprout, Target, TrendingUp, UsersRound, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../services/api'
import { LEVEL_LABELS, PROFICIENCY_LABELS, projectTypeLabel, readinessBreakdown } from '../lib/skills'
import type { Proficiency, ProjectIdea, RunStatus, StudentProfile } from '../types/models'

const RUN_LABELS: Record<RunStatus, string> = { queued: 'Queued', running: 'In progress', completed: 'Completed', failed: 'Failed' }

const IDEA_TIPS: { key: string; icon: LucideIcon; title: string; text: string }[] = [
  { key: 'problem', icon: Target, title: 'Solve a real problem', text: 'Pick something you or your classmates actually face — it makes testing with real users easy.' },
  { key: 'users', icon: UsersRound, title: 'Name your users', text: 'Say who it is for: students, faculty, a local shop… Specific users lead to specific features.' },
  { key: 'core', icon: Sprout, title: 'Start small', text: 'Describe the one core feature first. Extras can come after the first version works.' },
  { key: 'needs', icon: Package, title: 'Check what you need', text: 'Datasets, hardware or APIs can take time to get — mention them in your idea.' },
]

const EXAMPLE_IDEA: { text: string; tip?: string }[] = [
  { text: 'Students at our college', tip: 'users' },
  { text: ' ' },
  { text: 'waste time walking around to find an empty classroom to study in.', tip: 'problem' },
  { text: ' This web app ' },
  { text: 'shows which rooms are free right now', tip: 'core' },
  { text: ', ' },
  { text: "using the timetable data from the admin office.", tip: 'needs' },
]

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
        <li><Check size={16} /> Create your profile and take a short skill check</li>
        <li><Check size={16} /> Submit your project idea in a few sentences</li>
        <li><Check size={16} /> AI agents review its feasibility, scope, timeline and risks</li>
      </ul>
      <div className="welcome-actions">
        <Link className="button button-primary" to="/register">Create account</Link>
        <Link className="button button-ghost" to="/sign-in">Sign in</Link>
      </div>
    </div>
  )
}

type ProjectWithStatus = ProjectIdea & { runStatus?: RunStatus }

function Dashboard({ name, profile }: { name: string; profile: StudentProfile | null }) {
  const [projects, setProjects] = useState<ProjectWithStatus[] | null>(null)
  useEffect(() => {
    let cancelled = false
    api.listProjects()
      .then(list => Promise.all(list.map(async p => ({ ...p, runStatus: p.latestRunId ? (await api.getPipelineRun(p.latestRunId).catch(() => null))?.status : undefined }))))
      .then(list => { if (!cancelled) setProjects(list) })
      .catch(() => { if (!cancelled) setProjects([]) })
    return () => { cancelled = true }
  }, [])

  const recent = projects?.slice(0, 5) ?? []
  const verified = profile?.skills.filter(s => s.quiz).length ?? 0
  const details = profile && [`${profile.course} · ${profile.year}`, `${profile.weeklyHours} h/week`].join('  ·  ')

  return (
    <>
      <header className="page-header">
        <div><h1>Welcome back, {name.split(' ')[0]}</h1><p>{details ?? 'Finish setting up so the agents can tailor their analysis to you.'}</p></div>
        {profile && <Link className="button button-primary" to="/create"><Plus size={16} /> New idea</Link>}
      </header>

      {!profile && (
        <div className="callout">
          <div><strong>Complete your profile</strong><span>About 5 minutes: your details, skills and a short skill quiz.</span></div>
          <Link className="button button-primary" to="/onboarding">Continue setup <ArrowRight size={16} /></Link>
        </div>
      )}

      {profile && (
        <ul className="stat-tiles" aria-label="Summary">
          <li><span className="stat-icon"><FolderKanban size={18} /></span><div><strong>{projects?.length ?? '–'}</strong><span>Ideas submitted</span></div></li>
          <li><span className="stat-icon"><Gauge size={18} /></span><div><strong>{profile.assessment.score}<small>/100</small></strong><span>Readiness · {LEVEL_LABELS[profile.assessment.level]}</span></div></li>
          <li><span className="stat-icon"><ClipboardCheck size={18} /></span><div><strong>{verified}<small> of {profile.skills.length}</small></strong><span>Skills verified by quiz</span></div></li>
        </ul>
      )}

      <div className="dash-grid">
        <div className="dash-col">
          <section className="panel" aria-labelledby="dash-projects">
            <div className="panel-head"><h2 id="dash-projects">Recent projects</h2>{projects && projects.length > 5 && <Link className="link-button" to="/projects">View all</Link>}</div>
            {projects === null ? <p className="panel-empty">Loading…</p>
              : recent.length === 0 ? <p className="panel-empty">No projects yet.{profile && <> <Link className="link-button" to="/create">Submit your first idea</Link></>}</p>
                : <ul className="row-list">{recent.map(p => (
                  <li key={p.id}><Link to={`/projects/${p.id}`}>
                    <div><strong>{p.title}</strong><span>{projectTypeLabel(p)} · {p.durationWeeks} weeks · {new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></div>
                    <span className="row-end">{p.runStatus && <span className={`run-status ${p.runStatus}`}>{RUN_LABELS[p.runStatus]}</span>}<ChevronRight size={18} /></span>
                  </Link></li>
                ))}</ul>}
          </section>

          <section className="panel" aria-labelledby="dash-tips">
            <div className="panel-head">
              <div><h2 id="dash-tips"><Lightbulb size={17} /> Tips for a strong project idea</h2><p className="panel-sub">Two or three sentences that cover these four things are enough.</p></div>
            </div>
            <ul className="tips">{IDEA_TIPS.map((t, i) => (
              <li key={t.key} className={`tip-${t.key}`}>
                <span className="tip-icon"><t.icon size={18} /></span>
                <div><strong><span className="tip-num">{i + 1}</span> {t.title}</strong><span>{t.text}</span></div>
              </li>
            ))}</ul>
            <details className="idea-example">
              <summary><ChevronDown size={16} className="chevron" /> See an example of a strong idea</summary>
              <blockquote>{EXAMPLE_IDEA.map((part, i) => part.tip ? <mark key={i} className={`tip-${part.tip}`}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</blockquote>
              <ul className="example-legend">{IDEA_TIPS.map((t, i) => <li key={t.key} className={`tip-${t.key}`}><i /> {i + 1}. {t.title}</li>)}</ul>
            </details>
          </section>
        </div>

        {profile && (
          <div className="dash-col">
            <section className="panel" aria-labelledby="dash-skills">
              <div className="panel-head"><h2 id="dash-skills">Your skills</h2></div>
              <SkillMix levels={profile.skills.map(s => s.level)} />
              <ul className="skill-rows">{profile.skills.map(s => (
                <li key={s.skill}>
                  <span>{s.skill}{s.quiz && <Check size={13} aria-label="verified by quiz" className="verified" />}</span>
                  <span className={`level-pill l${s.level}`}>{PROFICIENCY_LABELS[s.level]}</span>
                </li>
              ))}</ul>
            </section>

            <ReadinessPanel profile={profile} />
          </div>
        )}
      </div>
    </>
  )
}

/** Stacked bar of how many skills sit at each level. */
function SkillMix({ levels }: { levels: Proficiency[] }) {
  const counts = ([3, 2, 1] as Proficiency[]).map(l => ({ level: l, count: levels.filter(x => x === l).length }))
  return (
    <div className="skill-mix">
      <div className="skill-mix-bar" role="img" aria-label={counts.map(c => `${c.count} ${PROFICIENCY_LABELS[c.level].toLowerCase()}`).join(', ')}>
        {counts.filter(c => c.count).map(c => <span key={c.level} className={`l${c.level}`} style={{ flexGrow: c.count }} />)}
      </div>
      <ul className="skill-mix-legend">{counts.map(c => <li key={c.level}><i className={`l${c.level}`} /> {c.count} {PROFICIENCY_LABELS[c.level]}</li>)}</ul>
    </div>
  )
}

/** One plain-language action per part of the readiness score. */
function readinessActions(profile: StudentProfile) {
  const parts = Object.fromEntries(readinessBreakdown(profile.skills, profile.priorProjects, profile.weeklyHours).map(p => [p.key, p]))
  const skillCount = profile.skills.length
  return [
    {
      key: 'skills', icon: BrainCircuit, part: parts.skills,
      title: 'Learn more skills',
      status: `You have ${skillCount} skill${skillCount === 1 ? '' : 's'} so far`,
      gain: parts.skills.max - parts.skills.points,
    },
    {
      key: 'experience', icon: Rocket, part: parts.experience,
      title: profile.priorProjects === 'one' ? 'Build another project' : 'Build a project outside class',
      status: { none: "You haven't built one yet", one: "You've built one", several: "You've built several" }[profile.priorProjects],
      // The next step only: one project is worth 12 points, several 25.
      gain: profile.priorProjects === 'none' ? 12 : parts.experience.max - parts.experience.points,
    },
    {
      key: 'time', icon: Clock3, part: parts.time,
      title: 'Give more time each week',
      status: profile.weeklyHours >= 15 ? `You give ${profile.weeklyHours} hours a week` : `You give ${profile.weeklyHours} hour${profile.weeklyHours === 1 ? '' : 's'} — aim for 15`,
      gain: parts.time.max - parts.time.points,
    },
  ]
}

/** Short names of skills worth learning next, worked out from the current profile (not stored text). */
function nextSkills(profile: StudentProfile) {
  const has = (category: string) => profile.skills.some(s => s.category === category)
  const list = profile.skills.filter(s => s.quiz && s.quiz.level < s.selfLevel).map(s => `Strengthen ${s.skill}`)
  if (!profile.skills.some(s => s.skill === 'Git')) list.push('Git')
  if (!has('data')) list.push('SQL or pandas')
  if (!has('web') && !has('design')) list.push('Simple UI (HTML / CSS)')
  return list.slice(0, 4)
}

/** The readiness score as a short to-do list: what to do, where you are now, and the points it adds. */
function ReadinessPanel({ profile }: { profile: StudentProfile }) {
  const actions = readinessActions(profile)
  const skills = nextSkills(profile)
  const { score, level } = profile.assessment
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <section className="panel" aria-labelledby="dash-readiness">
      <div className="panel-head"><h2 id="dash-readiness"><TrendingUp size={17} /> How to raise your readiness</h2><Link className="link-button" to={{ pathname: '/onboarding', search: '?edit=skills' }} state={{ from: '/' }}>Update</Link></div>
      <p className="panel-sub readiness-intro">You're at <strong>{score}/100</strong> — {LEVEL_LABELS[level]}. Do these to improve:</p>

      <ul className="actions">{actions.map(a => (
        <li key={a.key} className={a.gain ? undefined : 'done'}>
          <span className="action-icon"><a.icon size={18} /></span>
          <div className="action-body">
            <div className="action-head">
              <strong>{a.title}</strong>
              {a.gain ? <span className="gain-chip">+{a.gain} pts</span> : <span className="gain-chip done"><Check size={12} /> Done</span>}
            </div>
            <span className="action-status">{a.status}</span>
            <div className="breakdown-track" role="progressbar" aria-label={a.title} aria-valuemin={0} aria-valuemax={a.part.max} aria-valuenow={a.part.points}><span style={{ width: `${(a.part.points / a.part.max) * 100}%` }} /></div>
          </div>
        </li>
      ))}</ul>

      {skills.length > 0 && <>
        <span className="muted-label">SKILLS TO LEARN NEXT</span>
        <ul className="skill-chips">{skills.map(sk => <li key={sk}><Sprout size={13} /> {sk}</li>)}</ul>
      </>}

      <div className="score-rules">
        <button type="button" className="link-button" onClick={() => dialogRef.current?.showModal()}><Calculator size={15} /> How is my score calculated?</button>
      </div>

      {/* A modal keeps the dashboard's height unchanged instead of stretching this card. */}
      <dialog className="score-dialog" ref={dialogRef} aria-labelledby="score-dialog-title" onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close() }}>
        <div className="score-dialog-head">
          <h2 id="score-dialog-title"><Calculator size={18} /> How your readiness score is calculated</h2>
          <button type="button" className="dialog-close" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={18} /></button>
        </div>
        <div className="score-dialog-body">
          <ul className="score-rule-list">
            <li><strong>Skills — up to 60 points</strong><span>Each skill counts by level: Beginner 1, Intermediate 2, Advanced 3. Add them up and multiply by 5 (12 or more points = full 60).</span></li>
            <li><strong>Project experience — up to 25 points</strong><span>One project outside class = 12, several = 25.</span></li>
            <li><strong>Weekly time — up to 15 points</strong><span>1 point for each hour per week, up to 15 hours.</span></li>
          </ul>
          <ScoreMath profile={profile} />
        </div>
      </dialog>
    </section>
  )
}

/** The student's own numbers for every part of the score, ending with the total. */
function ScoreMath({ profile }: { profile: StudentProfile }) {
  const skillPoints = profile.skills.reduce((sum, s) => sum + s.level, 0)
  const skills = Math.min(skillPoints, 12) * 5
  const experienceOptions = [
    { key: 'none', label: 'Not yet', points: 0 },
    { key: 'one', label: 'One project', points: 12 },
    { key: 'several', label: 'Several projects', points: 25 },
  ] as const
  const experience = experienceOptions.find(o => o.key === profile.priorProjects)!.points
  const time = Math.min(15, Math.max(0, Math.round(profile.weeklyHours)))

  return (
    <div className="skill-math">
      <span className="muted-label">YOUR CALCULATION</span>

      <h4>1. Skills</h4>
      <ul>{profile.skills.map(s => (
        <li key={s.skill}><span>{s.skill} <small>({PROFICIENCY_LABELS[s.level]}{s.quiz ? ', from quiz' : ''})</small></span><b>{s.level}</b></li>
      ))}</ul>
      <p>{skillPoints} point{skillPoints === 1 ? '' : 's'}{skillPoints > 12 ? ' (counted as 12)' : ''} × 5 = <b>{skills} / 60</b></p>

      <h4>2. Project experience</h4>
      <ul>{experienceOptions.map(o => (
        <li key={o.key} className={o.key === profile.priorProjects ? 'chosen' : undefined}><span>{o.label}{o.key === profile.priorProjects && <small> (your answer)</small>}</span><b>{o.points}</b></li>
      ))}</ul>
      <p>Your answer = <b>{experience} / 25</b></p>

      <h4>3. Weekly time</h4>
      <p className="no-rule">{profile.weeklyHours} hour{profile.weeklyHours === 1 ? '' : 's'} a week × 1 point{profile.weeklyHours > 15 ? ' (counted as 15)' : ''} = <b>{time} / 15</b></p>

      <p className="score-total">Total: {skills} + {experience} + {time} = <b>{skills + experience + time} / 100</b></p>
    </div>
  )
}
