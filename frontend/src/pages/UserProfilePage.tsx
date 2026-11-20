import { useState, type FormEvent } from 'react'
import { apiSend, type SessionUser } from '../lib/api'
import { useAuth } from '../lib/auth'

const ROLE_BADGE = {
  admin: 'bg-purple-50 text-simulation border-purple-200',
  reviewer: 'bg-blue-50 text-brand border-blue-200',
  viewer: 'bg-slate-100 text-insufficient border-slate-200',
} as const

const ROLE_DESCRIPTIONS = {
  admin:
    'Full administrative control: configure organization risk weights, create and deactivate users, view audit logs, upload documents, and perform reviews and evaluations.',
  reviewer:
    'Compliance review authority: upload regulatory circulars, run AI obligation extraction, approve/edit/reject obligations, compile machine-checkable rules, evaluate entity compliance, run simulations, and view audit history.',
  viewer:
    'Read-only access: inspect regulatory circulars, browse approved obligations, view versioned rules, and examine entity compliance dashboards.',
} as const

export function UserProfilePage() {
  const { user, refreshUser } = useAuth()

  // Name form state
  const [name, setName] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameNotice, setNameNotice] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  if (!user) return null

  async function handleUpdateName(e: FormEvent) {
    e.preventDefault()
    setNameNotice(null)
    setNameError(null)

    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters.')
      return
    }

    setSavingName(true)
    try {
      await apiSend<{ user: SessionUser; message: string }>('PATCH', '/api/auth/profile', {
        name: name.trim(),
      })
      await refreshUser()
      setNameNotice('Profile name updated successfully.')
    } catch (err) {
      setNameError((err as Error).message)
    } finally {
      setSavingName(false)
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordNotice(null)
    setPasswordError(null)

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setSavingPassword(true)
    try {
      await apiSend<{ user: SessionUser; message: string }>('PATCH', '/api/auth/profile', {
        currentPassword,
        newPassword,
      })
      setPasswordNotice('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError((err as Error).message)
    } finally {
      setSavingPassword(false)
    }
  }

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'U'

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User Profile & Account</h1>
        <p className="text-sm text-muted">
          Manage your personal credentials, view your role permissions, and review organisation access.
        </p>
      </div>

      {/* Profile Overview Banner */}
      <div className="rounded-xl border border-line bg-panel p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-xl font-bold text-white shadow-inner">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-ink">{user.name}</h2>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[user.role]}`}>
                  {user.role.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-muted">{user.email}</p>
              {user.organisation && (
                <p className="mt-0.5 text-xs font-medium text-ink">
                  Organisation: <span className="text-brand">{user.organisation.name}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end text-xs text-muted">
            <span className="font-medium text-ink">Account Status: Active</span>
            <span>Auth: Bearer JWT (HS256)</span>
            {user.createdAt && (
              <span>Member since: {new Date(user.createdAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Profile Settings (Name) */}
        <div className="rounded-xl border border-line bg-panel p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">Personal Information</h2>
          <p className="text-xs text-muted">
            Your name is displayed alongside your audit entries, reviews, and rule compilation actions.
          </p>

          <form onSubmit={handleUpdateName} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink">Full Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink">Work Email</span>
              <input
                type="email"
                disabled
                value={user.email}
                className="mt-1 block w-full rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-muted cursor-not-allowed"
              />
              <span className="mt-1 text-[11px] text-muted">Email address is managed by your administrator.</span>
            </label>

            {nameNotice && (
              <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                {nameNotice}
              </p>
            )}
            {nameError && (
              <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-fail">
                {nameError}
              </p>
            )}

            <button
              type="submit"
              disabled={savingName || name.trim() === user.name}
              className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-blue-900 disabled:opacity-50"
            >
              {savingName ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password Management */}
        <div className="rounded-xl border border-line bg-panel p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">Change Password</h2>
          <p className="text-xs text-muted">
            Ensure your account is protected with a strong password of at least 8 characters.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-ink">Current Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink">New Password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink">Confirm New Password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
              />
            </label>

            {passwordNotice && (
              <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                {passwordNotice}
              </p>
            )}
            {passwordError && (
              <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-fail">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword}
              className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-blue-900 disabled:opacity-50"
            >
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Role Capabilities & Security Info */}
      <div className="rounded-xl border border-line bg-panel p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold">Your Role & Governance Rights</h2>
        <p className="text-sm text-ink">{ROLE_DESCRIPTIONS[user.role]}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-line bg-surface p-3">
            <span className="text-xs text-muted">Upload & Extraction</span>
            <p className="mt-1 text-sm font-semibold text-ink">
              {user.role === 'viewer' ? 'Disabled' : 'Enabled'}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-3">
            <span className="text-xs text-muted">Review & Compilation</span>
            <p className="mt-1 text-sm font-semibold text-ink">
              {user.role === 'viewer' ? 'Disabled' : 'Enabled'}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-3">
            <span className="text-xs text-muted">Compliance Evaluation</span>
            <p className="mt-1 text-sm font-semibold text-ink">
              {user.role === 'viewer' ? 'Read-only' : 'Full Execution'}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-3">
            <span className="text-xs text-muted">Audit Log & Trace</span>
            <p className="mt-1 text-sm font-semibold text-ink">
              {user.role === 'viewer' ? 'Restricted' : 'Full Access'}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3 text-xs text-muted">
          <span className="font-semibold text-ink">Audit Guarantee:</span> In compliance with IFSCA supervisory standards, every decision you make in ClauseTrace is cryptographically associated with your user ID and recorded in an immutable, append-only PostgreSQL ledger.
        </div>
      </div>
    </div>
  )
}
