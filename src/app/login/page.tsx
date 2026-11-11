'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Zap, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = login(password)
    if (ok) {
      router.replace('/home')
    } else {
      setError('Contraseña incorrecta. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14  bg-primary/20 mb-4">
            <Zap size={30} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">AnfitriónSoft</h1>
          <p className="text-muted text-sm mt-1">Panel de Administración</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border  p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Acceso Administrador</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Contraseña de acceso</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoFocus
                  className="w-full bg-bg border border-border  px-4 py-2.5 pr-10 text-white placeholder-muted text-sm focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/40  px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold py-2.5  text-sm transition-colors"
            >
              {loading ? 'Verificando…' : 'Ingresar al panel'}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-6">
          © {new Date().getFullYear()} AnfitriónSoft
        </p>
      </div>
    </div>
  )
}
