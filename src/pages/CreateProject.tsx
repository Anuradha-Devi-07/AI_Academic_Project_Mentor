import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, CircleAlert, GraduationCap, Sparkles } from 'lucide-react'
import { FlowSteps, errorMessage } from '../components/ui'
import { api } from '../services/api'
import { DOMAIN_LABELS, LEVEL_LABELS } from '../lib/skills'
import type { ProjectDomain, StudentProfile } from '../types/models'

const MIN_IDEA = 30
const MAX_IDEA = 1000
const DURATIONS = [4, 6, 8, 10, 12, 16]
const DOMAINS = Object.keys(DOMAIN_LABELS) as ProjectDomain[]

const ideaSchema = z.object({
  title: z.string().trim().min(3, 'Give your idea a short working title (at least 3 characters).').max(80, 'Please keep the title under 80 characters.'),
  description: z.string().trim().min(MIN_IDEA, `Add a little more detail — at least ${MIN_IDEA} characters (about two sentences).`).max(MAX_IDEA, `Please keep it under ${MAX_IDEA} characters.`),
  domain: z.enum(['ai_ml', 'web', 'mobile', 'iot', 'data', 'other']),
  durationWeeks: z.number().int().min(4).max(24),
})
type IdeaForm = z.infer<typeof ideaSchema>

export default function CreateProject({ profile }: { profile: StudentProfile | null }) {
  if (!profile) return <NeedsProfile />
  return <IdeaFormPage profile={profile} />
}

function NeedsProfile() {
  return (
    <div className="empty-state">
      <h1>Complete your profile first</h1>
      <p>The agents use your skills, time and team size to make the plan realistic. It takes about two minutes.</p>
      <Link className="button button-primary" to="/onboarding">Create my profile <ArrowRight size={16} /></Link>
    </div>
  )
}

function IdeaFormPage({ profile }: { profile: StudentProfile }) {
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, setError } = useForm<IdeaForm>({
    resolver: zodResolver(ideaSchema),
    mode: 'onTouched',
    defaultValues: { title: '', description: '', domain: 'web', durationWeeks: 8 },
  })
  const description = watch('description')
  const domain = watch('domain')
  const length = description.trim().length

  const submit = handleSubmit(async data => {
    try {
      const { project } = await api.submitIdea(data)
      navigate(`/projects/${project.id}`)
    } catch (e) {
      setError('root', { message: errorMessage(e) })
    }
  })

  return (
    <>
      <div className="form-shell create-shell">
        <div className="form-intro">
          <h1>New project idea</h1>
          <p>Describe your idea in two or three sentences. It doesn't need to be perfect.</p>
          <FlowSteps current={2} />
          <div className="profile-chip"><GraduationCap size={15} /><span>Planning for <strong>{profile.name}</strong> · {LEVEL_LABELS[profile.assessment.level]} · {profile.weeklyHours}h/week</span><Link to="/onboarding">Edit</Link></div>
        </div>

        <form className="form-card" onSubmit={submit} noValidate>
          <label>Give your idea a working title <span className="required-mark" aria-hidden="true">*</span>
            <input {...register('title')} placeholder="e.g. Smart Campus Companion" aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-error' : undefined} autoFocus />
            {errors.title && <span className="field-error" id="title-error"><CircleAlert size={13} /> {errors.title.message}</span>}
          </label>

          <label>Describe your idea <span className="required-mark" aria-hidden="true">*</span>
            <textarea {...register('description')} placeholder="What problem do you want to solve? Who would use your solution? What do you imagine it doing?" rows={6} maxLength={MAX_IDEA} aria-invalid={!!errors.description} aria-describedby="idea-help" />
          </label>
          <div className="textarea-footer" id="idea-help">
            {errors.description
              ? <span className="field-error"><CircleAlert size={13} /> {errors.description.message}</span>
              : <span className={length >= MIN_IDEA ? 'ok' : ''}>{length >= MIN_IDEA ? <><Check size={12} /> Looks good</> : length ? `Add ${MIN_IDEA - length} more character${MIN_IDEA - length === 1 ? '' : 's'}` : 'Two or three sentences are enough'}</span>}
            <span className={description.length > MAX_IDEA * .9 ? 'warn' : ''}>{description.length}/{MAX_IDEA}</span>
          </div>

          <fieldset className="choice-group">
            <legend className="field-label">What kind of project is it?</legend>
            <div className="skill-options">
              {DOMAINS.map(d => <label key={d} className={domain === d ? 'skill-option selected' : 'skill-option'}><input type="radio" className="visually-hidden" value={d} {...register('domain')} />{domain === d && <Check size={13} />} {DOMAIN_LABELS[d]}</label>)}
            </div>
          </fieldset>

          <label>How long do you have?
            <select {...register('durationWeeks', { setValueAs: Number })}>{DURATIONS.map(w => <option key={w} value={w}>{w} weeks</option>)}</select>
          </label>

          {errors.root && <p className="form-error" role="alert"><CircleAlert size={15} /> {errors.root.message}</p>}
          <button className="button button-primary form-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Starting the agents…' : <>Generate my blueprint <Sparkles size={16} /></>}</button>
        </form>
      </div>
    </>
  )
}
