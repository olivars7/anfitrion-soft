'use client'

/**
 * Hook to read the resolved event from the [slug] layout cache.
 * The layout already fetched and cached the event by slug — child pages
 * just read from the cache instead of making another DB call.
 */
import { useParams } from 'next/navigation'
import { slugEventCache } from '@/app/[slug]/layout'
import type { Database } from '@/lib/database.types'

type Event = Database['public']['Tables']['events']['Row']

export function useSlugEvent(): { event: Event | null; slug: string; eventId: string | null } {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''
  const event = (slugEventCache.slug === slug ? slugEventCache.event : null)
  return { event, slug, eventId: event?.id ?? null }
}
