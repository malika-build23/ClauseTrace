import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Command } from 'cmdk'
import {
  Building2,
  Compass,
  FileCheck,
  FileText,
  History,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import {
  apiGet,
  type DocumentSummary,
  type EntityProfile,
  type ObligationListItem,
  type RuleRow,
} from '../../lib/api'
import {
  BASE_NAV_ITEMS,
  capSearchResults,
  filterItemsByRole,
  type SearchItem,
} from '../../lib/searchIndex'

const RECENT_KEY = 'clausetrace_recent_searches'
const MAX_RECENT = 4

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  // Cached remote data
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [profiles, setProfiles] = useState<EntityProfile[]>([])
  const [obligations, setObligations] = useState<ObligationListItem[]>([])
  const [hasFetched, setHasFetched] = useState(false)

  // Recent items persisted in localStorage
  const [recentItems, setRecentItems] = useState<SearchItem[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY)
      return stored ? (JSON.parse(stored) as SearchItem[]) : []
    } catch {
      return []
    }
  })

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else {
          // If not open, the parent layout or state should trigger open
          // Also listen here for convenience
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Fetch indexable entities on first open
  useEffect(() => {
    if (!isOpen || hasFetched) return

    Promise.allSettled([
      apiGet<DocumentSummary[]>('/api/documents'),
      apiGet<RuleRow[]>('/api/rules?active=true'),
      apiGet<EntityProfile[]>('/api/entity-profiles'),
      apiGet<ObligationListItem[]>('/api/obligations/review'),
    ]).then(([docsRes, rulesRes, profsRes, obsRes]) => {
      if (docsRes.status === 'fulfilled') setDocuments(docsRes.value)
      if (rulesRes.status === 'fulfilled') setRules(rulesRes.value)
      if (profsRes.status === 'fulfilled') setProfiles(profsRes.value)
      if (obsRes.status === 'fulfilled') setObligations(obsRes.value)
      setHasFetched(true)
    })
  }, [isOpen, hasFetched])

  // Build searchable index
  const { pages, docsList, rulesList, profilesList, obsList } = useMemo(() => {
    // 1. Pages (Strict RBAC filtering: viewers must never see /audit or /users)
    const allowedPages = filterItemsByRole(BASE_NAV_ITEMS, (role) => can(role))

    // 2. Documents
    const docs: SearchItem[] = documents.map((d) => ({
      id: `doc-${d.id}`,
      title: d.title,
      subtitle: `${d.regulator} · ${d.versions.length} version${d.versions.length === 1 ? '' : 's'}`,
      category: 'document',
      url: `/documents/${d.id}`,
      badge: d.regulator,
    }))

    // 3. Rules
    const rls: SearchItem[] = rules.map((r) => ({
      id: `rule-${r.id}`,
      title: `${r.ruleKey} (v${r.ruleVersion})`,
      subtitle: `Type: ${r.type} · ${r.isActive ? 'Active' : 'Superseded'}`,
      category: 'rule',
      url: `/rules?key=${encodeURIComponent(r.ruleKey)}`,
      badge: r.type,
    }))

    // 4. Entities
    const profs: SearchItem[] = profiles.map((p) => ({
      id: `profile-${p.id}`,
      title: p.name,
      subtitle: `Category: ${p.category?.name ?? 'Financial Entity'}${p.isSimulation ? ' · Simulation' : ''}`,
      category: 'entity',
      url: `/profiles`,
      badge: p.isSimulation ? 'SIMULATION' : undefined,
    }))

    // 5. Obligations
    const obs: SearchItem[] = obligations.map((o) => ({
      id: `ob-${o.id}`,
      title: `${o.obligationKey} (v${o.version})`,
      subtitle: `${o.subject} — ${o.action}`,
      category: 'obligation',
      url: `/obligations/${o.id}`,
      badge: o.modality,
    }))

    return {
      pages: allowedPages,
      docsList: docs,
      rulesList: rls,
      profilesList: profs,
      obsList: obs,
    }
  }, [can, documents, rules, profiles, obligations])

  const handleSelect = (item: SearchItem) => {
    // Save to recents
    const updated = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, MAX_RECENT)
    setRecentItems(updated)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
    } catch {
      // Ignore storage errors
    }

    onClose()
    setQuery('')
    navigate(item.url)
  }

  if (!isOpen) return null

  const getCategoryIcon = (category: SearchItem['category']) => {
    switch (category) {
      case 'page':
        return <Compass className="h-4 w-4 text-teal" />
      case 'document':
        return <FileText className="h-4 w-4 text-sky-600" />
      case 'rule':
        return <ShieldCheck className="h-4 w-4 text-amber-600" />
      case 'entity':
        return <Building2 className="h-4 w-4 text-purple-600" />
      case 'obligation':
        return <FileCheck className="h-4 w-4 text-teal" />
      case 'recent':
        return <History className="h-4 w-4 text-muted" />
      default:
        return <Search className="h-4 w-4 text-muted" />
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-line bg-panel shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command Palette" className="flex flex-col h-full">
          {/* Header & Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-line bg-panel-header">
            <Search className="h-4 w-4 text-muted shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search documents, clauses, obligations, rules, entities..."
              className="w-full py-3.5 text-sm bg-transparent outline-none placeholder:text-muted text-ink font-sans"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-muted hover:text-ink text-xs p-1"
                title="Clear query"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted hover:text-ink hover:bg-surface transition-colors"
              title="Close (Esc)"
              aria-label="Close command palette"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results List */}
          <Command.List className="overflow-y-auto p-2 space-y-2 text-sm max-h-[480px]">
            <Command.Empty className="p-6 text-center text-xs text-muted">
              No matching records, clauses, or routes found.
            </Command.Empty>

            {/* Recent Searches (Shown when query is empty) */}
            {!query && recentItems.length > 0 && (
              <Command.Group heading="Recent Activity" className="px-1 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {recentItems.map((item) => (
                  <Command.Item
                    key={`recent-${item.id}`}
                    value={`${item.title} ${item.subtitle ?? ''}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-surface aria-selected:bg-brand-light aria-selected:text-brand transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <History className="h-4 w-4 text-muted shrink-0" />
                      <div className="truncate">
                        <p className="font-medium text-xs truncate">{item.title}</p>
                        {item.subtitle && <p className="text-[11px] text-muted truncate">{item.subtitle}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted capitalize shrink-0 font-normal">
                      {item.category}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation Pages */}
            <Command.Group heading="Navigation & Workflows" className="px-1 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              {capSearchResults(pages, 8).map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.title} ${item.subtitle ?? ''}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-surface aria-selected:bg-brand-light aria-selected:text-brand transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Compass className="h-4 w-4 text-teal shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-xs truncate">{item.title}</p>
                      {item.subtitle && <p className="text-[11px] text-muted truncate">{item.subtitle}</p>}
                    </div>
                  </div>
                  {item.roleRequired && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 border border-amber-200 uppercase">
                      {item.roleRequired}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Regulatory Documents */}
            {docsList.length > 0 && (
              <Command.Group heading="Regulatory Instruments" className="px-1 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {capSearchResults(docsList, 5).map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle ?? ''} ${item.badge ?? ''}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-surface aria-selected:bg-brand-light aria-selected:text-brand transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getCategoryIcon('document')}
                      <div className="truncate">
                        <p className="font-medium text-xs truncate">{item.title}</p>
                        {item.subtitle && <p className="text-[11px] text-muted truncate">{item.subtitle}</p>}
                      </div>
                    </div>
                    {item.badge && (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-800 border border-sky-200">
                        {item.badge}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Extracted Obligations */}
            {obsList.length > 0 && (
              <Command.Group heading="Approved Obligations" className="px-1 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {capSearchResults(obsList, 5).map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle ?? ''}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-surface aria-selected:bg-brand-light aria-selected:text-brand transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getCategoryIcon('obligation')}
                      <div className="truncate">
                        <p className="font-mono text-xs font-medium truncate">{item.title}</p>
                        {item.subtitle && <p className="text-[11px] text-muted truncate">{item.subtitle}</p>}
                      </div>
                    </div>
                    {item.badge && (
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-medium text-teal border border-teal-200">
                        {item.badge}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Compiled Rules */}
            {rulesList.length > 0 && (
              <Command.Group heading="Compiled Rules (Deterministic)" className="px-1 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {capSearchResults(rulesList, 5).map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle ?? ''}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-surface aria-selected:bg-brand-light aria-selected:text-brand transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getCategoryIcon('rule')}
                      <div className="truncate">
                        <p className="font-mono text-xs font-medium truncate">{item.title}</p>
                        {item.subtitle && <p className="text-[11px] text-muted truncate">{item.subtitle}</p>}
                      </div>
                    </div>
                    {item.badge && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 border border-amber-200 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Regulated Entity Profiles */}
            {profilesList.length > 0 && (
              <Command.Group heading="Regulated Entities" className="px-1 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {capSearchResults(profilesList, 5).map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle ?? ''}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-surface aria-selected:bg-brand-light aria-selected:text-brand transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getCategoryIcon('entity')}
                      <div className="truncate">
                        <p className="font-medium text-xs truncate">{item.title}</p>
                        {item.subtitle && <p className="text-[11px] text-muted truncate">{item.subtitle}</p>}
                      </div>
                    </div>
                    {item.badge && (
                      <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-simulation border border-purple-200">
                        {item.badge}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer Shortcuts */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-line bg-panel-header text-[11px] text-muted">
            <div className="flex items-center gap-3">
              <span>Navigate: <kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-line">↑</kbd> <kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-line">↓</kbd></span>
              <span>Select: <kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-line">↵</kbd></span>
              <span>Close: <kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-line">esc</kbd></span>
            </div>
            <span className="text-[10px]">Strict RBAC Filter Active</span>
          </div>
        </Command>
      </div>
    </div>
  )
}
