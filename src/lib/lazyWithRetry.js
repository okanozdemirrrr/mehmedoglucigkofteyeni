import { lazy } from 'react'

/**
 * Lazy route: chunk yüklenemezse bir kez yenilemeyi dener, sonra Türkçe hata fırlatır.
 */
export function lazyWithRetry(importer, name = 'sayfa') {
  return lazy(async () => {
    try {
      return await importer()
    } catch (firstErr) {
      // Capacitor / geçici ağ: bir kez sayfa yenilemeden chunk'ı tekrar dene
      try {
        await new Promise((r) => window.setTimeout(r, 400))
        return await importer()
      } catch (secondErr) {
        const msg = String(secondErr?.message || firstErr?.message || '')
        const err = new Error(
          `"${name}" yüklenemedi. İnternet bağlantınızı kontrol edip Yeniden dene'ye basın. (${msg.slice(0, 120)})`
        )
        err.cause = secondErr
        throw err
      }
    }
  })
}
