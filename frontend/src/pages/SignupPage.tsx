import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
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
    <div className="relative min-h-screen flex items-center justify-center bg-surface px-4 py-12 overflow-hidden selection:bg-brand-light selection:text-brand">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[550px] w-[550px] rounded-full bg-gradient-to-bl from-brand/15 via-mist/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[550px] w-[550px] rounded-full bg-gradient-to-tr from-rose/20 via-brand/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-gradient-to-tr from-brand/5 via-rose/5 to-transparent blur-3xl" />

      {/* Floating Elements in Canvas Background */}
      <div className="pointer-events-none absolute top-8 right-8 hidden xl:block opacity-70 animate-pulse">
        <FloatingShieldElement className="h-16 w-16" />
      </div>
      <div className="pointer-events-none absolute top-10 left-10 hidden lg:block opacity-45 hover:opacity-80 transition-opacity">
        <FloatingSecuritySealElement className="h-28 w-28" />
      </div>
      <div className="pointer-events-none absolute bottom-12 right-10 hidden lg:block opacity-65">
        <FloatingTraceGraph className="w-32 h-20" />
      </div>
      <div className="pointer-events-none absolute top-28 right-1/3 hidden md:block opacity-80">
        <FloatingSparkle className="h-5 w-5" color="#E0BACF" />
      </div>
      <div className="pointer-events-none absolute bottom-24 left-16 hidden md:block opacity-60">
        <FloatingSparkle className="h-6 w-6" color="#9FB0E8" />
      </div>

      {/* Main Open Content Layout (Outer box removed) */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">

          {/* Left Column: Visual Showcase & Brand Narrative */}
          <div className="space-y-6 lg:col-span-6">
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
                  Reviewer Workspace
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-[40px] leading-tight">
                Start Validating IFSCA Compliance{' '}
                <span className="bg-gradient-to-r from-brand via-slate to-rose bg-clip-text text-transparent">
                  with Full Determinism.
                </span>
              </h1>
              <p className="text-sm font-normal leading-relaxed text-muted">
                Create an account to explore the compliance workspace: parsed regulations, AI-proposed
                obligations with exact source quotes, versioned rules, and traceable evaluations. New accounts
                get instant reviewer access to upload, review, and evaluate.
              </p>
            </div>

            {/* Completely Transparent RegTech Illustration with Overlaid Micro-Elements */}
            <div className="relative py-2">
              <div className="absolute -top-3 left-2 z-20 hidden sm:block">
                <FloatingClauseCardElement />
              </div>

              <HeroImage className="mx-auto max-w-md" />

              <div className="absolute -bottom-2 right-2 z-20 hidden sm:block">
                <FloatingRuleMetricElement />
              </div>
            </div>

            {/* 3-Step AI-to-Deterministic Pipeline Diagram (Transparent image element) */}
            <div className="pt-1">
              <FloatingAIPipelineElement className="w-full justify-between" />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <RegTechBadge label="Reviewer Privileges" icon="check" />
              <RegTechBadge label="FME Rulesets" icon="shield" />
              <RegTechBadge label="What-If Sandbox" icon="nodes" />
              <div className="inline-flex items-center gap-1.5 rounded-full border border-mist/40 bg-panel/70 px-3 py-1 text-xs font-semibold text-muted backdrop-blur-sm shadow-2xs">
                <span>✦ 100% Traceability Chain</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sleek Floating Sign-Up Card (Outer container removed) */}
          <div className="relative lg:col-span-6">
            {/* Angled Regulatory Clearance Stamp floating at the card's top-right */}
            <div className="pointer-events-none absolute -top-8 -right-4 z-20 hidden sm:block">
              <FloatingRegulatoryStamp className="h-16 w-36 drop-shadow-sm" />
            </div>

            <div className="relative rounded-3xl border border-line bg-panel/90 p-7 shadow-xl shadow-brand/5 backdrop-blur-xl sm:p-9 transition-all">
              {/* Subtle top highlight line */}
              <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
                    Create Account
                  </h2>
                  <p className="text-xs text-muted">
                    Self-service registration with immediate reviewer access
                  </p>
                </div>
                <div className="hidden sm:block">
                  <FloatingShieldElement className="h-10 w-10 opacity-70" />
                </div>
              </div>

              <form onSubmit={submit} className="mt-6 space-y-3.5">
                <label className="block">
                  <span className="text-xs font-semibold text-ink">Full Name</span>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-line bg-panel px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-ink">Work Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="priya@fundmanagement.demo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-line bg-panel px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-ink">
                    Organisation Name <span className="text-xs text-muted font-normal">(optional)</span>
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. GIFT Fund Management Corp"
                    value={organisationName}
                    onChange={(e) => setOrganisationName(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-line bg-panel px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-ink">Password</span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Min 12 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-line bg-panel px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-ink">Confirm</span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-line bg-panel px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                    />
                  </label>
                </div>

                <div aria-live="polite">
                  {error && (
                    <p className="rounded-xl border border-fail-border bg-fail-bg px-3.5 py-2.5 text-xs font-medium text-fail">
                      {error}
                    </p>
                  )}
                  {slow && (
                    <p className="text-xs text-upcoming flex items-center gap-1.5 pt-1">
                      <span className="h-2 w-2 rounded-full bg-upcoming animate-ping" />
                      Creating account… this can take a few moments.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full mt-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/35 disabled:opacity-50 active:scale-[0.99]"
                >
                  {busy ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              <div className="mt-5 border-t border-line/80 pt-4 text-center text-xs text-muted">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-brand hover:underline">
                  Sign in
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
