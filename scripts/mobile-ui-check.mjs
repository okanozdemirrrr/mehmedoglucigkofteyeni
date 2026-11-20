/**
 * Kritik sayfaları 375/390/430 genişlikte açar, yatay taşma kontrol eder,
 * screenshots/mobile altına PNG kaydeder.
 *
 * Kullanım: npm run build && npm run ui:mobile-check
 * Demo bayi/admin (opsiyonel): .env içinde DEMO_DEALER_EMAIL / DEMO_DEALER_PASSWORD
 * ve DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD
 */

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WIDTHS = [375, 390, 430]
const PUBLIC_PAGES = [
  { path: '/urunler', name: 'catalog' },
  { path: '/login', name: 'login' },
  { path: '/bayi-basvuru', name: 'basvuru' },
  { path: '/gizlilik', name: 'gizlilik' },
]

const OUT = resolve(process.cwd(), 'screenshots/mobile')
const PORT = 4173
const BASE = `http://127.0.0.1:${PORT}`

function loadEnv() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[t.slice(0, i).trim()] = v
  }
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  throw new Error(`Preview ayağa kalkmadı: ${url}`)
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const sw = Math.max(doc.scrollWidth, body?.scrollWidth || 0)
    const iw = window.innerWidth
    return { sw, iw, overflow: sw > iw + 1 }
  })
}

async function shot(page, name, width, failedRef) {
  const overflow = await checkOverflow(page)
  const file = resolve(OUT, `${name}-${width}.png`)
  await page.screenshot({ path: file, fullPage: true })
  if (overflow.overflow) {
    failedRef.count += 1
    console.error(
      `FAIL overflow ${name} @${width}px scrollWidth=${overflow.sw} innerWidth=${overflow.iw}`
    )
  } else {
    console.log(`OK  ${name} @${width}px → ${file}`)
  }
}

async function loginAs(page, role, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(300)
  // Rol seç
  const roleLabel = role === 'ADMIN' ? 'Dağıtıcı' : 'Bayi'
  await page.getByRole('button', { name: roleLabel }).first().click().catch(() => {})
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /Girişi|Giriş/ }).last().click()
  await page.waitForURL(/\/(admin|bayi)\//, { timeout: 20000 }).catch(() => {})
  await sleep(800)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const env = { ...loadEnv(), ...process.env }

  const preview = spawn(
    'npx vite preview --host 127.0.0.1 --port ' + PORT + ' --strictPort',
    { cwd: process.cwd(), stdio: 'ignore', shell: true }
  )

  const failedRef = { count: 0 }

  try {
    await waitForServer(BASE)
    const browser = await chromium.launch({ headless: true })

    for (const width of WIDTHS) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
      })

      for (const route of PUBLIC_PAGES) {
        await page.goto(`${BASE}${route.path}`, {
          waitUntil: 'networkidle',
          timeout: 30000,
        }).catch(async () => {
          await page.goto(`${BASE}${route.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          })
        })
        await sleep(350)
        await shot(page, route.name, width, failedRef)
      }

      // Demo bayi
      if (env.DEMO_DEALER_EMAIL && env.DEMO_DEALER_PASSWORD) {
        await loginAs(page, 'DEALER', env.DEMO_DEALER_EMAIL, env.DEMO_DEALER_PASSWORD)
        await shot(page, 'bayi-dashboard', width, failedRef)
        // Bildirim panelini aç
        await page.getByLabel('Bildirimler').click().catch(() => {})
        await sleep(300)
        await shot(page, 'bayi-notifications', width, failedRef)
        await page.keyboard.press('Escape').catch(() => {})
      }

      // Demo admin (önce çıkış)
      if (env.DEMO_ADMIN_EMAIL && env.DEMO_ADMIN_PASSWORD) {
        await page.getByRole('button', { name: /Çıkış/i }).click().catch(() => {})
        await sleep(400)
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
        await sleep(400)
        // Oturum hâlâ açıksa local storage temizle
        await page.evaluate(() => {
          try {
            localStorage.clear()
            sessionStorage.clear()
          } catch {
            /* ignore */
          }
        })
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
        await sleep(300)
        await loginAs(page, 'ADMIN', env.DEMO_ADMIN_EMAIL, env.DEMO_ADMIN_PASSWORD)
        await shot(page, 'admin-dashboard', width, failedRef)
        await page.getByLabel('Bildirimler').click().catch(() => {})
        await sleep(300)
        await shot(page, 'admin-notifications', width, failedRef)
      }

      await page.close()
    }

    await browser.close()

    if (failedRef.count > 0) {
      console.error(`\n${failedRef.count} yatay taşma bulundu.`)
      process.exit(1)
    }
    console.log('\nKontrol edilen sayfalar yatay taşmasız.')
  } finally {
    preview.kill('SIGTERM')
  }
}

if (!existsSync(resolve(process.cwd(), 'dist'))) {
  console.error('Önce npm run build çalıştırın.')
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
