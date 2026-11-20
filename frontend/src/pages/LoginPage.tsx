import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const { user, login, notice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">ClauseTrace</h1>
        <p className="mt-1 text-center text-sm text-muted">AI reads. Humans verify. Every result remains traceable.</p>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-line bg-panel p-6 shadow-sm">
          <h2 className="text-lg font-medium">Sign in</h2>
          {notice && !error && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-upcoming">{notice}</p>}

          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
            />
          </label>

          <div aria-live="polite">
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}
            {slow && <p className="text-sm text-muted">Waking up the server… this can take up to a minute.</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">Accounts are created by an administrator.</p>
      </div>
    </div>
  )
}
