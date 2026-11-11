'use client'

// Pagos page scoped to [slug] event
// Re-exports the same implementation but reads eventId from slugEventCache.

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, db } from '@/lib/supabase'
import { useSlugEvent } from '@/hooks/useSlugEvent'
import { CheckCircle, RefreshCw, Trash2, X } from 'lucide-react'
import UniqueLoading from '@/components/ui/morph-loading'
import TicketVisual from '@/components/TicketVisual'

type PaymentStatus = 'pending' | 'approved' | 'rejected'

interface Row {
  registrationId: string
  publicId:       string
  name:           string
  phone:          string
  paymentId:      string
  amount:         number
  status:         PaymentStatus
  ticketId:       string | null
  ticketType:     string | null
  eventId:        string | null
  qrToken:        string | null
  createdAt:      string
}

const STATUS_META: Record<PaymentStatus, { label: string; dot: string; text: string }> = {
  pending:  { label: 'Pendiente', dot: 'bg-[#ff9f0a]', text: 'text-[#ff9f0a]' },
  approved: { label: 'Aprobado',  dot: 'bg-[#30d158]', text: 'text-[#30d158]' },
  rejected: { label: 'Rechazado', dot: 'bg-[#ff453a]', text: 'text-[#ff453a]' },
}

function tierColor(tierName: string | null, eventId: string | null): string {
  if (!tierName) return '#aeaeb2'
  if (typeof window !== 'undefined' && eventId) {
    try {
      const raw = localStorage.getItem(`event_tiers_${eventId}`) ?? localStorage.getItem('active_event_tiers')
      if (raw) {
        const parsed = JSON.parse(raw)
        const tiers: { name: string; color?: string }[] = Array.isArray(parsed) ? parsed : (parsed.tiers ?? [])
        const match = tiers.find(t => t.name.toLowerCase() === tierName.toLowerCase())
        if (match?.color) return match.color
      }
    } catch { /* ignore */ }
  }
  const lc = tierName.toLowerCase()
  if (lc.includes('vip')) return '#30d158'
  if (lc.includes('preventa')) return '#ff9f0a'
  return '#aeaeb2'
}

interface RegRow { id: string; public_id: string; guest_name: string; whatsapp_phone: string; created_at: string }
interface PayRow { id: string; registration_id: string; amount: number; status: string }
interface TixRow { id: string; registration_id: string; event_id: string; ticket_type: string; status: string; qr_token: string }

async function fetchRows(eventId: string | null): Promise<Row[]> {
  const regQ = eventId
    ? supabase.from('registrations').select('id, public_id, guest_name, whatsapp_phone, created_at').eq('event_id', eventId).order('created_at', { ascending: false })
    : supabase.from('registrations').select('id, public_id, guest_name, whatsapp_phone, created_at').order('created_at', { ascending: false })
  const tixQ = eventId
    ? supabase.from('tickets').select('id, registration_id, event_id, ticket_type, status, qr_token').eq('event_id', eventId)
    : supabase.from('tickets').select('id, registration_id, event_id, ticket_type, status, qr_token')

  const [regRes, tixRes] = await Promise.all([regQ, tixQ])
  const regIds = ((regRes.data ?? []) as { id: string }[]).map(r => r.id)
  const payRes = regIds.length > 0
    ? await supabase.from('payments').select('id, registration_id, amount, status').in('registration_id', regIds)
    : { data: [] as { id: string; registration_id: string; amount: number; status: string }[] }

  const regs     = (regRes.data ?? []) as RegRow[]
  const payments = payRes.data as PayRow[]
  const tickets  = (tixRes.data ?? []) as TixRow[]

  const payByReg: Record<string, PayRow> = {}
  const tixByReg: Record<string, TixRow> = {}
  for (const p of payments) payByReg[p.registration_id] = p
  for (const t of tickets)  tixByReg[t.registration_id] = t

  return regs.filter(r => payByReg[r.id]).map(r => {
    const pay = payByReg[r.id]
    const tix = tixByReg[r.id] ?? null
    return {
      registrationId: r.id, publicId: r.public_id, name: r.guest_name, phone: r.whatsapp_phone,
      paymentId: pay.id, amount: pay.amount, status: pay.status as PaymentStatus,
      ticketId: tix?.id ?? null, ticketType: tix?.ticket_type ?? null,
      eventId: tix?.event_id ?? null, qrToken: tix?.qr_token ?? null, createdAt: r.created_at,
    }
  })
}

function ApproveButton({ row, onApproved }: { row: Row; onApproved: () => void }) {
  const [loading, setLoading] = useState(false)
  async function handleApprove(e: React.MouseEvent) {
    e.stopPropagation(); setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('payments') as any).update({ status: 'approved' }).eq('id', row.paymentId)
    setLoading(false); onApproved()
  }
  return (
    <button type="button" onClick={handleApprove} disabled={loading}
      className="shrink-0 flex items-center gap-1.5 bg-[#30d158]/10 hover:bg-[#30d158]/20 disabled:opacity-50 border border-[#30d158]/40 text-[#30d158] text-[11px] font-bold px-3 py-1.5 transition-colors">
      {loading ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
      Aprobar
    </button>
  )
}

function EditableField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="py-3">
      <p className="text-[10px] uppercase tracking-widest text-[#636366] mb-0.5">{label}</p>
      <div className={`relative border-b transition-colors ${focused ? 'border-white' : 'border-[#38383a]'}`}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full bg-transparent text-white text-[15px] py-1 focus:outline-none" />
      </div>
    </div>
  )
}

function loadTiers(eventId: string | null): { name: string; color: string; preventa_price: number; taquilla_price: number }[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`event_tiers_${eventId}`) ?? localStorage.getItem('active_event_tiers')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const arr: { name: string; color?: string; preventa_price?: number; taquilla_price?: number }[] = Array.isArray(parsed) ? parsed : (parsed.tiers ?? [])
    return arr.map(t => ({ name: t.name, color: t.color ?? '#aeaeb2', preventa_price: t.preventa_price ?? 0, taquilla_price: t.taquilla_price ?? 0 }))
  } catch { return [] }
}

const GUEST_TIER = { name: 'Invitad@ especial', color: '#9333ea', preventa_price: 0, taquilla_price: 0 }

function loadPhrase(eventId: string | null): string {
  if (typeof window === 'undefined' || !eventId) return ''
  try { return localStorage.getItem(`event_phrase_${eventId}`) ?? '' } catch { return '' }
}

function EditPopup({ row, onClose, onSaved, onDeleted, eventName }: { row: Row; onClose: () => void; onSaved: () => void; onDeleted: () => void; eventName: string }) {
  const [name, setName]         = useState(row.name)
  const [phone, setPhone]       = useState(row.phone ?? '')
  const [amount, setAmount]     = useState(String(row.amount))
  const [status, setStatus]     = useState<PaymentStatus>(row.status)
  const [tierType, setTierType] = useState(row.ticketType ?? '')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [saveErr, setSaveErr]   = useState('')
  const popupRef = useRef<HTMLDivElement>(null)
  const tiers = loadTiers(row.eventId)
  const allTiers = [...tiers, GUEST_TIER]
  const phrase = loadPhrase(row.eventId)
  const isGuest = tierType === GUEST_TIER.name
  const accentColor = isGuest ? '#9333ea' : tierColor(tierType || row.ticketType, row.eventId)

  function selectTier(tierName: string) {
    setTierType(tierName)
    if (tierName === GUEST_TIER.name) { setAmount('0'); return }
    const t = tiers.find(x => x.name === tierName)
    if (t) setAmount(String(t.preventa_price || t.taquilla_price || row.amount))
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) { if (e.target === e.currentTarget) onClose() }

  async function handleSave() {
    setSaving(true); setSaveErr('')
    const { error: regErr } = await db.from('registrations').update({ guest_name: name.trim(), whatsapp_phone: phone.trim() }).eq('id', row.registrationId)
    if (regErr) { setSaveErr(`Error: ${regErr.message}`); setSaving(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: payErr } = await (db.from('payments') as any).update({ amount: Number(amount) || 0, status }).eq('id', row.paymentId)
    if (payErr) { setSaveErr(`Error: ${payErr.message}`); setSaving(false); return }
    if (row.ticketId && tierType) {
      await db.from('tickets').update({ ticket_type: tierType }).eq('id', row.ticketId)
    }
    setSaving(false); onSaved()
  }

  async function handleDelete() {
    setDeleting(true)
    if (row.ticketId) await db.from('tickets').delete().eq('id', row.ticketId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('payments') as any).delete().eq('id', row.paymentId)
    await db.from('registrations').delete().eq('id', row.registrationId)
    setDeleting(false); onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.72)' }}
      onClick={handleBackdropClick}>
      <div ref={popupRef} className="w-full bg-[#1c1c1e] border border-[#38383a] overflow-hidden flex flex-col my-6"
        style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>

        {/* TOP: Ticket visual full width */}
        <div className="bg-[#141416] p-5 border-b border-[#38383a]">
          <TicketVisual serial={row.publicId} kicker={eventName || undefined}
            tierName={tierType || row.ticketType || 'General'}
            guestName={name} accentColor={accentColor} qrValue={row.publicId}
            brandMark={phrase || undefined}
            subline={isGuest ? 'INVITAD@ ESPECIAL' : (Number(amount) > 0 ? `$${Number(amount).toLocaleString()}` : undefined)} />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#636366]">ID</span>
            <span className="font-mono text-[#0a84ff] font-semibold text-xs tracking-widest">{row.publicId}</span>
          </div>
        </div>

        {/* HEADER */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#38383a]">
          <p className="text-[10px] uppercase tracking-widest text-[#636366]">Editar registro</p>
          <button type="button" onClick={onClose} className="text-[#636366] hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* FIELDS */}
        <div className="px-5 divide-y divide-[#38383a]">
          <EditableField label="Nombre" value={name} onChange={setName} />
          <EditableField label="Teléfono" value={phone} onChange={setPhone} type="tel" />

          {/* Ticket type selector */}
          <div className="py-3">
            <p className="text-[10px] uppercase tracking-widest text-[#636366] mb-2">Tipo de boleto</p>
            <div className="flex flex-wrap gap-1.5">
              {allTiers.map(t => {
                const selected = tierType === t.name
                const isGuestTier = t.name === GUEST_TIER.name
                return (
                  <button key={t.name} type="button" onClick={() => selectTier(t.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-colors"
                    style={{
                      borderColor: selected ? t.color : '#38383a',
                      color: selected ? t.color : '#636366',
                      background: selected ? `${t.color}14` : 'transparent',
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                    <span>{t.name}</span>
                    {!isGuestTier && (t.preventa_price > 0 || t.taquilla_price > 0) && (
                      <span className="opacity-50">${(t.preventa_price || t.taquilla_price).toLocaleString()}</span>
                    )}
                  </button>
                )
              })}
            </div>
            {/* Amount display — read-only, driven by tier */}
            {!isGuest && amount && Number(amount) > 0 && (
              <p className="mt-2 text-[11px] font-mono text-[#636366]">
                Monto: <span className="text-white font-semibold">${Number(amount).toLocaleString()}</span>
              </p>
            )}
          </div>

          {/* Status selector */}
          <div className="py-3">
            <p className="text-[10px] uppercase tracking-widest text-[#636366] mb-2">Estado</p>
            <div className="flex flex-wrap gap-2">
              {(['pending', 'approved', 'rejected'] as PaymentStatus[]).map(s => {
                const m = STATUS_META[s]
                return (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors ${status === s ? `border-current ${m.text} bg-current/10` : 'border-[#38383a] text-[#636366] hover:border-[#555]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {saveErr && <p className="text-[#ff453a] text-xs px-5 pb-2">{saveErr}</p>}

        {confirmDel && (
          <div className="mx-5 mb-4 bg-[#ff453a]/10 border border-[#ff453a]/40 p-3">
            <p className="text-sm text-white mb-3">¿Eliminar a <span className="font-semibold">{row.name}</span> y todos sus datos?</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-[#ff453a] hover:bg-[#ff453a]/80 disabled:opacity-50 text-white font-bold py-2 text-sm transition-colors">
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button type="button" onClick={() => setConfirmDel(false)}
                className="flex-1 bg-[#2c2c2e] text-[#aeaeb2] hover:text-white font-semibold py-2 text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
        {!confirmDel && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#38383a]">
            <button type="button" onClick={() => setConfirmDel(true)} className="text-[#636366] hover:text-[#ff453a] transition-colors p-1"><Trash2 size={18} /></button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-[#30d158] hover:bg-[#30d158]/80 disabled:opacity-40 text-black font-bold px-6 py-2.5 text-sm transition-colors">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PagosPage() {
  const { eventId, event } = useSlugEvent()
  const [rows, setRows]         = useState<Row[]>([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const [selected, setSelected] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [fetched] = await Promise.all([fetchRows(eventId), new Promise(r => setTimeout(r, 800))])
    setRows(fetched); setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const totalApproved = rows.filter(r => r.status === 'approved').length
  const totalPending  = rows.filter(r => r.status === 'pending').length
  const totalRevenue  = rows.filter(r => r.status === 'approved').reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Boletos / Pagos</h1>
          <p className="text-muted text-sm mt-0.5">{rows.length} registros</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-sm text-muted hover:text-white border border-border hover:border-primary px-3 py-2 transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Aprobados',     value: totalApproved,                           color: 'text-[#30d158]' },
          { label: 'Pendientes',    value: totalPending,                            color: 'text-[#ff9f0a]' },
          { label: 'Total cobrado', value: `$${totalRevenue.toLocaleString()}`,     color: 'text-[#0a84ff]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-border px-4 py-3">
            <p className="text-muted text-xs uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {toast && (
        <div className="flex items-center gap-2 bg-[#30d158]/10 border border-[#30d158]/30 text-[#30d158] text-sm px-4 py-2.5 mb-4">
          <CheckCircle size={16} />{toast}
        </div>
      )}

      {loading ? (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none"><UniqueLoading variant="morph" size="md" /></div>
      ) : rows.length === 0 ? (
        <div className="text-muted text-sm py-8 text-center">No hay registros todavía.</div>
      ) : (
        <div className="bg-surface border border-border overflow-hidden">
          {rows.map((row, idx) => {
            const sm = STATUS_META[row.status]
            const tc = row.ticketType ? tierColor(row.ticketType, row.eventId) : null
            return (
              <div key={row.paymentId} onClick={() => setSelected(row)}
                className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.04] transition-colors ${idx < rows.length - 1 ? 'border-b border-border' : ''}`}>
                <span className={`shrink-0 w-2 h-2 rounded-full ${sm.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-semibold text-sm truncate">{row.name}</span>
                    {row.ticketType && (
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tc ?? undefined }}>{row.ticketType}</span>
                    )}
                  </div>
                  <span className="text-white font-mono font-semibold text-[12px]">{row.amount > 0 ? `$${row.amount.toLocaleString()}` : 'Gratis'}</span>
                  <div className="mt-0.5">
                    <span className="font-mono text-[#0a84ff] text-[11px] tracking-widest">{row.publicId}</span>
                  </div>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  {row.status === 'pending'
                    ? <ApproveButton row={row} onApproved={() => { showToast(`✓ ${row.name} aprobado`); load() }} />
                    : <span className="text-[#636366] text-[11px] font-semibold">{sm.label}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <EditPopup row={selected} onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); showToast(`✓ Cambios guardados para ${selected.name}`); load() }}
          onDeleted={() => { setSelected(null); showToast('Registro eliminado.'); load() }}
          eventName={event?.name ?? ''} />
      )}
    </div>
  )
}
