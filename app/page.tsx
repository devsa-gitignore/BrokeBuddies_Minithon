'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Zap, Target, Filter } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neo-black text-white font-sans overflow-hidden">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-6xl mx-auto">
        <div className="font-pixel text-2xl font-bold text-neo-lime">Attention<span className="text-white">Filter</span></div>
        <Link
          href="/auth/login"
          className="font-pixel border-2 border-white px-4 py-2 hover:bg-white hover:text-black transition-colors neo-press shadow-neo-white"
        >
          LOGIN
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <h1 className="font-pixel text-5xl md:text-7xl leading-tight uppercase">
              Reclaim Your <br />
              <span className="bg-neo-purple text-neo-lime px-2 pb-2 inline-block -rotate-2 transform mt-2 border-4 border-neo-lime">
                Attention
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-md">
              A harsh filter for a noisy world. Turn your notifications, emails, and news into calm, actionable feeds. No fluff. Just focus.
            </p>
            <div className="pt-4">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-3 bg-neo-lime text-black font-pixel text-xl px-8 py-4 border-4 border-black hover:bg-white transition-colors shadow-neo-lavender neo-press uppercase"
              >
                Enter the Zone
                <ArrowRight className="w-6 h-6" strokeWidth={3} />
              </Link>
            </div>
          </motion.div>

          {/* Abstract Hero Art */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative h-[400px] w-full flex items-center justify-center"
          >
            <div className="absolute w-64 h-64 bg-neo-purple border-4 border-black shadow-neo-lime rotate-6 z-10" />
            <div className="absolute w-72 h-40 bg-neo-green border-4 border-black shadow-neo-lavender -rotate-12 translate-x-8 translate-y-12 z-20 flex items-center justify-center">
              <span className="font-pixel text-neo-lime text-4xl">NOISE_FILTER_ON</span>
            </div>
            <div className="absolute w-32 h-32 bg-neo-lavender border-4 border-black shadow-neo-purple translate-x-32 -translate-y-20 z-30" />
          </motion.div>
        </div>

        {/* Features Bento Grid */}
        <div className="mt-32 space-y-12">
          <div className="text-center">
            <h2 className="font-pixel text-4xl uppercase text-neo-lavender">System Modules</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-neo-purple border-4 border-black p-8 shadow-neo-lime neo-press transition-transform group"
            >
              <Target className="w-12 h-12 text-neo-lime mb-6" strokeWidth={2.5} />
              <h3 className="font-pixel text-2xl text-neo-lime uppercase mb-4">Deep Focus</h3>
              <p className="text-white/80">
                A brutalist timer that blocks everything except urgent pings and priority contacts. Get work done.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-neo-green border-4 border-black p-8 shadow-neo-lavender neo-press transition-transform group"
            >
              <Filter className="w-12 h-12 text-neo-lavender mb-6" strokeWidth={2.5} />
              <h3 className="font-pixel text-2xl text-neo-lavender uppercase mb-4">Harsh Filters</h3>
              <p className="text-white/80">
                AI categorizes and silences the junk. We separate the signal from the noise with extreme prejudice.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-neo-lavender border-4 border-black p-8 shadow-neo-purple neo-press transition-transform group"
            >
              <Zap className="w-12 h-12 text-black mb-6" strokeWidth={2.5} />
              <h3 className="font-pixel text-2xl text-black uppercase mb-4">Synthesized Intel</h3>
              <p className="text-black/80">
                Highlights clustered into actionable bullet points. Read less, know more, act faster.
              </p>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-white/10 mt-20">
        <div className="max-w-6xl mx-auto p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-pixel text-neo-lavender">SYSTEM_v2.0</div>
          <div className="text-xs text-white/40 uppercase tracking-widest">Built for the relentless.</div>
        </div>
      </footer>
    </div>
  )
}
