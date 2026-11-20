import { supabase } from './supabaseClient'

/** Girişsiz vitrin — sadece güvenli RPC alanları */
export async function fetchPublicProducts() {
  if (!supabase) return { data: [], error: new Error('Yapılandırma eksik') }

  const { data, error } = await supabase.rpc('list_public_products')
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

export async function fetchPublicProduct(id) {
  if (!supabase) return { data: null, error: new Error('Yapılandırma eksik') }
  if (!id) return { data: null, error: new Error('Ürün bulunamadı') }

  const { data, error } = await supabase.rpc('get_public_product', { p_id: id })
  if (error) return { data: null, error }

  const row = Array.isArray(data) ? data[0] : data
  return { data: row || null, error: null }
}

/** Anon ile fiyat sızıntısı olmadığını doğrulamak için (dev/test) */
export async function assertAnonCannotReadPrices() {
  if (!supabase) return { ok: false, detail: 'no client' }

  const { data, error } = await supabase.from('products').select('id, base_price').limit(1)
  // Beklenen: RLS nedeniyle boş veya hata; fiyat dönmemeli
  if (error) return { ok: true, detail: error.message }
  if (!data || data.length === 0) return { ok: true, detail: 'empty' }
  return { ok: false, detail: 'products readable by anon', sample: data[0] }
}
