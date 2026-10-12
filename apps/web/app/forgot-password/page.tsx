'use client';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Enter a valid email address.');
      setSentMessage(body.message);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="eden-panel w-full max-w-sm p-8 space-y-5">
        <h1 className="font-serif text-2xl text-eden-gold-light text-center">Reset your password</h1>
        {sentMessage ? (
          <p className="text-sm text-eden-cream text-center">{sentMessage}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-eden-stone">Enter your account's email and we'll send you a link to choose a new password.</p>
            {error && <p className="text-sm text-eden-sunset text-center">{error}</p>}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
              required
            />
            <button type="submit" disabled={submitting} className="eden-btn-primary w-full disabled:opacity-50">
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-eden-stone">
          <a href="/login" className="text-eden-gold-light hover:underline">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
