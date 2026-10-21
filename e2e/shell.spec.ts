import { expect, test } from '@playwright/test'
import { resetData } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

test('reviewer nav, with the pending count', async ({ page }) => {
  await page.goto('/queue')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link')).toHaveText(['Queue9', 'History', 'Rules'])
  await expect(nav.getByRole('link', { name: /Queue/ })).toHaveClass(/active/)
  await page.screenshot({ path: 'screenshots/m2-shell-reviewer.png' })
})

test('switching role sets the cookie, changes the nav and goes home', async ({ page }) => {
  await page.goto('/queue')
  await page.locator('.fp-role-button').click()
  await page.getByRole('menuitem', { name: /Marketer/ }).click()
  await expect(page).toHaveURL(/\/my-ads$/)
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link')).toHaveText(['My ads', 'Rules'])
  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name === 'fp_role')?.value).toBe('marketer')
  await page.goto('/')
  await expect(page).toHaveURL(/\/my-ads$/)
  // A marketer can't open reviewer pages.
  await page.goto('/queue')
  await expect(page).toHaveURL(/\/my-ads$/)
  await page.screenshot({ path: 'screenshots/m2-shell-marketer.png' })
})

test('coming next starts collapsed and lists the roadmap', async ({ page }) => {
  await page.goto('/queue')
  const toggle = page.getByRole('button', { name: 'Coming next' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(page.locator('#coming-next-list li')).toHaveText([
    'Turn compliance documents into rules',
    'Upload your own ads',
    'Search past decisions',
  ])
  await page.screenshot({ path: 'screenshots/m2-coming-next.png' })
})

test('reset asks first, then re-seeds', async ({ page }) => {
  await page.goto('/queue')
  await page.getByRole('button', { name: 'Reset sample data' }).click()
  await expect(page.getByText('Reset sample data?')).toBeVisible()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByText('Sample data reset')).toBeVisible()
})

test('the sidebar collapses to icons', async ({ page }) => {
  await page.goto('/queue')
  await page.getByRole('button', { name: 'Collapse menu' }).click()
  await expect(page.getByRole('button', { name: 'Expand menu' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'History' })).toBeVisible()
  await page.screenshot({ path: 'screenshots/m2-shell-collapsed.png' })
  await page.getByRole('button', { name: 'Expand menu' }).click()
})
