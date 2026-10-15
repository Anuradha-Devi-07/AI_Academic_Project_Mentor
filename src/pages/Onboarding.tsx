import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CircleAlert, ClipboardCheck, Pencil, RotateCw, Sparkles, TrendingUp } from 'lucide-react'
import { FlowSteps, ScoreRing, errorMessage } from '../components/ui'
import { SkillQuiz, type QuizResults } from '../components/SkillQuiz'
import { useAuth } from '../auth/AuthContext'
import { api } from '../services/api'
import { EXPERIENCE_LABELS, LEVEL_LABELS, PROFICIENCY_HINTS, PROFICIENCY_LABELS, SKILL_CATALOG, rating } from '../lib/skills'
import type { PriorExperience, Proficiency, StudentProfile } from '../types/models'

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name (at least 2 characters).').max(50, 'Please keep your name under 50 characters.'),
  course: z.string().trim().max(80, 'Please keep this under 80 characters.'),
  year: z.string(),
  skills: z.array(z.object({ skill: z.string(), level: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).min(1, 'Pick at least one skill — beginner level counts too.'),
  priorProjects: z.enum(['none', 'one', 'several']),
  weeklyHours: z.number({ error: 'Enter the number of hours you can spend each week.' }).int('Use a whole number.').min(1, 'Plan for at least 1 hour a week.').max(40, 'Up to 40 hours a week.'),
  teamSize: z.number().int().min(1).max(6),
})
type ProfileForm = z.infer<typeof profileSchema>
type Step = 'about' | 'skills' | 'quiz' | 'result'

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', 'Postgraduate']

export default function Onboarding({ profile, onSaved }: { profile: StudentProfile | null; onSaved: (p: StudentProfile) => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(profile ? 'result' : 'about')
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors, isSubmitting, isSubmitted }, setError } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: {
      name: profile?.name ?? user?.name ?? '',
      course: profile?.course ?? '',
      year: profile?.year ?? '',
      skills: profile?.skills.map(s => ({ skill: s.skill, level: s.selfLevel ?? s.level })) ?? [],
      priorProjects: profile?.priorProjects ?? 'none',
      weeklyHours: profile?.weeklyHours ?? 6,
      teamSize: profile?.teamSize ?? 1,
    },
  })
  const skills = watch('skills')
  const priorProjects = watch('priorProjects')

  const setSkills = (next: ProfileForm['skills']) => setValue('skills', next, { shouldValidate: isSubmitted, shouldDirty: true })
  const toggleSkill = (skill: string) => setSkills(skills.some(s => s.skill === skill) ? skills.filter(s => s.skill !== skill) : [...skills, { skill, level: 1 }])
  const setLevel = (skill: string, level: Proficiency) => setSkills(skills.map(s => s.skill === skill ? { ...s, level } : s))

  const goToSkills = async () => { if (await trigger(['name', 'course', 'year'])) setStep('skills') }
  const goToQuiz = async () => { if (await trigger(['skills', 'priorProjects', 'weeklyHours', 'teamSize'])) setStep('quiz') }
  // Quiz the skills the student rated highest first: that's where an over-estimate would hurt the plan most.
  const quizSkills = [...skills].sort((a, b) => b.level - a.level).map(s => s.skill)
  const previousQuiz = (skill: string) => profile?.skills.find(s => s.skill === skill)?.quiz

  /** Saves the profile; skills not in this quiz (or a skipped quiz) keep any earlier quiz result. */
  const save = (quiz: QuizResults | null) => handleSubmit(async data => {
    try {
      const saved = await api.saveProfile({
        name: data.name,
        course: data.course || undefined,
        year: data.year || undefined,
        skills: data.skills.map(s => rating(s.skill, s.level, quiz?.[s.skill] ?? previousQuiz(s.skill))),
        priorProjects: data.priorProjects,
        weeklyHours: data.weeklyHours,
        teamSize: data.teamSize,
      })
      onSaved(saved)
      setStep('result')
    } catch (e) {
      setError('root', { message: errorMessage(e) })
    }
  })()

  const intro = {
    about: { title: 'Your details', text: 'Tell us a little about yourself. Setup takes about five minutes.' },
    skills: { title: 'Your skills', text: "Pick the skills you've used and rate each one honestly. A short quiz checks them next." },
    quiz: { title: 'Skill quiz', text: "A few quick questions verify your ratings. It's a check-up, not an exam." },
    result: { title: 'Your skill check', text: 'This shapes the feasibility score, tech stack and milestones the agents create for you.' },
  }[step]

  return (
    <>
      {(step === 'skills' || step === 'quiz') && <button type="button" className="back-link" onClick={() => setStep(step === 'quiz' ? 'skills' : 'about')}><ArrowLeft size={15} /> {step === 'quiz' ? 'Back to your skills' : 'Back to your details'}</button>}
      <div className="form-shell">
        <div className="form-intro">
          <h1>{intro.title}</h1>
          <p>{intro.text}</p>
          <FlowSteps current={step === 'about' ? 0 : step === 'result' ? 2 : 1} />
        </div>

        {step === 'result' && profile ? <AssessmentResult profile={profile} onEdit={() => setStep('about')} onRetake={() => setStep('quiz')} onNext={() => navigate('/create')} />
          : step === 'quiz' ? <SkillQuiz skills={quizSkills} onComplete={results => save(results)} onSkip={() => save(null)} saving={isSubmitting} error={errors.root?.message} />
          : (
          <form className="form-card" onSubmit={e => { e.preventDefault(); if (step === 'about') goToSkills(); else goToQuiz() }} noValidate>
            {step === 'about' && <>
              <label>What should we call you? <span className="required-mark" aria-hidden="true">*</span>
                <input {...register('name')} placeholder="Your name" autoComplete="given-name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} autoFocus />
                {errors.name && <span className="field-error" id="name-error"><CircleAlert size={13} /> {errors.name.message}</span>}
              </label>
              <label>Course / branch <span className="optional-mark">Optional</span>
                <input {...register('course')} placeholder="e.g. B.Tech · AI & Data Science" aria-invalid={!!errors.course} />
                {errors.course && <span className="field-error"><CircleAlert size={13} /> {errors.course.message}</span>}
              </label>
              <label>Current year <span className="optional-mark">Optional</span>
                <select {...register('year')}><option value="">Select your year</option>{YEARS.map(y => <option key={y}>{y}</option>)}</select>
              </label>
              <button className="button button-primary form-submit" type="button" onClick={goToSkills}>Next: skill check <ArrowRight size={16} /></button>
            </>}

            {step === 'skills' && <>
              <div className="field-label" id="skills-label">Which skills have you used? <span className="required-mark" aria-hidden="true">*</span></div>
              <p className="field-hint" id="skills-hint">Choose all that apply{skills.length > 0 && ` · ${skills.length} selected`}, then rate each one below.</p>
              <div className="skill-options" role="group" aria-labelledby="skills-label" aria-describedby="skills-hint">
                {SKILL_CATALOG.map(({ skill }) => { const on = skills.some(s => s.skill === skill); return <button type="button" key={skill} aria-pressed={on} className={on ? 'skill-option selected' : 'skill-option'} onClick={() => toggleSkill(skill)}>{on && <Check size={13} />} {skill}</button> })}
              </div>
              {errors.skills && <p className="field-error standalone"><CircleAlert size={13} /> {errors.skills.message ?? errors.skills.root?.message}</p>}

              {skills.length > 0 && <div className="rating-list">
                <div className="rating-key">{([1, 2, 3] as Proficiency[]).map(l => <span key={l}><strong>{PROFICIENCY_LABELS[l]}</strong> — {PROFICIENCY_HINTS[l]}</span>)}</div>
                {skills.map(s => (
                  <fieldset className="rating-row" key={s.skill}>
                    <legend>{s.skill}</legend>
                    <div className="segmented">
                      {([1, 2, 3] as Proficiency[]).map(l => <label key={l} className={s.level === l ? 'on' : undefined} title={PROFICIENCY_HINTS[l]}><input type="radio" name={`level-${s.skill}`} checked={s.level === l} onChange={() => setLevel(s.skill, l)} />{PROFICIENCY_LABELS[l]}</label>)}
                    </div>
                  </fieldset>
                ))}
              </div>}

              <fieldset className="choice-group">
                <legend className="field-label">Have you built a project outside class before?</legend>
                <div className="segmented wide">
                  {(Object.keys(EXPERIENCE_LABELS) as PriorExperience[]).map(v => <label key={v} className={priorProjects === v ? 'on' : undefined}><input type="radio" value={v} {...register('priorProjects')} />{EXPERIENCE_LABELS[v]}</label>)}
                </div>
              </fieldset>

              <div className="field-row">
                <label>Hours per week for the project
                  <span className="input-suffix"><input type="number" min={1} max={40} inputMode="numeric" {...register('weeklyHours', { valueAsNumber: true })} aria-invalid={!!errors.weeklyHours} /><span>hrs</span></span>
                  {errors.weeklyHours && <span className="field-error"><CircleAlert size={13} /> {errors.weeklyHours.message}</span>}
                </label>
                <label>Team size
                  <select {...register('teamSize', { setValueAs: Number })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n === 1 ? 'Just me' : `${n} people`}</option>)}</select>
                </label>
              </div>

              <button className="button button-primary form-submit" type="submit">Next: quick skill quiz <ArrowRight size={16} /></button>
            </>}
          </form>
        )}
      </div>
    </>
  )
}

function AssessmentResult({ profile, onEdit, onRetake, onNext }: { profile: StudentProfile; onEdit: () => void; onRetake: () => void; onNext: () => void }) {
  const { assessment } = profile
  const verified = profile.skills.filter(s => s.quiz).length
  return (
    <div className="form-card" role="status" aria-live="polite">
      <div className="assessment-head">
        <ScoreRing score={assessment.score} size="lg" label="Readiness score" />
        <div>
          <span className="muted-label">READINESS SCORE</span>
          <h2>{LEVEL_LABELS[assessment.level]}</h2>
          <p>Nice to meet you, {profile.name}! {profile.skills.length} skill{profile.skills.length === 1 ? '' : 's'} · {profile.weeklyHours}h/week · {profile.teamSize === 1 ? 'solo' : `team of ${profile.teamSize}`}</p>
        </div>
      </div>
      <div className="assessment-block">
        <span className="muted-label"><ClipboardCheck size={13} /> SKILL LEVELS · {verified} OF {profile.skills.length} VERIFIED BY QUIZ</span>
        <ul className="skill-results">
          {profile.skills.map(s => (
            <li key={s.skill}>
              <span className="skill-results-name">{s.skill}</span>
              <span className={`level-pill l${s.level}`}>{PROFICIENCY_LABELS[s.level]}</span>
              <span className="skill-results-source">
                {s.quiz
                  ? <><Check size={12} /> Quiz {s.quiz.correct}/{s.quiz.total}{s.quiz.level !== (s.selfLevel ?? s.level) && <> · you said {PROFICIENCY_LABELS[s.selfLevel].toLowerCase()}</>}</>
                  : 'Self-rated'}
              </span>
            </li>
          ))}
        </ul>
        {verified < profile.skills.length && <p className="field-hint">Self-rated skills count at the level you chose. Take the quiz to verify them.</p>}
      </div>
      {assessment.strengths.length > 0 && <div className="assessment-block"><span className="muted-label"><Sparkles size={13} /> YOUR STRENGTHS</span><div className="tag-list">{assessment.strengths.map(s => <span className="tag" key={s}>{s}</span>)}</div></div>}
      {assessment.growthAreas.length > 0 && <div className="assessment-block"><span className="muted-label"><TrendingUp size={13} /> WORTH GROWING</span><ul className="plain-list">{assessment.growthAreas.map(g => <li key={g}>{g}</li>)}</ul></div>}
      <div className="summary-actions">
        <button type="button" className="button button-ghost" onClick={onEdit}><Pencil size={15} /> Edit profile</button>
        <button type="button" className="button button-ghost" onClick={onRetake}><RotateCw size={15} /> {verified ? 'Retake quiz' : 'Take the quiz'}</button>
        <button type="button" className="button button-primary" onClick={onNext}>Next: share your idea <ArrowRight size={16} /></button>
      </div>
    </div>
  )
}
