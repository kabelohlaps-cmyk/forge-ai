import type { Metadata } from 'next';
import './globals.css';
import { VerseBalloon, EdenTreeLockup } from '@forge/ui';
import { Providers } from '../components/Providers';
import { AuthNav } from '../components/AuthNav';

export const metadata: Metadata = {
  title: 'FORGE AI — Design in Eden',
  description: 'AI design agent',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="sticky top-0 z-30 border-b border-eden-sage/10 bg-eden-deep/70 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
              <a href="/"><EdenTreeLockup size={44} /></a>
              <AuthNav />
            </div>
          </header>
          <VerseBalloon />
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
          <footer className="mt-20 border-t border-eden-sage/10 py-8 text-center text-xs text-eden-stone">
            <p className="eden-verse">"He has made everything beautiful in its time."</p>
            <p className="mt-2">FORGE AI · Design in Eden</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
