import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS = path.join(__dirname, 'screenshots')
const BASE = 'http://localhost:5173'

await mkdir(SCREENSHOTS, { recursive: true })

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

async function shot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true })
  console.log(`📸 ${name}`)
}

// Mobile viewport
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

// Welcome
await page.goto(BASE, { waitUntil: 'networkidle0' })
await shot(page, '01-welcome-mobile')

// Register
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle0' })
await shot(page, '02-register-mobile')

// Verify
await page.goto(`${BASE}/verify`, { waitUntil: 'networkidle0' })
await shot(page, '03-verify-mobile')

// Protected routes — attempt to access (will redirect if no session)
await page.goto(`${BASE}/hunt`, { waitUntil: 'networkidle0' })
await shot(page, '04-hunt-mobile')

await page.goto(`${BASE}/matches`, { waitUntil: 'networkidle0' })
await shot(page, '05-matches-mobile')

await page.goto(`${BASE}/chat/m1`, { waitUntil: 'networkidle0' })
await shot(page, '06-chat-mobile')

await page.goto(`${BASE}/activity`, { waitUntil: 'networkidle0' })
await shot(page, '07-activity-mobile')

await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle0' })
await shot(page, '08-profile-mobile')

await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle0' })
await shot(page, '09-settings-mobile')

await page.goto(`${BASE}/add`, { waitUntil: 'networkidle0' })
await shot(page, '10-additem-mobile')

await page.goto(`${BASE}/match/match-1`, { waitUntil: 'networkidle0' })
await shot(page, '11-match-mobile')

// Desktop viewport
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })

await page.goto(BASE, { waitUntil: 'networkidle0' })
await shot(page, '12-welcome-desktop')

await page.goto(`${BASE}/hunt`, { waitUntil: 'networkidle0' })
await shot(page, '13-hunt-desktop')

await page.goto(`${BASE}/matches`, { waitUntil: 'networkidle0' })
await shot(page, '14-matches-desktop')

await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle0' })
await shot(page, '15-profile-desktop')

await browser.close()
console.log('Done! Screenshots saved to', SCREENSHOTS)
