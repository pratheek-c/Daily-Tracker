/**
 * Supabase client and typed table shapes.
 *
 * The client is created lazily and only when both environment variables are
 * present. If they are missing the app stays in its fully functional local-only
 * mode — the cloud layer is strictly additive, never a hard dependency.
 *
 * Security: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are read here.
 * `VITE_`-prefixed values are part of the browser bundle, so the service-role key
 * must never be added to them. Row Level Security in
 * `supabase/migrations/0001_records.sql` scopes every table to `auth.uid()`.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const isCloudConfigured = url.length > 0 && anonKey.length > 0

/** Public (browser) configuration problem, shown in Settings when relevant. */
export const cloudConfigurationHint = isCloudConfigured
  ? null
  : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (and to your Vercel project) to enable cloud sync. The app works fully offline without them.'

/**
 * The synced record shape, mirroring `public.records`.
 *
 * `payload` is the client record verbatim, which is what lets one table hold
 * every entity type without a migration per entity.
 */
export interface RemoteRecord {
  user_id: string
  entity: string
  id: string
  entity_label: string | null
  updated_at: number
  deleted: boolean
  server_at?: string
  payload: Record<string, unknown>
}

/** Exactly the columns the client writes on upsert. */
export type RemoteRecordInsert = Omit<RemoteRecord, 'server_at'>

/**
 * Cast a batch of insert rows to what the typed PostgREST builder accepts.
 *
 * `postgrest-js` rejects excess properties with
 * `Row & { [K in Exclude<keyof Row, keyof Base>]: never }`. Our `payload` column
 * is `Record<string, unknown>` — it holds an arbitrary client record — and that
 * index signature makes the mapped type collapse the whole row to `never`, so the
 * generic parameter infers as `never` and nothing type-checks.
 *
 * The cast is centralised here rather than sprinkled through the sync engine, and
 * the column set is still pinned by `RemoteRecordInsert`, which mirrors
 * `supabase/migrations/0001_records.sql`. A renamed column is therefore a
 * compile error at the definition, not a silent no-op at runtime.
 */
export function asRecordInserts(rows: RemoteRecordInsert[]): never[] {
  return rows as unknown as never[]
}

export interface RemoteRecordCount {
  user_id: string
  entity: string
  live_rows: number
  tombstoned_rows: number
  last_client_write: number | null
  last_server_write: string | null
}

export interface Database {
  public: {
    Tables: {
      records: {
        Row: RemoteRecord
        Insert: RemoteRecordInsert
        Update: Partial<Omit<RemoteRecord, 'user_id' | 'entity' | 'id'>>
        Relationships: []
      }
      reminder_jobs: {
        Row: {
          user_id: string
          id: string
          dedupe_key: string
          fire_at: string
          title: string
          body: string
          category: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          id: string
          dedupe_key: string
          fire_at: string
          title: string
          body?: string
          category?: string
          sent_at?: string | null
        }
        Update: Partial<{ fire_at: string; title: string; body: string; sent_at: string | null }>
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          user_agent?: string | null
        }
        Update: Partial<{ endpoint: string; p256dh: string; auth_key: string }>
        Relationships: []
      }
    }
    Views: {
      record_counts: {
        Row: RemoteRecordCount
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!isCloudConfigured) return null
  if (!client) {
    // `createBrowserClient` persists the session in cookies rather than
    // localStorage. Cookies are the only place a server-side check can read the
    // session from, which is what lets `middleware.ts` refuse app routes before
    // the SPA is even served. The cookie is `sb-<project-ref>-auth-token`, split
    // into numbered chunks when the session outgrows one cookie.
    client = createBrowserClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: { 'x-application-name': 'anusree-daily-tracker' },
      },
    })
  }
  return client
}
