'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/supabase'
import { ArrowLeft, CalendarDays, MapPin, Users, Plus, X, Ticket } from 'lucide-react'

interface TicketTier {
  name: string
  preventa_price: string
  taquilla_price: string
  color: string
  benefits: string
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function Field({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string
  icon: React.ElementType
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">
        <Icon size={11} />
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const TIER_SUGGESTIONS = ['Preventa General', 'VIP', 'Mesa VIP', 'Palco', 'General']

const TIER_COLORS = [
  '#ffffff', '#9ca3af', '#6b7280',
  '#f87171', '#ef4444', '#991b1b',
  '#f97316', '#ea580c', '#c2410c',
  '#fbbf24', '#d97706', '#92400e',
  '#22c55e', '#16a34a', '#166534',
  '#0ea5e9', '#0284c7', '#075985',
  '#6366f1', '#9333ea',
]

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (c: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Color swatch button — fixed square matching input height, 5px inner padding */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-[30px] h-[30px] border border-[#2e2e2e] hover:border-white/30 transition-colors p-[5px] flex-shrink-0"
        title="Cambiar color"
      >
        <span
          className="block w-full h-full"
          style={{ backgroundColor: value || '#ffffff' }}
        />
      </button>

      {/* Color grid dropdown — opens upward, aligned to left edge of button */}
      {open && (
        <div
          className="absolute left-0 bottom-full mb-1 z-50 bg-[#111] border border-[#2a2a2a] p-2 shadow-2xl"
          style={{ width: '112px' }}
        >
          <p className="text-[9px] uppercase tracking-widest text-[#555] mb-2 select-none">Color del boleto</p>
          <div className="grid grid-cols-4 gap-1">
            {TIER_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false) }}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#111]' : ''}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewEventPage() {
  const router = useRouter()

  const [name,     setName]     = useState('')
  const [slug,     setSlug]     = useState('')
  const [venue,    setVenue]    = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [capacity, setCapacity] = useState('')
  const [tagline,  setTagline]  = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  // Ticket tiers (up to 5)
  const [tiers, setTiers] = useState<TicketTier[]>([
    { name: 'Preventa General', preventa_price: '', taquilla_price: '', color: '#ffffff', benefits: '' },
    { name: 'VIP',              preventa_price: '', taquilla_price: '', color: '#6366f1', benefits: '' },
  ])

  function handleNameChange(val: string) {
    setName(val)
    setSlug(slugify(val))
  }

  function addTier() {
    if (tiers.length >= 5) return
    setTiers(prev => [...prev, { name: '', preventa_price: '', taquilla_price: '', color: '#ffffff', benefits: '' }])
  }

  function removeTier(idx: number) {
    setTiers(prev => prev.filter((_, i) => i !== idx))
  }

  function updateTier(idx: number, field: keyof TicketTier, value: string) {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: orgData } = await db
      .from('organizers')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    const organizerId = (orgData as { id: string } | null)?.id

    if (!organizerId) {
      setError('No se encontró ningún organizador en la base de datos.')
      setSaving(false)
      return
    }

    // Serialize ticket tiers as JSON into cover_price (store as string in DB)
    const validTiers = tiers.filter(t => t.name.trim())
    const tiersPayload = validTiers.map(t => ({
      name:           t.name.trim(),
      preventa_price: Number(t.preventa_price) || 0,
      taquilla_price: Number(t.taquilla_price) || 0,
      color:          t.color || '#ffffff',
      benefits:       t.benefits || '',
    }))

    // Use first tier's taquilla_price as cover_price for legacy compat
    const legacyPrice = tiersPayload[0]?.taquilla_price ?? 0

    const { data: newEvent, error: insertErr } = await db.from('events').insert({
      organizer_id: organizerId,
      name:         name.trim(),
      slug:         slug || slugify(name),
      venue:        venue.trim() || 'Lugar sin definir',
      starts_at:    startsAt,
      capacity:     Number(capacity) || null,
      cover_price:  legacyPrice,
      status:       'active',
    }).select('id').single()

    if (insertErr) {
      setError(`Error al crear evento: ${insertErr.message}`)
      setSaving(false)
      return
    }

    // Persist ticket tiers, tagline, subtitle in localStorage keyed by event ID
    if (newEvent) {
      const eventRow = newEvent as { id: string }
      try {
        if (tiersPayload.length > 0) {
          localStorage.setItem(`event_tiers_${eventRow.id}`, JSON.stringify(tiersPayload))
          localStorage.setItem('active_event_tiers', JSON.stringify({ eventId: eventRow.id, tiers: tiersPayload }))
        }
        if (tagline.trim()) localStorage.setItem(`event_tagline_${eventRow.id}`, tagline.trim())
        if (subtitle.trim()) localStorage.setItem(`event_subtitle_${eventRow.id}`, subtitle.trim())
      } catch { /* ignore storage errors */ }
    }

    router.push('/home')
  }

  const inputCls =
    'w-full bg-[#0a0a0a] border border-[#1e1e1e] px-4 py-2.5 text-white text-sm placeholder-[#444] focus:outline-none focus:border-white/30 transition-colors'

  return (
    <div className="min-h-screen px-4 pt-10 pb-20 max-w-lg mx-auto relative z-10">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors mb-8"
      >
        <ArrowLeft size={14} />
        Volver
      </button>

      <h1 className="text-2xl font-bold text-white mb-1">Nuevo Evento</h1>
      <p className="text-[#555] text-sm mb-8">Completa los datos para crear un evento desde cero.</p>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Name + slug preview */}
        <Field label="Nombre del evento" icon={CalendarDays} required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ej. Fiesta Neon 2026"
            className={inputCls}
          />
          {slug && (
            <p className="text-[11px] text-[#444] font-mono mt-1.5 pl-0.5 select-none">
              anfitrionsoft.com/<span className="text-[#555]">{slug}</span>
            </p>
          )}
        </Field>

        {/* Date */}
        <Field label="Fecha y hora" icon={CalendarDays} required>
          <input
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Venue */}
        <Field label="Venue / Lugar" icon={MapPin}>
          <div className="flex gap-2">
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Ej. Club XYZ, CDMX"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setVenue('Lugar sin definir')}
              className="flex-shrink-0 px-3 py-2 border border-[#1e1e1e] text-[#555] text-[11px] whitespace-nowrap hover:border-white/20 hover:text-white/70 transition-colors"
            >
              Lugar sin definir
            </button>
          </div>
        </Field>

        {/* Capacity */}
        <Field label="Limite de personas" icon={Users}>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Limite de personas"
            className={inputCls}
          />
        </Field>

        {/* Ticket tiers */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Ticket size={11} className="text-[#555]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">
              Tipos de boleto
            </span>
            <span className="ml-auto text-[10px] text-[#444]">{tiers.length}/5</span>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-[1fr_90px_90px_28px] gap-2 mb-1.5 px-0.5">
            <span className="text-[9px] uppercase tracking-widest text-[#444]">Nombre</span>
            <span className="text-[9px] uppercase tracking-widest text-[#444] text-center">Preventa</span>
            <span className="text-[9px] uppercase tracking-widest text-[#444] text-center">Taquilla</span>
            <span />
          </div>

          <div className="space-y-4">
            {tiers.map((tier, idx) => (
              <div key={idx} className="border border-[#1a1a1a] p-3">
                {/* Row: name + prices + remove */}
                <div className="grid grid-cols-[1fr_90px_90px_28px] gap-2 items-center mb-3">
                  {/* Name + color picker */}
                  <div className="flex gap-1.5 items-center">
                    <ColorPicker
                      value={tier.color}
                      onChange={(c) => updateTier(idx, 'color', c)}
                    />
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => updateTier(idx, 'name', e.target.value)}
                      placeholder={TIER_SUGGESTIONS[idx] ?? 'Tipo…'}
                      className="w-full bg-[#0a0a0a] border border-[#1e1e1e] px-3 py-2 text-white text-xs placeholder-[#444] focus:outline-none focus:border-white/25 transition-colors"
                    />
                  </div>

                  {/* Preventa price */}
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#444] text-xs pointer-events-none">$</span>
                    <input
                      type="number"
                      min={0}
                      value={tier.preventa_price}
                      onChange={(e) => updateTier(idx, 'preventa_price', e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0a0a0a] border border-[#1e1e1e] pl-5 pr-2 py-2 text-white text-xs placeholder-[#444] focus:outline-none focus:border-white/25 transition-colors"
                    />
                  </div>

                  {/* Taquilla price */}
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#444] text-xs pointer-events-none">$</span>
                    <input
                      type="number"
                      min={0}
                      value={tier.taquilla_price}
                      onChange={(e) => updateTier(idx, 'taquilla_price', e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0a0a0a] border border-[#1e1e1e] pl-5 pr-2 py-2 text-white text-xs placeholder-[#444] focus:outline-none focus:border-white/25 transition-colors"
                    />
                  </div>

                  {/* Remove (only for non-first rows) */}
                  {idx >= 1 ? (
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      className="flex items-center justify-center w-7 h-7 border border-[#1e1e1e] text-[#555] hover:border-red-500/40 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <div />
                  )}
                </div>

              </div>
            ))}
          </div>

          {/* Add tier button */}
          {tiers.length < 5 && (
            <button
              type="button"
              onClick={addTier}
              className="mt-3 flex items-center gap-1.5 text-[11px] text-[#555] hover:text-white transition-colors"
            >
              <Plus size={12} />
              Agregar tipo de boleto
            </button>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-white hover:bg-white/90 disabled:opacity-40 text-black font-bold py-3 text-sm transition-colors"
        >
          {saving ? 'Creando evento…' : 'Crear evento'}
        </button>
      </form>
    </div>
  )
}
