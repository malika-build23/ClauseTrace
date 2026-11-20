// Empty in dev (Vite proxies /api); the Render URL in production.
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export type Health = { status: string; db: string; dbTime?: string }
