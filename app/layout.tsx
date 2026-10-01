import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Attention Filter - only what deserves your attention',
  description:
    'Turns notifications, email, calendar and news into four calm feeds: Urgent, People, Summaries and For You.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0f1115',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
