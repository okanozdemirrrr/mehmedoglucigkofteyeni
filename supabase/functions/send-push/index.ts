/**
 * Supabase Edge Function: send-push
 *
 * notifications tablosuna INSERT olduğunda (Database Webhook veya pg_net)
 * ilgili kullanıcının FCM token(lar)ına FCM v1 push gönderir.
 *
 * Secrets (supabase secrets set):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (\\n ile tek satır)
 *
 * Deploy:
 *   supabase functions deploy send-push --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { JWT } from 'https://esm.sh/google-auth-library@9.14.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRecord {
  id: string
  user_id: string
  title: string
  body: string
  type?: string
  data?: Record<string, unknown>
  link?: string | null
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: NotificationRecord
  schema?: string
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwtClient = new JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  })

  const tokens = await jwtClient.authorize()
  if (!tokens?.access_token) {
    throw new Error('FCM access token alınamadı')
  }
  return tokens.access_token
}

async function sendFcm(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: { priority: 'high' },
          apns: {
            payload: {
              aps: {
                alert: { title, body },
                sound: 'default',
                badge: 1,
              },
            },
          },
        },
      }),
    },
  )

  const json = await res.json()
  if (!res.ok) {
    throw new Error(JSON.stringify(json))
  }
  return json
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = (await req.json()) as WebhookPayload
    const record = payload.record

    if (!record?.user_id || !record.title) {
      return new Response(JSON.stringify({ error: 'Geçersiz payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
    const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')

    if (!projectId || !clientEmail || !privateKey) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: 'FIREBASE_* secrets tanımlı değil',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: tokens, error } = await admin
      .from('user_push_tokens')
      .select('fcm_token, platform')
      .eq('user_id', record.user_id)

    if (error) throw error
    if (!tokens?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'token yok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await getAccessToken(clientEmail, privateKey)
    const dataPayload: Record<string, string> = {
      type: String(record.type || 'general'),
      notification_id: String(record.id),
      link: String(record.link || ''),
      ...(record.data
        ? Object.fromEntries(
            Object.entries(record.data).map(([k, v]) => [k, String(v)]),
          )
        : {}),
    }

    let sent = 0
    const errors: string[] = []

    for (const row of tokens) {
      try {
        await sendFcm(
          projectId,
          accessToken,
          row.fcm_token,
          record.title,
          record.body,
          dataPayload,
        )
        sent += 1
      } catch (e) {
        errors.push(String(e))
      }
    }

    return new Response(JSON.stringify({ sent, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
