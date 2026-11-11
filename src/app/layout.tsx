import type { Metadata } from 'next'
import { Bebas_Neue, Staatliches, Nanum_Pen_Script } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'

const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas' })
const staatliches = Staatliches({ weight: '400', subsets: ['latin'], variable: '--font-staatliches' })
const nanumPen = Nanum_Pen_Script({ weight: '400', subsets: ['latin'], variable: '--font-nanum' })

export const metadata: Metadata = {
  title: 'AnfitriónSoft – Admin',
  description: 'Panel de administración para gestión de accesos a eventos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bebasNeue.variable} ${staatliches.variable} ${nanumPen.variable}`}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
