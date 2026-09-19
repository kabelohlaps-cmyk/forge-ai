'use client';
import { useSession, signOut } from 'next-auth/react';

export function AuthNav() {
  const { data: session, status } = useSession();

  return (
    <nav className="flex items-center gap-6 text-sm text-eden-sage">
      <a href="/modes" className="hover:text-eden-gold-light transition">Modes</a>
      <a href="/billing" className="hover:text-eden-gold-light transition">Plans</a>
      {status === 'authenticated' ? (
        <>
          <a href="/projects" className="hover:text-eden-gold-light transition">Projects</a>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="eden-btn text-xs py-1.5 px-4">
            Sign out
          </button>
        </>
      ) : (
        <a href="/login" className="eden-btn text-xs py-1.5 px-4">Sign in</a>
      )}
    </nav>
  );
}
