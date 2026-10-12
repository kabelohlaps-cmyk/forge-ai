import type { Metadata } from 'next';

// The token is in this page's URL; never send it on to other sites in a Referer header.
export const metadata: Metadata = { referrer: 'no-referrer' };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
