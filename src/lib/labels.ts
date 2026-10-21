import type { AdStatus, Product, Role } from './types'

export const PRODUCT_LABEL: Record<Product, string> = {
  personal_loan: 'Personal loan',
  credit_card: 'Credit card',
  mortgage: 'Mortgage',
}

export const STATUS_LABEL: Record<AdStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  changes_required: 'Changes required',
  approved_with_changes: 'Approved with changes',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const ROLE_LABEL: Record<Role, { name: string; team: string; home: string }> = {
  // Insights first: the throughput story, then the Queue is one click away.
  reviewer: { name: 'Reviewer', team: 'Compliance team', home: '/insights' },
  marketer: { name: 'Marketer', team: 'Marketing team', home: '/my-ads' },
}

/** "Internal marketing" or "Affiliate · TotallyLegitLoans.biz". */
export function sourceLabel(source: string): string {
  return source === 'internal' ? 'Internal marketing' : `Affiliate · ${source}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
