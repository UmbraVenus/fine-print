import { expect, test } from '@playwright/test'
import { queueOrder, resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await resetData(page)
  await setRole(page, 'reviewer')
})

test('the review page is prepared: groups, pins, rule info', async ({ page }) => {
  const order = await queueOrder(page)
  await page.goto('/review/3')
  await expect(page.getByRole('heading', { level: 1, name: 'Fall personal loan' })).toBeVisible()
  await expect(page.getByText(`${order.findIndex((r) => r.id === 3) + 1} of 9`)).toBeVisible()
  await expect(page.getByText('Due today')).toBeVisible()
  await expect(page.getByRole('button', { name: /Critical · 1/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /Caution · 2/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /Good · \d/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Legal approved this rate wording last month.')).toBeVisible()
  // Pins and cards are linked.
  await page.getByRole('button', { name: /^Finding 3:/ }).click()
  await expect(page.locator('[data-finding="3"]')).toHaveCSS('border-top-width', '2px')
  await page.screenshot({ path: 'screenshots/m4-review.png', fullPage: true })
})

test('keep, edit, dismiss with a reason, restore', async ({ page }) => {
  await page.goto('/review/3')
  const first = page.locator('[data-finding="1"]')
  await first.getByRole('button', { name: 'Keep' }).click()
  await expect(first.getByRole('button', { name: 'Kept' })).toHaveAttribute('aria-pressed', 'true')
  const second = page.locator('[data-finding="2"]')
  await second.getByRole('button', { name: 'Edit' }).click()
  await second.getByRole('textbox').fill('Make the disclosure readable and put it under the rate.')
  await second.getByRole('button', { name: 'Save' }).click()
  await expect(second.getByText('Make the disclosure readable and put it under the rate.')).toBeVisible()
  await page.locator('[data-finding="3"]').getByRole('button', { name: 'Dismiss…' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Dismiss' })).toBeDisabled()
  await dialog.getByRole('textbox').fill('Wording was approved by legal.')
  await dialog.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('button', { name: /Dismissed · 1/ })).toBeVisible()
  await page.getByRole('button', { name: /Dismissed · 1/ }).click()
  await expect(page.getByText('Wording was approved by legal.')).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('button', { name: /Dismissed · 0/ })).toBeVisible()
})

test('reviewer requests changes on Fall personal loan', async ({ page }) => {
  await page.goto('/review/3')
  await page.locator('[data-finding="1"]').getByRole('button', { name: 'Keep' }).click()
  await page.getByRole('button', { name: 'Add a finding' }).click()
  await page.getByPlaceholder('What does the submitter need to fix? Quote the words if you can.').fill('Pick an image that doesn’t suggest same-day cash.')
  await page.getByRole('button', { name: 'Add finding' }).click()
  await expect(page.getByText('FROM YOU')).toBeVisible()
  await page.getByRole('button', { name: 'Request changes' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('textbox')).toHaveValue(/The rate claim is missing the full APR range/)
  await expect(dialog.getByRole('textbox')).toHaveValue(/same-day cash/)
  await dialog.getByRole('button', { name: 'Request changes' }).click()
  await expect(page.getByText('Changes requested ·')).toBeVisible()
  // Done with this ad: back to the Queue, which no longer lists it.
  await expect(page).toHaveURL(/\/queue$/)
  await expect(page.locator('.fp-ad-link', { hasText: 'Fall personal loan' })).toHaveCount(0)
  await expect(page.locator('.fp-nav-badge')).toHaveText('8')

  // The marketer now sees it under My ads with the reviewer's comments.
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  const row = page.locator('tr', { hasText: 'Fall personal loan' })
  await expect(row.getByText('Changes required')).toBeVisible()
})

test('approve shows Undo, and Undo restores everything', async ({ page }) => {
  await page.goto('/review/4')
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page).toHaveURL(/\/queue$/)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Decision undone')).toBeVisible()
  await expect(page).toHaveURL(/\/review\/4$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Rate check email' })).toBeVisible()
  await expect(page.locator('.fp-nav-badge')).toHaveText('9')
})

test('previous and next follow the queue order', async ({ page }) => {
  const order = await queueOrder(page)
  await page.goto(`/review/${order[2].id}`)
  await expect(page.getByText('3 of 9')).toBeVisible()
  await page.getByRole('link', { name: 'Next' }).click()
  await expect(page.getByText('4 of 9')).toBeVisible()
  await page.getByRole('link', { name: 'Previous' }).click()
  await page.getByRole('link', { name: 'Previous' }).click()
  await expect(page.getByText('2 of 9')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: order[1].name })).toBeVisible()
})

test('what changed on a resubmission', async ({ page }) => {
  await page.goto('/review/5')
  await expect(page.getByRole('heading', { name: 'Compare versions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible()
  await expect(page.getByText('Good standing')).toBeVisible()
  await expect(page.getByRole('button', { name: /Resolved · 2/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Still open · 0/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: /New suggestions · 0/ })).toBeVisible()
  await page.screenshot({ path: 'screenshots/m5-what-changed.png', fullPage: true })
})

test('text formats render with underlines and a missing-disclosure chip', async ({ page }) => {
  await page.goto('/review/6')
  await expect(page.getByText('No affiliate disclosure on this page')).toBeVisible()
  await page.screenshot({ path: 'screenshots/m4-review-blog.png', fullPage: true })
  await page.goto('/review/4')
  await page.screenshot({ path: 'screenshots/m4-review-email.png', fullPage: true })
})

test('clearing the queue shows the empty state', async ({ page }) => {
  for (const id of [6, 7, 3, 4, 5, 8, 9, 10]) {
    const res = await page.request.post(`/api/ads/${id}/decision`, { data: { status: 'approved' } })
    expect(res.ok()).toBe(true)
  }
  await page.goto('/review/11')
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page).toHaveURL(/\/queue$/)
  await expect(page.getByText('Queue cleared. Go get a snack.')).toBeVisible()
})
