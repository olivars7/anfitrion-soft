'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { db } from '@/lib/supabase'
import { useSlugEvent } from '@/hooks/useSlugEvent'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, RotateCcw, UserPlus, Star } from 'lucide-react'
import TicketVisual from '@/components/TicketVisual'

interface TicketTypeInfo { name: string; preventa_price: number; taquilla_price: number; color?: string }
interface ActiveEvent { id: string; name: string; startsAt: string | null; ticket_types: TicketTypeInfo[] }
interface GeneratedTicket { publicId: string; qrToken: string; guestName: string; phone: string; tierName: string; tierColor: string; pricePaid: number; isGuest: boolean; eventName: string; eventDate: string | null }

function generatePublicId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let result = 'DA-'
  for (let i = 0; i < 4; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}
function generateQrToken(): string { return crypto.randomUUID() }
function splitDate(iso: string | null) {
  if (!iso) return { weekday: '', dateStr: '', year: '', time: '' }
  const d = new Date(iso)
  return { weekday: d.toLocaleDateString('es-MX', { weekday: 'long' }).toUpperCase(), dateStr: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }).toUpperCase(), year: d.getFullYear().toString(), time: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }).toUpperCase() }
}
function formatPrice(n: number) { return n === 0 ? 'Gratis' : `$${n.toLocaleString('es-MX')}` }

const TIER_ACCENTS = [
  { border: 'border-cyan-500/60',   bg: 'bg-cyan-500/10',    text: 'text-cyan-400'    },
  { border: 'border-yellow-500/60', bg: 'bg-yellow-500/10',  text: 'text-yellow-400'  },
  { border: 'border-emerald-500/60',bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { border: 'border-rose-500/60',   bg: 'bg-rose-500/10',    text: 'text-rose-400'    },
  { border: 'border-violet-500/60', bg: 'bg-violet-500/10',  text: 'text-violet-400'  },
]

const GUEST_TIER_INDEX = -1

export default function TaquillaPage() {
  const { event } = useSlugEvent()
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [ticket, setTicket]       = useState<GeneratedTicket | null>(null)
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null | 'loading'>('loading')
  const printRef = useRef<HTMLDivElement>(null)

  const [phrase, setPhrase] = useState('')

  useEffect(() => {
    if (!event) return
    setActiveEvent('loading')
    const row = event
    let tiers: TicketTypeInfo[] = []
    try {
      const perEvent = localStorage.getItem(`event_tiers_${row.id}`)
      if (perEvent) { tiers = JSON.parse(perEvent) }
      else {
        const cached = localStorage.getItem('active_event_tiers')
        if (cached) { const obj = JSON.parse(cached); if (obj.eventId === row.id) tiers = obj.tiers }
      }
    } catch { /* ignore */ }
    if (tiers.length === 0 && row.cover_price >= 0) tiers = [{ name: 'General', preventa_price: row.cover_price, taquilla_price: row.cover_price }]
    setActiveEvent({ id: row.id, name: row.name, startsAt: row.starts_at ?? null, ticket_types: tiers })
    try { setPhrase(localStorage.getItem(`event_phrase_${row.id}`) ?? '') } catch { /* ignore */ }
  }, [event])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setTicket(null)
    if (!activeEvent || activeEvent === 'loading') { setError('No hay evento cargado.'); setLoading(false); return }
    const isGuest  = selectedIdx === GUEST_TIER_INDEX
    const tier     = isGuest ? null : activeEvent.ticket_types[selectedIdx]
    const tierName = isGuest ? 'Invitado Especial' : (tier?.name ?? 'General')
    const tierColorVal = isGuest ? '#9333ea' : (tier?.color || '#e52239')
    const pricePaid = isGuest ? 0 : (tier?.preventa_price ?? 0)
    const eventId = activeEvent.id
    const publicId = generatePublicId(); const qrToken = generateQrToken()

    const { data: orgData } = await db.from('organizers').select('id').order('created_at', { ascending: false }).limit(1).single()
    const organizerId = (orgData as { id: string } | null)?.id
    if (!organizerId) { setError('No se encontró ningún organizador.'); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reg, error: regErr } = await (db.from('registrations') as any).insert({ organizer_id: organizerId, event_id: eventId, public_id: publicId, guest_name: name, whatsapp_phone: phone || '+52 55 0000 0000', party_size: 1, status: 'confirmed' }).select('id').single()
    if (regErr || !reg) { setError(`Error al crear registro: ${regErr?.message ?? 'desconocido'}`); setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: payErr } = await (db.from('payments') as any).insert({ organizer_id: organizerId, registration_id: reg.id, amount: pricePaid, method: 'cash', reference_id: `REF-${publicId}`, clabe: '000000000000000000', status: 'approved' })
    if (payErr) { setError(`Error al crear pago: ${payErr.message}`); setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: tickErr } = await (db.from('tickets') as any).insert({ organizer_id: organizerId, event_id: eventId, registration_id: reg.id, qr_token: qrToken, ticket_type: tierName, status: 'valid', seat_number: 1, holder_name: name })
    if (tickErr) { setError(`Error al crear boleto: ${tickErr.message}`); setLoading(false); return }
    setTicket({ publicId, qrToken, guestName: name, phone, tierName, tierColor: tierColorVal, pricePaid, isGuest, eventName: activeEvent.name, eventDate: activeEvent.startsAt })
    setLoading(false)
  }

  function handleReset() { setTicket(null); setName(''); setPhone(''); setSelectedIdx(0); setError('') }

  function handlePrint() {
    if (!ticket) return
    const dp = splitDate(ticket.eventDate); const accent = ticket.tierColor
    const hex = accent.replace('#', ''); const r = parseInt(hex.substring(0,2),16); const g = parseInt(hex.substring(2,4),16); const b = parseInt(hex.substring(4,6),16)
    const priceLabel = ticket.pricePaid > 0 ? `$${ticket.pricePaid.toLocaleString('es-MX')}` : 'INVITAD@ ESPECIAL'
    const dateLabel = dp.dateStr ? `${dp.weekday} ${dp.dateStr}${dp.time ? ' · ' + dp.time : ''}` : ''
    const qrEl = document.querySelector('#print-ticket canvas, #print-ticket svg')
    const qrSvg = qrEl ? qrEl.outerHTML : ''
    const win = window.open('', '_blank', 'width=860,height=480'); if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Boleto – ${ticket.publicId}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#eeeae7;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}.ticket{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 190px;min-height:210px;border-radius:11px;overflow:hidden;box-shadow:0 24px 65px rgba(17,8,16,.3);isolation:isolate;background:#111014;color:#f7f0ec;max-width:820px;width:100%}.main{position:relative;min-width:0;padding:16px 22px 14px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:radial-gradient(ellipse at 20% 20%,rgba(${r},${g},${b},.38),transparent 42%),radial-gradient(ellipse at 76% 80%,rgba(${Math.round(r*.5)},${Math.round(g*.4)},${Math.round(b*.5)},.55),transparent 43%),linear-gradient(125deg,#09090d 0%,#1a0c12 42%,#09090d 100%)}.inner{position:relative;z-index:1}.brand{font-size:8px;letter-spacing:.25em;font-weight:900;text-transform:uppercase;color:#f7f0ec;margin-bottom:8px}.brand span{color:${accent}}.kicker{font-size:7px;font-weight:900;letter-spacing:.34em;text-transform:uppercase;color:${accent};opacity:.85;margin-bottom:5px}.name{font-size:clamp(36px,6vw,52px);line-height:.84;letter-spacing:-.07em;font-weight:950;text-transform:uppercase;background:linear-gradient(110deg,#fff5ed 0%,#ffcdb8 22%,${accent} 52%,${accent}88 78%,#fff0e8 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 12px rgba(${r},${g},${b},.25));margin-bottom:6px}.subline{font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#b7a9a8;margin-bottom:8px}.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:3px;font-size:7px;font-weight:950;letter-spacing:.22em;text-transform:uppercase;color:#fff;background:linear-gradient(105deg,${accent}cc,${accent} 55%,${accent}88);box-shadow:0 4px 14px rgba(${r},${g},${b},.35);margin-top:10px}.stub{position:relative;background:linear-gradient(145deg,#20171b,#39232a 48%,#171317);border-left:1px dashed rgba(${r},${g},${b},.4);padding:14px 9px 12px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}.stub:before,.stub:after{content:"";position:absolute;left:-9px;width:18px;height:18px;background:#eeeae7;border-radius:50%}.stub:before{top:-9px}.stub:after{bottom:-9px}.stub-label{font-size:7px;letter-spacing:.2em;font-weight:900;text-transform:uppercase;color:#bca5a5;margin-bottom:6px}.qr{padding:5px;background:#fff;border:1px solid rgba(255,255,255,.2);border-radius:5px;margin-bottom:8px}.qr svg,.qr canvas{display:block;width:88px;height:88px}.code{font-size:7px;letter-spacing:.08em;font-weight:800;color:#f8e9e5;word-break:break-all;line-height:1.4}@media print{body{background:#eeeae7;padding:0}.ticket{box-shadow:none}}</style></head><body><article class="ticket"><div class="main"><div class="inner"><div class="brand">AS<span>.</span> / EXPERIENCES</div><div class="kicker">${ticket.eventName}</div><div class="name">${ticket.guestName}</div><div class="subline">${ticket.isGuest ? 'Cortesía' : priceLabel}</div>${dateLabel ? `<div style="border-top:1px solid rgba(${r},${g},${b},.22);padding-top:8px;margin-top:4px"><strong style="font-size:10px;color:#f7f0ec">${dateLabel}</strong></div>` : ''}<span class="badge">✦ ${ticket.isGuest ? 'CORTESÍA' : ticket.tierName}</span></div></div><aside class="stub"><div class="stub-label">Escanea para validar</div><div class="qr">${qrSvg}</div><div class="code">${ticket.publicId}</div></aside></article></body></html>`)
    win.document.close(); win.focus(); setTimeout(() => win.print(), 600)
  }

  if (ticket) {
    const dp = splitDate(ticket.eventDate); const accentColor = ticket.tierColor
    const priceLabel = ticket.pricePaid > 0 ? `$${ticket.pricePaid.toLocaleString('es-MX')}` : 'INVITAD@ ESPECIAL'
    const dateLabel = dp.dateStr ? `${dp.weekday} ${dp.dateStr}${dp.time ? ' · ' + dp.time : ''}` : undefined
    return (
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-white mb-6">Boleto Generado ✓</h1>
        <div ref={printRef} id="print-ticket">
          <TicketVisual serial={ticket.publicId} kicker={ticket.eventName} guestName={ticket.guestName}
            subline={ticket.isGuest ? 'INVITAD@ ESPECIAL' : priceLabel} dateLabel={dateLabel} tierName={ticket.isGuest ? 'INVITAD@ ESPECIAL' : ticket.tierName}
            accentColor={accentColor} qrValue={ticket.publicId} brandMark={phrase || undefined} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[#555]">
          {ticket.phone && <span>📞 {ticket.phone}</span>}
          {ticket.pricePaid > 0 && <span>💰 {priceLabel}</span>}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={handlePrint} className="flex items-center gap-2 flex-1 justify-center bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 text-sm transition-colors"><Printer size={15} />Imprimir</button>
          <button onClick={handleReset} className="flex items-center gap-2 flex-1 justify-center bg-[#111] border border-[#2a2a2a] hover:border-cyan-500/50 text-white font-semibold py-2.5 text-sm transition-colors"><RotateCcw size={15} />Nuevo boleto</button>
        </div>
        {/* QR display */}
        <div className="mt-4 flex justify-center">
          <QRCodeSVG value={ticket.publicId} size={120} level="H" />
        </div>
      </div>
    )
  }

  const isLoadingEvent = activeEvent === 'loading'
  const hasEvent = activeEvent !== null && activeEvent !== 'loading'
  const tiers = hasEvent ? (activeEvent as ActiveEvent).ticket_types : []
  const tiersOdd = tiers.length % 2 !== 0

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Taquilla Manual</h1>
      <p className="text-[#888] text-sm mb-1">Registra un invitado de forma presencial o cortesía.</p>
      {isLoadingEvent ? (
        <p className="text-[#555] text-xs mb-6">Cargando evento…</p>
      ) : hasEvent ? (
        <p className="text-cyan-500/70 text-xs mb-6 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Evento: <span className="font-semibold text-cyan-300">{(activeEvent as ActiveEvent).name}</span>
        </p>
      ) : (
        <p className="text-red-400 text-xs mb-6">⚠ Sin evento cargado.</p>
      )}
      <form onSubmit={handleSubmit} className="bg-[#0d0d0d] border border-[#1e1e1e] p-6 space-y-6">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Nombre del invitado <span className="text-red-400">*</span></label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Ej. María García"
            className="w-full bg-[#0a0a0a] border border-[#1e1e1e] px-4 py-2.5 text-white placeholder-[#444] text-sm focus:outline-none focus:border-cyan-500/50 transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Teléfono (opcional)</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ej. +52 55 1234 5678"
            className="w-full bg-[#0a0a0a] border border-[#1e1e1e] px-4 py-2.5 text-white placeholder-[#444] text-sm focus:outline-none focus:border-cyan-500/50 transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">Tipo de boleto (Preventa)</label>
          {isLoadingEvent ? (
            <p className="text-[#444] text-xs py-4 text-center">Cargando tipos de boleto…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tiers.map((tier, idx) => {
                const accent = TIER_ACCENTS[idx % TIER_ACCENTS.length]
                const selected = selectedIdx === idx
                const isLastOdd = tiersOdd && idx === tiers.length - 1
                return (
                  <button key={idx} type="button" onClick={() => setSelectedIdx(idx)}
                    className={`relative flex flex-col items-center justify-center gap-1 py-4 px-3 border transition-all ${isLastOdd ? 'col-span-2 py-3 flex-row justify-start gap-4 px-5' : ''} ${selected ? `${accent.bg} ${accent.border} ${accent.text}` : 'bg-[#0a0a0a] border-[#1e1e1e] text-[#555] hover:border-[#2a2a2a] hover:text-[#777]'}`}>
                    <span className={`font-bold ${isLastOdd ? 'text-sm' : 'text-sm text-center'}`}>{tier.name}</span>
                    <span className={`font-mono text-xs font-semibold ${selected ? accent.text : 'text-[#444]'}`}>{formatPrice(tier.preventa_price)}</span>
                    {selected && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
                  </button>
                )
              })}
              <button type="button" onClick={() => setSelectedIdx(GUEST_TIER_INDEX)}
                className={`col-span-2 flex items-center justify-between px-5 py-3.5 border transition-all ${selectedIdx === GUEST_TIER_INDEX ? 'bg-purple-500/10 border-purple-500/60 text-purple-400' : 'bg-[#0a0a0a] border-[#1e1e1e] text-[#555] hover:border-purple-900/50 hover:text-[#777]'}`}>
                <div className="flex items-center gap-3">
                  <Star size={16} />
                  <span className="text-sm font-bold">Invitado Especial</span>
                  {selectedIdx === GUEST_TIER_INDEX && <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">Seleccionado</span>}
                </div>
                <span className={`text-xs font-mono font-semibold ${selectedIdx === GUEST_TIER_INDEX ? 'text-purple-300' : 'text-[#333]'}`}>Invitad@ especial</span>
              </button>
            </div>
          )}
        </div>
        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading || !hasEvent}
          className="flex items-center gap-2 w-full justify-center bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 text-sm transition-colors">
          <UserPlus size={16} />{loading ? 'Generando boleto…' : 'Generar boleto y QR'}
        </button>
      </form>
    </div>
  )
}
