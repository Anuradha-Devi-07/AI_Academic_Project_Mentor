import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { RequireAuth, useAuth } from './auth/AuthContext'
import { Brand } from './components/ui'
import { UserMenu } from './components/UserMenu'
import { ThemeMenu } from './components/ThemeMenu'
import { api } from './services/api'
import type { StudentProfile } from './types/models'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import CreateProject from './pages/CreateProject'
import Projects from './pages/Projects'
import ProjectRun from './pages/ProjectRun'
import { ForgotPassword, Register, SignIn } from './pages/Auth'

const pageTitle = (pathname: string) =>
  pathname === '/sign-in' ? 'Sign in · ProjectMentor AI'
    : pathname === '/forgot-password' ? 'Forgot password · ProjectMentor AI'
    : pathname === '/register' ? 'Create account · ProjectMentor AI'
    : pathname === '/onboarding' ? 'Your profile · ProjectMentor AI'
    : pathname === '/create' ? 'Share your idea · ProjectMentor AI'
      : pathname === '/projects' ? 'My projects · ProjectMentor AI'
        : pathname.startsWith('/projects/') ? 'Project · ProjectMentor AI'
          : 'ProjectMentor AI — From idea to impact'

/** Scrolls to the top on page change, or to the #section in the URL once it has rendered. */
function useScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    document.title = pageTitle(pathname)
    if (!hash) { window.scrollTo({ top: 0 }); return }
    let frame = 0, tries = 0
    const find = () => {
      const target = document.getElementById(hash.slice(1))
      if (target) target.scrollIntoView({ behavior: 'smooth' })
      else if (tries++ < 60) frame = requestAnimationFrame(find)
    }
    find()
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
}

function App() {
  const location = useLocation()
  const { user } = useAuth()
  const [profile, setProfile] = useState<StudentProfile | null>(() => api.getProfile())
  // Each account has its own profile: reload it whenever someone signs in or out.
  useEffect(() => { setProfile(api.getProfile()) }, [user?.id])
  useScrollManager()


  return (
    <div className="app-shell" id="top">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="navbar">
        <div className="nav-inner">
          <Brand />
          <nav aria-label="Main" className="nav-bar">
            <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/" end>{user ? 'Dashboard' : 'Home'}</NavLink>
            {user ? <>
              <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/projects" end>My projects</NavLink>
              <UserMenu />
            </> : <>
              <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/sign-in">Sign in</NavLink>
              <Link className="button button-small button-light" to="/register">Get started <ArrowUpRight size={15} /></Link>
              <ThemeMenu />
            </>}
          </nav>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main id="main" tabIndex={-1} key={location.pathname} className="page section-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }}>
          <Routes location={location}>
            <Route path="/" element={<Home profile={profile} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding profile={profile} onSaved={setProfile} /></RequireAuth>} />
            <Route path="/create" element={<RequireAuth><CreateProject profile={profile} /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth><Projects /></RequireAuth>} />
            <Route path="/projects/:projectId" element={<RequireAuth><ProjectRun /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
    </div>
  )
}

export default App
