import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

test('pre-check: use the wording, edit on ad, mark resolved, a note, and no-key re-check', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/ads/1/pre-check')
  await expect(page.getByRole('heading', { level: 1, name: 'Cash back card' })).toBeVisible()
  await expect(page.getByText('Facebook ad · Credit card')).toBeVisible()
  await expect(page.getByRole('button', { name: /Critical · 1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Good · 4/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Copy suggested fix' })).toHaveCount(0)
  await page.screenshot({ path: 'screenshots/m5-pre-check.png', fullPage: true })

  // 1. "Use this wording" swaps the flagged words on the ad, in place.
  const first = page.locator('[data-finding="1"]')
  await first.getByRole('button', { name: 'Use this wording' }).click()
  await expect(page.getByText('Wording used on the ad.', { exact: false })).toBeVisible()
  await expect(page.locator('[data-layer="headline"]')).toContainText('21.24%–29.24% variable APR.')
  await expect(first.getByRole('button', { name: 'Wording used' })).toBeDisabled()
  await expect(page.locator('[data-layer="headline"] .fp-edited-badge')).toHaveText('Edited')

  // 2. "Edit on ad" opens that text for editing (shown once the wording's been used).
  await first.getByRole('button', { name: 'Edit on ad' }).click()
  const editor = page.getByRole('textbox', { name: 'Edit text' })
  await expect(editor).toBeFocused()
  await editor.press('Escape')

  // 3. The marketer marks it resolved by hand; it moves to its own group, and can be reopened.
  await first.getByRole('button', { name: 'Mark resolved' }).click()
  await expect(page.getByRole('button', { name: /Resolved by you · 1/ })).toBeVisible()
  await expect(page.getByText('· 1 marked resolved')).toBeVisible()
  await expect(page.getByRole('button', { name: /Critical · 1/ })).toHaveCount(0)
  await page.screenshot({ path: 'screenshots/final/03-pre-check-resolved.png', fullPage: true })
  await page.locator('[data-finding="1"]').getByRole('button', { name: 'Reopen' }).click()
  await expect(page.getByRole('button', { name: /Critical · 1/ })).toBeVisible()
  await page.locator('[data-finding="1"]').getByRole('button', { name: 'Mark resolved' }).click()
  await expect(page.getByRole('button', { name: /Resolved by you · 1/ })).toBeVisible()

  const second = page.locator('[data-finding="2"]')
  await second.getByRole('button', { name: 'Add a note' }).click()
  await second.getByLabel('Note to your reviewer (optional)').fill('Legal approved this wording.')
  await second.getByLabel('Note to your reviewer (optional)').blur()

  await page.getByRole('button', { name: 'Re-check' }).click()
  await expect(page.getByText('Auto check unavailable right now. You can still submit as usual.')).toBeVisible()
  // Nothing is blocked: Submit still works.
  await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled()

  // The reviewer sees what was marked resolved, and the note.
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/\/my-ads$/)
  await setRole(page, 'reviewer')
  await page.goto('/review/1')
  await expect(page.locator('[data-finding="1"]').getByText('The submitter marked this resolved.', { exact: false })).toBeVisible()
  await expect(page.locator('[data-finding="2"]').getByText('Legal approved this wording.')).toBeVisible()
})

test('download the approved ad as a PNG', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/my-ads?view=12')
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Make the change below before it goes live.')).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: 'Download ad' }).click()])
  expect(download.suggestedFilename()).toBe('balance-transfer-banner-v1.png')
  const file = await download.path()
  await download.saveAs('screenshots/final/02-download-balance-transfer-banner.png')
  const { readFileSync } = await import('node:fs')
  const png = readFileSync(file)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  // Full size at 2x: the banner is 480px wide.
  expect(png.readUInt32BE(16)).toBe(960)

  // Only approved ads can be downloaded.
  await page.goto('/my-ads?view=3')
  await expect(page.getByRole('dialog').getByText('ACTIVITY')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Download ad' })).toHaveCount(0)
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
