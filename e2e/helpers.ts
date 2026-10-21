import type { Page } from '@playwright/test'

export async function resetData(page: Page) {
  const res = await page.request.post('/api/reset')
  if (!res.ok()) throw new Error(`Reset failed: ${res.status()}`)
}

export async function setRole(page: Page, role: 'reviewer' | 'marketer') {
  await page.context().addCookies([{ name: 'fp_role', value: role, url: 'http://localhost:5173' }])
}
