export { default } from 'next-auth/middleware';

// Multi-user app: the marketing pages (home, modes, pricing) stay public so
// visitors can see the product before signing up. Only the actual workspace
// -- projects and the dashboard -- requires a logged-in session.
export const config = {
  matcher: ['/projects/:path*', '/dashboard/:path*'],
};
