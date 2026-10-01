import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, VT323 } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' })
const vt323 = VT323({ weight: '400', subsets: ['latin'], variable: '--font-pixel' })

export const metadata: Metadata = {
  title: 'Attention Filter - Neobrutalist',
  description:
    'Turns notifications, email, calendar and news into calm feeds.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#09090b',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`min-h-screen bg-background text-foreground antialiased ${spaceGrotesk.variable} ${vt323.variable} font-sans`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
