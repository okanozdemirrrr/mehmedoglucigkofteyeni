# Agent / AI çalışma kuralları — Mehmedoğlu B2B

## Mobil UI (zorunlu)

- Her UI değişikliği **375 / 390 / 430 px** genişliklerde doğrulanmadan bitmiş sayılmaz.
- Mümkünse `npm run build && npm run ui:mobile-check` çalıştır; public sayfa screenshot’larını kontrol et.
- Yeni **dropdown / panel / modal / toast** viewport dışına taşmamalı; mobilde `fixed` + `left/right` inset veya `max-width: calc(100vw - …)` kullan. `absolute right-0` + `width: 90vw` kombinasyonundan kaçın (sola taşar).
- Yeni **tablo** mutlaka mobilde kart düzenine geçmeli (`stack-table` + `data-label`). Masaüstü-only sütunlar için `stack-hide-mobile` kullan; düz `hidden` yeterli değil (stack CSS `display:flex` ezer).
- Input’larda iOS zoom için en az **16px** font; dokunma hedefleri en az **44px**.
- Safe area: `env(safe-area-inset-*)` / `.safe-area-pad-t|b`.
- İş mantığı, Supabase sorguları, yetkilendirme ve demo seed’e dokunma; sadece layout/CSS/JSX yapısı.

## Referans

Ayrıntılı kontrol maddeleri: `MOBILE_UI_CHECKLIST.md`
