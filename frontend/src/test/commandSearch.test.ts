import { describe, expect, it } from 'vitest'
import {
  BASE_NAV_ITEMS,
  capSearchResults,
  filterItemsByRole,
  searchItems,
  type SearchItem,
} from '../lib/searchIndex'

describe('Command Palette RBAC Role Filtering', () => {
  it('strictly excludes audit log and user management for viewer role', () => {
    // Viewer role: can returns false for reviewer and admin
    const canViewer = () => false
    const allowed = filterItemsByRole(BASE_NAV_ITEMS, canViewer)

    expect(allowed.some((item) => item.url === '/audit')).toBe(false)
    expect(allowed.some((item) => item.url === '/users')).toBe(false)
    expect(allowed.some((item) => item.url === '/documents')).toBe(true)
    expect(allowed.some((item) => item.url === '/')).toBe(true)
  })

  it('allows audit log for reviewer role but excludes user management', () => {
    // Reviewer role: can('reviewer') is true, can('admin') is false
    const canReviewer = (role: 'reviewer' | 'admin') => role === 'reviewer'
    const allowed = filterItemsByRole(BASE_NAV_ITEMS, canReviewer)

    expect(allowed.some((item) => item.url === '/audit')).toBe(true)
    expect(allowed.some((item) => item.url === '/users')).toBe(false)
  })

  it('allows all administration and audit routes for admin role', () => {
    // Admin role: can returns true for all
    const canAdmin = () => true
    const allowed = filterItemsByRole(BASE_NAV_ITEMS, canAdmin)

    expect(allowed.some((item) => item.url === '/audit')).toBe(true)
    expect(allowed.some((item) => item.url === '/users')).toBe(true)
    expect(allowed.length).toBe(BASE_NAV_ITEMS.length)
  })
})

describe('Command Palette Search and Cap Utilities', () => {
  const mockItems: SearchItem[] = [
    { id: '1', title: 'IFSCA Fund Management Regulations', subtitle: 'GIFT City', category: 'document', url: '/d1', badge: 'IFSCA' },
    { id: '2', title: 'Capital Adequacy Ratio', subtitle: 'Prudential threshold', category: 'rule', url: '/r1', badge: 'NUMERIC' },
    { id: '3', title: 'Quarterly Return Submission', subtitle: 'Statutory deadline', category: 'obligation', url: '/o1', badge: 'MUST' },
    { id: '4', title: 'Apex Asset Managers', subtitle: 'Cat II AIF', category: 'entity', url: '/p1' },
    { id: '5', title: 'Alternative Investment Fund Regulations', subtitle: 'SEBI Circular', category: 'document', url: '/d2' },
    { id: '6', title: 'Custodian Agreement Requirement', subtitle: 'Third-party custody', category: 'obligation', url: '/o2', badge: 'MUST NOT' },
    { id: '7', title: 'Risk Governance Norms', subtitle: 'Annual stress testing', category: 'rule', url: '/r2' },
  ]

  it('caps search results to requested limit', () => {
    const capped = capSearchResults(mockItems, 3)
    expect(capped.length).toBe(3)
  })

  it('searches case-insensitively across title, subtitle, and badges', () => {
    const queryDoc = searchItems(mockItems, 'gift city')
    expect(queryDoc.length).toBe(1)
    expect(queryDoc[0].id).toBe('1')

    const queryBadge = searchItems(mockItems, 'numeric')
    expect(queryBadge.length).toBe(1)
    expect(queryBadge[0].id).toBe('2')

    const querySub = searchItems(mockItems, 'statutory')
    expect(querySub.length).toBe(1)
    expect(querySub[0].id).toBe('3')
  })
})
