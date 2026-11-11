import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Typed client for reads
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Untyped client for writes — avoids Supabase SDK's overly-strict mutation types
export const db = createClient(supabaseUrl, supabaseAnonKey)
