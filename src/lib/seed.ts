import { db } from './supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makePublicId(): string {
  let r = 'DA-'
  for (let i = 0; i < 4; i++) r += CHARS[Math.floor(Math.random() * CHARS.length)]
  return r
}

function makeQrToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Returns an ISO timestamp offset `daysBack` days from now, at the given hour */
function daysAgo(days: number, hour = 12, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Static seed data — EXOTIC FEST 2.0 (San Valentín)
// Ticket types match the event's actual tiers:
//   · Preventa Mujeres  — $250  (rosa #ec4899)
//   · Preventa Hombres  — $350  (azul #3b82f6)
//   · VIP Pareja        — $600  (dorado #f59e0b)
//   · General           — $200  (gris  #aeaeb2)
// ---------------------------------------------------------------------------

type PaySt   = 'pending' | 'approved' | 'rejected'
type TixSt   = 'valid' | 'used' | 'cancelled'
type Method  = 'cash' | 'spei'

interface Entry {
  guestName:         string
  phone:             string
  ticketType:        string
  payStatus:         PaySt
  ticketStatus:      TixSt
  amount:            number
  method:            Method
  registeredDaysAgo: number
  seatNumber:        number
  scannedDaysAgo?:   number
  scannedHour?:      number
}

const SEED_ENTRIES: Entry[] = [
  // ── VIP Pareja (3 boletos) ────────────────────────────────────────────────
  {
    guestName: 'Valentina y Rodrigo',   phone: '+52 55 1234 5678', ticketType: 'VIP Pareja',
    payStatus: 'approved', ticketStatus: 'used',  amount: 600, method: 'spei',
    registeredDaysAgo: 14, seatNumber: 1, scannedDaysAgo: 1, scannedHour: 21,
  },
  {
    guestName: 'Isabella Montoya',      phone: '+52 81 5555 1212', ticketType: 'VIP Pareja',
    payStatus: 'approved', ticketStatus: 'used',  amount: 600, method: 'spei',
    registeredDaysAgo: 12, seatNumber: 2, scannedDaysAgo: 1, scannedHour: 22,
  },
  {
    guestName: 'Camila y José',         phone: '+52 33 9876 5432', ticketType: 'VIP Pareja',
    payStatus: 'approved', ticketStatus: 'valid', amount: 600, method: 'spei',
    registeredDaysAgo: 10, seatNumber: 3,
  },

  // ── Preventa Mujeres (5 boletos) ─────────────────────────────────────────
  {
    guestName: 'Sofía Gutiérrez',       phone: '+52 55 4321 8765', ticketType: 'Preventa Mujeres',
    payStatus: 'approved', ticketStatus: 'used',  amount: 250, method: 'cash',
    registeredDaysAgo: 20, seatNumber: 4, scannedDaysAgo: 1, scannedHour: 20,
  },
  {
    guestName: 'Mariana Quispe',        phone: '+52 81 1111 2222', ticketType: 'Preventa Mujeres',
    payStatus: 'approved', ticketStatus: 'used',  amount: 250, method: 'spei',
    registeredDaysAgo: 18, seatNumber: 5, scannedDaysAgo: 1, scannedHour: 21,
  },
  {
    guestName: 'Fernanda Salinas',      phone: '+52 81 9988 7766', ticketType: 'Preventa Mujeres',
    payStatus: 'approved', ticketStatus: 'valid', amount: 250, method: 'cash',
    registeredDaysAgo: 15, seatNumber: 6,
  },
  {
    guestName: 'Natalia Ibáñez',        phone: '+52 55 8877 6655', ticketType: 'Preventa Mujeres',
    payStatus: 'pending',  ticketStatus: 'cancelled', amount: 250, method: 'cash',
    registeredDaysAgo: 4, seatNumber: 7,
  },
  {
    guestName: 'Paola Estrada',         phone: '+52 81 9900 1122', ticketType: 'Preventa Mujeres',
    payStatus: 'pending',  ticketStatus: 'cancelled', amount: 250, method: 'spei',
    registeredDaysAgo: 2, seatNumber: 8,
  },

  // ── Preventa Hombres (5 boletos) ─────────────────────────────────────────
  {
    guestName: 'Diego Fuentes',         phone: '+52 55 2468 1357', ticketType: 'Preventa Hombres',
    payStatus: 'approved', ticketStatus: 'used',  amount: 350, method: 'spei',
    registeredDaysAgo: 22, seatNumber: 9, scannedDaysAgo: 1, scannedHour: 20,
  },
  {
    guestName: 'Carlos Becerra',        phone: '+52 33 1122 3344', ticketType: 'Preventa Hombres',
    payStatus: 'approved', ticketStatus: 'used',  amount: 350, method: 'spei',
    registeredDaysAgo: 19, seatNumber: 10, scannedDaysAgo: 2, scannedHour: 22,
  },
  {
    guestName: 'Javier Morales',        phone: '+52 55 5544 3322', ticketType: 'Preventa Hombres',
    payStatus: 'approved', ticketStatus: 'valid', amount: 350, method: 'cash',
    registeredDaysAgo: 16, seatNumber: 11,
  },
  {
    guestName: 'Miguel Ángel Vázquez',  phone: '+52 81 4433 2211', ticketType: 'Preventa Hombres',
    payStatus: 'approved', ticketStatus: 'valid', amount: 350, method: 'spei',
    registeredDaysAgo: 11, seatNumber: 12,
  },
  {
    guestName: 'Omar Delgado',          phone: '+52 33 2211 0099', ticketType: 'Preventa Hombres',
    payStatus: 'pending',  ticketStatus: 'cancelled', amount: 350, method: 'cash',
    registeredDaysAgo: 3, seatNumber: 13,
  },

  // ── General (5 boletos) ───────────────────────────────────────────────────
  {
    guestName: 'Luis Espinoza',         phone: '+52 81 3456 7890', ticketType: 'General',
    payStatus: 'approved', ticketStatus: 'used',  amount: 200, method: 'cash',
    registeredDaysAgo: 21, seatNumber: 14, scannedDaysAgo: 1, scannedHour: 19,
  },
  {
    guestName: 'Ana Lucía Mendoza',     phone: '+52 55 6543 2109', ticketType: 'General',
    payStatus: 'approved', ticketStatus: 'used',  amount: 200, method: 'cash',
    registeredDaysAgo: 17, seatNumber: 15, scannedDaysAgo: 2, scannedHour: 20,
  },
  {
    guestName: 'Sebastián Torres',      phone: '+52 55 2468 1000', ticketType: 'General',
    payStatus: 'approved', ticketStatus: 'valid', amount: 200, method: 'spei',
    registeredDaysAgo: 13, seatNumber: 16,
  },
  {
    guestName: 'Renata Paredes',        phone: '+52 55 3322 1100', ticketType: 'General',
    payStatus: 'pending',  ticketStatus: 'cancelled', amount: 200, method: 'spei',
    registeredDaysAgo: 5, seatNumber: 17,
  },
  {
    guestName: 'Hugo Sandoval',         phone: '+52 33 0011 2233', ticketType: 'General',
    payStatus: 'rejected', ticketStatus: 'cancelled', amount: 200, method: 'cash',
    registeredDaysAgo: 7, seatNumber: 18,
  },

  // ── Invitado Especial (2 cortesías) ──────────────────────────────────────
  {
    guestName: 'Tomás Guerrero',        phone: '+52 81 6655 4433', ticketType: 'Invitado Especial',
    payStatus: 'approved', ticketStatus: 'valid', amount: 0, method: 'cash',
    registeredDaysAgo: 6, seatNumber: 19,
  },
  {
    guestName: 'Daniela Ruiz',          phone: '+52 55 7788 9900', ticketType: 'Invitado Especial',
    payStatus: 'approved', ticketStatus: 'used',  amount: 0, method: 'cash',
    registeredDaysAgo: 9, seatNumber: 20, scannedDaysAgo: 1, scannedHour: 22,
  },
]

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

export async function seedDatabase(): Promise<void> {
  // 1. Resolve organizer & event -------------------------------------------
  const { data: orgData } = await db
    .from('organizers')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!orgData) throw new Error('No se encontró ningún organizador.')
  const organizerId = (orgData as { id: string }).id

  let eventId: string | null = null
  {
    const { data } = await db
      .from('events')
      .select('id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data) {
      eventId = (data as { id: string }).id
    } else {
      const { data: any } = await db
        .from('events')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (any) eventId = (any as { id: string }).id
    }
  }

  if (!eventId) {
    const { data: newEvent } = await db
      .from('events')
      .insert({
        organizer_id: organizerId,
        name: 'EXOTIC FEST 2.0',
        slug: 'exotic-fest-2-san-valentin',
        starts_at: new Date('2025-02-14T22:00:00.000Z').toISOString(),
        venue: 'Club Social Monterrey — Salón Diamante',
        capacity: 300,
        cover_price: 200,
        status: 'active',
      })
      .select('id')
      .single()
    if (!newEvent) throw new Error('No se pudo crear el evento de prueba.')
    eventId = (newEvent as { id: string }).id
  }

  // 2. Wipe existing data for this event ------------------------------------
  const { data: existingRegs } = await db
    .from('registrations')
    .select('id')
    .eq('event_id', eventId)

  if (existingRegs && existingRegs.length > 0) {
    const regIds = (existingRegs as { id: string }[]).map((r) => r.id)

    // Delete scan_log first (via tickets)
    for (const rid of regIds) {
      const { data: tix } = await db.from('tickets').select('id').eq('registration_id', rid)
      if (tix && tix.length > 0) {
        const tixIds = (tix as { id: string }[]).map((t) => t.id)
        for (const tid of tixIds) {
          await db.from('scan_log').delete().eq('ticket_id', tid)
        }
      }
    }
    for (const rid of regIds) {
      await db.from('tickets').delete().eq('registration_id', rid)
    }
    for (const rid of regIds) {
      await db.from('payments').delete().eq('registration_id', rid)
    }
    await db.from('registrations').delete().eq('event_id', eventId)
  }

  // 3. Insert 20 seed records -----------------------------------------------
  for (let i = 0; i < SEED_ENTRIES.length; i++) {
    const entry = SEED_ENTRIES[i]
    const publicId   = makePublicId()
    const qrToken    = makeQrToken()
    const regCreatedAt = daysAgo(entry.registeredDaysAgo, 10 + (i % 8))

    // Registration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reg } = await (db.from('registrations') as any).insert({
      organizer_id:   organizerId,
      event_id:       eventId,
      public_id:      publicId,
      guest_name:     entry.guestName,
      whatsapp_phone: entry.phone,
      party_size:     1,
      status:         entry.payStatus === 'approved' ? 'confirmed' : 'pending',
      created_at:     regCreatedAt,
    }).select('id').single()

    if (!reg) continue
    const regId = (reg as { id: string }).id

    // Payment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('payments') as any).insert({
      organizer_id:   organizerId,
      registration_id: regId,
      amount:          entry.amount,
      method:          entry.method,
      reference_id:    `REF-${publicId}`,
      clabe:           entry.method === 'spei' ? '646180111801234567' : '000000000000000000',
      status:          entry.payStatus,
      created_at:      regCreatedAt,
    })

    // Ticket
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tix } = await (db.from('tickets') as any).insert({
      organizer_id:   organizerId,
      event_id:       eventId,
      registration_id: regId,
      qr_token:        qrToken,
      ticket_type:     entry.ticketType,
      status:          entry.ticketStatus,
      seat_number:     entry.seatNumber,
      holder_name:     entry.guestName,
      created_at:      regCreatedAt,
    }).select('id').single()

    // Scan log — only for 'used' tickets
    if (entry.ticketStatus === 'used' && entry.scannedDaysAgo != null && tix) {
      const ticketId  = (tix as { id: string }).id
      const scannedAt = daysAgo(entry.scannedDaysAgo, entry.scannedHour ?? 20, i * 3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.from('scan_log') as any).insert({
        organizer_id: organizerId,
        event_id:     eventId,
        ticket_id:    ticketId,
        result:       'ok',
        scanned_at:   scannedAt,
      })
    }
  }
}
