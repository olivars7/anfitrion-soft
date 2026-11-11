'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated])

  if (!isAuthenticated) return null

  return (
    <div className="home-bg min-h-screen relative overflow-hidden">
      {/* Animated square particles */}
      <div className="particles-layer" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={`sq-particle sq-particle-${i}`} />
        ))}
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
