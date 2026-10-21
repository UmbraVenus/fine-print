import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PORT = 5173

// Use a pre-installed Chromium when there is one, instead of downloading browsers.
const preinstalledChromium = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const launchOptions = existsSync(preinstalledChromium) ? { executablePath: preinstalledChromium } : {}

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions } }],
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
