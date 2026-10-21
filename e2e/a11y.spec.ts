import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { resetData, setRole } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await resetData(page)
})

const PAGES: Array<{ role: 'reviewer' | 'marketer'; path: string; ready: string }> = [
  { role: 'reviewer', path: '/queue', ready: 'Best loans of 2026' },
  { role: 'reviewer', path: '/history', ready: 'approved this week' },
  { role: 'reviewer', path: '/insights', ready: 'Affiliate compliance' },
  { role: 'reviewer', path: '/review/3', ready: 'Auto suggestions' },
  { role: 'reviewer', path: '/review/5', ready: 'What changed' },
  { role: 'reviewer', path: '/review/6', ready: 'No affiliate disclosure on this page' },
  { role: 'reviewer', path: '/rules', ready: 'Clear and conspicuous' },
  { role: 'marketer', path: '/my-ads', ready: 'Holiday debt email' },
  { role: 'marketer', path: '/my-ads?view=12', ready: 'BEFORE IT GOES LIVE' },
  { role: 'marketer', path: '/ads/1/pre-check', ready: 'Auto suggestions' },
  { role: 'marketer', path: '/ads/2/pre-check', ready: 'From your reviewer' },
]

async function serious(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`)
}

for (const { role, path, ready } of PAGES) {
  test(`no serious accessibility issues: ${role} ${path}`, async ({ page }) => {
    await setRole(page, role)
    await page.goto(path)
    await expect(page.getByText(ready).first()).toBeVisible()
    await page.waitForTimeout(300)
    expect(await serious(page)).toEqual([])
  })
}

test('keyboard: tab through Review, keep a suggestion, open a pin', async ({ page }) => {
  await setRole(page, 'reviewer')
  await page.goto('/review/3')
  await expect(page.getByText('Auto suggestions')).toBeVisible()
  const visited: string[] = []
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return 'BODY|n/a'
      const outline = getComputedStyle(el).outlineStyle
      return `${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? el.tagName}|${outline}`
    })
    visited.push(label)
  }
  const names = visited.map((v) => v.split('|')[0])
  // The reviewer reaches the pins, the cards' actions and every decision by keyboard alone.
  for (const expected of ['Finding 1: The rate claim is missing the full APR range and the autopay condition.', 'Keep', 'Dismiss…', 'Add a finding', 'Approve']) {
    expect(names.some((n) => n.startsWith(expected))).toBe(true)
  }
  // Every focused element shows the visible focus ring.
  expect(visited.filter((v) => v.endsWith('|none'))).toEqual([])
  expect(names.filter((n) => n !== 'BODY').length).toBeGreaterThan(30)

  await page.getByRole('button', { name: /^Finding 2:/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-finding="2"]')).toHaveCSS('border-top-width', '2px')
  const keep = page.locator('[data-finding="2"]').getByRole('button', { name: 'Keep' })
  await keep.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-finding="2"]').getByRole('button', { name: 'Kept' })).toBeVisible()
})

for (const width of [1024, 1280, 1440]) {
  test(`layout holds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await setRole(page, 'reviewer')
    for (const path of ['/queue', '/review/3', '/history', '/insights']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(0)
    }
    await page.goto('/queue')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `screenshots/m7-queue-${width}.png` })
    await page.goto('/review/3')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `screenshots/m7-review-${width}.png` })
  })
}
