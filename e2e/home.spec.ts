import { expect, test } from '@playwright/test'

test('home page opens', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Fine Print')
  await expect(page.getByRole('heading', { level: 1, name: 'Fine Print' })).toBeVisible()
})

test('api is reachable through the dev proxy', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBe(true)
  expect(await res.json()).toEqual({ status: 'ok' })
})
