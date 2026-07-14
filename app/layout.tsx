import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'SEVENO',
  description: 'Plateforme europeenne dediee a la disponibilite des competences.',
  icons: {
    icon: [
      {
        url: '/images/favicon-seveno.png',
        type: 'image/png',
      },
    ],
    shortcut: '/images/favicon-seveno.png',
    apple: '/images/favicon-seveno.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
