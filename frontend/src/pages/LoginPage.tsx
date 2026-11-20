import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import {
  BrandLogo,
  FloatingAIPipelineElement,
  FloatingClauseCardElement,
  FloatingRegulatoryStamp,
  FloatingRuleMetricElement,
  FloatingSecuritySealElement,
  FloatingShieldElement,
  FloatingSparkle,
  FloatingTraceGraph,
  HeroImage,
  RegTechBadge,
} from '../components/ThemeGraphics'
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
    <div className="relative min-h-screen flex items-center justify-center bg-surface px-4 py-12 overflow-hidden selection:bg-brand-light selection:text-brand">
      {/* Background Ambient Glows (No solid boxes, purely atmospheric radial gradients) */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-brand/15 via-mist/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[550px] w-[550px] rounded-full bg-gradient-to-tl from-rose/20 via-brand/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-gradient-to-tr from-brand/5 via-rose/5 to-transparent blur-3xl" />

      {/* Floating Transparent Elements Scattered Across the Canvas */}
      <div className="pointer-events-none absolute top-8 left-8 hidden xl:block opacity-70 animate-pulse">
        <FloatingShieldElement className="h-16 w-16" />
      </div>
      <div className="pointer-events-none absolute top-10 right-12 hidden lg:block opacity-45 hover:opacity-80 transition-opacity">
        <FloatingSecuritySealElement className="h-28 w-28" />
      </div>
      <div className="pointer-events-none absolute bottom-12 left-10 hidden lg:block opacity-65">
        <FloatingTraceGraph className="w-32 h-20" />
      </div>
      <div className="pointer-events-none absolute top-28 left-1/3 hidden md:block opacity-80">
        <FloatingSparkle className="h-5 w-5" color="#E0BACF" />
      </div>
      <div className="pointer-events-none absolute bottom-24 right-16 hidden md:block opacity-60">
        <FloatingSparkle className="h-6 w-6" color="#9FB0E8" />
      </div>
      <div className="pointer-events-none absolute bottom-8 left-1/2 hidden md:block opacity-75">
        <FloatingSparkle className="h-4 w-4" color="#6281DC" />
      </div>

      {/* Main Open Content Layout (Outer heavy container box removed) */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">

          {/* Left Column: Visual Showcase, Brand Story & Rich Image Elements */}
          <div className="space-y-6 lg:col-span-7">
            {/* Brand Header */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <BrandLogo className="h-11 w-11 shadow-md shadow-brand/20 rounded-xl" />
                <FloatingSparkle className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5" color="#E0BACF" />
              </div>
              <div>
                <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
                  ClauseTrace
                </span>
                <span className="ml-2.5 inline-flex items-center rounded-full border border-mist/30 bg-mist/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                  IFSCA FME RegTech
                </span>
              </div>
            </div>

            {/* Headline and Value Proposition */}
            <div className="space-y-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-[42px] leading-tight">
                Turning Financial Regulations into{' '}
                <span className="bg-gradient-to-r from-brand via-slate to-rose bg-clip-text text-transparent">
                  Machine-Checkable Truth.
                </span>
              </h1>
              <p className="text-sm font-normal leading-relaxed text-muted max-w-xl">
                Purpose-built for IFSCA circulars governing Fund Management Entities (FMEs) in GIFT City IFSC.
                AI extracts, compliance officers verify, and deterministic rules evaluate with end-to-end audit traceability.
              </p>
            </div>

            {/* Completely Transparent RegTech Illustration with Overlaid Micro-Elements */}
            <div className="relative py-2">
              {/* Floating Clause Snippet element hovering near top-left of hero */}
              <div className="absolute -top-3 left-4 z-20 hidden sm:block">
                <FloatingClauseCardElement />
              </div>

              {/* Central Transparent Vector Artwork */}
              <HeroImage className="mx-auto max-w-lg" />

              {/* Floating Rule Metric element hovering near bottom-right of hero */}
              <div className="absolute -bottom-2 right-4 z-20 hidden sm:block">
                <FloatingRuleMetricElement />
              </div>
            </div>

            {/* 3-Step AI-to-Deterministic Pipeline Diagram (Transparent image element) */}
            <div className="pt-1">
              <FloatingAIPipelineElement className="w-full justify-between" />
            </div>

            {/* Transparent Floating Badges & Dual-Coded Features */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <RegTechBadge label="GIFT IFSC Framework" icon="shield" />
              <RegTechBadge label="Deterministic Evaluation" icon="check" />
              <RegTechBadge label="Immutable Audit Chain" icon="nodes" />
              <div className="inline-flex items-center gap-1.5 rounded-full border border-rose/30 bg-rose/10 px-3 py-1 text-xs font-semibold text-[#6B3254] dark:text-rose">
                <span>✦ Zero Hallucination Rules</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sleek Floating Sign-In Card (Only the form is boxed, outer box removed) */}
          <div className="relative lg:col-span-5">
            {/* Angled Regulatory Clearance Stamp floating at the card's top-right */}
            <div className="pointer-events-none absolute -top-8 -right-4 z-20 hidden sm:block">
              <FloatingRegulatoryStamp className="h-16 w-36 drop-shadow-sm" />
            </div>

            <div className="relative rounded-3xl border border-line bg-panel/90 p-7 shadow-xl shadow-brand/5 backdrop-blur-xl sm:p-9 transition-all">
              {/* Subtle top highlight gradient line */}
              <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
                    Sign In
                  </h2>
                  <p className="text-xs text-muted">
                    Access your deterministic compliance console
                  </p>
                </div>
                <div className="hidden sm:block">
                  <FloatingShieldElement className="h-10 w-10 opacity-70" />
                </div>
              </div>

              <form onSubmit={submit} className="mt-7 space-y-4">
                {navNotice && !error && (
                  <p className="rounded-xl border border-line bg-brand-light px-3.5 py-2.5 text-xs font-semibold text-brand">
                    {navNotice}
                  </p>
                )}
                {notice && !navNotice && !error && (
                  <p className="rounded-xl border border-rose/40 bg-rose/15 px-3.5 py-2.5 text-xs font-semibold text-[#6B3254] dark:text-rose">
                    {notice}
                  </p>
                )}

                <label className="block">
                  <span className="text-xs font-semibold text-ink">Work Email</span>
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="reviewer@clausetrace.demo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-ink">Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  />
                </label>

                <div aria-live="polite">
                  {error && (
                    <p className="rounded-xl border border-fail-border bg-fail-bg px-3.5 py-2.5 text-xs font-medium text-fail">
                      {error}
                    </p>
                  )}
                  {slow && (
                    <p className="text-xs text-upcoming flex items-center gap-1.5 pt-1">
                      <span className="h-2 w-2 rounded-full bg-upcoming animate-ping" />
                      Waking up the server… this can take up to a minute.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full mt-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/35 disabled:opacity-50 active:scale-[0.99]"
                >
                  {busy ? 'Signing in…' : 'Sign in to Console'}
                </button>
              </form>

              <div className="mt-6 border-t border-line/80 pt-5 text-center text-xs text-muted">
                Don't have an account?{' '}
                <Link to="/signup" className="font-semibold text-brand hover:underline">
                  Create account with Reviewer access
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
