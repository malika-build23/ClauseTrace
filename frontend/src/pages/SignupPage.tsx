import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { BrandLogo, HeroImage, RegTechBadge } from '../components/ThemeGraphics'
import { apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'

export function SignupPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organisationName, setOrganisationName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).')
      return
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const timer = setTimeout(() => setSlow(true), 4000)
    try {
      await apiPost('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        organisationName: organisationName.trim() || undefined,
      })

      // On successful signup, navigate to login with a notice
      navigate('/login', {
        state: {
          notice: 'Account created successfully! Please sign in with your credentials.',
          email: email.trim(),
        },
        replace: true,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      clearTimeout(timer)
      setSlow(false)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-5xl rounded-3xl border border-[#D1E8E2] bg-white p-6 shadow-xl lg:p-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Visual Showcase & Brand Story */}
          <div className="space-y-6 lg:col-span-6">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-10 w-10" />
              <span className="font-display text-2xl font-bold tracking-tight text-[#2C3531]">ClauseTrace</span>
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#2C3531] sm:text-4xl">
                Start Validating IFSCA Compliance Today.
              </h1>
              <p className="text-sm font-medium leading-relaxed text-[#586b66]">
                Create an account to explore the compliance workspace: parsed regulations, AI-proposed obligations with their exact source quotes, versioned rules and traceable results. New accounts get reviewer access to upload, review and evaluate; an admin can change roles at any time.
              </p>
            </div>

            <div className="py-2">
              <HeroImage className="mx-auto max-w-sm drop-shadow-md" />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <RegTechBadge label="Reviewer Access" icon="check" />
              <RegTechBadge label="FME Rulesets" icon="shield" />
              <RegTechBadge label="What-If Sandbox" icon="nodes" />
            </div>
          </div>

          {/* Right Column: Sign Up Form */}
          <div className="rounded-2xl border border-[#D1E8E2] bg-[#F5FAF8]/80 p-6 shadow-sm lg:col-span-6 lg:p-8">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-[#2C3531]">Create Account</h2>
              <p className="text-xs text-[#586b66]">Self-service registration with reviewer access</p>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-3.5">
              <label className="block">
                <span className="text-xs font-semibold text-[#2C3531]">Full Name</span>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#D1E8E2] bg-white px-3 py-2 text-sm text-[#2C3531] placeholder-slate-400 focus:border-[#116466] focus:ring-1 focus:ring-[#116466] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#2C3531]">Work Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="priya@fundmanagement.demo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#D1E8E2] bg-white px-3 py-2 text-sm text-[#2C3531] placeholder-slate-400 focus:border-[#116466] focus:ring-1 focus:ring-[#116466] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#2C3531]">
                  Organisation Name <span className="text-xs text-muted font-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  placeholder="e.g. GIFT Fund Management Corp"
                  value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#D1E8E2] bg-white px-3 py-2 text-sm text-[#2C3531] placeholder-slate-400 focus:border-[#116466] focus:ring-1 focus:ring-[#116466] focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[#2C3531]">Password</span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Min 12 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#D1E8E2] bg-white px-3 py-2 text-sm text-[#2C3531] placeholder-slate-400 focus:border-[#116466] focus:ring-1 focus:ring-[#116466] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[#2C3531]">Confirm</span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#D1E8E2] bg-white px-3 py-2 text-sm text-[#2C3531] placeholder-slate-400 focus:border-[#116466] focus:ring-1 focus:ring-[#116466] focus:outline-none"
                  />
                </label>
              </div>

              <div aria-live="polite">
                {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
                {slow && <p className="text-xs text-[#be7534]">Creating account… this can take a few moments.</p>}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-[#116466] py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0c4d4f] disabled:opacity-50"
              >
                {busy ? 'Creating Account…' : 'Sign Up to Continue'}
              </button>
            </form>

            <div className="mt-4 border-t border-[#D1E8E2] pt-3 text-center text-xs text-[#586b66]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#116466] hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
