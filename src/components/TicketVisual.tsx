'use client'

import { QRCodeSVG } from 'qrcode.react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TicketVisualProps {
  /** Short brand / org prefix shown top-left */
  brandMark?: string
  /** Ticket serial / public ID — shown only below the QR */
  serial: string
  /** Small kicker above the big name (event name) */
  kicker?: string
  /** Big display name — the BUYER name */
  guestName: string
  /** Subline below the big name — price paid */
  subline?: string
  /** Date + time string */
  dateLabel?: string
  /** Venue */
  venue?: string
  /** Accent color hex — drives gradients. Defaults to #e52239 */
  accentColor?: string
  /** Tier/type label shown on the badge */
  tierName: string
  /** QR value */
  qrValue: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketVisual({
  brandMark = '',
  serial,
  kicker,
  guestName,
  subline,
  dateLabel,
  venue,
  accentColor = '#e52239',
  tierName,
  qrValue,
}: TicketVisualProps) {
  // Derive color variants from accentColor
  const hex = accentColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const mainBg = `
    radial-gradient(ellipse at 20% 20%, rgba(${r},${g},${b},.38), transparent 42%),
    radial-gradient(ellipse at 76% 80%, rgba(${Math.round(r*.5)},${Math.round(g*.4)},${Math.round(b*.5)},.55), transparent 43%),
    linear-gradient(125deg, #09090d 0%, #1a0c12 42%, #09090d 100%)
  `
  const ringBorder = `rgba(${r},${g},${b},.26)`
  const ringGlow1  = `rgba(${r},${g},${b},.07)`
  const ringGlow2  = `rgba(${r},${g},${b},.04)`
  const nameGrad   = `linear-gradient(110deg, #fff5ed 0%, #ffcdb8 22%, ${accentColor} 52%, ${accentColor}88 78%, #fff0e8 100%)`
  const dropShadow = `drop-shadow(0 3px 12px rgba(${r},${g},${b},.25))`

  return (
    <div
      className="relative flex overflow-hidden"
      style={{
        borderRadius: 11,
        background: '#111014',
        color: '#f7f0ec',
        boxShadow: '0 24px 65px rgba(17,8,16,.3)',
        isolation: 'isolate',
        minHeight: 190,
      }}
    >
      {/* ── MAIN PANEL ───────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-between overflow-hidden"
        style={{ flex: '1 1 0%', minWidth: 0, padding: '14px 18px 13px', background: mainBg }}
      >
        {/* Dot texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0, opacity: 0.28,
            backgroundImage: `
              repeating-linear-gradient(132deg, transparent 0 5px, rgba(255,255,255,.06) 5px 6px),
              radial-gradient(rgba(255,255,255,.22) .55px, transparent .65px)
            `,
            backgroundSize: 'auto, 6px 6px',
            maskImage: 'linear-gradient(110deg, #000, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(110deg, #000, transparent 90%)',
          }}
        />
        {/* Decorative ring */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 320, height: 320, borderRadius: '50%',
            border: `1px solid ${ringBorder}`,
            right: -145, top: -185, zIndex: 0,
            boxShadow: `0 0 0 20px ${ringGlow1}, 0 0 0 40px ${ringGlow2}`,
          }}
        />

        {/* Content */}
        <div className="relative" style={{ zIndex: 1 }}>

          {/* Brand mark / phrase */}
          {brandMark.trim() && (
            <div style={{ fontSize: 8, letterSpacing: '0.25em', fontWeight: 900, textTransform: 'uppercase', color: '#f7f0ec', marginBottom: 8 }}>
              {brandMark}
            </div>
          )}

          {/* Kicker (event name) */}
          {kicker && (
            <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.34em', textTransform: 'uppercase', color: accentColor, marginBottom: 5, opacity: 0.85 }}>
              {kicker}
            </div>
          )}

          {/* Big name — buyer */}
          <div
            style={{
              fontSize: 'clamp(34px, 7vw, 52px)',
              lineHeight: 0.84,
              letterSpacing: '-0.07em',
              fontWeight: 950,
              textTransform: 'uppercase',
              backgroundImage: nameGrad,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: dropShadow,
              marginBottom: 6,
            }}
          >
            {guestName}
          </div>

          {/* Subline — price */}
          {subline && (
            <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800, color: '#b7a9a8', marginBottom: 8 }}>
              {subline}
            </div>
          )}

          {/* Meta: date + venue */}
          {(dateLabel || venue) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: dateLabel && venue ? '1fr 1fr' : '1fr',
                gap: '8px 10px',
                borderTop: `1px solid rgba(${r},${g},${b},.22)`,
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              {dateLabel && (
                <div>
                  <strong style={{ fontSize: 10, letterSpacing: '-0.01em', color: '#f7f0ec' }}>{dateLabel}</strong>
                </div>
              )}
              {venue && (
                <div>
                  <strong style={{ fontSize: 10, letterSpacing: '-0.01em', color: '#f7f0ec' }}>{venue}</strong>
                </div>
              )}
            </div>
          )}

          {/* Tier badge */}
          <div style={{ marginTop: 10 }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', borderRadius: 3,
                fontSize: 7, fontWeight: 950, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: '#fff',
                background: `linear-gradient(105deg, ${accentColor}cc, ${accentColor} 55%, ${accentColor}88)`,
                boxShadow: `0 4px 14px rgba(${r},${g},${b},.35)`,
              }}
            >
              ✦ {tierName}
            </span>
          </div>

        </div>
      </div>

      {/* ── STUB ─────────────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center justify-between text-center"
        style={{
          width: 108,
          flexShrink: 0,
          padding: '14px 9px 12px',
          background: 'linear-gradient(145deg, #20171b, #39232a 48%, #171317)',
          borderLeft: `1px dashed rgba(${r},${g},${b},.4)`,
        }}
      >
        {/* Perforated circles */}
        <div className="absolute" style={{ left: -9, top: -9,    width: 18, height: 18, borderRadius: '50%', background: '#0a0a0a' }} />
        <div className="absolute" style={{ left: -9, bottom: -9, width: 18, height: 18, borderRadius: '50%', background: '#0a0a0a' }} />

        {/* Stub label */}
        <div style={{ fontSize: 7, letterSpacing: '0.2em', fontWeight: 900, textTransform: 'uppercase', color: '#bca5a5' }}>
          Escanea<br />para validar
        </div>

        {/* QR */}
        <div style={{ padding: 5, background: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 5, margin: '8px 0' }}>
          <QRCodeSVG value={qrValue} size={80} level="H" includeMargin={false} />
        </div>

        {/* Serial — only here */}
        <div style={{ fontSize: 7, letterSpacing: '0.08em', fontWeight: 800, color: '#f8e9e5', wordBreak: 'break-all', lineHeight: 1.4 }}>
          {serial}
        </div>
      </div>
    </div>
  )
}
