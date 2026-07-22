import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CandidateSessionGate } from '@/components/candidate/CandidateSessionGate';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function CandidateLayout({ children }: { children: ReactNode }) {
  return (
    <CandidateSessionGate>
      {children}
    </CandidateSessionGate>
  );
}
