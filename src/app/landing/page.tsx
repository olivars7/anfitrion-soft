'use client'

import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import TicketVisual from '@/components/TicketVisual'
import type { Database } from '@/lib/database.types'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Event        = Database['public']['Tables']['events']['Row']
type Registration = Database['public']['Tables']['registrations']['Row']
type Ticket       = Database['public']['Tables']['tickets']['Row']

interface FoundTicket {
  registration: Registration
  ticket: Ticket
  event: Event
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) && !/Z|[+-]\d{2}:\d{2}$/.test(iso)
    ? iso.replace('T', ' ')
    : iso
  const d = new Date(normalized)
  const day  = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return { full: `${day} · ${time}`, day, time }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [event,       setEvent]       = useState<Event | null | 'loading'>('loading')
  const [inputId,     setInputId]     = useState('')
  const [searching,   setSearching]   = useState(false)
  const [found,       setFound]       = useState<FoundTicket | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [isPortrait,  setIsPortrait]  = useState(false)
  const [ticketOpen,  setTicketOpen]  = useState(false)
  const [ticketScale, setTicketScale] = useState(1)
  const [phrase,      setPhrase]      = useState('')
  const [tierColor,   setTierColor]   = useState('#e50000')
  const [amountPaid,  setAmountPaid]  = useState<number | null>(null)

  // Natural ticket dimensions (matches TicketVisual internals)
  const TICKET_W = 520
  const TICKET_H = 210

  // ── Load event + autocomplete last ID ───────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('starts_at', { ascending: true })
        .limit(1)
        .single()
      const ev = (data as Event | null) ?? null
      setEvent(ev)
      if (ev) {
        try {
          setPhrase(localStorage.getItem(`event_phrase_${ev.id}`) ?? '')
          const lastId = localStorage.getItem('last_ticket_id')
          if (lastId) setInputId(lastId)
        } catch { /* ignore */ }
      }
    }
    load()
  }, [])

  // ── Portrait detection + ticket scale ───────────────────────────────────────
  useEffect(() => {
    function check() {
      const vw = window.innerWidth
      const vh = window.innerHeight
      setIsPortrait(vh > vw)
      // Ticket is landscape; on portrait mobile we rotate it 90° so
      // its "width" fills vh and its "height" fills vw.
      // Scale = min(vh / TICKET_W, vw / TICKET_H)
      if (vh > vw) {
        setTicketScale(Math.min(vh / TICKET_W, vw / TICKET_H))
      } else {
        setTicketScale(Math.min(vw / TICKET_W, vh / TICKET_H))
      }
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // ── Ticket lookup ────────────────────────────────────────────────────────────
  async function handleLookup(e: FormEvent) {
    e.preventDefault()
    if (!event || event === 'loading') return
    const id = inputId.trim().toUpperCase()
    if (!id) return

    setSearching(true)
    setFound(null)
    setLookupError('')
    setAmountPaid(null)

    const { data: reg } = await supabase
      .from('registrations')
      .select('*')
      .eq('public_id', id)
      .eq('event_id', event.id)
      .single()

    if (!reg) {
      setLookupError(`No encontramos ningun boleto con el ID "${id}". Verifica que lo escribiste bien (ej: DA-A3K9).`)
      setSearching(false)
      return
    }

    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('registration_id', (reg as Registration).id)
      .limit(1)
      .single()

    if (!ticket) {
      setLookupError('Encontramos tu registro pero no tiene boleto generado aun. Contacta al organizador.')
      setSearching(false)
      return
    }

    // Save ID for next visit
    try { localStorage.setItem('last_ticket_id', id) } catch { /* ignore */ }

    // Resolve tier color from localStorage
    const ticketType = (ticket as Ticket).ticket_type || 'General'
    try {
      const raw = localStorage.getItem(`event_tiers_${event.id}`) ?? localStorage.getItem('active_event_tiers')
      if (raw) {
        const parsed = JSON.parse(raw)
        const tiersList: { name: string; color?: string }[] = Array.isArray(parsed) ? parsed : (parsed.tiers ?? [])
        const match = tiersList.find(t => t.name.toLowerCase() === ticketType.toLowerCase())
        if (match?.color) setTierColor(match.color)
      }
    } catch { /* ignore */ }

    // Fetch approved payment amount
    const { data: payment } = await supabase
      .from('payments')
      .select('amount')
      .eq('registration_id', (reg as Registration).id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (payment) setAmountPaid((payment as { amount: number }).amount)

    setFound({ registration: reg as Registration, ticket: ticket as Ticket, event: event as Event })
    setSearching(false)
    setTicketOpen(true)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const ev       = event !== 'loading' ? event : null
  const dateInfo = ev ? fmtDate(ev.starts_at) : null

  const ticketProps = found ? {
    serial:      found.registration.public_id,
    guestName:   found.registration.guest_name,
    kicker:      found.event.name,
    dateLabel:   dateInfo?.full,
    tierName:    found.ticket.ticket_type || 'General',
    qrValue:     found.ticket.qr_token,
    accentColor: tierColor,
    brandMark:   phrase || undefined,
    subline:     amountPaid ? `$${amountPaid.toLocaleString('es-MX')} pagados` : undefined,
  } : null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="lr">

      {/* Admin ghost button — top-right corner */}
      <div className="adm-wrap">
        <Link href="/login" className="adm">Admin</Link>
      </div>

      {/* ══ HERO + LOOKUP ════════════════════════════════════════════════════ */}
      <main className="page-wrap">
        <div className="w">

          {/* ── Title block ── */}
          {event === 'loading' ? (
            <div className="dots">
              <span /><span style={{ animationDelay: '.18s' }} /><span style={{ animationDelay: '.36s' }} />
            </div>
          ) : ev === null ? (
            <div className="title-block">
              <p className="over">AnfitriónSoft</p>
              <h1 className="hed-fallback">Nada por<br />ahora</h1>
              <p className="sub-text">No hay eventos activos. Vuelve pronto.</p>
            </div>
          ) : (
            <div className="title-block">
              <p className="over hf" style={{ animationDelay: '0s' }}>Estás invitado</p>

              <h1 className="hed hf" style={{ animationDelay: '.06s' }}>{ev.name}</h1>

              <div className="meta-row hf" style={{ animationDelay: '.12s' }}>
                {dateInfo && <span className="meta-chip">{dateInfo.day}</span>}
                {dateInfo && <span className="meta-chip">{dateInfo.time}</span>}
              </div>
            </div>
          )}

          {/* ── Lookup form ── */}
          {ev && (
            <div className="lookup-block hf" style={{ animationDelay: '.28s' }}>
              <p className="lookup-label">Ingresa tu ID de boleto</p>
              <form className="lookup-form" onSubmit={handleLookup}>
                <input
                  className="id-inp"
                  type="text"
                  placeholder="DA-XXXX"
                  value={inputId}
                  onChange={e => {
                    setInputId(e.target.value.toUpperCase())
                    setLookupError('')
                    setFound(null)
                  }}
                  maxLength={8}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button className="lookup-go" type="submit" disabled={searching || !inputId.trim()}>
                  {searching ? '···' : 'Ver boleto'}
                </button>
              </form>

              {lookupError && <p className="lerr">{lookupError}</p>}

              {/* Warning — always visible once ticket found */}
              {ticketProps && (
                <div className="warn-box">
                  <span className="warn-icon">!</span>
                  <p>
                    Oye — <strong>no lo compartas con nadie</strong>. Si alguien lo escanea antes que tú,
                    el sistema lo detecta al instante y nos toca negarte el acceso. Ahorranos el drama.
                  </p>
                </div>
              )}

              {/* Inline ticket — desktop only */}
              {ticketProps && (
                <div className="tkt-inline">
                  <div className={`tkt-orient${isPortrait ? ' portrait' : ''}`}>
                    <div className="tkt-inner">
                      <TicketVisual {...ticketProps} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ══ FOOTER — WhatsApp contact ════════════════════════════════════════ */}
      <footer className="lnd-footer">
        <div className="w">
          <p className="lnd-footer-text">
            ¿Dudas?{' '}
            <a
              href="https://wa.me/526646947418"
              target="_blank"
              rel="noopener noreferrer"
              className="lnd-footer-link"
            >
              Escríbeme al WhatsApp: 664 694 7418
            </a>
          </p>
        </div>
      </footer>

      {/* ══ MOBILE OVERLAY ═══════════════════════════════════════════════════ */}
      {ticketProps && ticketOpen && (
        <div className="tkt-overlay" onClick={() => setTicketOpen(false)}>
          <div
            className="tkt-scale-wrap"
            style={{ transform: `rotate(90deg) scale(${ticketScale})` }}
          >
            <TicketVisual {...ticketProps} />
          </div>
        </div>
      )}

      {/* ══ STYLES ══════════════════════════════════════════════════════════ */}
      <style>{`

        /* ROOT */
        .lr {
          min-height: 100vh;
          background: #000;
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
        }

        /* FOOTER */
        .lnd-footer {
          padding-block: 20px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .lnd-footer-text {
          margin: 0;
          font-size: 13px;
          color: rgba(255,255,255,0.35);
        }
        .lnd-footer-link {
          color: #25D366;
          text-decoration: none;
          font-weight: 600;
          transition: color .15s;
        }
        .lnd-footer-link:hover { color: #1ebe5d; }

        /* ADMIN GHOST BUTTON */
        .adm-wrap { position: fixed; top: 18px; right: 18px; z-index: 200; }
        .adm {
          font-size: 10px; font-weight: 800; letter-spacing: 0.18em;
          text-transform: uppercase; color: rgba(255,255,255,0.18);
          text-decoration: none; padding: 5px 11px;
          border: 1px solid rgba(255,255,255,0.08);
          transition: color .25s, border-color .25s;
        }
        .adm:hover { color: rgba(255,255,255,0.55); border-color: rgba(255,255,255,0.22); }

        /* CONTAINER */
        .w {
          width: 100%; max-width: 860px; margin-inline: auto;
          padding-inline: clamp(20px, 6vw, 56px);
        }

        /* PAGE WRAP — vertically centers content */
        .page-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          padding-block: clamp(60px, 12vw, 100px);
        }
        .page-wrap > .w { width: 100%; }

        /* TITLE BLOCK */
        .title-block { margin-bottom: clamp(36px, 7vw, 60px); }

        /* Eyebrow */
        .over {
          font-size: 11px; font-weight: 800; letter-spacing: 0.22em;
          text-transform: uppercase; color: #e50000; margin: 0 0 16px;
        }

        /* Tagline (big) */
        .hed-tagline {
          margin: 0 0 10px;
          font-family: var(--font-bebas), 'Arial Black', system-ui, sans-serif;
          font-size: clamp(4rem, 18vw, 10rem);
          line-height: 0.85; letter-spacing: -0.03em; text-transform: uppercase;
          color: #fff; word-break: break-word;
        }

        /* Event name fallback */
        .hed {
          margin: 0 0 10px;
          font-family: var(--font-bebas), 'Arial Black', system-ui, sans-serif;
          font-size: clamp(3.5rem, 14vw, 8rem);
          line-height: 0.85; letter-spacing: -0.03em; text-transform: uppercase; color: #fff;
          word-break: break-word;
        }
        .hed-fallback {
          margin: 0 0 16px;
          font-family: var(--font-bebas), 'Arial Black', system-ui, sans-serif;
          font-size: clamp(3rem, 14vw, 7rem);
          line-height: 0.85; text-transform: uppercase; color: rgba(255,255,255,0.3);
        }

        /* Subtitle gradient */
        .hed-subtitle {
          margin: 0 0 20px;
          font-family: var(--font-bebas), 'Arial Black', system-ui, sans-serif;
          font-size: clamp(1.4rem, 5vw, 3rem);
          line-height: 0.9; letter-spacing: -0.01em; text-transform: uppercase;
          background: linear-gradient(90deg, #e50000 0%, #ff6b35 40%, #ff2d9e 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: gradshift 6s linear infinite;
        }

        /* Event name below tagline */
        .hed-event-name {
          margin: 0 0 20px;
          font-family: var(--font-bebas), 'Arial Black', system-ui, sans-serif;
          font-size: clamp(1.2rem, 4vw, 2.4rem);
          line-height: 0.9; letter-spacing: -0.01em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
        }

        .sub-text { margin: 0; font-size: clamp(1rem, 3vw, 1.15rem); color: rgba(255,255,255,0.4); }

        /* Date chips */
        .meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .meta-chip {
          font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; padding: 6px 14px;
          border: 1px solid rgba(255,255,255,0.22); color: rgba(255,255,255,0.65);
        }

        /* HERO ENTRY ANIMATIONS */
        .hf {
          opacity: 0;
          transform: translateY(20px);
          animation: hrise .6s cubic-bezier(.16,.84,.44,1) forwards;
        }

        /* LOADING DOTS */
        .dots { display: flex; gap: 10px; padding: 80px 0; }
        .dots span {
          width: 10px; height: 10px; background: rgba(255,255,255,0.2);
          animation: dpulse 1s ease-in-out infinite;
        }
        @keyframes dpulse { 0%,80%,100%{transform:scale(.6);opacity:.3} 40%{transform:scale(1);opacity:1} }

        /* LOOKUP BLOCK */
        .lookup-block { max-width: 520px; }
        .lookup-label {
          font-size: 10px; font-weight: 800; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,0.35); margin: 0 0 12px;
        }
        .lookup-form {
          display: flex;
          border: 2px solid rgba(255,255,255,0.22); margin-bottom: 14px;
          transition: border-color .2s, box-shadow .2s;
        }
        .lookup-form:focus-within {
          border-color: rgba(229,0,0,0.6);
          box-shadow: 0 0 0 3px rgba(229,0,0,0.15);
        }
        .id-inp {
          flex: 1; font-size: 1.15rem; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
          color: #fff; background: transparent; border: none; padding: 14px 16px; outline: none;
        }
        .id-inp::placeholder { color: rgba(255,255,255,0.2); font-weight: 400; letter-spacing: 0.08em; }
        .lookup-go {
          appearance: none; border: none; border-left: 2px solid rgba(255,255,255,0.22);
          cursor: pointer;
          font-family: var(--font-bebas), 'Arial Black', system-ui, sans-serif;
          font-size: 1.05rem; letter-spacing: 0.06em; text-transform: uppercase;
          background: #e50000; color: #fff; padding: 14px 24px;
          transition: background .15s; white-space: nowrap;
        }
        .lookup-go:hover:not(:disabled) { background: #c40000; }
        .lookup-go:active:not(:disabled) { background: #a00; }
        .lookup-go:disabled { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.2); cursor: default; }

        @media (max-width: 767px) {
          .lookup-block { max-width: 100%; }
          .lookup-form {
            flex-direction: column;
            border: none;
            gap: 10px;
          }
          .lookup-form:focus-within { box-shadow: none; }
          .id-inp {
            border: 2px solid rgba(255,255,255,0.22);
            padding: 15px 16px;
            width: 100%;
            font-size: 1.3rem;
            transition: border-color .2s;
          }
          .id-inp:focus { border-color: rgba(229,0,0,0.6); }
          .lookup-go {
            border-left: none;
            border: none;
            width: 100%;
            padding: 16px;
            font-size: 1.2rem;
          }
          .warn-box { margin-top: 4px; }
        }

        .lerr {
          margin: 0 0 14px; font-size: 0.83rem; color: #e50000; font-weight: 600;
          padding: 10px 14px; border: 1px solid rgba(229,0,0,0.25); background: rgba(229,0,0,0.04);
        }

        /* INLINE TICKET (desktop) */
        .tkt-inline {
          margin-top: 28px;
          animation: hrise .55s .1s cubic-bezier(.2,.9,.3,1.1) both;
        }
        .tkt-orient { width: 100%; margin-bottom: 16px; }
        .tkt-orient.portrait {
          height: calc((100vw - 40px) * 0.52);
          display: flex; align-items: center; justify-content: center; overflow: visible;
        }
        .tkt-orient.portrait .tkt-inner {
          transform: rotate(90deg); transform-origin: center center;
          width: calc(100vh - 140px); display: block;
        }

        /* Warning */
        .warn-box {
          display: flex; gap: 12px; align-items: flex-start;
          background: rgba(229,0,0,0.06); border: 1px solid rgba(229,0,0,0.3);
          padding: 14px 18px;
        }
        .warn-icon {
          font-size: 1rem; font-weight: 900; font-family: var(--font-bebas), sans-serif;
          color: #e50000; flex-shrink: 0; margin-top: 2px; line-height: 1; font-style: italic;
        }
        .warn-box p { margin: 0; font-size: 0.82rem; color: rgba(255,255,255,0.6); line-height: 1.6; }
        .warn-box strong { color: #fff; }

        /* MOBILE OVERLAY */
        .tkt-overlay { display: none; }

        @media (max-width: 767px) {
          .tkt-inline { display: none; }

          .tkt-overlay {
            display: flex;
            align-items: center;
            justify-content: center;
            position: fixed; inset: 0; z-index: 500;
            background: #000;
            cursor: pointer;
            animation: fadein .2s ease both;
            overflow: hidden;
          }

          /* Ticket: rendered at fixed natural size, then rotated + scaled via JS */
          .tkt-scale-wrap {
            transform-origin: center center;
            flex-shrink: 0;
            width: 520px; /* pin natural width so scale math is exact */
          }
        }

        /* KEYFRAMES */
        @keyframes hrise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadein   { from { opacity: 0; } }
        @keyframes gradshift { to { background-position: -200% center; } }

        /* REDUCED MOTION */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
          .hf { opacity: 1 !important; transform: none !important; }
          .hed-subtitle { color: #e50000; background: none; -webkit-text-fill-color: #e50000; }
        }
      `}</style>
    </div>
  )
}
