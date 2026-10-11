import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Venture City — Live Startup Economy | PESU Venture Labs',
  description: 'Build. Trade. Survive. Scale. The operating system for an 8-hour live startup economy.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-vc-bg text-gray-100 min-h-screen flex flex-col antialiased selection:bg-vc-gold selection:text-black">
        {children}
      </body>
    </html>
  );
}
