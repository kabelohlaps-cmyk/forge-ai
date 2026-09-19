'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/projects');
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="eden-panel w-full max-w-sm p-8 space-y-5">
        <h1 className="font-serif text-2xl text-eden-gold-light text-center">Enter the Garden</h1>

        <div className="space-y-2">
          <button onClick={() => signIn('google', { callbackUrl: '/projects' })} className="eden-btn w-full text-sm">
            Continue with Google
          </button>
          <button onClick={() => signIn('apple', { callbackUrl: '/projects' })} className="eden-btn w-full text-sm">
            Continue with Apple
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
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
            required
          />
          <button type="submit" className="eden-btn-primary w-full">Sign in</button>
        </form>

        <p className="text-center text-sm text-eden-stone">
          New here? <a href="/signup" className="text-eden-gold-light hover:underline">Create an account</a>
        </p>
      </div>
    </div>
  );
}
