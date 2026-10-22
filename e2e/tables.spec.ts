import { expect, test } from '@playwright/test'
import { queueOrder, resetData, setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

function stat(page: import('@playwright/test').Page, key: string) {
  return page.locator(`[data-stat="${key}"] [data-stat-value]`)
}

test('queue: 9 waiting, 4 due today, most recently updated first', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/queue')
  await expect(stat(page, 'waiting')).toHaveText('9')
  await expect(stat(page, 'due_today')).toHaveText('4')
  const names = page.locator('.fp-ad-link')
  await expect(names).toHaveCount(9)
  await expect(names).toHaveText((await queueOrder(page)).map((r) => r.name))
  await expect(page.getByText('Showing 1–9 of 9')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Review / })).toHaveCount(9)
  await page.screenshot({ path: 'screenshots/m3-queue.png', fullPage: true })
})

test('my ads: stats agree with the rows', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await expect(stat(page, 'attention')).toHaveText('2')
  await expect(stat(page, 'in_review')).toHaveText('3')
  await expect(page.locator('.fp-ad-link')).toHaveCount(8)
  await expect(page.getByRole('link', { name: /^Pre-check / })).toHaveCount(2)
  // No sub-lines under internal ads: Status and the dates say it.
  await expect(page.getByText('Pre-check: 1 Critical, 1 Caution')).toHaveCount(0)
  await page.screenshot({ path: 'screenshots/m3-my-ads.png', fullPage: true })
})

test('filters live in the column headers', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await page.locator('th', { hasText: 'Format' }).locator('.ant-table-filter-trigger').click()
  await page.getByRole('checkbox', { name: 'Email' }).check()
  await page.screenshot({ path: 'screenshots/m3-my-ads-filter.png' })
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('.fp-ad-link')).toHaveText(['Holiday debt email', 'Rate check email'])
  await expect(page.locator('th.fp-th-active')).toHaveCount(1)
})

test('search, with an empty state', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/queue')
  await page.getByRole('textbox', { name: 'Search ads' }).fill('zzz')
  await expect(page.getByText('No ads match your search.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Search ads' }).fill('card')
  await expect(page.locator('.fp-ad-link')).toHaveCount(2)
  expect((await page.locator('.fp-ad-link').allInnerTexts()).sort()).toEqual(['Card payoff story', 'Student card post'])
})

test('history: computed numbers and pagination', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/history')
  await expect(page.locator('.fp-ad-link')).toHaveCount(10)
  await expect(page.getByText(/^Showing 1–10 of [\d,]+$/)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Go to page' })).toBeVisible()
  await page.screenshot({ path: 'screenshots/m3-history.png', fullPage: true })
  await page.getByRole('button', { name: 'Page 2', exact: true }).click()
  await expect(page.getByText(/^Showing 11–20 of/)).toBeVisible()
})

test('go to page: jumps on Enter and refuses a page that does not exist', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/history')
  const goTo = page.getByRole('textbox', { name: 'Go to page' })
  const lastPage = Number(await page.locator('nav[aria-label="Pages"] .fp-page').nth(-2).textContent())
  // Typing past the last page used to stop at the last valid prefix ("300" became 30).
  await goTo.fill(String(lastPage * 10))
  await goTo.press('Enter')
  await expect(page.getByRole('alert')).toHaveText(`Pick a page from 1 to ${lastPage}`)
  await expect(goTo).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText(/^Showing 1–10 of/)).toBeVisible()
  await goTo.fill('15')
  await goTo.press('Enter')
  await expect(page.getByText(/^Showing 141–150 of/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Page 15', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(goTo).toHaveValue('')
})

test('the view drawer opens from an ad name and closes with Escape', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await page.getByRole('button', { name: 'Balance transfer banner' }).click()
  await expect(page).toHaveURL(/view=12/)
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('BEFORE IT GOES LIVE', { exact: true })).toBeVisible()
  await expect(drawer.getByText('Add “then 20.24%–28.24% variable APR” right after the intro rate. No second review needed.')).toBeVisible()
  await expect(drawer.getByText('Reviewer approved with changes')).toBeVisible()
  await expect(drawer.getByText('You submitted version 1')).toBeVisible()
  await expect(drawer.getByText('Pre-check: 1 Caution')).toBeVisible()
  await page.screenshot({ path: 'screenshots/m3-view-drawer.png' })
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/view=/)
})
