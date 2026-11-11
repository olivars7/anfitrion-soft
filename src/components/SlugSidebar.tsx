'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CreditCard, TicketCheck, ScanLine,
  Settings, LogOut, Zap, Terminal, ChevronLeft, Dices,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

interface Props {
  slug: string
  eventName: string
}

export default function SlugSidebar({ slug, eventName }: Props) {
  const pathname = usePathname()
  const { logout } = useAuth()

  const base = `/${slug}`

  const navSections = [
    {
      label: 'Principal',
      items: [
        { href: `${base}/dashboard`, label: 'Dashboard',     icon: LayoutDashboard },
      ],
    },
    {
      label: 'Operaciones',
      items: [
        { href: `${base}/pagos`,    label: 'Boletos / Pagos',   icon: CreditCard  },
        { href: `${base}/taquilla`, label: 'Taquilla Manual',   icon: TicketCheck },
        { href: `${base}/scanner`,  label: 'Escáner de Puerta', icon: ScanLine    },
        { href: `${base}/rifa`,     label: 'Rifa',              icon: Dices       },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { href: `${base}/console`,  label: 'Consola DB',    icon: Terminal },
        { href: `${base}/settings`, label: 'Configuración', icon: Settings },
      ],
    },
  ]

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 flex flex-col bg-surface border-r border-white/[0.06] z-40 overflow-y-auto">
      {/* Back button + Logo */}
      <div className="px-3 pt-3 pb-0 shrink-0">
        <Link
          href="/home"
          className="flex items-center gap-1.5 text-[#666] hover:text-[#aaa] transition-colors text-[11px] font-medium mb-2.5"
        >
          <ChevronLeft size={13} />
          Eventos
        </Link>
      </div>
      <div className="flex items-start gap-2 px-5 pb-4 border-b border-white/[0.06] shrink-0">
        <Zap size={18} className="text-white mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-white font-semibold text-sm tracking-wide block truncate">AnfitriónSoft</span>
          <span className="text-[#555] text-[10px] font-mono truncate block">{eventName}</span>
        </div>
      </div>

      {/* Sectioned Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#555555]">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2 text-xs font-medium transition-colors rounded-sm ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-[#888888] hover:bg-white/[0.05] hover:text-[#cccccc]'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 pt-3 border-t border-white/[0.06] shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 text-xs font-medium text-[#888888] hover:bg-white/[0.05] hover:text-[#cccccc] transition-colors rounded-sm"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
