import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://seveno.eu'),
  title: 'Seven’O — Le recrutement autrement',
  description: 'Le bon recrutement ne commence pas par une pile de CV. Il commence par une rencontre qui a du sens.',
  openGraph: {
    title: 'Seven’O — Le recrutement autrement',
    description: 'Le bon recrutement ne commence pas par une pile de CV. Il commence par une rencontre qui a du sens.',
    url: 'https://seveno.eu',
    siteName: 'Seven’O',
    type: 'website',
    locale: 'fr_FR',
    images: [
      {
        url: 'https://seveno.eu/images/logo-seveno.png',
        width: 1774,
        height: 887,
        alt: 'Seven’O — Le recrutement autrement',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seven’O — Le recrutement autrement',
    description: 'Le bon recrutement ne commence pas par une pile de CV. Il commence par une rencontre qui a du sens.',
    images: ['https://seveno.eu/images/logo-seveno.png'],
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
