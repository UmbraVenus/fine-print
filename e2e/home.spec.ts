import { expect, test } from '@playwright/test'
import { resetData } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

test('home opens the reviewer queue by default', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/queue$/)
  await expect(page).toHaveTitle('Queue · Fine Print')
  await expect(page.getByRole('heading', { level: 1, name: 'Queue' })).toBeVisible()
})

test('api is reachable through the dev proxy', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBe(true)
  expect(await res.json()).toEqual({ status: 'ok' })
})
