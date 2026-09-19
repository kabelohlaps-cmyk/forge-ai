'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || 'Could not create account.');
        setSubmitting(false);
        return;
      }
      // Account created -- now establish a normal session the same way login does.
      const signInRes = await signIn('credentials', { email, password, redirect: false });
      if (signInRes?.error) {
        setError('Account created, but sign-in failed. Try logging in.');
        setSubmitting(false);
        return;
      }
      router.push('/projects');
    } catch {
      setError('Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="eden-panel w-full max-w-sm p-8 space-y-5">
        <h1 className="font-serif text-2xl text-eden-gold-light text-center">Plant Your Seed</h1>

        <div className="space-y-2">
          <button onClick={() => signIn('google', { callbackUrl: '/projects' })} className="eden-btn w-full text-sm">
            Sign up with Google
          </button>
          <button onClick={() => signIn('apple', { callbackUrl: '/projects' })} className="eden-btn w-full text-sm">
            Sign up with Apple
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="eden-divider flex-1" />
          <span className="text-xs text-eden-stone">or</span>
          <div className="eden-divider flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-eden-sunset text-center">{error}</p>}
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
            required
          />
          <input
            type="password"
            placeholder="Password (min. 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
            required
          />
          <button type="submit" disabled={submitting} className="eden-btn-primary w-full disabled:opacity-50">
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-eden-stone">
          Already have an account? <a href="/login" className="text-eden-gold-light hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
