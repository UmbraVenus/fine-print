import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 1000 } })

test('a reviewer finding that quotes the ad is pinned there, for both roles, and resolves when the words change', async ({ page }) => {
  await resetData(page)
  await setRole(page, 'reviewer')
  await page.goto('/review/3')

  // Quoted words that are on the ad get a person pin, linked to the card.
  await page.getByRole('button', { name: 'Add a finding' }).click()
  await page.getByPlaceholder('What does the submitter need to fix? Quote the words if you can.').fill('Drop “As low as 7.99% APR”: show the full range.')
  await page.getByRole('button', { name: 'Add finding' }).click()
  const pin = page.getByRole('button', { name: /^Reviewer finding: Drop/ })
  await expect(pin).toBeVisible()
  await page.getByRole('button', { name: 'Show the quoted words on the ad' }).click()
  await expect(pin).toHaveAttribute('aria-pressed', 'true')

  // Words that aren't on the ad stay plain text.
  await page.getByRole('button', { name: 'Add a finding' }).click()
  await page.getByPlaceholder('What does the submitter need to fix? Quote the words if you can.').fill('Add “then 20.24% variable APR” after it.')
  await page.getByRole('button', { name: 'Add finding' }).click()
  await expect(page.getByText('FROM YOU')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Reviewer finding:/ })).toHaveCount(1)

  await page.getByRole('button', { name: 'Request changes' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Request changes' }).click()
  await expect(page).toHaveURL(/\/review\/4$/)

  // The marketer sees the same pin, and Edit on ad opens those words.
  await setRole(page, 'marketer')
  await page.goto('/ads/3/pre-check')
  const fromReviewer = page.locator('section', { has: page.getByRole('heading', { name: 'From your reviewer' }) })
  await expect(page.getByRole('button', { name: /^Reviewer finding: Drop/ })).toBeVisible()
  await fromReviewer.getByRole('button', { name: 'Edit on ad' }).click()
  await expect(page.getByRole('textbox', { name: 'Edit text' })).toBeFocused()
  await page.getByRole('textbox', { name: 'Edit text' }).press('Escape')

  // Swapping in the auto suggestion removes the quoted words, so the reviewer pin goes too.
  const rate = page.locator('article', { hasText: 'The rate claim is missing the full APR range' })
  await rate.getByRole('button', { name: 'Swap the flagged words for this wording' }).click()
  await expect(page.getByRole('button', { name: /^Reviewer finding:/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/\/my-ads$/)

  // What changed counts it as resolved.
  await setRole(page, 'reviewer')
  await page.goto('/review/3')
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible()
  const yours = page.locator('article', { hasText: 'Was your finding' })
  await expect(yours).toContainText('Reworded “as low as 7.99% APR”.')
})
