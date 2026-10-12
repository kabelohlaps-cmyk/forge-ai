'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not reset the password.');
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token)
    return (
      <p className="text-sm text-eden-sunset text-center">
        This reset link is missing its token.{' '}
        <a href="/forgot-password" className="text-eden-gold-light hover:underline">Request a new one</a>
      </p>
    );

  if (done)
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-eden-cream">Your password has been changed. Every other session has been signed out.</p>
        <a href="/login" className="eden-btn-primary inline-block">Sign in</a>
      </div>
    );

  const fieldClass =
    'w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50';
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-eden-sunset text-center">
          {error}{' '}
          {error.includes('expired') && (
            <a href="/forgot-password" className="text-eden-gold-light hover:underline">Request a new link</a>
          )}
        </p>
      )}
      <input type="password" placeholder="New password (at least 8 characters)" value={password}
        onChange={(e) => setPassword(e.target.value)} className={fieldClass} minLength={8} required />
      <input type="password" placeholder="Confirm new password" value={confirm}
        onChange={(e) => setConfirm(e.target.value)} className={fieldClass} minLength={8} required />
      <button type="submit" disabled={submitting} className="eden-btn-primary w-full disabled:opacity-50">
        {submitting ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="eden-panel w-full max-w-sm p-8 space-y-5">
        <h1 className="font-serif text-2xl text-eden-gold-light text-center">Choose a new password</h1>
        <Suspense fallback={<p className="text-eden-sage text-center">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
