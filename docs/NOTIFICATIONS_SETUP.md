# Bildirim Sistemi Kurulumu

## 1. SQL Migration

Supabase Dashboard → **SQL Editor** → `supabase/migrations/010_notifications_system.sql` içeriğini çalıştır.

Bu migration şunları ekler:
- `notifications` tablosu (Realtime açık)
- `user_push_tokens` tablosu
- Sipariş / başvuru / menü triggerları
- `upsert_push_token`, `mark_all_notifications_read` RPC'leri

## 2. Edge Function (killed-state FCM)

```bash
supabase functions deploy send-push --no-verify-jwt

supabase secrets set FIREBASE_PROJECT_ID="mehmedoglucigkofte"
supabase secrets set FIREBASE_CLIENT_EMAIL="firebase-adminsdk@....iam.gserviceaccount.com"
supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Database Webhook (opsiyonel):
- Table: `notifications` / INSERT
- URL: `https://<PROJECT>.supabase.co/functions/v1/send-push`

## 3. Capacitor

```bash
npm install
npm run build:mobile
npx cap open android
# iOS: npx cap add ios && npx cap open ios
```

Native izinler giriş sonrası otomatik istenir; token `user_push_tokens` tablosuna yazılır.

## Senaryolar

| Olay | Alıcı | Mesaj |
|------|-------|-------|
| Yeni sipariş (PENDING) | Admin | Yeni Sipariş Geldi! |
| PREPARING | Bayi | Onaylandı ve Hazırlanıyor |
| ON_THE_WAY | Bayi | Yola Çıktı |
| DELIVERED | Bayi | Teslim edildi |
| CANCELLED | Bayi | İptal Edildi |
| Yeni bayi başvurusu | Admin | Onayınızı bekliyor |
| Ürün ekle/güncelle | Tüm bayiler | Menü Güncellendi |
