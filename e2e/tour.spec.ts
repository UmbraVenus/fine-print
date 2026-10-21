import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 1000 } })

// The README's tour, step by step, without an API key.
test('README tour', async ({ page }) => {
  await resetData(page)

  // 1. Open Queue.
  await setRole(page, 'reviewer')
  await page.goto('/')
  await expect(page).toHaveURL(/\/queue$/)
  await expect(page.locator('[data-stat="waiting"] [data-stat-value]')).toHaveText('9')

  // 2. Review Fall personal loan.
  await page.goto('/review/3')
  await page.locator('[data-finding="1"]').getByRole('button', { name: 'Keep' }).click()
  await page.getByPlaceholder('What does the submitter need to fix? Quote the words if you can.').fill("Pick an image that doesn't suggest same-day cash.")
  await page.getByRole('button', { name: 'Add finding' }).click()
  await expect(page.getByText('FROM YOU')).toBeVisible()

  // 3. Request changes.
  await page.getByRole('button', { name: 'Request changes' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Request changes' }).click()
  await expect(page).toHaveURL(/\/review\/4$/)

  // 4. Switch to Marketer.
  await page.locator('.fp-role-button').click()
  await page.getByRole('menuitem', { name: /Marketer/ }).click()
  await expect(page).toHaveURL(/\/my-ads$/)
  await expect(page.locator('tr', { hasText: 'Fall personal loan' }).getByText('2 comments from your reviewer')).toBeVisible()

  // 5. Fix it and resubmit.
  await page.goto('/ads/3/pre-check')
  await page.locator('[data-layer="headline"] .fp-editable').click()
  const editor = page.getByRole('textbox', { name: 'Edit text' })
  await editor.fill('Personal loans from 7.99% to 29.99% APR with autopay')
  await editor.press('Enter')
  await expect(page.locator('.fp-edited-badge')).toBeVisible()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/\/my-ads$/)

  // 6. Approve the What changed view.
  await setRole(page, 'reviewer')
  await page.goto('/review/3')
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Resolved · 1/ })).toBeVisible()
  await expect(page.getByText('Reworded “as low as 7.99% APR”.')).toBeVisible()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByText('Approved ·')).toBeVisible()

  // 7. Check History.
  await page.goto('/history')
  await page.getByRole('textbox', { name: 'Search ads' }).fill('Fall personal loan')
  await expect(page.locator('.fp-ad-link')).toHaveText(['Fall personal loan'])
  await page.getByRole('button', { name: 'Fall personal loan' }).click()
  await expect(page.getByRole('dialog').getByText('You approved')).toBeVisible()
  await page.keyboard.press('Escape')

  // 8. Add a rule and Re-check.
  await page.goto('/rules')
  await page.getByRole('button', { name: 'Add a rule' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('Rule name').fill('Balance transfer fees')
  await drawer.getByLabel('What it checks').fill('A balance transfer offer must show the transfer fee next to the intro APR.')
  await drawer.getByRole('checkbox', { name: 'Credit card' }).check()
  await drawer.getByLabel('Don’t example').fill('0% intro APR for 18 months')
  await drawer.getByLabel('Do example').fill('0% intro APR for 18 months. 3% transfer fee.')
  await drawer.getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByText('Added “Balance transfer fees”.', { exact: false })).toBeVisible()
  await setRole(page, 'marketer')
  await page.goto('/ads/1/pre-check')
  await page.getByRole('button', { name: 'Re-check' }).click()
  await expect(page.getByText('Auto check unavailable right now. You can still submit as usual.')).toBeVisible()
})
