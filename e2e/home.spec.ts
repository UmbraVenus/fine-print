import { expect, test } from '@playwright/test'
import { resetData } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

test('home opens the reviewer’s Insights by default, one click from the Queue', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/insights$/)
  await expect(page).toHaveTitle('Insights · Fine Print')
  await expect(page.getByRole('heading', { level: 2, name: /× more ads approved every week$/ })).toBeVisible()
  await page.getByRole('link', { name: 'Open the Queue · 9' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Queue' })).toBeVisible()
})

test('api is reachable through the dev proxy', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBe(true)
  expect(await res.json()).toEqual({ status: 'ok' })
})
