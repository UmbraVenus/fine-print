import { expect, test } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test('the Queue updates when you come back from deciding in the Review tab', async ({ page, context }) => {
  await resetData(page)
  await setRole(page, 'reviewer')
  await page.goto('/queue')
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(9)

  const [review] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: /^Review Fall personal loan/ }).click()])
  await review.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(review.getByText('Approved ·')).toBeVisible()

  await page.bringToFront()
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(8)
  await expect(page.getByRole('link', { name: /^Review Fall personal loan/ })).toHaveCount(0)
})
