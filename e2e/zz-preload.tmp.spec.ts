import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'
test('preload matches', async ({ page }) => {
  await resetData(page)
  await setRole(page, 'reviewer')
  const urls: string[] = []
  page.on('request', (r) => { if (r.url().includes('/api/ads?')) urls.push(new URL(r.url()).search) })
  await page.goto('/queue')
  await expect(page.locator('.fp-ad-link').first()).toBeVisible()
  await page.waitForTimeout(800)
  const preloaded = [...urls]
  urls.length = 0
  await page.getByRole('link', { name: 'History' }).click()
  await expect(page.locator('.fp-ad-link').first()).toBeVisible({ timeout: 300 })
  console.log('PRELOADED', preloaded, 'HISTORY', urls)
  expect(preloaded).toContain(urls[0])
})
