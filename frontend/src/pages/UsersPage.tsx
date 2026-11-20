import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiGet, apiSend, type ManagedUser, type Role } from '../lib/api'
import { useAuth } from '../lib/auth'

const ROLES: Role[] = ['viewer', 'reviewer', 'admin']
const ROLE_HELP: Record<Role, string> = {
  viewer: 'Read-only',
  reviewer: 'Upload, extract, review',
  admin: 'Everything, plus user management',
}

const inputClass =
  'mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none'

export function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'viewer' as Role, password: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    apiGet<ManagedUser[]>('/api/users')
      .then(setUsers)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const created = await apiSend<ManagedUser>('POST', '/api/users', form)
      setMessage(`Created ${created.email}. Share the password with them through a secure channel.`)
      setForm({ name: '', email: '', role: 'viewer', password: '' })
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function update(u: ManagedUser, change: Partial<{ role: Role; isActive: boolean; password: string }>) {
    setError(null)
    setMessage(null)
    try {
      await apiSend('PATCH', `/api/users/${u.id}`, change)
      setMessage(change.password ? `Password reset for ${u.email}.` : `Updated ${u.email}.`)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function resetPassword(u: ManagedUser) {
    const password = window.prompt(`New password for ${u.email} (at least 12 characters):`)
    if (password) update(u, { password })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted">Create accounts and set roles. Every change is recorded in the audit log.</p>
      </div>

      <div aria-live="polite">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}
        {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-pass">{message}</p>}
      </div>

      <section className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Last sign-in</th>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!users && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {users?.map((u) => {
              const self = u.id === me?.id
              return (
                <tr key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {u.name} {self && <span className="text-xs text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={self}
                      onChange={(e) => update(u, { role: e.target.value as Role })}
                      aria-label={`Role for ${u.email}`}
                      className="rounded-md border border-line bg-panel px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">{u.isActive ? 'Active' : 'Deactivated'}</td>
                  <td className="px-4 py-3 text-muted">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => resetPassword(u)} className="text-xs text-brand underline">
                      Reset password
                    </button>
                    {!self && (
                      <button
                        type="button"
                        onClick={() => update(u, { isActive: !u.isActive })}
                        className="ml-3 text-xs text-fail underline"
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="max-w-xl rounded-xl border border-line bg-panel p-5 shadow-sm">
        <h2 className="font-medium">Add a user</h2>
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} · {ROLE_HELP[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Initial password</span>
            <input
              required
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-muted">At least 12 characters.</span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
