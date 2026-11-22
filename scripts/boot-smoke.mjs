/**
 * Üretim build + Capacitor Preferences mock senaryoları.
 * Kullanım: npm run build && node scripts/boot-smoke.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = 4175
const BASE = `http://127.0.0.1:${PORT}`
const OUT = resolve(process.cwd(), 'screenshots/boot')

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

function prefsMockSource(mode) {
  // mode: ok | hang | throw
  return `
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      Plugins: {},
      isPluginAvailable: () => true,
    };
    const hang = () => new Promise(() => {});
    const okPrefs = {
      keys: async () => ({ keys: ['sb-test-auth-token'] }),
      get: async ({ key }) => ({ value: null }),
      set: async () => {},
      remove: async () => {},
    };
    const throwPrefs = {
      keys: async () => { throw new Error('Preferences.keys failed'); },
      get: async () => { throw new Error('Preferences.get failed'); },
      set: async () => { throw new Error('Preferences.set failed'); },
      remove: async () => { throw new Error('Preferences.remove failed'); },
    };
    const hangPrefs = {
      keys: hang,
      get: hang,
      set: hang,
      remove: hang,
    };
    const prefs = ${JSON.stringify(mode)} === 'hang' ? hangPrefs
      : ${JSON.stringify(mode)} === 'throw' ? throwPrefs
      : okPrefs;

    // @capacitor/preferences dinamik import'unu boz / yönlendir
    const origFetch = window.fetch.bind(window);
    // Vite chunk'ı yerine global mock: Capacitor.Plugins.Preferences
    window.Capacitor.Plugins.Preferences = prefs;

    // ESM import('@capacitor/preferences') için module mock mümkün değilse
    // Preferences bridge'i Capacitor.getPlugin ile de denenebilir — authStorage
    // doğrudan @capacitor/preferences import eder. Bu yüzden defineProperty ile
    // import map yok; sayfa yüklenmeden önce import'u monkey-patch etmek için
    // aşağıdaki stub script'i window.__MOCK_PREFS__ olarak bırakıyoruz.
    window.__MOCK_PREFS_MODE__ = ${JSON.stringify(mode)};
    window.__MOCK_PREFS__ = prefs;
  `
}

async function runScenario(browser, mode) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  const failedRequests = []
  const rejections = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.failure()?.errorText || 'fail'} ${req.url()}`)
  })

  await page.addInitScript(
    ({ mode }) => {
      window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
        isPluginAvailable: () => true,
      }
      const hang = () => new Promise(() => {})
      const okPrefs = {
        keys: async () => ({ keys: [] }),
        get: async () => ({ value: null }),
        set: async () => {},
        remove: async () => {},
      }
      const throwPrefs = {
        keys: async () => {
          throw new Error('Preferences.keys failed')
        },
        get: async () => {
          throw new Error('Preferences.get failed')
        },
        set: async () => {
          throw new Error('Preferences.set failed')
        },
        remove: async () => {
          throw new Error('Preferences.remove failed')
        },
      }
      const hangPrefs = {
        keys: hang,
        get: hang,
        set: hang,
        remove: hang,
      }
      const prefs = mode === 'hang' ? hangPrefs : mode === 'throw' ? throwPrefs : okPrefs
      window.__MOCK_PREFS__ = prefs
      window.__MOCK_PREFS_MODE__ = mode

      // authStorage dinamik import('@capacitor/preferences') — Vite'ta gerçek paket gelir.
      // Gerçek Preferences native bridge çağırır; web'de localStorage fallback kullanır.
      // Capacitor.isNativePlatform() true olduğu için Preferences import edilir.
      // Web'de @capacitor/preferences Preferences.get genelde localStorage kullanır.
      // Hang senaryosu için Preferences metodlarını patch'lemek üzere
      // import sonrası poll:
      const patch = () => {
        try {
          // Bazı sürümlerde window.Capacitor.Plugins üzerinden
          if (window.Capacitor) {
            window.Capacitor.Plugins = window.Capacitor.Plugins || {}
            window.Capacitor.Plugins.Preferences = prefs
          }
        } catch {
          /* ignore */
        }
      }
      patch()
      setInterval(patch, 50)
    },
    { mode }
  )

  // Preferences ESM modülünü sayfa tarafında override etmek için route interception
  // Mümkün değilse hang: gerçek Preferences web implementasyonu localStorage kullanır
  // ve asılı kalmaz. Hang'i simüle etmek için authStorage'ın kullandığı import'u
  // page.evaluateOnNewDocument ile prototype patch yapamayız.
  // Bunun yerine: hang senaryosunda window.Capacitor.isNativePlatform true iken
  // @capacitor/preferences web kodu çalışır — hang etmez.
  // Gerçek hang için modülün Preferences nesnesini monkey-patch edelim:

  await page.route('**/node_modules/@capacitor/preferences/**', async (route) => {
    const body =
      mode === 'hang'
        ? `export const Preferences = { keys: () => new Promise(()=>{}), get: () => new Promise(()=>{}), set: () => new Promise(()=>{}), remove: () => new Promise(()=>{}) };`
        : mode === 'throw'
          ? `export const Preferences = { keys: async () => { throw new Error('keys'); }, get: async () => { throw new Error('get'); }, set: async () => { throw new Error('set'); }, remove: async () => { throw new Error('remove'); } };`
          : `export const Preferences = { keys: async () => ({ keys: [] }), get: async () => ({ value: null }), set: async () => {}, remove: async () => {} };`
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body,
    })
  })

  // Built chunk adları farklı olabilir — preview'da assets içindeki preferences chunk
  await page.route('**/preferences*.js', async (route) => {
    if (mode === 'ok') {
      await route.continue()
      return
    }
    const body =
      mode === 'hang'
        ? `export const Preferences = { keys: () => new Promise(()=>{}), get: () => new Promise(()=>{}), set: () => new Promise(()=>{}), remove: () => new Promise(()=>{}) };`
        : `export const Preferences = { keys: async () => { throw new Error('keys'); }, get: async () => { throw new Error('get'); }, set: async () => { throw new Error('set'); }, remove: async () => { throw new Error('remove'); } };`
    await route.fulfill({ status: 200, contentType: 'application/javascript', body })
  })

  const t0 = Date.now()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })

  // UI görünür olmalı (yükleniyor / vitrin / hata — beyaz boş değil)
  const result = await page.waitForFunction(
    () => {
      const root = document.getElementById('root')
      const text = (root?.innerText || '').trim()
      const watchdog = document.getElementById('boot-watchdog')
      const watchdogShown = watchdog?.classList?.contains('show')
      const mounted = window.__APP_MOUNTED__ === true
      return {
        mounted,
        textLen: text.length,
        textSample: text.slice(0, 120),
        watchdogShown: Boolean(watchdogShown),
        hasYukleniyor: /Yükleniyor|Ürün|Giriş|başlatılamadı|Mehmedoğlu/i.test(text),
      }
    },
    { timeout: 10000 }
  ).then((h) => h.jsonValue()).catch(async () => {
    const snap = await page.evaluate(() => ({
      mounted: window.__APP_MOUNTED__,
      text: (document.getElementById('root')?.innerText || '').slice(0, 200),
      htmlLen: document.getElementById('root')?.innerHTML?.length || 0,
      lastError: window.__APP_LAST_ERROR__,
    }))
    return { ...snap, failed: true }
  })

  const elapsed = Date.now() - t0
  await page.screenshot({ path: resolve(OUT, `boot-${mode}.png`) }).catch(() => {})

  // Giriş sayfası da açılsın
  let loginOk = false
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForSelector('text=Giriş', { timeout: 8000 })
    loginOk = true
  } catch {
    loginOk = false
  }

  await context.close()

  const uiVisible =
    result.hasYukleniyor ||
    (result.textLen || 0) > 10 ||
    result.watchdogShown ||
    result.mounted

  return {
    mode,
    elapsed,
    uiVisible,
    loginOk,
    result,
    consoleErrors: consoleErrors.slice(0, 8),
    pageErrors: pageErrors.slice(0, 8),
    failedRequests: failedRequests.slice(0, 8),
    rejections,
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  if (!existsSync(resolve(process.cwd(), 'dist'))) {
    console.error('Önce npm run build')
    process.exit(1)
  }

  const preview = spawn(
    `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    { cwd: process.cwd(), stdio: 'ignore', shell: true }
  )

  const report = []
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch({ headless: true })

    // Önce web (Capacitor yok)
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForFunction(
        () => window.__APP_MOUNTED__ || (document.getElementById('root')?.innerText || '').length > 5,
        { timeout: 8000 }
      )
      const text = await page.locator('#root').innerText()
      const webOk = text.length > 5 && /Yükleniyor|Ürün|Giriş|Mehmedoğlu|vitrin|katalog/i.test(text)
      report.push({
        mode: 'web-normal',
        uiVisible: webOk,
        loginOk: true,
        textSample: text.slice(0, 100),
        pageErrors: errors,
      })
      await page.screenshot({ path: resolve(OUT, 'boot-web.png') })
      await context.close()
      console.log(`web-normal: ui=${webOk}`)
    }

    for (const mode of ['ok', 'hang', 'throw']) {
      const r = await runScenario(browser, mode)
      report.push(r)
      console.log(
        `${mode}: ui=${r.uiVisible} login=${r.loginOk} ${r.elapsed}ms mounted=${r.result?.mounted} sample="${(r.result?.textSample || r.result?.text || '').slice(0, 60)}"`
      )
      if (r.pageErrors?.length) console.log('  pageErrors:', r.pageErrors)
      if (r.consoleErrors?.length) console.log('  console:', r.consoleErrors.slice(0, 3))
    }

    await browser.close()
  } finally {
    preview.kill('SIGTERM')
  }

  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2))

  const failed = report.filter((r) => !r.uiVisible)
  if (failed.length) {
    console.error('\nFAIL: UI görünmeyen senaryolar:', failed.map((f) => f.mode).join(', '))
    process.exit(1)
  }
  console.log('\nTüm boot senaryolarında arayüz açıldı.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
