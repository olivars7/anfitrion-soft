'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface LogEntry {
  table: string
  action: string
  record_id: string
  payload: Record<string, unknown>
  created_at: string
  event_id?: string | null
}

interface RegRow { id: string; event_id: string; guest_name: string; public_id: string; created_at: string }
interface PayRow { id: string; registration_id: string; amount: number; status: string; created_at: string }
interface TixRow { id: string; event_id: string; registration_id: string; ticket_type: string; status: string; created_at: string }
interface ScanRow { id: string; event_id: string; ticket_id: string; result: string; scanned_at: string }

async function buildLog(): Promise<LogEntry[]> {
  const [regRes, payRes, tixRes, scanRes] = await Promise.all([
    supabase.from('registrations').select('id, event_id, guest_name, public_id, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('payments').select('id, registration_id, amount, status, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('tickets').select('id, event_id, registration_id, ticket_type, status, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('scan_log').select('id, event_id, ticket_id, result, scanned_at').order('scanned_at', { ascending: false }).limit(50),
  ])

  const entries: LogEntry[] = []

  for (const r of (regRes.data ?? []) as RegRow[]) {
    entries.push({ table: 'registrations', action: 'INSERT', record_id: r.id, payload: { name: r.guest_name, public_id: r.public_id }, created_at: r.created_at, event_id: r.event_id })
  }
  for (const p of (payRes.data ?? []) as PayRow[]) {
    entries.push({ table: 'payments', action: p.status === 'approved' ? 'APPROVED' : p.status === 'rejected' ? 'REJECTED' : 'INSERT', record_id: p.id, payload: { amount: p.amount, status: p.status }, created_at: p.created_at, event_id: null })
  }
  for (const t of (tixRes.data ?? []) as TixRow[]) {
    entries.push({ table: 'tickets', action: t.status === 'valid' ? 'ACTIVATED' : t.status === 'used' ? 'SCANNED' : 'INSERT', record_id: t.id, payload: { ticket_type: t.ticket_type, status: t.status }, created_at: t.created_at, event_id: t.event_id })
  }
  for (const s of (scanRes.data ?? []) as ScanRow[]) {
    entries.push({ table: 'scan_log', action: 'SCAN', record_id: s.id, payload: { result: s.result, ticket_id: s.ticket_id }, created_at: s.scanned_at, event_id: s.event_id })
  }

  return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100)
}

const TABLE_COLOR: Record<string, string> = {
  registrations: 'text-[#00e5ff]',
  payments:      'text-[#39ff14]',
  tickets:       'text-[#ff6b00]',
  scan_log:      'text-[#888888]',
}

const ACTION_COLOR: Record<string, string> = {
  INSERT:   'text-white',
  APPROVED: 'text-[#39ff14]',
  ACTIVATED:'text-[#39ff14]',
  SCANNED:  'text-[#00e5ff]',
  REJECTED: 'text-red-500',
  SCAN:     'text-[#00e5ff]',
}

interface ConsoleViewProps {
  compact?: boolean
  eventId?: string | null
  defaultFilterByEvent?: boolean
}

export function ConsoleView({ compact = false, eventId, defaultFilterByEvent = true }: ConsoleViewProps) {
  const [log, setLog] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterByEvent, setFilterByEvent] = useState<boolean>(
    defaultFilterByEvent && !!eventId
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLog(await buildLog())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Sync default when eventId first arrives
  useEffect(() => {
    if (eventId && defaultFilterByEvent) setFilterByEvent(true)
  }, [eventId, defaultFilterByEvent])

  const allEntries = compact ? log.slice(0, 12) : log
  const entries = filterByEvent && eventId
    ? allEntries.filter(e => e.event_id === eventId || e.event_id == null)
    : allEntries

  return (
    <div className={`flex flex-col ${compact ? 'overflow-hidden' : 'h-full'}`}>
      {!compact && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs text-[#888888] font-mono uppercase tracking-widest">consola db</span>

          {/* Animated square switch filter */}
          {eventId && (
            <button
              onClick={() => setFilterByEvent(v => !v)}
              className="flex items-center gap-2 group select-none"
              title={filterByEvent ? 'Mostrando este evento · clic para ver todo' : 'Mostrando todo · clic para filtrar por evento'}
            >
              {/* Square toggle track */}
              <span
                className={`
                  relative inline-flex items-center w-10 h-5 border transition-all duration-300 ease-in-out shrink-0
                  ${filterByEvent
                    ? 'bg-[#39ff14]/15 border-[#39ff14]/50'
                    : 'bg-transparent border-white/20'
                  }
                `}
              >
                {/* Square thumb */}
                <span
                  className={`
                    absolute top-0.5 w-4 h-4 transition-all duration-300 ease-in-out
                    ${filterByEvent
                      ? 'translate-x-[22px] bg-[#39ff14]'
                      : 'translate-x-[2px] bg-[#444]'
                    }
                  `}
                />
              </span>
              <span className={`text-[10px] font-mono transition-colors duration-200 ${filterByEvent ? 'text-[#39ff14]' : 'text-[#555]'}`}>
                {filterByEvent ? 'este evento' : 'todos'}
              </span>
            </button>
          )}
        </div>
      )}
      <div className={`font-mono text-xs bg-black ${compact ? 'overflow-hidden' : 'overflow-y-auto flex-1 min-h-0'}`}>
        {loading ? (
          <p className="text-[#888888] p-3">Cargando…</p>
        ) : entries.length === 0 ? (
          <p className="text-[#888888] p-3">Sin actividad registrada.</p>
        ) : (
          <table className="w-full">
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-1.5 text-[#444] whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString('es-MX', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className={`px-2 py-1.5 ${TABLE_COLOR[e.table] ?? 'text-white'}`}>{e.table}</td>
                  <td className={`px-2 py-1.5 font-bold ${ACTION_COLOR[e.action] ?? 'text-white'}`}>{e.action}</td>
                  <td className="px-2 py-1.5 text-[#555] truncate max-w-[120px]">
                    {Object.entries(e.payload).map(([k, v]) => `${k}:${v}`).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
