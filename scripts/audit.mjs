import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'screenshots')
const BASE = 'http://localhost:5173'

// Load env from .env.local
const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const envVars = Object.fromEntries(
  env.trim().split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const SUPABASE_URL = envVars['VITE_SUPABASE_URL']
const ANON_KEY = envVars['VITE_SUPABASE_ANON_KEY']
const SERVICE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing Supabase env vars'); process.exit(1)
}

const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1]
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
  console.log(`✓ ${name}`)
}

// Get a real session via OTP with service role
let session = null

if (SERVICE_KEY) {
  console.log('Getting session via service role...')
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1 })
  if (users?.length > 0) {
    const user = users[0]
    console.log(`Using user: ${user.email}`)
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    })
    if (linkData?.properties?.hashed_token) {
      const anonClient = createClient(SUPABASE_URL, ANON_KEY)
      const { data: verifyData } = await anonClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      })
      if (verifyData?.session) {
        session = verifyData.session
        console.log('✓ Got session for:', user.email)
        console.log('  access_token starts:', session.access_token?.slice(0, 20))
      } else {
        console.log('✗ Could not exchange token for session')
      }
    }
  }
} else {
  console.log('No SERVICE_KEY — protected screens will redirect to Welcome')
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })

// Navigate to a URL, optionally with session pre-injected
async function navigateWithSession(page, url) {
  const needsSession = session && !noSessionRoutes.has(url)

  if (needsSession) {
    // Navigate to origin first to set localStorage, then go to target
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
    await page.evaluate((key, sessionStr) => {
      localStorage.setItem(key, sessionStr)
    }, STORAGE_KEY, JSON.stringify(session))
  } else {
    // Clear session for public screens
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, STORAGE_KEY)
  }

  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
  // Extra wait for data-heavy screens (Hunt needs feed to load)
  const extraWait = ['/hunt', '/matches', '/activity', '/profile'].some(p => url.startsWith(p)) ? 3000 : 1500
  await wait(extraWait)
}

async function auditMobile(routes) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844 })
  for (const [name, url] of routes) {
    await navigateWithSession(page, url)
    await shot(page, name)
  }
  await page.close()
}

async function auditDesktop(routes) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  for (const [name, url] of routes) {
    await navigateWithSession(page, url)
    await shot(page, name)
  }
  await page.close()
}

// Routes that should be captured WITHOUT session (auth/onboarding screens)
const noSessionRoutes = new Set(['/', '/register', '/login', '/verify'])

const mobileRoutes = [
  ['01-welcome-mobile', '/'],
  ['02-register-mobile', '/register'],
  ['03-login-mobile', '/login'],
  ['04-verify-mobile', '/verify'],
  ['05-hunt-mobile', '/hunt'],
  ['06-matches-mobile', '/matches'],
  ['07-activity-mobile', '/activity'],
  ['08-profile-mobile', '/profile'],
  ['09-settings-mobile', '/settings'],
  ['10-add-item-mobile', '/add'],
  ['11-chat-mobile', '/chat/test-swap-123'],
  ['12-match-mobile', '/match/test-swap-123'],
  ['13-cancel-mobile', '/cancel/test-swap-123'],
  ['14-rate-mobile', '/rate/test-swap-123'],
]

const desktopRoutes = [
  ['15-welcome-desktop', '/'],
  ['16-register-desktop', '/register'],
  ['17-hunt-desktop', '/hunt'],
  ['18-matches-desktop', '/matches'],
  ['19-activity-desktop', '/activity'],
  ['20-profile-desktop', '/profile'],
  ['21-settings-desktop', '/settings'],
  ['22-add-item-desktop', '/add'],
  ['23-chat-desktop', '/chat/test-swap-123'],
  ['24-match-desktop', '/match/test-swap-123'],
]

console.log('\n── Mobile ───────────────────────────────')
await auditMobile(mobileRoutes)
console.log('\n── Desktop ──────────────────────────────')
await auditDesktop(desktopRoutes)

await browser.close()
console.log('\nAll screenshots saved to scripts/screenshots/')
