import type { SidebarNavigationItemConfig } from '@/types/seveno-navigation';

export const CANDIDATE_NAVIGATION: SidebarNavigationItemConfig[] = [
  { href: '/candidat', label: 'Tableau de bord', match: 'exact' },
  { href: '/candidat/onboarding', label: 'Mon profil' },
  { href: '/candidat/identite', label: 'Mon identité' },
  { href: '/candidat/recommandations', label: 'Recommandations' },
];

export const COMPANY_NAVIGATION: SidebarNavigationItemConfig[] = [
  { href: '/entreprise', label: 'Tableau de bord', match: 'exact' },
  { href: '/entreprise/onboarding', label: 'Mon entreprise' },
  { href: '/entreprise/offres', label: 'Mes offres' },
  { href: '/entreprise/demandes', label: 'Mises en relation' },
];

export const ADMIN_NAVIGATION: SidebarNavigationItemConfig[] = [
  { href: '/admin', label: 'Tableau de bord', match: 'exact' },
  { href: '/admin/evaluation-seveno', label: 'Analyse professionnelle' },
  { href: '/admin/etude', label: 'Etude' },
  { href: '/admin/candidats', label: 'Candidats' },
  { href: '/admin/entreprises', label: 'Entreprises' },
  { href: '/admin/tests', label: 'Tests' },
  { href: '/admin/recommandations', label: 'Recommandations' },
  { href: '/admin/prerequis', label: 'Prerequis' },
  { href: '/admin/mises-en-relation', label: 'Mises en relation' },
  { href: '/admin/journal', label: 'Journal' },
];
