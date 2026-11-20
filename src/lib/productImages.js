import { supabase } from './supabaseClient'

export const PRODUCT_IMAGES_BUCKET = 'product-images'
const MAX_BYTES = 5 * 1024 * 1024
const MAX_EDGE = 1000
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Yüklemede dosya adı unique; URL’deki ?v= varsa koru, yoksa dokunma */
export function withImageCacheBust(url) {
  if (!url) return null
  return url
}

export function extractStoragePathFromPublicUrl(url) {
  if (!url) return null
  try {
    const marker = `/object/public/${PRODUCT_IMAGES_BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  } catch {
    return null
  }
}

/** Dosyayı doğrula, uzun kenarı ~1000px’e küçült, JPEG üret */
export async function prepareProductImage(file) {
  if (!file) throw new Error('Dosya seçilmedi.')
  if (!ALLOWED.has(file.type)) {
    throw new Error('Sadece JPG, PNG veya WEBP yükleyebilirsiniz.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Görsel en fazla 5 MB olabilir.')
  }

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Görsel okunamadı. Farklı bir dosya deneyin.')
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Görsel işlenemedi.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Görsel sıkıştırılamadı.'))),
      'image/jpeg',
      0.82
    )
  })

  if (blob.size > MAX_BYTES) {
    throw new Error('Sıkıştırılmış görsel hâlâ çok büyük. Daha küçük bir dosya seçin.')
  }

  return new File([blob], `product-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

export async function uploadProductImage(productId, file) {
  if (!supabase) throw new Error('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
  if (!productId) throw new Error('Ürün kimliği eksik.')

  const prepared = await prepareProductImage(file)
  const path = `${productId}/${Date.now()}.jpg`

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, prepared, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '3600',
    })

  if (error) {
    const msg = String(error.message || '').toLowerCase()
    if (msg.includes('row-level security') || msg.includes('unauthorized') || msg.includes('403')) {
      throw new Error('Görsel yükleme yetkiniz yok. Yalnızca yönetici yükleyebilir.')
    }
    throw new Error('Görsel yüklenemedi. Lütfen tekrar deneyin.')
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('Görsel adresi alınamadı.')

  // Her yüklemede yeni path + v= ile önbellek kırılır
  return `${publicUrl}?v=${Date.now()}`
}

export async function removeProductImageFile(imageUrl) {
  if (!supabase || !imageUrl) return
  const path = extractStoragePathFromPublicUrl(imageUrl)
  if (!path) return

  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path])
  if (error) {
    console.warn('Eski görsel silinemedi:', error.message)
  }
}
