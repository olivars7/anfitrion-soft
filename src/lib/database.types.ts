// Hand-written types matching the REAL Supabase schema.
// Verified against live DB via REST API probing 2026-11-10.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      organizers: {
        Row: { id: string; name: string; email: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['organizers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['organizers']['Insert']>
      }
      admins: {
        Row: { id: string; organizer_id: string; name: string; email: string; role: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['admins']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['admins']['Insert']>
      }
      events: {
        Row: {
          id: string
          organizer_id: string
          name: string
          slug: string
          starts_at: string
          venue: string
          capacity: number
          cover_price: number
          status: 'draft' | 'active' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      registrations: {
        Row: {
          id: string
          organizer_id: string
          event_id: string
          public_id: string
          guest_name: string
          whatsapp_phone: string
          party_size: number
          status: 'pending' | 'confirmed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['registrations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['registrations']['Insert']>
      }
      payments: {
        Row: {
          id: string
          organizer_id: string
          registration_id: string
          amount: number
          method: 'cash' | 'spei'
          reference_id: string
          clabe: string
          status: 'pending' | 'approved' | 'rejected'
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      tickets: {
        Row: {
          id: string
          organizer_id: string
          registration_id: string
          event_id: string
          seat_number: number
          holder_name: string | null
          qr_token: string
          status: 'valid' | 'used' | 'cancelled'
          checked_in_at: string | null
          ticket_type: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>
      }
      scan_log: {
        Row: {
          id: string
          organizer_id: string
          event_id: string
          ticket_id: string
          result: 'ok' | 'invalid'
          scanned_by: string | null
          scanned_at: string
        }
        Insert: Omit<Database['public']['Tables']['scan_log']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['scan_log']['Insert']>
      }
      cash_entries: {
        Row: { id: string; event_id: string; amount: number; note: string | null; created_at: string }
        Insert: Omit<Database['public']['Tables']['cash_entries']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['cash_entries']['Insert']>
      }
      budget_lines: {
        Row: { id: string; event_id: string; description: string; amount: number; created_at: string }
        Insert: Omit<Database['public']['Tables']['budget_lines']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['budget_lines']['Insert']>
      }
    }
  }
}
