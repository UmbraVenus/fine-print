import type { Page } from '@playwright/test'

export async function resetData(page: Page) {
  const res = await page.request.post('/api/reset')
  if (!res.ok()) throw new Error(`Reset failed: ${res.status()}`)
}

export async function setRole(page: Page, role: 'reviewer' | 'marketer') {
  await page.context().addCookies([{ name: 'fp_role', value: role, url: 'http://localhost:5173' }])
}

/** The Queue's order (most recently updated first), as the table and Review's Previous / Next use it. */
export async function queueOrder(page: Page): Promise<Array<{ id: number; name: string }>> {
  const res = await page.request.get('/api/ads?view=queue&page_size=20')
  const data = (await res.json()) as { rows: Array<{ id: number; name: string }> }
  return data.rows.map((r) => ({ id: r.id, name: r.name }))
}

/** The ad after this one in the Queue, wrapping around, as Review opens it after a decision. */
export function nextAfter(order: Array<{ id: number }>, id: number): number {
  const index = order.findIndex((r) => r.id === id)
  return order[(index + 1) % order.length].id
}
