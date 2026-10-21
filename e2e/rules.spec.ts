import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

test('rules page lists the 9 rules in three sections', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/rules')
  await expect(page.getByText('Every ad is checked against these 9 rules. Each suggestion names the rule it comes from.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Claims', 'Required elements', 'Presentation'])
  await expect(page.locator('.fp-rule-row')).toHaveCount(9)
  await expect(page.getByText('Applies to personal loans and credit cards · Flagged as Critical')).toBeVisible()
  await page.screenshot({ path: 'screenshots/m6-rules.png', fullPage: true })
})

test('rules are read-only for both roles', async ({ page }) => {
  for (const role of ['reviewer', 'marketer'] as const) {
    await setRole(page, role)
    await page.goto('/rules')
    await expect(page.getByRole('heading', { level: 1, name: 'Rules' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add a rule' })).toHaveCount(0)
  }
})
