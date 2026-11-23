/**
 * Şifremi unuttum / şifre yenile — ağ mock’lu Playwright kontrolleri.
 * Kullanım: npm run build && npm run test:password-reset
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = 4176
const BASE = `http://127.0.0.1:${PORT}`

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForServer(url, tries = 60) {
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

function startPreview() {
  const child = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
    {
      cwd: process.cwd(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  return child
}

async function mockRecover(page, { status = 200, body = {} } = {}) {
  await page.route('**/auth/v1/recover**', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

async function main() {
  if (!existsSync(resolve(process.cwd(), 'dist/index.html'))) {
    throw new Error('Önce npm run build çalıştırın (dist yok).')
  }

  const preview = startPreview()
  let failed = 0
  const log = (ok, name, detail = '') => {
    const mark = ok ? '✓' : '✗'
    console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`)
    if (!ok) failed += 1
  }

  try {
    await waitForServer(BASE)
    const browser = await chromium.launch({ headless: true })

    // 1) Form doğrulama — geçersiz e-posta
    {
      const page = await browser.newPage()
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Şifremi unuttum' }).click()
      await page.locator('#forgot-email').fill('degil-email')
      await page.getByRole('button', { name: 'Sıfırlama bağlantısı gönder' }).click()
      const err = page.locator('text=Geçerli bir e-posta adresi girin')
      log((await err.count()) > 0, 'Geçersiz e-posta doğrulaması')
      await page.close()
    }

    // 2) Başarı mesajı (mock 200) — hesap sızdırmaz metin
    {
      const page = await browser.newPage()
      await mockRecover(page, { status: 200, body: {} })
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Şifremi unuttum' }).click()
      await page.locator('#forgot-email').fill('ornek@firma.com')
      await page.getByRole('button', { name: 'Sıfırlama bağlantısı gönder' }).click()
      const okMsg = page.locator(
        'text=Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi'
      )
      await okMsg.waitFor({ timeout: 8000 })
      log((await okMsg.count()) > 0, 'Başarı mesajı (hesap sızdırmaz)')
      const cooldown = page.getByRole('button', { name: /Tekrar gönder/ })
      log((await cooldown.count()) > 0, '60 sn bekleme kilidi görünür')
      await page.close()
    }

    // 3) 429 davranışı
    {
      const page = await browser.newPage()
      await mockRecover(page, {
        status: 429,
        body: { message: 'email rate limit exceeded', error: 'over_email_send_rate_limit' },
      })
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Şifremi unuttum' }).click()
      await page.locator('#forgot-email').fill('ornek@firma.com')
      await page.getByRole('button', { name: 'Sıfırlama bağlantısı gönder' }).click()
      const rate = page.locator('text=Çok sık denediniz, biraz sonra tekrar deneyin')
      await rate.waitFor({ timeout: 8000 })
      log((await rate.count()) > 0, '429 rate limit mesajı')
      await page.close()
    }

    // 4) /sifre-yenile geçersiz token
    {
      const page = await browser.newPage()
      await page.goto(`${BASE}/sifre-yenile`, { waitUntil: 'networkidle' })
      const invalid = page.locator('text=geçersiz veya süresi dolmuş')
      await invalid.waitFor({ timeout: 10000 })
      log((await invalid.count()) > 0, '/sifre-yenile geçersiz bağlantı ekranı')
      const link = page.getByRole('link', { name: 'Yeni bağlantı iste' })
      log((await link.count()) > 0, 'Yeni bağlantı iste yönlendirmesi')
      await page.close()
    }

    // 5) Eşleşmeyen şifre (sahte recovery JWT + user mock)
    {
      const page = await browser.newPage()
      // minimal JWT (header.payload.sig) — supabase istemcisi biçim bekleyebilir
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(
        JSON.stringify({
          sub: '00000000-0000-0000-0000-000000000001',
          email: 't@t.com',
          role: 'authenticated',
          exp: 9999999999,
        })
      ).toString('base64url')
      const accessToken = `${header}.${payload}.testsig`
      const refreshToken = 'test-refresh-token'
      const userBody = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 't@t.com',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
      }

      await page.route('**/auth/v1/**', async (route) => {
        const url = route.request().url()
        const method = route.request().method()
        if (url.includes('/user') && method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(userBody),
          })
          return
        }
        if (url.includes('/token')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken,
              token_type: 'bearer',
              expires_in: 3600,
              user: userBody,
            }),
          })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(userBody),
        })
      })

      await page.goto(
        `${BASE}/sifre-yenile#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=recovery`,
        { waitUntil: 'networkidle' }
      )

      const newPw = page.locator('#new-password')
      try {
        await newPw.waitFor({ timeout: 12000 })
        await newPw.fill('abcdefghi')
        await page.locator('#new-password2').fill('farklisifre')
        await page.getByRole('button', { name: 'Şifreyi güncelle' }).click()
        const mismatch = page.locator('text=Şifreler eşleşmiyor')
        await mismatch.waitFor({ timeout: 5000 })
        log((await mismatch.count()) > 0, 'Eşleşmeyen şifre doğrulaması')
      } catch (err) {
        log(false, 'Eşleşmeyen şifre doğrulaması', String(err.message || err).slice(0, 160))
      }
      await page.close()
    }

    // 6) Giriş ekranı hâlâ açılıyor (akış bozulmadı)
    {
      const page = await browser.newPage()
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      const email = page.locator('#email')
      const submit = page.getByRole('button', { name: /Girişi$/ })
      log((await email.count()) > 0 && (await submit.count()) > 0, 'Mevcut giriş formu sağlam')
      await page.close()
    }

    // 7) Statik gizlilik/destek bozulmadı
    {
      const page = await browser.newPage()
      const g = await page.goto(`${BASE}/gizlilik.html`, { waitUntil: 'domcontentloaded' })
      const d = await page.goto(`${BASE}/destek.html`, { waitUntil: 'domcontentloaded' })
      log(g?.ok() && (await page.content()).includes('Destek'), 'destek.html erişilebilir')
      await page.goto(`${BASE}/gizlilik.html`, { waitUntil: 'domcontentloaded' })
      log(
        Boolean(d?.ok()) && (await page.content()).includes('Gizlilik'),
        'gizlilik.html erişilebilir'
      )
      await page.close()
    }

    await browser.close()
  } finally {
    preview.kill('SIGTERM')
  }

  if (failed > 0) {
    console.error(`\n${failed} kontrol başarısız.`)
    process.exit(1)
  }
  console.log('\nTüm şifre-sıfırlama kontrolleri geçti.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
