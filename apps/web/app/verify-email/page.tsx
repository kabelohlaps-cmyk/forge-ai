'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function VerifyEmail() {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'checking' | 'verified' | 'failed'>(token ? 'checking' : 'failed');
  const [error, setError] = useState(token ? '' : 'This verification link is missing its token.');
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) return setState('verified');
        const body = await res.json().catch(() => ({}));
        setError(typeof body.detail === 'string' ? body.detail : 'Could not verify your email.');
        setState('failed');
      })
      .catch(() => {
        setError('Something went wrong. Try opening the link again.');
        setState('failed');
      });
  }, [token]);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/auth/verify-email/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => ({}));
    setResent(res.ok ? body.message : 'Enter a valid email address.');
  }

  if (state === 'checking') return <p className="text-eden-sage text-center">Verifying…</p>;
  if (state === 'verified')
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-eden-cream">Your email address is verified. Thank you!</p>
        <a href="/projects" className="eden-btn-primary inline-block">Go to your projects</a>
      </div>
    );
  return (
    <div className="space-y-4">
      <p className="text-sm text-eden-sunset text-center">{error}</p>
      {resent ? (
        <p className="text-sm text-eden-cream text-center">{resent}</p>
      ) : (
        <form onSubmit={resend} className="space-y-3">
          <input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50" />
          <button type="submit" className="eden-btn-primary w-full">Send a new link</button>
        </form>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="eden-panel w-full max-w-sm p-8 space-y-5">
        <h1 className="font-serif text-2xl text-eden-gold-light text-center">Verify your email</h1>
        <Suspense fallback={<p className="text-eden-sage text-center">Loading…</p>}>
          <VerifyEmail />
        </Suspense>
      </div>
    </div>
  );
}
