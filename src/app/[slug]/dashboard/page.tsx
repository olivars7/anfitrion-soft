'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import UniqueLoading from '@/components/ui/morph-loading'
import { useSlugEvent } from '@/hooks/useSlugEvent'
import {
  Users, DollarSign, Ticket,
  CreditCard, ScanLine, Terminal,
  CheckCircle, AlertCircle, Maximize2,
  ArrowRight, House,
} from 'lucide-react'

interface Payment { amount: number; status: string; method: string; created_at: string }
interface TicketRow { status: string; ticket_type: string }
interface RegRow { id: string }

interface KPIs {
  totalRegistrations: number
  totalRevenue:       number
  pendingPayments:    number
  validTickets:       number
  usedTickets:        number
  approvedPayments:   number
  rejectedPayments:   number
  cashRevenue:        number
  transferRevenue:    number
  tierCounts:         Record<string, number>
  tierRevenue:        Record<string, number>
}

interface RecentPay {
  registrationId: string
  name: string
  amount: number
  status: string
  ticketType: string | null
}

type ChartInterval = '3d' | 'week'
const FIXED_BUCKETS = 8

function buildChartData(payments: Payment[], interval: ChartInterval) {
  const stepMs = interval === '3d' ? 3 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
  const nowDate = new Date()
  nowDate.setHours(23, 59, 59, 999)
  const end = nowDate.getTime()
  const periods: { from: number; to: number }[] = []
  for (let i = 0; i < FIXED_BUCKETS; i++) {
    const to = end - i * stepMs; const from = to - stepMs
    periods.unshift({ from, to })
  }
  const approved = payments.filter(p => p.status === 'approved')
  const buckets = periods.map(({ from, to }) => {
    const sum = approved.filter(p => { const t = new Date(p.created_at).getTime(); return t > from && t <= to }).reduce((s, p) => s + p.amount, 0)
    const d = new Date(from + stepMs / 2)
    return { label: d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }), value: sum }
  })
  return { labels: buckets.map(b => b.label), values: buckets.map(b => b.value) }
}

function useAnimProgress(key: unknown, duration = 1100) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    setProgress(0)
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setProgress(ease)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [key, duration])
  return progress
}

function KpiCard({ label, rawValue, Icon, accent, index }: { label: string; rawValue: number; Icon: React.ElementType; accent: boolean; index: number }) {
  const progress = useAnimProgress(rawValue)
  const display = accent
    ? `$${Math.round(rawValue * progress).toLocaleString()}`
    : Math.round(rawValue * progress).toLocaleString()
  return (
    <div
      className="kpi-card group relative overflow-hidden bg-[#0a0a0a] border border-white/[0.08] px-3 py-3 flex flex-col gap-1.5 min-w-[90px] cursor-default transition-all duration-200 hover:bg-white hover:border-white"
      style={{ animation: `dashFadeUp 0.4s ease-out ${0.05 * index}s both` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-white/40 group-hover:text-black/50 uppercase tracking-widest font-mono transition-colors duration-200">{label}</span>
        <Icon
          size={11}
          className="text-white/[0.06] group-hover:text-black/10 absolute right-2 top-1/2 -translate-y-1/2 transition-colors duration-200"
          style={{ width: 36, height: 36 }}
        />
      </div>
      <span className={`text-xl font-bold leading-none transition-colors duration-200 ${accent ? 'text-white group-hover:text-black' : 'text-white/80 group-hover:text-black/80'}`}>
        {display}
      </span>
    </div>
  )
}

// Monochrome SVG donut
function TicketModule({ slices }: { slices: { label: string; value: number; revenue: number }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  const totalRev = slices.reduce((s, x) => s + x.revenue, 0)
  const GREYS = ['#ffffff','#d4d4d4','#a3a3a3','#737373','#525252','#404040','#262626','#171717']

  let angle = -Math.PI / 2
  const paths = slices.map((s, i) => {
    const frac = total === 0 ? 1 / slices.length : s.value / total
    const a = frac * 2 * Math.PI
    const x1 = 50 + 38 * Math.cos(angle), y1 = 50 + 38 * Math.sin(angle)
    angle += a
    const x2 = 50 + 38 * Math.cos(angle), y2 = 50 + 38 * Math.sin(angle)
    const large = a > Math.PI ? 1 : 0
    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
    return { d: `M50,50 L${x1},${y1} A38,38 0 ${large},1 ${x2},${y2} Z`, color: GREYS[i % GREYS.length], label: s.label, value: s.value, revenue: s.revenue, pct }
  })

  const hov = hoveredIdx !== null ? paths[hoveredIdx] : null

  return (
    <div className="flex flex-col h-full gap-0 overflow-hidden">
      {/* SVG fills most of the module */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 pb-1">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ maxHeight: '100%' }}
        >
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.color}
              style={{ opacity: hoveredIdx === null ? 1 : hoveredIdx === i ? 1 : 0.25, cursor: 'default', transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
          {/* Donut hole */}
          <circle cx="50" cy="50" r="24" fill="#0a0a0a" onMouseEnter={() => setHoveredIdx(null)} />
          {/* Center: idle state */}
          {hov === null && (
            <>
              <text x="50" y="47" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{total}</text>
              <text x="50" y="55" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="4.5">boletos</text>
              {totalRev > 0 && (
                <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="4">${totalRev.toLocaleString()}</text>
              )}
            </>
          )}
          {/* Center: hovered slice */}
          {hov !== null && (
            <>
              <text x="50" y="44" textAnchor="middle" fill={hov.color} fontSize="4.5" fontWeight="600">{hov.label}</text>
              <text x="50" y="52" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{hov.value}</text>
              <text x="50" y="59" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="4.2">{hov.pct}% del total</text>
              {hov.revenue > 0 && (
                <text x="50" y="66" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="4">${hov.revenue.toLocaleString()}</text>
              )}
            </>
          )}
        </svg>
      </div>

      {/* Compact legend — no scroll */}
      <div className="shrink-0 px-3 pb-3 pt-1 space-y-[3px]">
        {paths.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-[3px] px-1 -mx-1 rounded-[1px] transition-colors duration-100"
            style={{ background: hoveredIdx === i ? 'rgba(255,255,255,0.07)' : 'transparent', cursor: 'default' }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
            <span
              className="text-[9px] truncate flex-1 font-mono transition-colors duration-100"
              style={{ color: hoveredIdx === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)' }}
            >{p.label}</span>
            <span
              className="text-[9px] font-mono transition-colors duration-100 shrink-0"
              style={{ color: hoveredIdx === i ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}
            >{p.pct}%</span>
            <span
              className="text-[9px] font-mono font-semibold transition-colors duration-100 shrink-0"
              style={{ color: hoveredIdx === i ? '#fff' : 'rgba(255,255,255,0.55)' }}
            >{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1)
  const total = values.reduce((s, v) => s + v, 0)
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="flex items-end gap-[3px] h-full px-3 pb-6 pt-3 relative">
      {values.map((v, i) => {
        const heightPct = (v / max) * 100
        const isHov = hovered === i
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-0 h-full justify-end relative group"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Hover tooltip */}
            {isHov && (
              <div className="absolute bottom-[calc(100%-20px)] mb-1 left-1/2 -translate-x-1/2 bg-white text-black rounded px-2 py-1 z-10 pointer-events-none whitespace-nowrap shadow-lg"
                style={{ bottom: `${heightPct + 6}%` }}>
                <p className="text-[9px] font-mono font-bold">${v.toLocaleString()}</p>
                <p className="text-[8px] text-black/50 font-mono">{labels[i]}</p>
                {total > 0 && <p className="text-[8px] text-black/40 font-mono">{Math.round((v / total) * 100)}% del total</p>}
              </div>
            )}

            {/* Bar */}
            <div
              className="w-full transition-all duration-150 rounded-t-[1px]"
              style={{
                height: `${heightPct}%`,
                minHeight: v > 0 ? 2 : 0,
                background: isHov ? '#ffffff' : v === max && max > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)',
              }}
            />

            {/* Label */}
            <span
              className="text-[7px] font-mono absolute bottom-0 transition-colors duration-150"
              style={{
                left: '50%',
                transform: 'translateX(-50%) rotate(-35deg)',
                transformOrigin: 'center top',
                color: isHov ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
              }}
            >
              {labels[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = { approved: 'Aprobado', pending: 'Pendiente', rejected: 'Rechazado' }
const STATUS_GREY: Record<string, string> = { approved: '#e5e5e5', pending: '#737373', rejected: '#404040' }

function RecentPayRow({ pay }: { pay: RecentPay }) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2 transition-all duration-150 hover:bg-white cursor-default">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150 group-hover:scale-125"
        style={{ background: STATUS_GREY[pay.status] ?? '#555' }}
      />
      <span className="flex-1 text-xs text-white/70 group-hover:text-black truncate transition-colors duration-150">{pay.name}</span>
      {pay.ticketType && (
        <span className="text-[9px] text-white/30 group-hover:text-black/50 font-mono truncate max-w-[60px] transition-colors duration-150">{pay.ticketType}</span>
      )}
      <span className="text-[9px] text-white/30 group-hover:text-black/40 font-mono shrink-0 transition-colors duration-150">
        {STATUS_LABELS[pay.status] ?? pay.status}
      </span>
      <span className="text-xs font-mono text-white/60 group-hover:text-black font-semibold shrink-0 transition-colors duration-150">
        ${pay.amount.toLocaleString()}
      </span>
    </div>
  )
}

function ExpandBtn({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-1 text-[10px] font-mono text-white/20 hover:text-white transition-colors">
      <Maximize2 size={10} />Ampliar
    </Link>
  )
}

export default function DashboardPage() {
  const { event, slug } = useSlugEvent()
  const base = `/${slug}`

  const [kpis, setKpis] = useState<KPIs>({ totalRegistrations: 0, totalRevenue: 0, pendingPayments: 0, validTickets: 0, usedTickets: 0, approvedPayments: 0, rejectedPayments: 0, cashRevenue: 0, transferRevenue: 0, tierCounts: {}, tierRevenue: {} })
  const [recentPays, setRecentPays] = useState<RecentPay[]>([])
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  const [chartInterval, setChartInterval] = useState<ChartInterval>('3d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!event) return
    const eventId = event.id
    async function load() {
      const [regRes, tixRes] = await Promise.all([
        supabase.from('registrations').select('id').eq('event_id', eventId),
        supabase.from('tickets').select('status, ticket_type').eq('event_id', eventId),
      ])
      const regIds = ((regRes.data ?? []) as { id: string }[]).map(r => r.id)
      const [payRes, tixWithRegRes] = await Promise.all([
        regIds.length > 0
          ? supabase.from('payments').select('amount, status, method, created_at, registration_id').in('registration_id', regIds)
          : Promise.resolve({ data: [] }),
        supabase.from('tickets').select('registration_id, ticket_type').eq('event_id', eventId),
      ])

      const payments = (payRes.data ?? []) as (Payment & { registration_id: string })[]
      const tickets  = (tixRes.data ?? []) as TicketRow[]
      const regs     = (regRes.data ?? []) as RegRow[]

      // Build registration_id → ticket_type map from the dedicated query
      const regToTier: Record<string, string> = {}
      for (const t of (tixWithRegRes.data ?? []) as { registration_id: string; ticket_type: string }[]) {
        regToTier[t.registration_id] = t.ticket_type || 'General'
      }

      const approved = payments.filter(p => p.status === 'approved')
      const pending  = payments.filter(p => p.status === 'pending')
      const rejected = payments.filter(p => p.status === 'rejected')
      const revenue  = approved.reduce((s, p) => s + (p.amount ?? 0), 0)
      const cashRev  = approved.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
      const transRev = approved.filter(p => p.method === 'spei').reduce((s, p) => s + p.amount, 0)

      const tierCounts: Record<string, number> = {}
      for (const t of tickets) { const k = t.ticket_type || 'General'; tierCounts[k] = (tierCounts[k] ?? 0) + 1 }

      // Revenue per tier: sum approved payments by their registration's ticket_type
      const tierRevenue: Record<string, number> = {}
      for (const p of approved) {
        const tier = regToTier[p.registration_id] ?? 'General'
        tierRevenue[tier] = (tierRevenue[tier] ?? 0) + p.amount
      }

      setKpis({ totalRegistrations: regs.length, totalRevenue: revenue, pendingPayments: pending.length, validTickets: tickets.filter(t => t.status === 'valid').length, usedTickets: tickets.filter(t => t.status === 'used').length, approvedPayments: approved.length, rejectedPayments: rejected.length, cashRevenue: cashRev, transferRevenue: transRev, tierCounts, tierRevenue })
      setAllPayments(payments)

      const { data: regNames } = await supabase.from('registrations').select('id, guest_name').eq('event_id', eventId)
      const { data: payFull }  = await supabase.from('payments').select('id, registration_id, amount, status').in('registration_id', regIds).order('created_at', { ascending: false }).limit(5)
      const tixFull = tixWithRegRes.data

      const nameMap: Record<string, string> = {}
      for (const r of (regNames ?? []) as { id: string; guest_name: string }[]) nameMap[r.id] = r.guest_name
      const tixMap: Record<string, string> = {}
      for (const t of (tixFull ?? []) as { registration_id: string; ticket_type: string }[]) tixMap[t.registration_id] = t.ticket_type

      setRecentPays(((payFull ?? []) as { id: string; registration_id: string; amount: number; status: string }[]).map(p => ({ registrationId: p.registration_id, name: nameMap[p.registration_id] ?? '—', amount: p.amount, status: p.status, ticketType: tixMap[p.registration_id] ?? null })))
      await new Promise(resolve => setTimeout(resolve, 800))
      setLoading(false)
    }
    load()
  }, [event])

  const chartData = buildChartData(allPayments, chartInterval)
  const kpiRow = [
    { label: 'Registros',  rawValue: kpis.totalRegistrations, Icon: Users,       accent: false },
    { label: 'Ingresos',   rawValue: kpis.totalRevenue,       Icon: DollarSign,  accent: true  },
    { label: 'Aprobados',  rawValue: kpis.approvedPayments,   Icon: CheckCircle, accent: false },
    { label: 'Pendientes', rawValue: kpis.pendingPayments,    Icon: AlertCircle, accent: false },
    { label: 'Boletos',    rawValue: kpis.validTickets,       Icon: Ticket,      accent: false },
    { label: 'Rechazados', rawValue: kpis.rejectedPayments,   Icon: AlertCircle, accent: false },
  ]

  // Summary stats for chart header
  const approvedTotal = allPayments.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0)

  return (
    <>
      <style>{`
        @keyframes dashFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .kpi-scroll{overflow-x:auto;width:100%;scrollbar-width:thin;scrollbar-color:transparent transparent}
        .kpi-scroll:hover{scrollbar-color:#2a2a2a transparent}
        .kpi-scroll::-webkit-scrollbar{height:3px}
        .kpi-scroll::-webkit-scrollbar-thumb{background:transparent;border-radius:2px}
        .kpi-scroll:hover::-webkit-scrollbar-thumb{background:#2a2a2a}
      `}</style>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link href="/home" title="Mis eventos" className="text-[#555] hover:text-white transition-colors">
            <House size={16} />
          </Link>
          <h1 className="text-sm font-semibold text-[#555] uppercase tracking-[0.15em]">
            {event?.name || 'Dashboard'}
          </h1>
        </div>

        {loading ? (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
            <UniqueLoading variant="morph" size="md" />
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div className="kpi-scroll -mx-6 px-6 md:mx-0 md:px-0">
              <div className="flex gap-2 md:grid md:grid-cols-6 min-w-max md:min-w-0">
                {kpiRow.map(({ label, rawValue, Icon, accent }, i) => (
                  <KpiCard key={label} label={label} rawValue={rawValue} Icon={Icon} accent={accent} index={i} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:grid lg:gap-3" style={{ gridTemplateColumns: '200px 1fr', gridTemplateRows: '270px 240px' } as React.CSSProperties}>

              {/* Donut */}
              <div className="bg-[#0a0a0a] border border-white/[0.08] flex flex-col overflow-hidden h-[380px] lg:h-auto" style={{ gridRow: '1 / 3' }}>
                <div className="px-3 py-2 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Tipo de boleto</span>
                  <span className="text-[10px] font-mono text-white/20">
                    {Object.values(kpis.tierCounts).reduce((a, b) => a + b, 0)} total
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <TicketModule slices={
                    Object.keys(kpis.tierCounts).length > 0
                      ? Object.entries(kpis.tierCounts).map(([label, value]) => ({ label, value, revenue: kpis.tierRevenue[label] ?? 0 }))
                      : [{ label: 'Sin datos', value: 0, revenue: 0 }]
                  } />
                </div>
              </div>

              {/* Revenue chart + scanner */}
              <div className="flex flex-col gap-3 lg:grid lg:gap-3" style={{ gridTemplateColumns: '1fr 240px' } as React.CSSProperties}>
                <div className="bg-[#0a0a0a] border border-white/[0.08] flex flex-col overflow-hidden h-[200px] lg:h-auto">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Ingresos</span>
                      <span className="text-[11px] font-mono text-white/70 font-semibold">${approvedTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-1">
                      {(['3d','week'] as const).map(iv => (
                        <button key={iv} onClick={() => setChartInterval(iv)}
                          className={`px-2 py-0.5 text-[9px] font-mono transition-all duration-150 ${chartInterval === iv ? 'text-black bg-white' : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]'}`}>
                          {iv === '3d' ? '3 días' : 'Semana'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0"><MiniBarChart labels={chartData.labels} values={chartData.values} /></div>
                </div>

                <div className="bg-[#0a0a0a] border border-white/[0.08] flex flex-col overflow-hidden h-[200px] lg:h-auto group/scan hover:bg-white transition-all duration-200 cursor-default">
                  <div className="px-3 py-2 border-b border-white/[0.06] group-hover/scan:border-black/[0.08] flex items-center justify-between shrink-0">
                    <span className="text-[10px] text-white/40 group-hover/scan:text-black/50 uppercase tracking-widest font-mono transition-colors duration-200">Escáner</span>
                    <Link href={`${base}/scanner`} className="flex items-center gap-1 text-[10px] font-mono text-white/20 group-hover/scan:text-black/40 hover:!text-black transition-colors">
                      <Maximize2 size={10} />Ampliar
                    </Link>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 p-3">
                    <ScanLine size={28} className="text-white/20 group-hover/scan:text-black/30 transition-colors duration-200" />
                    <Link href={`${base}/scanner`} className="flex items-center gap-1.5 text-[11px] text-white/40 group-hover/scan:text-black hover:!text-black transition-colors font-mono">
                      Abrir escáner <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Recent payments + KPI detail */}
              <div className="flex flex-col gap-3 lg:grid lg:gap-3" style={{ gridTemplateColumns: '1fr 240px' } as React.CSSProperties}>
                <div className="bg-[#0a0a0a] border border-white/[0.08] flex flex-col overflow-hidden h-[240px] lg:h-auto">
                  <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Pagos recientes</span>
                    <ExpandBtn href={`${base}/pagos`} />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {recentPays.length === 0
                      ? <p className="text-white/20 text-xs px-3 py-4">Sin pagos recientes</p>
                      : recentPays.map((p, i) => <RecentPayRow key={i} pay={p} />)
                    }
                  </div>
                </div>

                <div className="bg-[#0a0a0a] border border-white/[0.08] flex flex-col overflow-hidden h-[240px] lg:h-auto">
                  <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Desglose</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                    {[
                      { label: 'Efectivo',      value: `$${kpis.cashRevenue.toLocaleString()}`,     sub: `${kpis.approvedPayments > 0 ? Math.round((kpis.cashRevenue / kpis.totalRevenue) * 100) || 0 : 0}%`, Icon: CreditCard },
                      { label: 'Transferencia', value: `$${kpis.transferRevenue.toLocaleString()}`,  sub: `${kpis.approvedPayments > 0 ? Math.round((kpis.transferRevenue / kpis.totalRevenue) * 100) || 0 : 0}%`, Icon: CreditCard },
                      { label: 'Usados',        value: String(kpis.usedTickets),                     sub: `${kpis.validTickets + kpis.usedTickets > 0 ? Math.round((kpis.usedTickets / (kpis.validTickets + kpis.usedTickets)) * 100) : 0}%`, Icon: Ticket },
                      { label: 'Válidos',       value: String(kpis.validTickets),                    sub: `de ${kpis.validTickets + kpis.usedTickets}`, Icon: Ticket },
                    ].map(({ label, value, sub, Icon }) => (
                      <div key={label} className="group/det flex items-center justify-between py-1.5 px-1.5 -mx-1.5 transition-all duration-150 hover:bg-white cursor-default rounded-[1px]">
                        <div className="flex items-center gap-2">
                          <Icon size={11} className="text-white/20 group-hover/det:text-black/30 transition-colors duration-150" />
                          <span className="text-[10px] text-white/40 group-hover/det:text-black/60 uppercase tracking-wider transition-colors duration-150">{label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/20 group-hover/det:text-black/40 font-mono transition-colors duration-150">{sub}</span>
                          <span className="text-[11px] text-white/70 group-hover/det:text-black font-mono font-semibold transition-colors duration-150">{value}</span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/[0.06]">
                      <Link href={`${base}/console`} className="flex items-center gap-1.5 text-[10px] text-white/20 hover:text-white/60 transition-colors font-mono">
                        <Terminal size={10} />Consola DB
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </>
  )
}
