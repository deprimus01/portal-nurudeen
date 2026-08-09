import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '../lib/auth-context';
import { ThemeProvider } from '../lib/theme-context';
import { LanguageProvider } from '../lib/i18n/language-context';
import { ServiceWorkerRegistrar } from '../components/ServiceWorkerRegistrar';
import './globals.css';

// Every page in this app is client-rendered behind an auth check anyway, so
// there's little to gain from static prerendering - and it's required here:
// a nonce-based CSP (see middleware.ts) can only be embedded in HTML that's
// rendered per-request, not in a build-time-cached static page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nuruddeen Schools Gusau - Portal',
  description: 'Student records, attendance, results, and fees for Nuruddeen Schools Gusau.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#10367D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lexend:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>{children}</AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
