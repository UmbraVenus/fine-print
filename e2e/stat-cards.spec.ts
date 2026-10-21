import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

test('My ads: each card shows just its ads, and clicking it again shows all', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  const rows = page.locator('tbody tr.ant-table-row')
  await expect(rows).toHaveCount(8)

  const attention = page.locator('[data-stat="attention"]')
  await attention.click()
  await expect(attention).toHaveAttribute('aria-pressed', 'true')
  await expect(rows).toHaveCount(Number(await attention.locator('[data-stat-value]').innerText()))
  await expect(page.getByRole('columnheader', { name: /Status/ })).toHaveClass(/fp-th-active/)

  const inReview = page.locator('[data-stat="in_review"]')
  await inReview.click()
  await expect(attention).toHaveAttribute('aria-pressed', 'false')
  await expect(rows).toHaveCount(Number(await inReview.locator('[data-stat-value]').innerText()))

  await inReview.click()
  await expect(inReview).toHaveAttribute('aria-pressed', 'false')
  await expect(rows).toHaveCount(8)
})

test('Queue: due today filters; the other cards are plain numbers; the auto check sorts', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/queue')
  const rows = page.locator('tbody tr.ant-table-row')
  await expect(rows).toHaveCount(9)

  const due = page.locator('[data-stat="due_today"]')
  await due.click()
  await expect(rows).toHaveCount(4)
  await expect(due).toHaveAttribute('aria-pressed', 'true')
  await due.click()
  await expect(rows).toHaveCount(9)

  // Only cards that filter are buttons, and they show the filter funnel.
  await expect(page.locator('button[data-stat]')).toHaveCount(1)
  await expect(page.locator('[data-stat="waiting"] .fp-stat-funnel')).toHaveCount(0)
  await expect(page.locator('[data-stat="reviewed"]')).not.toHaveAttribute('href')

  // Most serious first, then Good standing last; the default order is by due date.
  await page.getByRole('columnheader', { name: /Auto check/ }).locator('.ant-table-column-sorters').click()
  await expect(rows.first()).toContainText('Best loans of 2026')
  await expect(rows.first()).toContainText('3 Critical')
  await expect(rows.last()).toContainText('Good standing')
})
