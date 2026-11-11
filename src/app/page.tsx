// src/app/page.tsx – redirects root to /landing
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/landing')
}
