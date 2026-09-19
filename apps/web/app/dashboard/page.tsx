'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '../../lib/api';

interface Me {
  id: number;
  email: string;
  name: string;
  tier: string;
  render_quota: number;
  allowed_modes: string[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const backendToken = (session as any)?.backendToken;
    if (status !== 'authenticated' || !backendToken) return;
    apiFetch('/users/me', backendToken)
      .then(setMe)
      .catch((e) => setError(e.message));
  }, [session, status]);

  if (status === 'loading') return <p className="text-eden-sage">Loading…</p>;
  if (error) return <p className="text-eden-sunset">{error}</p>;
  if (!me) return <p className="text-eden-sage">Loading your garden…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl tracking-widest text-eden-cream">Welcome back, {me.name || me.email}</h1>
        <p className="text-eden-sage mt-1">
          You're on the <span className="capitalize text-eden-gold-light">{me.tier}</span> plan
          {me.render_quota >= 0 ? ` — ${me.render_quota} renders/month` : ' — unlimited renders'}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/projects" className="eden-panel p-6 hover:border-eden-gold/40 transition">
          <div className="font-serif text-eden-gold-light text-lg">Your Projects</div>
          <p className="text-sm text-eden-stone mt-1">View and continue your designs.</p>
        </a>
        <a href="/modes" className="eden-panel p-6 hover:border-eden-gold/40 transition">
          <div className="font-serif text-eden-gold-light text-lg">Browse Modes</div>
          <p className="text-sm text-eden-stone mt-1">Start something new.</p>
        </a>
        <a href="/billing" className="eden-panel p-6 hover:border-eden-gold/40 transition">
          <div className="font-serif text-eden-gold-light text-lg">Manage Plan</div>
          <p className="text-sm text-eden-stone mt-1">Upgrade for more modes and renders.</p>
        </a>
      </div>

      <div>
        <h2 className="font-serif text-lg text-eden-gold-light mb-2">Modes available on your plan</h2>
        <div className="flex flex-wrap gap-2">
          {me.allowed_modes.map((m) => (
            <span key={m} className="text-xs uppercase tracking-widest text-eden-sage border border-eden-sage/20 rounded-full px-3 py-1 capitalize">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
