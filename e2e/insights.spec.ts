import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 900 } })

test('Insights is the reviewer’s, and agrees with History', async ({ page }) => {
  await resetData(page)
  await setRole(page, 'reviewer')
  await page.goto('/history')
  const approved = await page.locator('[data-stat="approved"] [data-stat-value]').innerText()
  const firstReview = await page.locator('[data-stat="first_review"] [data-stat-value]').innerText()

  await page.getByRole('link', { name: 'Insights' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights')
  await expect(page.locator('[data-insight="approved"]')).toHaveText(approved)
  await expect(page.locator('[data-insight="first_round"]')).toHaveText(firstReview)
  await expect(page.getByText(/^From about \d+ working days to/)).toBeVisible()
  await expect(page.locator('[data-affiliate]').first()).toContainText('TotallyLegitLoans.biz')
  await expect(page.locator('[data-affiliate]').first()).toContainText('At risk')
  await page.screenshot({ path: 'screenshots/final/11-insights.png', fullPage: true })
  await page.getByRole('link', { name: 'See all rules' }).click()
  await expect(page).toHaveURL(/\/rules$/)

  // The marketer has no Insights.
  await setRole(page, 'marketer')
  await page.goto('/insights')
  await expect(page).toHaveURL(/\/my-ads$/)
  await expect(page.getByRole('link', { name: 'Insights' })).toHaveCount(0)
})
