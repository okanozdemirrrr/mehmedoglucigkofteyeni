# Mobil UI Kontrol Listesi

Her arayüz değişikliğinden sonra **iOS build almadan önce** tarayıcıda (Chrome DevTools cihaz modu) doğrula.

## Genişlikler
- [ ] 375px (iPhone SE)
- [ ] 390px (iPhone 14/15)
- [ ] 430px (Pro Max sınıfı)

## Her sayfa / bileşen
- [ ] Yatay kaydırma yok (`scrollWidth ≈ innerWidth`)
- [ ] Dropdown / panel / modal viewport içinde; taşma yok
- [ ] Toast sağ/sol kenarda kesilmiyor
- [ ] Üst üste binen öğe yok
- [ ] Metinler kesilmiyor (özellikle başlıklar)
- [ ] Dokunma hedefleri ≥ 44×44 px
- [ ] Input `font-size` ≥ 16px (iOS zoom yok)
- [ ] Safe area: çentik / home indicator içeriği ezmiyor
- [ ] Sticky header içeriği kapatmıyor
- [ ] Tablolar mobilde kart düzeninde (`stack-table`)
- [ ] Genişletme oku tek ve net (çift chevron yok)

## Komut
```bash
npm run build
npm run ui:mobile-check
```
Ekran görüntüleri: `screenshots/mobile/`

## Girişli sayfalar (manuel)
Demo bayi / admin ile: dashboard, menü, bildirim paneli, sepet, ayarlar.
