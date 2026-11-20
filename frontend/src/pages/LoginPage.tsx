import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { BrandLogo, HeroImage, RegTechBadge } from '../components/ThemeGraphics'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const { user, login, notice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const navNotice = (location.state as { notice?: string } | null)?.notice
  const prefilledEmail = (location.state as { email?: string } | null)?.email

  const [email, setEmail] = useState(prefilledEmail ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)

  if (user) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const timer = setTimeout(() => setSlow(true), 4000)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
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
          <div className="space-y-6 lg:col-span-7">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-10 w-10" />
              <span className="font-display text-2xl font-bold tracking-tight text-[#2C3531]">ClauseTrace</span>
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#2C3531] sm:text-4xl">
                Turning Financial Regulations into Machine-Checkable Truth.
              </h1>
              <p className="text-sm font-medium leading-relaxed text-[#586b66]">
                Purpose-built for IFSCA circulars governing Fund Management Entities (FMEs) in GIFT City IFSC. AI extracts, compliance officers verify, and deterministic rules evaluate.
              </p>
            </div>

            {/* Transparent RegTech Illustration with Ambient Glow */}
            <div className="py-2">
              <HeroImage className="mx-auto max-w-md drop-shadow-lg" />
            </div>

            {/* Badges in User Palette */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <RegTechBadge label="IFSCA FME Framework" icon="shield" />
              <RegTechBadge label="Deterministic Evaluation" icon="check" />
              <RegTechBadge label="Immutable Audit Chain" icon="nodes" />
            </div>
          </div>

          {/* Right Column: Sign In Form */}
          <div className="rounded-2xl border border-[#D1E8E2] bg-[#F5FAF8]/80 p-6 shadow-sm lg:col-span-5 lg:p-8">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-[#2C3531]">Welcome Back</h2>
              <p className="text-xs text-[#586b66]">Sign in to your compliance workspace</p>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {navNotice && !error && (
                <p className="rounded-lg border border-[#D1E8E2] bg-[#EBF5F2] px-3 py-2 text-xs font-semibold text-[#116466]">
                  {navNotice}
                </p>
              )}
              {notice && !navNotice && !error && (
                <p className="rounded-lg border border-[#FFCB9A] bg-[#FFF5EC] px-3 py-2 text-xs font-semibold text-[#8C5828]">
                  {notice}
                </p>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-[#2C3531]">Work Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="reviewer@clausetrace.demo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#D1E8E2] bg-white px-3 py-2 text-sm text-[#2C3531] placeholder-slate-400 focus:border-[#116466] focus:ring-1 focus:ring-[#116466] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#2C3531]">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#D1E8E2] bg-white px-3 py-2 text-sm text-[#2C3531] placeholder-slate-400 focus:border-[#116466] focus:ring-1 focus:ring-[#116466] focus:outline-none"
                />
              </label>

              <div aria-live="polite">
                {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
                {slow && <p className="text-xs text-[#be7534]">Waking up the server… this can take up to a minute.</p>}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-[#116466] py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0c4d4f] disabled:opacity-50"
              >
                {busy ? 'Signing in…' : 'Sign in to Console'}
              </button>
            </form>

            <div className="mt-6 border-t border-[#D1E8E2] pt-4 text-center text-xs text-[#586b66]">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold text-[#116466] hover:underline">
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
