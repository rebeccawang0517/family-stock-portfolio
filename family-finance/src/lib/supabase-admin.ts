import { createClient } from '@supabase/supabase-js'

// 後端 / Server-only Supabase client。使用 service_role / secret key，會繞過 RLS。
// 絕對不要在 client-side（瀏覽器）匯入這個檔。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

if (!url || !secret) {
  throw new Error('Supabase env vars 缺失：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY')
}

export const supabaseAdmin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})
