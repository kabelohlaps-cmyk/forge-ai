'use client';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Shown to signed-in users whose email isn't verified yet. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function resend() {
    setState('sending');
    try {
      const res = await fetch(`${API_URL}/auth/verify-email/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <div data-testid="verify-email-banner" className="rounded-lg border border-eden-gold/30 bg-eden-gold/10 px-4 py-2 text-sm text-eden-cream">
      Please verify your email address. We sent a link to <span className="text-eden-gold-light">{email}</span>.{' '}
      {state === 'sent' ? (
        <span className="text-eden-sage">New link sent. Check your inbox.</span>
      ) : (
        <button onClick={resend} disabled={state === 'sending'} className="text-eden-gold-light underline disabled:opacity-50">
          {state === 'sending' ? 'Sending…' : 'Resend the link'}
        </button>
      )}
      {state === 'error' && <span className="text-eden-sunset"> Couldn't send it. Try again.</span>}
    </div>
  );
}
