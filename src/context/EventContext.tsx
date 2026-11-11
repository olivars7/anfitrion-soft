'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const STORAGE_KEY = 'selected_event_id'

interface EventContextValue {
  selectedEventId: string | null
  setSelectedEventId: (id: string) => void
}

const EventContext = createContext<EventContextValue | null>(null)

export function EventProvider({ children }: { children: ReactNode }) {
  const [selectedEventId, _setSelectedEventId] = useState<string | null>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) _setSelectedEventId(stored)
  }, [])

  function setSelectedEventId(id: string) {
    _setSelectedEventId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <EventContext.Provider value={{ selectedEventId, setSelectedEventId }}>
      {children}
    </EventContext.Provider>
  )
}

export function useEvent(): EventContextValue {
  const ctx = useContext(EventContext)
  if (!ctx) throw new Error('useEvent must be used inside EventProvider')
  return ctx
}
