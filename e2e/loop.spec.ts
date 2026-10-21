import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

test('pre-check: suggestions, copy fix, a note, and no-key re-check', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await setRole(page, 'marketer')
  await page.goto('/ads/1/pre-check')
  await expect(page.getByRole('heading', { level: 1, name: 'Cash back card' })).toBeVisible()
  await expect(page.getByText('Facebook ad · Credit card')).toBeVisible()
  await expect(page.getByRole('button', { name: /Critical · 1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Good · 4/ })).toHaveAttribute('aria-expanded', 'false')
  await page.screenshot({ path: 'screenshots/m5-pre-check.png', fullPage: true })

  const first = page.locator('[data-finding="1"]')
  await first.getByRole('button', { name: 'Copy suggested fix' }).click()
  await expect(page.getByText('Suggested fix copied')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('21.24%–29.24% variable APR')

  await first.getByRole('button', { name: 'Add a note' }).click()
  await first.getByLabel('Note to your reviewer (optional)').fill('Legal approved this wording.')
  await first.getByLabel('Note to your reviewer (optional)').blur()

  await page.getByRole('button', { name: 'Re-check' }).click()
  await expect(page.getByText('Auto check unavailable right now. You can still submit as usual.')).toBeVisible()
  // Nothing is blocked: Submit still works.
  await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled()

  // The reviewer sees the note on that finding.
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/\/my-ads$/)
  await setRole(page, 'reviewer')
  await page.goto('/review/1')
  await expect(page.getByText('Note from submitter')).toBeVisible()
  await expect(page.getByText('Legal approved this wording.')).toBeVisible()
})

test('full loop: fix, resubmit, what changed, approve, history', async ({ page }) => {
  // 1. The marketer edits Holiday debt email.
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  const [precheck] = await Promise.all([
    page.context().waitForEvent('page'),
    page.locator('tr', { hasText: 'Holiday debt email' }).getByRole('link', { name: /Pre-check/ }).click(),
  ])
  await precheck.waitForLoadState()
  await expect(precheck).toHaveURL(/\/ads\/2\/pre-check$/)
  await expect(precheck.getByRole('heading', { name: 'From your reviewer' })).toBeVisible()
  await expect(precheck.getByText('Add the APR range and say autopay is optional.')).toBeVisible()
  await expect(precheck.getByRole('button', { name: /^Edit body: Roll this season/ })).toHaveCount(1)
  await precheck.locator('[data-layer="body"] .fp-editable').click()
  const editor = precheck.getByRole('textbox', { name: 'Edit text' })
  await editor.fill(
    "Roll this season's card balances into one fixed monthly payment. Fixed rates from 8.99% to 29.99% APR with autopay. Autopay is optional.",
  )
  await editor.press('Enter')
  await expect(precheck.locator('.fp-edited-badge')).toHaveText('Edited')
  await precheck.screenshot({ path: 'screenshots/m5-pre-check-edited.png', fullPage: true })

  // 2. The marketer submits version 2.
  await precheck.getByRole('button', { name: 'Submit' }).click()
  await expect(precheck.getByText(/Submitted as version 2\. Due /)).toBeVisible()
  await expect(precheck).toHaveURL(/\/my-ads$/)
  const row = precheck.locator('tr', { hasText: 'Holiday debt email' })
  await expect(row.getByText('Pending')).toBeVisible()
  await expect(row.getByText('v2')).toBeVisible()
  await precheck.close()

  // 3. The reviewer sees What changed.
  await setRole(page, 'reviewer')
  await page.goto('/queue')
  await expect(page.locator('.fp-nav-badge')).toHaveText('10')
  await page.goto('/review/2')
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible()
  await expect(page.getByText('Good standing')).toBeVisible()
  await expect(page.getByText('· Compared with version 1')).toBeVisible()
  await expect(page.getByRole('button', { name: /Resolved · 1/ })).toBeVisible()
  await expect(page.getByText('Had 1 Critical and 1 finding from you')).toBeVisible()
  await page.screenshot({ path: 'screenshots/m5-what-changed-loop.png', fullPage: true })

  // 4. The reviewer approves.
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByText('Approved ·')).toBeVisible()

  // 5. The ad appears in History.
  await page.goto('/history')
  await page.getByRole('textbox', { name: 'Search ads' }).fill('Holiday debt email')
  await expect(page.locator('.fp-ad-link')).toHaveText(['Holiday debt email'])
  await expect(page.locator('tr', { hasText: 'Holiday debt email' }).getByText('Approved')).toBeVisible()

  // 6. My ads shows Approved.
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await expect(page.locator('tr', { hasText: 'Holiday debt email' }).getByText('Approved', { exact: true })).toBeVisible()
})
