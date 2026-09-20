import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';

const API_URL = process.env.API_URL || 'http://localhost:8000';

/**
 * Multi-user auth. Every path here (password, Google, Apple) ends the same
 * way: the FastAPI backend issues its own signed JWT ("backendToken") tied
 * to a real row in the users table. That backendToken, not the NextAuth
 * session itself, is what authorizes calls to the API -- this keeps the
 * backend provider-agnostic and lets the mobile app use the exact same
 * /auth/* endpoints without going through NextAuth at all.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });
        if (!res.ok) return null;
        const { token, user } = await res.json();
        return { id: String(user.id), email: user.email, name: user.name, backendToken: token };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      // next-auth generates the required JWT client secret itself from these
      // three fields -- do not pass a pre-built string here, and do not add
      // an "appleId" field, it's not part of the expected shape.
      clientSecret: {
        teamId: process.env.APPLE_TEAM_ID!,
        
        keyId: process.env.APPLE_KEY_ID!,
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, user }) {
      // Credentials provider already attached backendToken in authorize().
      if (user && (user as any).backendToken) {
        token.backendToken = (user as any).backendToken;
        return token;
      }
      // Google/Apple: exchange their id_token for our own backend JWT once,
      // right after the OAuth redirect completes.
      if (account?.provider === 'google' && account.id_token) {
        const res = await fetch(`${API_URL}/auth/oauth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: } as unknown as string,
                                JSON.stringify({ id_token: account.id_token }),
        });
        if (res.ok) {
          const { token: backendToken } = await res.json();
          token.backendToken = backendToken;
        }
      }
      if (account?.provider === 'apple' && account.id_token) {
        const res = await fetch(`${API_URL}/auth/oauth/apple`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: account.id_token }),
        });
        if (res.ok) {
          const { token: backendToken } = await res.json();
          token.backendToken = backendToken;
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).backendToken = token.backendToken;
      return session;
    },
  },
};
