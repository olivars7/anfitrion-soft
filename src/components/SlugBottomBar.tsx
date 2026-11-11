'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, TicketCheck, ScanLine, Settings, Dices } from 'lucide-react'

interface Props { slug: string }

export default function SlugBottomBar({ slug }: Props) {
  const pathname = usePathname()
  const base = `/${slug}`

  const items = [
    { href: `${base}/dashboard`, icon: LayoutDashboard },
    { href: `${base}/pagos`,    icon: CreditCard      },
    { href: `${base}/taquilla`, icon: TicketCheck     },
    { href: `${base}/scanner`,  icon: ScanLine        },
    { href: `${base}/rifa`,     icon: Dices           },
    { href: `${base}/settings`, icon: Settings        },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around px-4 pb-[env(safe-area-inset-bottom,0px)] h-[calc(72px+env(safe-area-inset-bottom,0px))]"
      style={{
        background: 'rgba(10,10,10,0.82)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '0.5px solid rgba(255,255,255,0.10)',
      }}
    >
      {items.map(({ href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} className="relative flex items-center justify-center flex-1 h-full select-none">
            <span
              className="absolute top-[10px] left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-200"
              style={{ width: active ? 20 : 0, background: active ? '#ffffff' : 'transparent' }}
            />
            <Icon
              size={28}
              strokeWidth={active ? 2.2 : 1.6}
              className="transition-colors duration-150"
              style={{ color: active ? '#ffffff' : '#6e6e73' }}
            />
          </Link>
        )
      })}
    </nav>
  )
}
