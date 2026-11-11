'use client'

import { ConsoleView } from '@/components/ConsoleView'
import { useSlugEvent } from '@/hooks/useSlugEvent'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

export default function ConsolePage() {
  const [key, setKey] = useState(0)
  const { eventId } = useSlugEvent()

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 3rem)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Consola de Actividad DB</h1>
          <p className="text-[#888888] text-xs mt-0.5">Registro de operaciones en tiempo real</p>
        </div>
        <button onClick={() => setKey(k => k + 1)}
          className="flex items-center gap-2 text-xs text-[#888888] hover:text-white border border-white/[0.08] hover:border-white/20 px-3 py-1.5 transition-colors">
          <RefreshCw size={13} />Actualizar
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ConsoleView key={key} eventId={eventId} defaultFilterByEvent={true} />
      </div>
    </div>
  )
}
