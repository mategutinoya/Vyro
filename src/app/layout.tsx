import '@fontsource-variable/inter';
import './globals.css';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'Vyro · Tu nutricionista con IA', template: '%s · Vyro' },
  description: 'Planes de comida personalizados, registro inteligente y seguimiento semanal con un nutricionista virtual.',
  applicationName: 'Vyro',
  appleWebApp: { capable: true, title: 'Vyro', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
