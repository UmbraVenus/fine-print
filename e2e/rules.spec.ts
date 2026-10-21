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

test('only reviewers can add a rule', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/rules')
  await expect(page.getByRole('heading', { level: 1, name: 'Rules' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add a rule' })).toHaveCount(0)
})

test('add a rule', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/rules')
  await page.getByRole('button', { name: 'Add a rule' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('Rule name').fill('Balance transfer fees')
  await drawer.getByLabel('What it checks').fill('A balance transfer offer must show the transfer fee next to the intro APR.')
  await drawer.getByRole('radio', { name: 'Critical' }).click()
  await drawer.getByRole('checkbox', { name: 'Credit card' }).check()
  await drawer.getByLabel('Don’t example').fill('0% intro APR for 18 months')
  await drawer.getByLabel('Do example').fill('0% intro APR for 18 months. 3% transfer fee.')
  await page.screenshot({ path: 'screenshots/m6-add-rule.png' })
  await drawer.getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByText('Added “Balance transfer fees”. The next check uses it.')).toBeVisible()
  await expect(page.getByText('Every ad is checked against these 10 rules.', { exact: false })).toBeVisible()
  const row = page.locator('[data-rule="custom-balance-transfer-fees"]')
  await expect(row.getByText('Added by reviewer')).toBeVisible()
  await expect(row.getByText('Applies to credit cards · Flagged as Critical')).toBeVisible()
})

test('a rule needs every field', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/rules')
  await page.getByRole('button', { name: 'Add a rule' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByRole('alert')).toHaveText('Fill in every field and pick what it applies to.')
})
