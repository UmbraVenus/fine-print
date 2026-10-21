import { expect, test } from '@playwright/test'
import { setRole } from './helpers.ts'

test.use({ viewport: { width: 1280, height: 900 } })

test('coming-next features take a vote, once per browser, where they would live and in the sidebar', async ({ page }) => {
  await setRole(page, 'marketer')
  await page.goto('/my-ads')
  await page.getByRole('button', { name: /^Upload your own ads/ }).click()
  const card = page.locator('.ant-popover')
  await expect(card.getByText('Drop in an image or a PDF.', { exact: false })).toBeVisible()
  const before = Number((await card.getByText(/^\d+ votes?$/).innerText()).match(/\d+/)![0])
  await card.getByRole('button', { name: 'I’d use this' }).click()
  await expect(card.getByText('Thanks, noted')).toBeVisible()
  // A check on the button, and on the same item in the sidebar, says you voted without opening it.
  await expect(page.getByRole('button', { name: /^Upload your own ads/ }).locator('[data-voted="upload"]')).toBeVisible()
  await expect(card.getByText(/^\d+ votes?$/)).toHaveText(before + 1 === 1 ? '1 vote' : `${before + 1} votes`)

  // The same browser can't vote twice: after a reload it's still noted, from the server.
  await page.reload()
  await page.getByRole('button', { name: /^Upload your own ads/ }).click()
  await expect(page.locator('.ant-popover').getByText('Thanks, noted')).toBeVisible()
  await expect(page.locator('.ant-popover').getByRole('button', { name: 'I’d use this' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // The sidebar's roadmap opens the same card, and Rules and History have their own.
  await page.getByRole('button', { name: 'Coming next', exact: true }).click()
  await expect(page.locator('#coming-next-list [data-voted="upload"]')).toBeVisible()
  await expect(page.locator('#coming-next-list [data-voted]')).toHaveCount(1)
  await page.locator('#coming-next-list').getByRole('button', { name: 'Search past decisions' }).click()
  await expect(page.locator('.ant-popover').getByText('Find how similar ads were decided before', { exact: false })).toBeVisible()
  await page.goto('/rules')
  await expect(page.getByRole('button', { name: /^Turn compliance documents into rules/ })).toBeVisible()
  await setRole(page, 'reviewer')
  await page.goto('/history')
  await expect(page.getByRole('button', { name: /^Search past decisions/ })).toBeVisible()
})
