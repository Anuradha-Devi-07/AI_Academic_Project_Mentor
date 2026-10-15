import type { CSSProperties } from 'react'
import { Check, Orbit } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Brand() {
  return <Link to="/" className="brand" aria-label="ProjectMentor AI home"><span className="brand-mark"><Orbit size={20} /></span><span className="brand-text">projectmentor<span className="brand-ai">.ai</span></span></Link>
}

const FLOW = ['Your profile', 'Skill check', 'Your idea']

/** Progress through the setup flow: 0 = profile, 1 = skills, 2 = idea. */
export function FlowSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="flow-steps" aria-label="Setup progress">
      {FLOW.map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current ? 'active' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span className="flow-dot">{i < current ? <Check size={12} aria-label="Done" /> : `0${i + 1}`}</span>
          <span className="flow-label">{label}</span>
        </li>
      ))}
    </ol>
  )
}

export function ScoreRing({ score, size = 'md', label }: { score: number; size?: 'md' | 'lg'; label: string }) {
  return (
    <div className={`ring ring-${size}`} style={{ '--p': `${score}%` } as CSSProperties} role="img" aria-label={`${label}: ${score} out of 100`}>
      <span>{score}</span>
    </div>
  )
}

export const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.'
