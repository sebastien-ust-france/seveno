import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTH_FORBIDDEN_FRAGMENTS = [
  'firebase/auth',
  'firebase/firestore',
  'firebase/messaging',
  'GoogleAuthProvider',
  'signInWithPopup',
  'signInWithRedirect',
  'getRedirectResult',
  'authStateReady',
  'getCurrentAuthUser',
  'getSevenoUser',
  'requestIdleCallback',
] as const;

const PUBLIC_PURE_PAGES = [
  'app/page.tsx',
  'app/candidats/page.tsx',
  'app/entreprises/page.tsx',
  'app/observatoire/page.tsx',
  'app/etude/page.tsx',
  'app/comment-ca-marche/page.tsx',
  'app/a-propos/page.tsx',
  'app/contact/page.tsx',
  'app/mentions-legales/page.tsx',
  'app/cgu/page.tsx',
  'app/confidentialite/page.tsx',
  'app/cookies/page.tsx',
] as const;

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertContains(relativePath: string, fragments: readonly string[]) {
  const source = readSource(relativePath);
  for (const fragment of fragments) {
    assert.match(source, new RegExp(escapeRegExp(fragment)));
  }
}

function assertDoesNotContain(relativePath: string, fragments: readonly string[]) {
  const source = readSource(relativePath);
  for (const fragment of fragments) {
    assert.doesNotMatch(source, new RegExp(escapeRegExp(fragment)));
  }
}

function assertPublicPurePageIsClean(relativePath: string) {
  assertDoesNotContain(relativePath, AUTH_FORBIDDEN_FRAGMENTS);
}

export function assertPublicAuthIsolation() {
  assertContains('components/public/PublicAccountActions.tsx', [
    'Se connecter',
    'Créer mon profil',
    'href="/connexion"',
  ]);
  assertDoesNotContain('components/public/PublicAccountActions.tsx', [
    'useEffect',
    'useState',
    ...AUTH_FORBIDDEN_FRAGMENTS,
  ]);

  assertDoesNotContain('components/public/PublicSiteHeader.tsx', AUTH_FORBIDDEN_FRAGMENTS);
  assertContains('components/public/PublicSiteHeader.tsx', ['PublicAccountActions', 'PublicMobileNavigation']);

  assertDoesNotContain('components/public/PublicMobileNavigation.tsx', AUTH_FORBIDDEN_FRAGMENTS);
  assertContains('components/public/PublicMobileNavigation.tsx', [
    'usePathname',
    'isMobileMenuOpen',
    'closeMobileMenu',
    'toggleMobileMenu',
    'toggleButtonRef',
    'fixed inset-x-0 top-[80px]',
    'h-[calc(100dvh-80px)]',
    'overflow-y-auto',
    'overscroll-contain',
    'backdrop-blur-[2px]',
    'safe-area-inset-bottom',
    'document.body.style.overflow = ',
    'document.documentElement.style.overflow = ',
    'Fermer',
    'Se connecter',
    'Créer mon profil',
    'public-site-mobile-menu',
  ]);

  for (const routeFile of PUBLIC_PURE_PAGES) {
    assertPublicPurePageIsClean(routeFile);
  }

  assertContains('app/connexion/page.tsx', [
    'getCurrentAuthUser',
    'signInWithGoogle',
    'resolveSevenoRedirect',
  ]);

  console.log('Public auth isolation smoke test: OK');
}

export function assertPublicPerformanceArchitecture() {
  assertPublicAuthIsolation();

  const homeSource = readSource('app/page.tsx');
  assert.match(homeSource, /export const revalidate = 900;/);
  assert.doesNotMatch(homeSource, /dynamic\s*=\s*['"]force-dynamic['"]/);
  assertContains('app/page.tsx', [
    'PublicSiteShell',
    'getPublicStudyResponseCount',
  ]);

  console.log('Public performance architecture smoke test: OK');
}
