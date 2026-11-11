'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSlugEvent } from '@/hooks/useSlugEvent'
import { Shuffle, Trophy } from 'lucide-react'

interface Ticket {
  name: string
  phone: string
  ticketType: string
  color: string
}

function loadTiers(eventId: string | null): { name: string; color: string }[] {
  if (typeof window === 'undefined' || !eventId) return []
  try {
    const raw = localStorage.getItem(`event_tiers_${eventId}`) ?? localStorage.getItem('active_event_tiers')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const arr: { name: string; color?: string }[] = Array.isArray(parsed) ? parsed : (parsed.tiers ?? [])
    return arr.map(t => ({ name: t.name, color: t.color ?? '#aeaeb2' }))
  } catch { return [] }
}

function tierColorFor(tierName: string, tiers: { name: string; color: string }[]): string {
  if (!tierName) return '#aeaeb2'
  if (tierName === 'Invitado Especial' || tierName === 'Invitad@ especial') return '#9333ea'
  const match = tiers.find(t => t.name.toLowerCase() === tierName.toLowerCase())
  if (match) return match.color
  const lc = tierName.toLowerCase()
  if (lc.includes('vip')) return '#30d158'
  if (lc.includes('preventa')) return '#ff9f0a'
  return '#aeaeb2'
}

// Draw the wheel on a canvas element
function drawWheel(
  canvas: HTMLCanvasElement,
  tickets: Ticket[],
  rotation: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx || tickets.length === 0) return
  const size = canvas.width
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 4

  const sliceAngle = (2 * Math.PI) / tickets.length

  ctx.clearRect(0, 0, size, size)

  tickets.forEach((ticket, i) => {
    const startAngle = rotation + i * sliceAngle
    const endAngle = startAngle + sliceAngle

    // Slice fill
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, radius, startAngle, endAngle)
    ctx.closePath()

    // Alternate brightness to distinguish slices
    const hex = ticket.color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const dark = i % 2 === 0
    const alpha = dark ? 0.85 : 0.55
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fill()

    // Slice border
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Label
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(startAngle + sliceAngle / 2)
    const textRadius = radius * 0.62
    ctx.translate(textRadius, 0)
    ctx.rotate(Math.PI / 2)

    const maxLen = tickets.length > 40 ? 6 : tickets.length > 20 ? 9 : 12
    const label = ticket.name.length > maxLen ? ticket.name.slice(0, maxLen - 1) + '…' : ticket.name
    const fontSize = tickets.length > 60 ? 7 : tickets.length > 30 ? 9 : tickets.length > 15 ? 11 : 13
    ctx.font = `bold ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 4
    ctx.fillText(label, 0, 0)
    ctx.restore()
  })

  // Center circle
  ctx.beginPath()
  ctx.arc(cx, cy, 22, 0, 2 * Math.PI)
  ctx.fillStyle = '#0d0d0d'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 2
  ctx.stroke()
}

export default function RifaPage() {
  const { eventId } = useSlugEvent()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [allTypes, setAllTypes] = useState<{ name: string; color: string }[]>([])

  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [winner, setWinner] = useState<Ticket | null>(null)

  // Fetch tickets from DB
  useEffect(() => {
    if (!eventId) return
    async function fetch() {
      setLoading(true)
      const tiers = loadTiers(eventId)
      const { data: regs } = await supabase
        .from('registrations')
        .select('id, guest_name, whatsapp_phone')
        .eq('event_id', eventId as string)
      const regIds = ((regs ?? []) as { id: string }[]).map(r => r.id)
      if (regIds.length === 0) { setTickets([]); setLoading(false); return }
      const { data: tixData } = await supabase
        .from('tickets')
        .select('registration_id, ticket_type, holder_name')
        .in('registration_id', regIds)
        .in('status', ['valid', 'used'])

      type RegRow = { id: string; guest_name: string; whatsapp_phone: string }
      type TixRow = { registration_id: string; ticket_type: string; holder_name: string | null }

      const regMap: Record<string, RegRow> = {}
      for (const r of (regs ?? []) as RegRow[]) regMap[r.id] = r

      const result: Ticket[] = ((tixData ?? []) as TixRow[]).map(t => {
        const reg = regMap[t.registration_id]
        return {
          name: reg?.guest_name ?? t.holder_name ?? 'Invitado',
          phone: reg?.whatsapp_phone ?? '',
          ticketType: t.ticket_type ?? 'General',
          color: tierColorFor(t.ticket_type, tiers),
        }
      })

      // Collect unique types
      const typeMap: Record<string, string> = {}
      for (const t of result) typeMap[t.ticketType] = t.color
      const types = Object.entries(typeMap).map(([name, color]) => ({ name, color }))

      setAllTypes(types)
      setSelectedTypes(types.map(t => t.name))
      setTickets(result)
      setLoading(false)
    }
    fetch()
  }, [eventId])

  // Filtered tickets
  const filtered = tickets.filter(t => selectedTypes.includes(t.ticketType))

  // Draw wheel whenever filtered or rotation changes
  useEffect(() => {
    if (!canvasRef.current) return
    drawWheel(canvasRef.current, filtered, rotation)
  }, [filtered, rotation])

  function toggleType(name: string) {
    setSelectedTypes(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    )
  }

  const spin = useCallback(() => {
    if (spinning || filtered.length === 0) return
    setWinner(null)
    setSpinning(true)

    // Pick winner index before spinning
    const winnerIdx = Math.floor(Math.random() * filtered.length)
    const sliceAngle = (2 * Math.PI) / filtered.length

    // We want to end so the pointer (top = -PI/2) points into winnerIdx's slice
    // pointer at -PI/2, slice center at rotation_final + winnerIdx * sliceAngle + sliceAngle/2
    // => rotation_final = -Math.PI/2 - winnerIdx * sliceAngle - sliceAngle/2
    const extraSpins = 6 + Math.random() * 4 // 6-10 full spins
    const targetOffset = -Math.PI / 2 - winnerIdx * sliceAngle - sliceAngle / 2
    const totalRotation = rotation + extraSpins * 2 * Math.PI + (targetOffset - (rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

    const duration = 4500 // ms
    const startTime = performance.now()
    const startRotation = rotation

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentRotation = startRotation + (totalRotation - startRotation) * eased
      setRotation(currentRotation)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        setRotation(totalRotation)
        setSpinning(false)
        setWinner(filtered[winnerIdx])
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }, [spinning, filtered, rotation])

  // Cleanup animation on unmount
  useEffect(() => () => cancelAnimationFrame(animFrameRef.current), [])

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-white mb-1">Rifa</h1>
      <p className="text-[#888] text-sm mb-6">Gira la ruleta y selecciona un ganador al azar entre los boletos.</p>

      {/* Ticket type filter */}
      {!loading && allTypes.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Filtrar tipos de boleto</p>
          <div className="flex flex-wrap gap-2">
            {allTypes.map(t => {
              const active = selectedTypes.includes(t.name)
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => toggleType(t.name)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-all"
                  style={{
                    borderColor: active ? t.color : '#2a2a2a',
                    color: active ? t.color : '#555',
                    background: active ? `${t.color}18` : 'transparent',
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? t.color : '#333' }} />
                  {t.name}
                  <span className="font-mono opacity-60">
                    {tickets.filter(tk => tk.ticketType === t.name).length}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[#444] text-xs mt-2">
            {filtered.length} boleto{filtered.length !== 1 ? 's' : ''} en ruleta
          </p>
        </div>
      )}

      {/* Wheel */}
      <div className="relative flex items-center justify-center mb-6">
        {/* Pointer arrow at top */}
        <div
          className="absolute z-10 top-0 left-1/2 -translate-x-1/2"
          style={{ transform: 'translateX(-50%) translateY(-2px)' }}
        >
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
            <polygon points="12,30 2,4 22,4" fill="#e52239" stroke="#0d0d0d" strokeWidth="2" />
          </svg>
        </div>

        {loading ? (
          <div className="w-[340px] h-[340px] flex items-center justify-center">
            <span className="text-[#555] text-sm">Cargando boletos…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="w-[340px] h-[340px] border border-[#1e1e1e] flex items-center justify-center rounded-full">
            <span className="text-[#555] text-sm text-center px-8">
              {tickets.length === 0 ? 'No hay boletos registrados.' : 'Selecciona al menos un tipo de boleto.'}
            </span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            className="rounded-full"
            style={{ display: 'block', boxShadow: '0 0 0 3px rgba(255,255,255,0.07), 0 8px 40px rgba(0,0,0,0.6)' }}
          />
        )}
      </div>

      {/* Spin button */}
      <div className="flex justify-center mb-6">
        <button
          type="button"
          onClick={spin}
          disabled={spinning || filtered.length === 0 || loading}
          className="flex items-center gap-3 px-8 py-3.5 bg-[#e52239] hover:bg-[#ff2d47] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-widest transition-colors"
        >
          <Shuffle size={16} className={spinning ? 'animate-spin' : ''} />
          {spinning ? 'Girando…' : 'Girar Ruleta'}
        </button>
      </div>

      {/* Winner popup */}
      {winner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
          onClick={() => setWinner(null)}
        >
          <div
            className="relative w-full bg-[#0d0d0d] border overflow-hidden"
            style={{ maxWidth: 420, borderColor: winner.color }}
            onClick={e => e.stopPropagation()}
          >
            {/* Color bar */}
            <div className="h-1 w-full" style={{ background: winner.color }} />

            <div className="p-8 flex flex-col items-center text-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: `${winner.color}22`, border: `2px solid ${winner.color}` }}
              >
                <Trophy size={28} style={{ color: winner.color }} />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: winner.color }}>
                  ¡Ganador!
                </p>
                <p className="text-3xl font-black text-white leading-tight mb-1">{winner.name}</p>
                {winner.phone && (
                  <p className="text-sm text-[#888] font-mono mb-2">{winner.phone}</p>
                )}
                <span
                  className="inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: `${winner.color}18`, color: winner.color, border: `1px solid ${winner.color}55` }}
                >
                  {winner.ticketType}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setWinner(null)}
                className="mt-2 w-full py-3 text-sm font-bold uppercase tracking-widest border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#555] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
