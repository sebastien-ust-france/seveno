import type { Metadata } from 'next';
import { StudyQuestionnaire } from '@/components/StudyQuestionnaire';

export const metadata: Metadata = {
  title: "Seven'O - Étude de marché",
  alternates: {
    canonical: '/etude',
  },
  description: "Questionnaire public distinct de la plateforme Seven'O.",
};

export default function EtudePage() {
  return <StudyQuestionnaire />;
}
