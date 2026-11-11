'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, db } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import UniqueLoading from '@/components/ui/morph-loading'
import { Plus, CalendarDays, MapPin, Users, Ticket, LogOut, Power } from 'lucide-react'
import type { Database } from '@/lib/database.types'

const SELECTED_EVENT_KEY = 'selected_event_id'

type Event = Database['public']['Tables']['events']['Row']

const STATUS_META: Record<Event['status'], { label: string; dot: string; text: string }> = {
  draft:  { label: 'Borrador', dot: 'bg-[#555]',     text: 'text-[#888]'   },
  active: { label: 'Activo',   dot: 'bg-[#39ff14]',  text: 'text-[#39ff14]' },
  closed: { label: 'Cerrado',  dot: 'bg-[#ff4040]',  text: 'text-[#ff4040]' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface ConfirmModal {
  event: Event
  nextStatus: 'active' | 'closed'
}

export default function HomePage() {
  const router = useRouter()
  const { logout } = useAuth()
  const [events, setEvents]       = useState<Event[]>([])
  const [loading, setLoading]     = useState(true)
  const [confirm, setConfirm]     = useState<ConfirmModal | null>(null)
  const [toggling, setToggling]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data }] = await Promise.all([
        supabase.from('events').select('*').order('starts_at', { ascending: false }),
        new Promise(resolve => setTimeout(resolve, 1000)),
      ])
      setEvents((data ?? []) as Event[])
      setLoading(false)
    }
    load()
  }, [])

  function openConfirm(ev: Event, e: React.MouseEvent) {
    e.stopPropagation()
    const nextStatus: 'active' | 'closed' = ev.status === 'active' ? 'closed' : 'active'
    setConfirm({ event: ev, nextStatus })
  }

  async function handleToggle() {
    if (!confirm) return
    const { event, nextStatus } = confirm
    setToggling(event.id)
    setConfirm(null)

    try {
      // If activating: first close any currently active event
      if (nextStatus === 'active') {
        const activeEvents = events.filter(e => e.status === 'active' && e.id !== event.id)
        for (const ae of activeEvents) {
          await db.from('events').update({ status: 'closed' }).eq('id', ae.id)
        }
      }
      await db.from('events').update({ status: nextStatus }).eq('id', event.id)

      // Refresh list
      const { data } = await supabase.from('events').select('*').order('starts_at', { ascending: false })
      setEvents((data ?? []) as Event[])
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="min-h-screen px-4 pt-10 pb-16 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#555] mb-1">
            AnfitriónSoft
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight">Mis Eventos</h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-[#666] hover:text-white transition-colors mt-1"
        >
          <LogOut size={14} />
          Salir
        </button>
      </div>

      {loading ? (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <UniqueLoading variant="morph" size="md" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">

          {/* ── Create new event button ── */}
          <button
            onClick={() => router.push('/home/new')}
            className="
              group flex flex-col items-center justify-center gap-2
              w-full h-32 border border-dashed border-[#333]
              hover:border-white/30 hover:bg-white/[0.03]
              transition-colors
            "
          >
            <div className="flex items-center justify-center w-9 h-9 border border-[#333] group-hover:border-white/30 transition-colors">
              <Plus size={18} className="text-[#555] group-hover:text-white transition-colors" />
            </div>
            <span className="text-xs font-medium text-[#555] group-hover:text-white transition-colors">
              Nuevo evento
            </span>
          </button>

          {/* ── Event cards ── */}
          {events.length === 0 ? (
            <p className="text-center text-[#555] text-sm py-10">
              Aún no hay eventos. Crea el primero.
            </p>
          ) : (
            events.map((ev) => {
              const meta = STATUS_META[ev.status]
              const isToggling = toggling === ev.id
              const canToggle = ev.status === 'active' || ev.status === 'closed'
              return (
                <div key={ev.id} className="relative event-card group">
                  <button
                    onClick={() => router.push(`/${ev.slug}/dashboard`)}
                    className="w-full text-left p-5"
                  >
                    {/* Top row: name + status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h2 className="text-base font-bold text-white leading-snug group-hover:text-white">
                        {ev.name}
                      </h2>
                      <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap mt-0.5 ${meta.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#666]">
                        <CalendarDays size={12} className="shrink-0 text-[#444]" />
                        <span className="truncate">{formatDate(ev.starts_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#666]">
                        <MapPin size={12} className="shrink-0 text-[#444]" />
                        <span className="truncate">{ev.venue || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#666]">
                        <Users size={12} className="shrink-0 text-[#444]" />
                        <span>{ev.capacity.toLocaleString()} cap.</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#666]">
                        <Ticket size={12} className="shrink-0 text-[#444]" />
                        <span>${ev.cover_price.toLocaleString()} cover</span>
                      </div>
                    </div>

                    {/* Slug */}
                    <p className="mt-3 text-[10px] font-mono text-[#444] truncate">
                      /{ev.slug}
                    </p>
                  </button>

                  {/* Toggle active/closed button */}
                  {canToggle && (
                    <button
                      onClick={(e) => openConfirm(ev, e)}
                      disabled={isToggling}
                      title={ev.status === 'active' ? 'Cerrar evento' : 'Activar evento'}
                      className={`
                        absolute bottom-3.5 right-4
                        flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold
                        border transition-colors disabled:opacity-40
                        ${ev.status === 'active'
                          ? 'border-[#ff4040]/40 text-[#ff4040]/70 hover:bg-[#ff4040]/10 hover:text-[#ff4040] hover:border-[#ff4040]/60'
                          : 'border-[#39ff14]/30 text-[#39ff14]/60 hover:bg-[#39ff14]/10 hover:text-[#39ff14] hover:border-[#39ff14]/50'
                        }
                      `}
                    >
                      <Power size={10} className={isToggling ? 'animate-pulse' : ''} />
                      {ev.status === 'active' ? 'Cerrar' : 'Activar'}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setConfirm(null)}
        >
          <div
            className="bg-[#111] border border-white/10 p-6 max-w-xs w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-base mb-2">
              {confirm.nextStatus === 'active' ? 'Activar evento' : 'Cerrar evento'}
            </h3>
            <p className="text-[#888] text-sm mb-5 leading-relaxed">
              {confirm.nextStatus === 'active'
                ? <>¿Activar <span className="text-white font-semibold">{confirm.event.name}</span>? Cualquier otro evento activo será cerrado automáticamente.</>
                : <>¿Cerrar <span className="text-white font-semibold">{confirm.event.name}</span>? El evento quedará marcado como cerrado.</>
              }
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2 text-xs font-medium text-[#888] border border-white/10 hover:bg-white/[0.04] hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleToggle}
                className={`flex-1 py-2 text-xs font-bold transition-colors ${
                  confirm.nextStatus === 'active'
                    ? 'bg-[#39ff14]/20 border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/30'
                    : 'bg-[#ff4040]/20 border border-[#ff4040]/40 text-[#ff4040] hover:bg-[#ff4040]/30'
                }`}
              >
                {confirm.nextStatus === 'active' ? 'Activar' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
