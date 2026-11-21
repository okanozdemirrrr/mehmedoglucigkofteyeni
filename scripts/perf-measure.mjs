/**
 * Mobil emülasyon + Slow 4G + 4x CPU ile akış süreleri.
 * Kullanım: npm run build && node scripts/perf-measure.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = 4174
const BASE = `http://127.0.0.1:${PORT}`
const OUT = resolve(process.cwd(), 'screenshots/perf')
const WIDTH = 390
const HEIGHT = 844

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[t.slice(0, i).trim()] = v
  }
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      /* retry */
    }
    await sleep(200)
  }
  throw new Error(`Preview ayağa kalkmadı: ${url}`)
}

function summarizeRequests(reqs) {
  const byHost = {}
  let totalBytes = 0
  let supabaseCount = 0
  const supabase = []
  for (const r of reqs) {
    totalBytes += r.encodedDataLength || 0
    try {
      const u = new URL(r.url)
      byHost[u.host] = (byHost[u.host] || 0) + 1
      if (u.host.includes('supabase') || u.pathname.includes('/rest/v1/') || u.pathname.includes('/auth/v1/')) {
        supabaseCount += 1
        supabase.push(r)
      }
    } catch {
      /* ignore */
    }
  }
  supabase.sort((a, b) => (b.duration || 0) - (a.duration || 0))
  const slowest3 = supabase.slice(0, 3).map((r) => {
    let path = r.url
    try {
      const u = new URL(r.url)
      path = u.pathname + (u.search ? u.search.slice(0, 80) : '')
    } catch {
      /* ignore */
    }
    return `${path} (${Math.round(r.duration || 0)}ms, ${Math.round((r.encodedDataLength || 0) / 1024)}KB)`
  })
  return {
    requestCount: reqs.length,
    supabaseCount,
    totalKB: Math.round(totalBytes / 1024),
    slowest3,
    byHost,
  }
}

async function measureFlow(browser, name, run) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: ((1.6 * 1024 * 1024) / 8) * 0.8, // Slow 4G-ish
    uploadThroughput: ((750 * 1024) / 8) * 0.8,
    latency: 150,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  const reqs = []
  const started = new Map()

  page.on('request', (req) => {
    started.set(req, Date.now())
  })
  page.on('response', async (res) => {
    const req = res.request()
    const t0 = started.get(req) || Date.now()
    let encodedDataLength = 0
    try {
      const headers = res.headers()
      const cl = headers['content-length']
      if (cl) encodedDataLength = parseInt(cl, 10) || 0
      else {
        const buf = await res.body().catch(() => null)
        if (buf) encodedDataLength = buf.length
      }
    } catch {
      /* ignore */
    }
    reqs.push({
      url: res.url(),
      status: res.status(),
      duration: Date.now() - t0,
      encodedDataLength,
      resourceType: req.resourceType(),
    })
  })

  const tStart = Date.now()
  let markFirstPaint = null
  try {
    await run(page, {
      markReady: () => {
        if (markFirstPaint == null) markFirstPaint = Date.now() - tStart
      },
    })
  } catch (err) {
    console.error(`FAIL ${name}:`, err.message)
  }
  const totalMs = Date.now() - tStart
  const summary = summarizeRequests(reqs)
  const jsReqs = reqs.filter((r) => r.resourceType === 'script' || /\.js(\?|$)/.test(r.url))
  const imgReqs = reqs.filter((r) => r.resourceType === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(r.url))
  const jsKB = Math.round(jsReqs.reduce((s, r) => s + (r.encodedDataLength || 0), 0) / 1024)
  const imgKB = Math.round(imgReqs.reduce((s, r) => s + (r.encodedDataLength || 0), 0) / 1024)

  await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: false }).catch(() => {})
  await context.close()

  return {
    flow: name,
    totalMs,
    firstReadyMs: markFirstPaint,
    ...summary,
    jsKB,
    imgKB,
  }
}

async function login(page, role, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const roleLabel = role === 'ADMIN' ? 'Dağıtıcı' : 'Bayi'
  await page.getByRole('button', { name: roleLabel }).first().click().catch(() => {})
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /Giriş/ }).last().click()
  await page.waitForURL(/\/(admin|bayi)\//, { timeout: 45000 })
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const env = { ...loadEnv(), ...process.env }
  if (!existsSync(resolve(process.cwd(), 'dist'))) {
    console.error('Önce npm run build çalıştırın.')
    process.exit(1)
  }

  const preview = spawn(
    `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    { cwd: process.cwd(), stdio: 'ignore', shell: true }
  )

  try {
    await waitForServer(BASE)
    const browser = await chromium.launch({ headless: true })
    const results = []

    // 1) Cold start → vitrin
    results.push(
      await measureFlow(browser, 'cold-catalog', async (page, { markReady }) => {
        await page.goto(`${BASE}/urunler`, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForSelector('text=Ürün', { timeout: 30000 }).catch(() => {})
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
        markReady()
        await sleep(800)
      })
    )

    // 2) Login → admin dashboard
    if (env.DEMO_ADMIN_EMAIL && env.DEMO_ADMIN_PASSWORD) {
      results.push(
        await measureFlow(browser, 'admin-dashboard', async (page, { markReady }) => {
          await login(page, 'ADMIN', env.DEMO_ADMIN_EMAIL, env.DEMO_ADMIN_PASSWORD)
          await page.waitForSelector('text=Dashboard', { timeout: 30000 }).catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
          markReady()
          await sleep(1000)
        })
      )

      results.push(
        await measureFlow(browser, 'admin-menu', async (page, { markReady }) => {
          await login(page, 'ADMIN', env.DEMO_ADMIN_EMAIL, env.DEMO_ADMIN_PASSWORD)
          await page.goto(`${BASE}/admin/menu`, { waitUntil: 'domcontentloaded', timeout: 60000 })
          await page.waitForSelector('text=Menü', { timeout: 30000 }).catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
          markReady()
          await sleep(800)
        })
      )

      results.push(
        await measureFlow(browser, 'admin-notifications', async (page, { markReady }) => {
          await login(page, 'ADMIN', env.DEMO_ADMIN_EMAIL, env.DEMO_ADMIN_PASSWORD)
          await page.getByLabel('Bildirimler').click().catch(() => {})
          await sleep(1200)
          markReady()
        })
      )
    }

    // 3) Login → bayi dashboard (+ sipariş hazırlığı)
    if (env.DEMO_DEALER_EMAIL && env.DEMO_DEALER_PASSWORD) {
      results.push(
        await measureFlow(browser, 'bayi-dashboard', async (page, { markReady }) => {
          await login(page, 'DEALER', env.DEMO_DEALER_EMAIL, env.DEMO_DEALER_PASSWORD)
          await page.waitForSelector('text=Sepet', { timeout: 30000 }).catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
          markReady()
          await sleep(1000)
        })
      )

      results.push(
        await measureFlow(browser, 'bayi-order-ready', async (page, { markReady }) => {
          await login(page, 'DEALER', env.DEMO_DEALER_EMAIL, env.DEMO_DEALER_PASSWORD)
          await page.waitForSelector('text=Sepet', { timeout: 30000 }).catch(() => {})
          // Ürün ekle butonu varsa tıkla (sipariş oluşturmayı başlat)
          const addBtn = page.getByRole('button', { name: /Sepete Ekle|Ekle/i }).first()
          if (await addBtn.count()) {
            await addBtn.click().catch(() => {})
            await sleep(500)
          }
          markReady()
          await sleep(800)
        })
      )
    }

    await browser.close()

    const report = { measuredAt: new Date().toISOString(), width: WIDTH, cpu: 4, network: 'slow-4g', results }
    writeFileSync(resolve(OUT, 'baseline.json'), JSON.stringify(report, null, 2))

    console.log('\n=== PERF BASELINE (Slow 4G + 4x CPU, 390px) ===\n')
    console.log('| Akış | Toplam ms | Ready ms | İstek | Supabase | JS KB | Img KB | Toplam KB | En yavaş 3 |')
    console.log('|------|-----------|----------|-------|----------|-------|--------|-----------|------------|')
    for (const r of results) {
      console.log(
        `| ${r.flow} | ${r.totalMs} | ${r.firstReadyMs ?? '-'} | ${r.requestCount} | ${r.supabaseCount} | ${r.jsKB} | ${r.imgKB} | ${r.totalKB} | ${(r.slowest3 || []).join(' · ') || '-'} |`
      )
    }
    console.log(`\nJSON: ${resolve(OUT, 'baseline.json')}`)
  } finally {
    preview.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
