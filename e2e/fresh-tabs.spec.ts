import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test('Review opens in the same tab, and the Queue is up to date when it comes back', async ({ page }) => {
  await resetData(page)
  await setRole(page, 'reviewer')
  await page.goto('/queue')
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(9)

  await page.getByRole('link', { name: /^Review Fall personal loan/ }).click()
  await expect(page).toHaveURL(/\/review\/3$/)
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByText('Approved ·')).toBeVisible()
  await expect(page).toHaveURL(/\/queue$/)
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(8)
  await expect(page.getByRole('link', { name: /^Review Fall personal loan/ })).toHaveCount(0)
})

test('an ad that changed since you last opened it is marked Updated, until you open it', async ({ page }) => {
  await resetData(page)
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(8)
  await expect(page.locator('.fp-updated-chip')).toHaveCount(0)

  // The reviewer sends Fall personal loan back.
  await page.request.post('/api/ads/3/decision', { data: { status: 'changes_required', message: 'Fix the rate claim.' } })
  await page.reload()
  const row = page.locator('tbody tr', { hasText: 'Fall personal loan' })
  await expect(row.locator('.fp-updated-chip')).toHaveText('Updated')
  await expect(page.locator('.fp-updated-chip')).toHaveCount(1)

  // Opening it clears the mark.
  await row.getByRole('button', { name: 'Fall personal loan' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.locator('.fp-updated-chip')).toHaveCount(0)
})

test('the reviewer opening an ad does not clear it for the marketer', async ({ page }) => {
  await resetData(page)
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(8)
  // In the same browser, the reviewer opens Fall personal loan and sends it back.
  await setRole(page, 'reviewer')
  await page.goto('/review/3')
  await page.getByRole('button', { name: 'Request changes' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('Fix the rate claim.')
  await page.getByRole('dialog').getByRole('button', { name: 'Request changes' }).click()
  await expect(page).not.toHaveURL(/\/review\/3$/)
  // The marketer still sees it as updated.
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await expect(page.locator('tbody tr', { hasText: 'Fall personal loan' }).locator('.fp-updated-chip')).toHaveText('Updated')
})
