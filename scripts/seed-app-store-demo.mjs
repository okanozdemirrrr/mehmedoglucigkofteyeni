/**
 * App Store Review demo hesap + menü seed.
 *
 * Gerekli env:
 *   VITE_SUPABASE_URL          (veya SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY  (Dashboard → Settings → API → service_role)
 *   DEMO_ADMIN_PASSWORD
 *   DEMO_DEALER_PASSWORD
 *
 * Opsiyonel:
 *   DEMO_ADMIN_EMAIL   (default: review-admin@regonteknoloji.com)
 *   DEMO_DEALER_EMAIL  (default: review-bayi@regonteknoloji.com)
 *
 * Çalıştır: node scripts/seed-app-store-demo.mjs
 * Şifreleri asla commit etme.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

loadDotEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = (process.env.DEMO_ADMIN_EMAIL || 'review-admin@regonteknoloji.com').toLowerCase()
const dealerEmail = (process.env.DEMO_DEALER_EMAIL || 'review-bayi@regonteknoloji.com').toLowerCase()
const adminPassword = process.env.DEMO_ADMIN_PASSWORD
const dealerPassword = process.env.DEMO_DEALER_PASSWORD

if (!url) {
  console.error('Eksik: VITE_SUPABASE_URL (veya SUPABASE_URL)')
  process.exit(1)
}
if (!serviceKey) {
  console.error(
    'Eksik: SUPABASE_SERVICE_ROLE_KEY\n' +
      'Supabase Dashboard → Project Settings → API → service_role (secret)\n' +
      'Örnek: $env:SUPABASE_SERVICE_ROLE_KEY=\"...\" ; npm run seed:demo'
  )
  process.exit(1)
}
if (!adminPassword || !dealerPassword) {
  console.error('Eksik: DEMO_ADMIN_PASSWORD ve DEMO_DEALER_PASSWORD gerekli.')
  process.exit(1)
}
if (adminPassword.length < 8 || dealerPassword.length < 8) {
  console.error('Demo şifreleri en az 8 karakter olmalı.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(email) {
  let page = 1
  const perPage = 200
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => (u.email || '').toLowerCase() === email)
    if (found) return found
    if (data.users.length < perPage) return null
    page += 1
  }
  return null
}

async function upsertAuthUser({ email, password, role, status, fullName, meta = {} }) {
  const existing = await findUserByEmail(email)
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        role,
        status,
        full_name: fullName,
        ...meta,
      },
    })
    if (error) throw error
    return data.user
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      status,
      full_name: fullName,
      ...meta,
    },
  })
  if (error) throw error
  return data.user
}

async function ensureCategories() {
  const cats = [
    { name: 'Çiğköfte', sort_order: 1 },
    { name: 'Lavaş', sort_order: 2 },
    { name: 'İçecekler', sort_order: 3 },
  ]
  for (const c of cats) {
    const { data: existing } = await admin.from('categories').select('id').eq('name', c.name).maybeSingle()
    if (!existing) {
      const { error } = await admin.from('categories').insert(c)
      if (error) throw error
    }
  }
  const { data, error } = await admin.from('categories').select('id, name')
  if (error) throw error
  return Object.fromEntries((data || []).map((c) => [c.name, c.id]))
}

async function ensureProducts(catIds) {
  const catalog = [
    {
      name: 'Çiğköfte (Kg)',
      base_price: 320,
      description: 'Taze hazırlanan klasik çiğköfte, kilogram sipariş.',
      catalog_sort: 1,
      category_id: catIds['Çiğköfte'],
      modifiers_jsonb: [
        {
          key: 'aci',
          label: 'Acı',
          required: true,
          options: ['Acısız', 'Az Acılı', 'Normal', 'Çok Acılı'],
        },
      ],
    },
    {
      name: 'Çiğköfte Dürüm',
      base_price: 95,
      description: 'Lavaş ile servis edilen çiğköfte dürüm.',
      catalog_sort: 2,
      category_id: catIds['Çiğköfte'],
      modifiers_jsonb: [
        {
          key: 'boy',
          label: 'Boy',
          required: true,
          options: ['Normal', 'Büyük'],
        },
      ],
    },
    {
      name: 'Lavaş (Paket)',
      base_price: 45,
      description: 'Siparişler için taze lavaş paketi.',
      catalog_sort: 1,
      category_id: catIds['Lavaş'],
      modifiers_jsonb: [],
    },
    {
      name: 'Ayran (Kutu)',
      base_price: 25,
      description: 'Soğuk servis ayran.',
      catalog_sort: 1,
      category_id: catIds['İçecekler'],
      modifiers_jsonb: [],
    },
    {
      name: 'Şalgam (1L)',
      base_price: 40,
      description: 'Geleneksel şalgam suyu.',
      catalog_sort: 2,
      category_id: catIds['İçecekler'],
      modifiers_jsonb: [],
    },
  ]

  const productIds = []
  for (const p of catalog) {
    const { data: existing } = await admin
      .from('products')
      .select('id')
      .eq('name', p.name)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('products')
        .update({
          base_price: p.base_price,
          category_id: p.category_id,
          modifiers_jsonb: p.modifiers_jsonb,
          description: p.description,
          catalog_sort: p.catalog_sort,
          is_active: true,
        })
        .eq('id', existing.id)
      if (error) throw error
      productIds.push(existing.id)
    } else {
      const { data, error } = await admin
        .from('products')
        .insert({ ...p, is_active: true })
        .select('id')
        .single()
      if (error) throw error
      productIds.push(data.id)
    }
  }
  return productIds
}

async function ensureDealer() {
  const name = 'App Store Review Bayi'
  const { data: existing } = await admin.from('dealers').select('id').eq('name', name).maybeSingle()
  if (existing) return existing.id

  const { data, error } = await admin
    .from('dealers')
    .insert({
      name,
      tax_no: '1111111111',
      phone: '0555 000 00 01',
      address: 'İstanbul / Kadıköy (Demo)',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function markProfile({ userId, role, status, fullName, dealerId, email }) {
  const payload = {
    full_name: fullName,
    role,
    status,
    dealer_id: role === 'DEALER' ? dealerId : null,
    email,
    phone: role === 'DEALER' ? '0555 000 00 01' : '0555 000 00 02',
    city: role === 'DEALER' ? 'İstanbul' : null,
    district: role === 'DEALER' ? 'Kadıköy' : null,
    tax_no: role === 'DEALER' ? '1111111111' : null,
    is_demo: true,
  }

  let { error } = await admin.from('profiles').update(payload).eq('id', userId)
  if (error && /is_demo|column/i.test(error.message || '')) {
    const { is_demo: _drop, ...withoutDemo } = payload
    ;({ error } = await admin.from('profiles').update(withoutDemo).eq('id', userId))
    console.warn('Uyarı: profiles.is_demo kolonu yok. Önce delete_own_account_v2 migration çalıştırın.')
  }
  if (error) throw error
}

async function ensureCustomPrices(dealerId, productIds) {
  for (const [i, productId] of productIds.entries()) {
    const custom = [300, 90, 42, 22, 38][i] ?? 50
    const { data: existing } = await admin
      .from('dealer_prices')
      .select('id')
      .eq('dealer_id', dealerId)
      .eq('product_id', productId)
      .maybeSingle()

    if (existing) {
      await admin.from('dealer_prices').update({ custom_price: custom }).eq('id', existing.id)
    } else {
      await admin.from('dealer_prices').insert({
        dealer_id: dealerId,
        product_id: productId,
        custom_price: custom,
      })
    }
  }
}

async function testDealerOrder(dealerUserId) {
  // Sign in as dealer with anon key to exercise RPC like the app
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!anonKey) {
    console.warn('Anon key yok; sipariş RPC testi atlandı.')
    return { ok: false, reason: 'missing_anon_key' }
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: signInError } = await client.auth.signInWithPassword({
    email: dealerEmail,
    password: dealerPassword,
  })
  if (signInError) {
    return { ok: false, reason: signInError.message }
  }

  const { data: products, error: prodErr } = await client
    .from('products')
    .select('id, name, modifiers_jsonb')
    .eq('is_active', true)
    .limit(2)

  if (prodErr || !products?.length) {
    await client.auth.signOut()
    return { ok: false, reason: prodErr?.message || 'no_products' }
  }

  const items = products.map((p) => {
    const mods = {}
    for (const m of p.modifiers_jsonb || []) {
      if (m.required && m.options?.length) mods[m.key] = m.options[0]
    }
    return {
      product_id: p.id,
      quantity: 1,
      selected_modifiers: mods,
    }
  })

  const { data: orderId, error: orderErr } = await client.rpc('create_dealer_order', {
    p_items: items,
  })

  let notifCount = 0
  if (!orderErr) {
    // Admin should get a notification (trigger); check via service role
    const { count } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dealerUserId === undefined ? null : undefined)

    const { data: adminProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'ADMIN')
      .eq('status', 'APPROVED')

    if (adminProfiles?.length) {
      const { count: c } = await admin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in(
          'user_id',
          adminProfiles.map((p) => p.id)
        )
        .gte('created_at', new Date(Date.now() - 60_000).toISOString())
      notifCount = c || 0
    }
  }

  await client.auth.signOut()

  if (orderErr) return { ok: false, reason: orderErr.message }
  return { ok: true, orderId, notifCount }
}

async function main() {
  console.log('→ Demo seed başlıyor...')

  const catIds = await ensureCategories()
  const productIds = await ensureProducts(catIds)
  const dealerId = await ensureDealer()

  const adminUser = await upsertAuthUser({
    email: adminEmail,
    password: adminPassword,
    role: 'ADMIN',
    status: 'APPROVED',
    fullName: 'App Store Review Admin',
  })

  const dealerUser = await upsertAuthUser({
    email: dealerEmail,
    password: dealerPassword,
    role: 'DEALER',
    status: 'APPROVED',
    fullName: 'App Store Review Bayi',
    meta: {
      age: '30',
      city: 'İstanbul',
      district: 'Kadıköy',
      tax_no: '1111111111',
      phone: '0555 000 00 01',
      dealer_id: dealerId,
    },
  })

  // Wait briefly for handle_new_user trigger on create
  await new Promise((r) => setTimeout(r, 800))

  await markProfile({
    userId: adminUser.id,
    role: 'ADMIN',
    status: 'APPROVED',
    fullName: 'App Store Review Admin',
    email: adminEmail,
  })

  await markProfile({
    userId: dealerUser.id,
    role: 'DEALER',
    status: 'APPROVED',
    fullName: 'App Store Review Bayi',
    dealerId,
    email: dealerEmail,
  })

  await ensureCustomPrices(dealerId, productIds)

  const orderTest = await testDealerOrder(dealerUser.id)

  console.log('\n✓ Demo seed tamamlandı')
  console.log(`  Admin : ${adminEmail}`)
  console.log(`  Bayi  : ${dealerEmail}`)
  console.log(`  Ürün  : ${productIds.length} aktif`)
  console.log(
    `  Sipariş testi: ${orderTest.ok ? `OK (order=${orderTest.orderId}, recent_admin_notif≈${orderTest.notifCount})` : `FAIL (${orderTest.reason})`}`
  )
  console.log('\nŞifreler env’den okundu; bu çıktıya yazılmıyor.')
}

main().catch((err) => {
  console.error('Seed başarısız:', err.message || err)
  process.exit(1)
})
