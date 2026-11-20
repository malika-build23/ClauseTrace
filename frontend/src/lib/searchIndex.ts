export type SearchCategory =
  | 'page'
  | 'document'
  | 'clause'
  | 'obligation'
  | 'rule'
  | 'entity'
  | 'recent'

export interface SearchItem {
  id: string
  title: string
  subtitle?: string
  category: SearchCategory
  url: string
  roleRequired?: 'reviewer' | 'admin'
  badge?: string
}

export const BASE_NAV_ITEMS: SearchItem[] = [
  { id: 'nav-overview', title: 'Executive Overview', subtitle: 'Compliance posture and risk dashboard', category: 'page', url: '/' },
  { id: 'nav-docs', title: 'Regulatory Documents', subtitle: 'Gazetted instruments and version diffs', category: 'page', url: '/documents' },
  { id: 'nav-review', title: 'Obligation Review Queue', subtitle: 'Human-in-the-loop candidate approvals', category: 'page', url: '/review' },
  { id: 'nav-rules', title: 'Deterministic Rules', subtitle: 'Compiled compliance logic ASTs', category: 'page', url: '/rules' },
  { id: 'nav-conflicts', title: 'Regulatory Conflicts', subtitle: 'Cross-document obligation clashes', category: 'page', url: '/conflicts' },
  { id: 'nav-profiles', title: 'Regulated Entities', subtitle: 'Fund managers and licensed profiles', category: 'page', url: '/profiles' },
  { id: 'nav-profile', title: 'User Profile & Settings', subtitle: 'Active role permissions and preferences', category: 'page', url: '/profile' },
  { id: 'nav-audit', title: 'System Audit Log', subtitle: 'Tamper-evident regulatory provenance trail', category: 'page', url: '/audit', roleRequired: 'reviewer' },
  { id: 'nav-users', title: 'User Management', subtitle: 'Role assignment and access control', category: 'page', url: '/users', roleRequired: 'admin' },
]

/**
 * Filters items strictly by the user's role permissions.
 * Viewers MUST NEVER see or access audit log or user administration entries.
 */
export function filterItemsByRole(
  items: SearchItem[],
  can: (role: 'reviewer' | 'admin') => boolean,
): SearchItem[] {
  return items.filter((item) => {
    if (!item.roleRequired) return true
    return can(item.roleRequired)
  })
}

/**
 * Caps results to keep command palette fast and uncluttered.
 */
export function capSearchResults(items: SearchItem[], limit = 6): SearchItem[] {
  return items.slice(0, limit)
}

/**
 * Filter items by case-insensitive search term across title, subtitle, badge, and category.
 */
export function searchItems(items: SearchItem[], query: string): SearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items

  return items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(q)
    const subtitleMatch = item.subtitle?.toLowerCase().includes(q)
    const badgeMatch = item.badge?.toLowerCase().includes(q)
    const categoryMatch = item.category.toLowerCase().includes(q)
    return titleMatch || subtitleMatch || badgeMatch || categoryMatch
  })
}
