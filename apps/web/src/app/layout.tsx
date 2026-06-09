import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DevComms AI — Automated Developer Changelogs',
  description:
    'AI-powered changelog generation from your git history. Automated, categorized, and ready to publish.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
