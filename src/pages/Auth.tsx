import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, CircleAlert, CircleHelp, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../components/ui'
import { ApiError, api, isDemoMode } from '../services/api'

type FromState = { from?: string } | null

/** Where to go after signing in: onboarding until a profile exists, then the page they were sent away from. */
const nextPath = (from?: string) => !api.getProfile() ? '/onboarding' : from && from !== '/sign-in' && from !== '/register' ? from : '/projects'

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name (at least 2 characters).').max(50, 'Please keep your name under 50 characters.'),
  email: z.email('Enter a valid email address, like name@college.edu.'),
  password: z.string().min(8, 'Use at least 8 characters.').regex(/[A-Za-z]/, 'Include at least one letter.').regex(/\d/, 'Include at least one number.'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { path: ['confirm'], message: "Passwords don't match." })

const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export function Register() {
  const { user, register: createAccount } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as FromState)?.from
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema), mode: 'onTouched', defaultValues: { name: '', email: '', password: '', confirm: '' },
  })
  const password = watch('password')
  const rules = [{ ok: password.length >= 8, label: '8+ characters' }, { ok: /[A-Za-z]/.test(password), label: 'A letter' }, { ok: /\d/.test(password), label: 'A number' }]

  if (user) return <Navigate to={nextPath(from)} replace />

  const submit = handleSubmit(async data => {
    try {
      await createAccount({ name: data.name, email: data.email, password: data.password })
      navigate(nextPath(from), { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('email', { message: 'An account with this email already exists. Try signing in instead.' })
      else setError('root', { message: errorMessage(e) })
    }
  })

  return (
    <AuthLayout title="Create your account" text="Your profile, project ideas and blueprints stay together in one place.">
      <form className="form-card" onSubmit={submit} noValidate>
        <Field label="Your name" error={errors.name?.message} input={register('name')} placeholder="e.g. Asha Kumar" autoComplete="name" autoFocus />
        <Field label="Email" error={errors.email?.message} input={register('email')} type="email" placeholder="name@college.edu" autoComplete="email" inputMode="email" />
        <PasswordField label="Password" error={errors.password?.message} input={register('password')} autoComplete="new-password" describedBy="password-rules" />
        <ul className="password-rules" id="password-rules" aria-label="Password requirements">{rules.map(r => <li key={r.label} className={r.ok ? 'ok' : undefined}>{r.ok ? <Check size={12} /> : <span className="rule-dot" />} {r.label}</li>)}</ul>
        <PasswordField label="Confirm password" error={errors.confirm?.message} input={register('confirm')} autoComplete="new-password" />
        {isDemoMode && <DemoNote />}
        {errors.root && <p className="form-error" role="alert"><CircleAlert size={15} /> {errors.root.message}</p>}
        <button className="button button-primary form-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating your account…' : <>Create account <ArrowRight size={16} /></>}</button>
        <p className="auth-switch">Already have an account? <Link to="/sign-in" state={{ from }}>Sign in</Link></p>
      </form>
    </AuthLayout>
  )
}

export function SignIn() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as FromState)?.from
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema), mode: 'onTouched', defaultValues: { email: '', password: '' },
  })

  if (user) return <Navigate to={nextPath(from)} replace />

  const submit = handleSubmit(async data => {
    try {
      await signIn(data)
      navigate(nextPath(from), { replace: true })
    } catch (e) {
      setError('root', { message: errorMessage(e) })
    }
  })

  return (
    <AuthLayout title="Sign in" text={from ? 'Please sign in to continue to that page.' : 'Welcome back. Sign in to see your projects.'}>
      <form className="form-card" onSubmit={submit} noValidate>
        <Field label="Email" error={errors.email?.message} input={register('email')} type="email" placeholder="name@college.edu" autoComplete="email" inputMode="email" autoFocus />
        <PasswordField label="Password" error={errors.password?.message} input={register('password')} autoComplete="current-password" />
        {errors.root && <p className="form-error" role="alert"><CircleAlert size={15} /> {errors.root.message}</p>}
        <button className="button button-primary form-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button>
        <p className="auth-switch">New here? <Link to="/register" state={{ from }}>Create an account</Link></p>
      </form>
    </AuthLayout>
  )
}

function AuthLayout({ title, text, children }: { title: ReactNode; text: string; children: ReactNode }) {
  return (
    <div className="form-shell auth-shell">
      <div className="form-intro"><h1>{title}</h1><p>{text}</p></div>
      {children}
    </div>
  )
}

type FieldProps = { label: string; error?: string; input: UseFormRegisterReturn } & Omit<InputHTMLAttributes<HTMLInputElement>, 'name'>

function Field({ label, error, input, ...rest }: FieldProps) {
  const errorId = `${input.name}-error`
  return (
    <label>{label}
      <input {...input} {...rest} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
      {error && <span className="field-error" id={errorId}><CircleAlert size={13} /> {error}</span>}
    </label>
  )
}

function PasswordField({ label, error, input, autoComplete, describedBy }: { label: string; error?: string; input: UseFormRegisterReturn; autoComplete: string; describedBy?: string }) {
  const [visible, setVisible] = useState(false)
  const errorId = `${input.name}-error`
  return (
    <label>{label}
      <span className="password-input">
        <input {...input} type={visible ? 'text' : 'password'} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={[error && errorId, describedBy].filter(Boolean).join(' ') || undefined} />
        <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </span>
      {error && <span className="field-error" id={errorId}><CircleAlert size={13} /> {error}</span>}
    </label>
  )
}

function DemoNote() {
  return <div className="demo-note"><CircleHelp size={16} /><p><strong>Demo mode:</strong> your account is stored only in this browser and isn't secure. Don't reuse a real password.</p></div>
}
