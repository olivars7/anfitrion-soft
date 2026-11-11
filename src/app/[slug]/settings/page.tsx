'use client'

// Settings scoped to [slug] — reads event from slugEventCache, no more status=active lookup.
// Core logic is identical to (app)/settings/page.tsx but uses useSlugEvent().

import { useEffect, useState, useRef, FormEvent } from 'react'
import ReactDOM from 'react-dom'
import { db } from '@/lib/supabase'
import { useSlugEvent } from '@/hooks/useSlugEvent'
import { Check, Copy, CalendarDays, MapPin, Users, Ticket, Plus, X, Save } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Event = Database['public']['Tables']['events']['Row']

interface TicketTier { name: string; preventa_price: string; taquilla_price: string; color: string; benefits: string }

const TIER_SUGGESTIONS = ['Preventa General', 'VIP', 'Mesa VIP', 'Palco', 'General']
const TIER_COLORS = [
  '#ffffff','#9ca3af','#6b7280','#f87171','#ef4444','#991b1b',
  '#f97316','#ea580c','#c2410c','#fbbf24','#d97706','#92400e',
  '#22c55e','#16a34a','#166534','#0ea5e9','#0284c7','#075985','#6366f1','#9333ea',
]

function SectionLabel({ title }: { title: string }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#555] mb-2 mt-7 first:mt-0">{title}</p>
}
function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2"><Icon size={11} />{label}</label>
      {children}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) && menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function handleOpen() {
    if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.top + window.scrollY - 4, left: r.left + window.scrollX }) }
    setOpen(o => !o)
  }

  const menu = open ? (
    <div ref={menuRef} className="bg-[#111] border border-[#2a2a2a] p-2 shadow-2xl" style={{ position: 'absolute', top: pos.top, left: pos.left, width: '116px', zIndex: 9999, transform: 'translateY(-100%)' }}>
      <p className="text-[9px] uppercase tracking-widest text-[#555] mb-2 select-none">Color</p>
      <div className="grid grid-cols-4 gap-1">
        {TIER_COLORS.map(c => (
          <button key={c} type="button" onClick={() => { onChange(c); setOpen(false) }} style={{ backgroundColor: c }}
            className={`w-6 h-6 transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#111]' : ''}`} />
        ))}
      </div>
    </div>
  ) : null

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen} className="w-[30px] h-[30px] flex-shrink-0 border border-[#2e2e2e] hover:border-white/30 transition-colors p-[5px]" title="Cambiar color">
        <span className="block w-full h-full" style={{ backgroundColor: value || '#ffffff' }} />
      </button>
      {typeof document !== 'undefined' && ReactDOM.createPortal(menu, document.body)}
    </>
  )
}

function TicketCard({ tier, idx, total, onUpdate, onRemove }: { tier: TicketTier; idx: number; total: number; onUpdate: (f: keyof TicketTier, v: string) => void; onRemove: () => void }) {
  const [editingField, setEditingField] = useState<'preventa' | 'taquilla' | null>(null)
  const color = tier.color || '#ffffff'
  const bgStyle = { backgroundColor: color + '14' }
  const borderColor = color + '44'

  return (
    <div className="relative border transition-colors" style={{ borderColor, ...bgStyle }}>
      <div className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: color }} />
      <div className="ml-1 p-3 md:p-5">
        <div className="flex items-center gap-3 mb-3 md:mb-5">
          <ColorPicker value={color} onChange={c => onUpdate('color', c)} />
          <input type="text" value={tier.name} onChange={e => onUpdate('name', e.target.value)} placeholder={TIER_SUGGESTIONS[idx] ?? 'Nombre del boleto'}
            className="flex-1 bg-transparent border-b border-white/10 focus:border-white/30 pb-1 text-white text-base font-bold placeholder-[#444] focus:outline-none transition-colors" />
          {total > 1 && (
            <button type="button" onClick={onRemove} className="flex items-center justify-center w-7 h-7 border border-white/10 text-[#555] hover:border-red-500/40 hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
          )}
        </div>
        <div className="border border-dashed px-3 py-3 md:px-4 md:py-4 flex items-center justify-between gap-3 md:gap-4" style={{ borderColor: color + '35' }}>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color }}>Boleto</span>
            <span className="text-white text-sm font-semibold leading-tight truncate">{tier.name || TIER_SUGGESTIONS[idx] || 'Sin nombre'}</span>
          </div>
          <div className="flex flex-col gap-[3px] shrink-0">{Array.from({ length: 5 }).map((_, i) => <span key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: color + '44' }} />)}</div>
          <div className="flex gap-4 shrink-0">
            {(['preventa', 'taquilla'] as const).map(field => (
              <div key={field} className="text-center">
                <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: color + 'aa' }}>{field === 'preventa' ? 'Preventa' : 'Taquilla'}</p>
                {editingField === field ? (
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[#666] text-xs pointer-events-none">$</span>
                    <input type="number" min={0} autoFocus value={field === 'preventa' ? tier.preventa_price : tier.taquilla_price}
                      onChange={e => onUpdate(field === 'preventa' ? 'preventa_price' : 'taquilla_price', e.target.value)}
                      onBlur={() => setEditingField(null)}
                      className="w-[80px] bg-black/40 border border-white/20 pl-5 pr-2 py-1 text-white text-sm text-center focus:outline-none focus:border-white/40 transition-colors" />
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingField(field)} className="group flex flex-col items-center">
                    <span className="text-white text-base md:text-xl font-bold leading-none group-hover:opacity-70 transition-opacity">
                      {(field === 'preventa' ? tier.preventa_price : tier.taquilla_price)
                        ? `$${Number(field === 'preventa' ? tier.preventa_price : tier.taquilla_price).toLocaleString()}`
                        : <span className="text-[#444] text-sm font-normal">—</span>}
                    </span>
                    <span className="text-[9px] text-[#444] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">editar</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { event: initialEvent } = useSlugEvent()
  const [event, setEvent]       = useState<Event | null>(initialEvent)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [copied, setCopied]     = useState(false)

  const [name,     setName]     = useState('')
  const [venue,    setVenue]    = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [capacity, setCapacity] = useState('')
  const [tagline,  setTagline]  = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [tiers,    setTiers]    = useState<TicketTier[]>([])
  const [phrase,   setPhrase]   = useState('')

  useEffect(() => {
    if (!initialEvent) return
    setEvent(initialEvent)
    setName(initialEvent.name)
    setVenue(initialEvent.venue)
    setStartsAt(initialEvent.starts_at ? initialEvent.starts_at.slice(0, 16) : '')
    setCapacity(String(initialEvent.capacity))
    try { setTagline(localStorage.getItem(`event_tagline_${initialEvent.id}`) ?? '') } catch { /* ignore */ }
    try { setSubtitle(localStorage.getItem(`event_subtitle_${initialEvent.id}`) ?? '') } catch { /* ignore */ }
    setIsActive(initialEvent.status === 'active')
    setIsClosed(initialEvent.status === 'closed')
    loadTiers(initialEvent.id)
    try { setPhrase(localStorage.getItem(`event_phrase_${initialEvent.id}`) ?? '') } catch { /* ignore */ }
  }, [initialEvent])

  function loadTiers(eventId: string) {
    try {
      const raw = localStorage.getItem(`event_tiers_${eventId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as { name: string; preventa_price: number; taquilla_price: number; color?: string; benefits?: string }[]
        setTiers(parsed.map((t, i) => ({ name: t.name, preventa_price: t.preventa_price === 0 ? '' : String(t.preventa_price), taquilla_price: t.taquilla_price === 0 ? '' : String(t.taquilla_price), color: t.color || TIER_COLORS[i % TIER_COLORS.length], benefits: t.benefits ?? '' }))); return
      }
      const cached = localStorage.getItem('active_event_tiers')
      if (cached) {
        const obj = JSON.parse(cached) as { eventId: string; tiers: { name: string; preventa_price: number; taquilla_price: number; color?: string; benefits?: string }[] }
        if (obj.eventId === eventId) setTiers(obj.tiers.map((t, i) => ({ name: t.name, preventa_price: t.preventa_price === 0 ? '' : String(t.preventa_price), taquilla_price: t.taquilla_price === 0 ? '' : String(t.taquilla_price), color: t.color || TIER_COLORS[i % TIER_COLORS.length], benefits: t.benefits ?? '' })))
      }
    } catch { /* ignore */ }
  }

  function saveTiers(eventId: string, updated: TicketTier[]) {
    const payload = updated.map(t => ({ name: t.name, preventa_price: Number(t.preventa_price) || 0, taquilla_price: Number(t.taquilla_price) || 0, color: t.color || '#ffffff', benefits: t.benefits || '' }))
    try { localStorage.setItem(`event_tiers_${eventId}`, JSON.stringify(payload)); localStorage.setItem('active_event_tiers', JSON.stringify({ eventId, tiers: payload })) } catch { /* ignore */ }
    try { if (phrase.trim()) localStorage.setItem(`event_phrase_${eventId}`, phrase.trim()); else localStorage.removeItem(`event_phrase_${eventId}`) } catch { /* ignore */ }
  }

  function updateTier(idx: number, field: keyof TicketTier, value: string) { setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t)) }
  function addTier() { if (tiers.length >= 5) return; setTiers(prev => [...prev, { name: '', preventa_price: '', taquilla_price: '', color: TIER_COLORS[prev.length % TIER_COLORS.length], benefits: '' }]) }
  function removeTier(idx: number) { setTiers(prev => prev.filter((_, i) => i !== idx)) }
  function deriveStatus(): Event['status'] { if (isClosed) return 'closed'; if (isActive) return 'active'; return 'draft' }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); if (!event) return; setSaving(true); setError(''); setSaved(false)
    const status = deriveStatus(); const legacyPrice = Number(tiers[0]?.taquilla_price) || event.cover_price
    const { error: err } = await db.from('events').update({ name: name.trim(), venue: venue.trim(), starts_at: startsAt, capacity: Number(capacity) || 0, cover_price: legacyPrice, status }).eq('id', event.id)
    if (err) { setError(`Error al guardar: ${err.message}`) } else {
      saveTiers(event.id, tiers)
      try {
        if (tagline.trim()) localStorage.setItem(`event_tagline_${event.id}`, tagline.trim()); else localStorage.removeItem(`event_tagline_${event.id}`)
        if (subtitle.trim()) localStorage.setItem(`event_subtitle_${event.id}`, subtitle.trim()); else localStorage.removeItem(`event_subtitle_${event.id}`)
      } catch { /* ignore */ }
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  function copyId() { if (!event?.id) return; navigator.clipboard.writeText(event.id); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const inputCls = 'w-full bg-[#0a0a0a] border border-[#1e1e1e] px-4 py-2.5 text-white text-sm placeholder-[#444] focus:outline-none focus:border-white/30 transition-colors'

  if (!event) return <div className="min-h-screen pt-10 pb-16 max-w-lg mx-auto"><p className="text-[#555] text-sm">Cargando…</p></div>

  const status = deriveStatus()
  const STATUS_META = { draft: { label: 'Borrador', dot: 'bg-[#555]', text: 'text-[#888]' }, active: { label: 'Activo', dot: 'bg-[#39ff14]', text: 'text-[#39ff14]' }, closed: { label: 'Cerrado', dot: 'bg-[#ff4040]', text: 'text-[#ff4040]' } }
  const meta = STATUS_META[status]

  return (
    <form onSubmit={handleSubmit} className="min-h-screen pt-10 pb-20">
      <div className="flex items-start justify-between mb-8 md:max-w-none">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#555] mb-1">AnfitriónSoft</p>
          <h1 className="text-2xl font-bold text-white leading-tight">Configuración</h1>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mt-1 ${meta.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />{meta.label}
        </span>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10 gap-5">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <div>
            <SectionLabel title="Identidad del evento" />
            <div className="flex flex-col gap-3">
              <Field label="Nombre del evento" icon={CalendarDays}>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del evento" className={inputCls} />
              </Field>
              <Field label="Slug URL" icon={CalendarDays}>
                <div className="w-full bg-[#0a0a0a] border border-[#1e1e1e] px-4 py-2.5 text-[#444] text-sm font-mono select-all cursor-default">{event.slug}</div>
              </Field>
              <Field label="Frase del boleto" icon={CalendarDays}>
                <input type="text" value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="Ej. VIP EXPERIENCE · NOCHE ESPECIAL" className={inputCls} />
                <p className="text-[10px] text-[#444] mt-1">Aparece en la parte superior del boleto. Si está vacío no se muestra nada.</p>
              </Field>
            </div>
          </div>
          <div>
            <SectionLabel title="Detalle" />
            <div className="flex flex-col gap-3">
              <Field label="Venue / Lugar" icon={MapPin}><input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Club / Lugar" className={inputCls} /></Field>
              <Field label="Fecha y hora" icon={CalendarDays}><input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className={inputCls} /></Field>
              <Field label="Capacidad" icon={Users}><input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="500" className={inputCls} /></Field>
            </div>
          </div>
          <div>
            <SectionLabel title="Estado del evento" />
            <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#1e1e1e] p-1">
              {([{ key: 'draft', label: 'Borrador', active: !isActive && !isClosed, color: 'text-[#888]', dot: 'bg-[#555]' }, { key: 'active', label: 'Activo', active: isActive, color: 'text-[#39ff14]', dot: 'bg-[#39ff14]' }, { key: 'closed', label: 'Cerrado', active: isClosed, color: 'text-[#ff4040]', dot: 'bg-[#ff4040]' }] as const).map(({ key, label, active, color, dot }) => (
                <button key={key} type="button" onClick={() => { if (key === 'draft') { setIsActive(false); setIsClosed(false) } if (key === 'active') { setIsActive(true); setIsClosed(false) } if (key === 'closed') { setIsActive(false); setIsClosed(true) } }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${active ? `bg-[#1a1a1a] border border-[#333] ${color}` : 'text-[#444] hover:text-[#666]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? dot : 'bg-[#333]'}`} />{label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel title="Identificadores (solo lectura)" />
            <div className="flex flex-col gap-2">
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-1">Slug URL</p>
                <p className="text-xs font-mono text-[#444] select-all">{event.slug}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-1">UUID</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-mono text-[#444] truncate select-all">{event.id}</p>
                  <button type="button" onClick={copyId} className="shrink-0 flex items-center gap-1 text-[11px] text-[#555] hover:text-white transition-colors">
                    {copied ? <Check size={13} className="text-[#39ff14]" /> : <Copy size={13} />}{copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2">{error}</p>}
          <div className="hidden md:block mt-3">
            <button type="submit" disabled={saving} className="w-full bg-white hover:bg-white/90 disabled:opacity-40 text-black font-bold py-3 text-sm transition-colors flex items-center justify-center gap-2">
              {saving ? (<><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Guardando…</>) : saved ? (<><Check size={15} strokeWidth={2.5} className="text-[#39ff14]" /><span className="text-[#39ff14]">Guardado</span></>) : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2 mt-7 md:mt-0">
            <Ticket size={11} className="text-[#555]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#555]">Tipos de boleto</span>
            <span className="ml-auto text-[10px] text-[#444]">{tiers.length}/5</span>
          </div>
          {tiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-[#222] py-16 text-center">
              <Ticket size={24} className="text-[#333] mb-3" />
              <p className="text-[#555] text-sm">Sin tipos de boleto</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:gap-4">
              {tiers.map((tier, idx) => (
                <TicketCard key={idx} tier={tier} idx={idx} total={tiers.length} onUpdate={(f, v) => updateTier(idx, f, v)} onRemove={() => removeTier(idx)} />
              ))}
            </div>
          )}
          {tiers.length < 5 && (
            <button type="button" onClick={addTier} className="mt-4 group flex flex-col items-center justify-center gap-2 w-full h-20 border border-dashed border-[#222] hover:border-white/20 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-center w-8 h-8 border border-[#222] group-hover:border-white/20 transition-colors"><Plus size={14} className="text-[#555] group-hover:text-white transition-colors" /></div>
              <span className="text-[11px] text-[#555] group-hover:text-white transition-colors">Agregar tipo de boleto</span>
            </button>
          )}
          <p className="text-[10px] text-[#444] mt-3">Dejar precio vacío = Gratis</p>
        </div>
      </div>

      <button type="submit" disabled={saving} aria-label="Guardar cambios" className="md:hidden fixed right-5 z-40 w-14 h-14 flex items-center justify-center bg-white disabled:opacity-40 transition-colors" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {saving ? <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : saved ? <Check size={22} strokeWidth={2.5} className="text-[#39ff14]" /> : <Save size={22} strokeWidth={2} className="text-black" />}
      </button>
    </form>
  )
}
