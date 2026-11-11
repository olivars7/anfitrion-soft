'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import SlugSidebar from '@/components/SlugSidebar'
import SlugBottomBar from '@/components/SlugBottomBar'
import UniqueLoading from '@/components/ui/morph-loading'
import type { Database } from '@/lib/database.types'

type Event = Database['public']['Tables']['events']['Row']

export interface SlugEventContextValue {
  event: Event
  slug: string
}

// Simple module-level cache so child pages can read the resolved event
// without an additional DB round-trip. Reset when slug changes.
export const slugEventCache: { slug: string | null; event: Event | null } = {
  slug: null,
  event: null,
}

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''

  const [event, setEvent] = useState<Event | null>(
    slugEventCache.slug === slug ? slugEventCache.event : null
  )
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (slugEventCache.slug === slug && slugEventCache.event) {
      setEvent(slugEventCache.event)
      return
    }
    async function resolve() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .limit(1)
        .single()
      if (!data) {
        setNotFound(true)
        return
      }
      const ev = data as Event
      slugEventCache.slug = slug
      slugEventCache.event = ev
      setEvent(ev)
    }
    resolve()
  }, [slug, isAuthenticated])

  if (!isAuthenticated) return null

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-white text-xl font-bold">Evento no encontrado</p>
        <p className="text-[#666] text-sm">No existe un evento con la URL <span className="font-mono text-[#aaa]">/{slug}</span></p>
        <button onClick={() => router.push('/home')} className="text-[#0a84ff] text-sm hover:underline mt-2">
          ← Volver a mis eventos
        </button>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <UniqueLoading variant="morph" size="md" />
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <SlugSidebar slug={slug} eventName={event.name} />
      </div>
      <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-surface md:left-56 pt-6 px-6 pb-[calc(72px+env(safe-area-inset-bottom,0px)+2rem)] md:p-6">
        {children}
      </main>
      <SlugBottomBar slug={slug} />
    </>
  )
}
