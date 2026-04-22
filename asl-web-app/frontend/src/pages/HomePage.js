import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, MessageSquare, Bot, Globe, Brain, Hand, Volume2 } from 'lucide-react';

function HomePage() {
  const features = [
    {
      icon: Camera,
      title: 'Live Detection',
      description: 'Real-time ASL alphabet recognition with confidence overlays and word building.',
      link: '/detection'
    },
    {
      icon: Volume2,
      title: 'Speech Output',
      description: 'Browser-based text-to-speech with selectable voices and optional auto-speak.',
      link: '/detection'
    },
    {
      icon: Bot,
      title: 'Gemini Assist',
      description: 'Gemini-powered autocomplete and Roman Urdu translation with graceful fallback.',
      link: '/detection'
    },
    {
      icon: MessageSquare,
      title: 'Reverse Mode',
      description: 'Convert typed or dictated text into sign-card playback for hearing users.',
      link: '/detection'
    }
  ];

  const stats = [
    { label: 'Runtime', value: 'Browser-first', icon: Globe },
    { label: 'Tracking', value: '21 landmarks', icon: Hand },
    { label: 'AI Assist', value: 'Gemini + local fallback', icon: Brain }
  ];

  return (
    <div className="space-y-12 text-slate-100">
      <section className="overflow-hidden rounded-[2rem] border border-[#00ff88]/20 bg-[radial-gradient(circle_at_top_left,_rgba(0,255,136,0.16),_transparent_24%),linear-gradient(145deg,#020617,#08130f_55%,#03120c)] px-6 py-12 shadow-2xl">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00ff88]/30 bg-[#00ff88]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#b8ffda]">
            AlphaHand
          </div>
          <h1 className="mt-6 text-5xl font-black tracking-tight text-white md:text-7xl">
            A real-time ASL communication tool for Deaf and Hearing conversations.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300">
            AlphaHand keeps the webcam front and center, confirms stable letters, speaks live output, and adds AI-assisted communication layers without breaking the detector underneath.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/detection" className="rounded-2xl bg-[#00ff88] px-6 py-4 text-lg font-semibold text-slate-950 hover:bg-[#5cffaf]">
              Open Live Workspace
            </Link>
            <Link to="/gesture-control" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-6 py-4 text-lg font-semibold text-slate-100 hover:border-slate-500">
              Explore Gesture Control
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1.75rem] border border-slate-800 bg-slate-950/85 p-6 text-center shadow-xl">
            <stat.icon className="mx-auto mb-4 h-10 w-10 text-[#00ff88]" />
            <div className="text-3xl font-black text-white">{stat.value}</div>
            <div className="mt-2 text-sm uppercase tracking-[0.24em] text-slate-500">{stat.label}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Platform Features</p>
            <h2 className="mt-2 text-4xl font-black text-white">Built for real conversations</h2>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <Link key={feature.title} to={feature.link}>
              <article className="h-full rounded-[1.75rem] border border-slate-800 bg-slate-950/85 p-6 shadow-xl transition hover:-translate-y-1 hover:border-[#00ff88]/40">
                <div className="mb-5 inline-flex rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/10 p-3">
                  <feature.icon className="h-6 w-6 text-[#00ff88]" />
                </div>
                <h3 className="text-2xl font-bold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
              </article>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-6 shadow-xl">
          <h2 className="text-3xl font-black text-white">What changed</h2>
          <ul className="mt-5 grid gap-3 text-sm text-slate-300">
            <li>Stable-letter confirmation now feeds a word builder and committed sentence output.</li>
            <li>Gemini suggestions are optional and fall back locally if the API key is missing or the request fails.</li>
            <li>Speech synthesis, Roman Urdu translation, practice mode, and reverse playback live in the same workflow.</li>
            <li>Feature boundaries and modular hooks keep the camera, AI, and UX concerns separated.</li>
          </ul>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-6 shadow-xl">
          <h2 className="text-3xl font-black text-white">Routes</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <p><strong className="text-white">Live Detection:</strong> main communication workspace.</p>
            <p><strong className="text-white">Gesture Control:</strong> existing gesture automations.</p>
            <p><strong className="text-white">Communication:</strong> legacy bidirectional page retained for compatibility.</p>
            <p><strong className="text-white">Analytics / History:</strong> existing support pages.</p>
          </div>
        </div>
      </section>

      <footer className="py-4 text-center text-sm text-slate-500">
        AlphaHand is built with React, MediaPipe, browser speech APIs, and Gemini-assisted UX layers.
      </footer>
    </div>
  );
}

export default HomePage;
