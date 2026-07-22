import Image from 'next/image';
import Link from 'next/link';
import { PublicAccountActions } from '@/components/public/PublicAccountActions';
import { PublicMobileNavigation } from '@/components/public/PublicMobileNavigation';

const PUBLIC_NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/candidats', label: 'Candidats' },
  { href: '/entreprises', label: 'Entreprises' },
  { href: '/observatoire', label: 'Observatoire' },
  { href: '/etude', label: 'Étude' },
  { href: '/a-propos', label: 'À propos' },
] as const;

function PublicNavLinks() {
  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
      {PUBLIC_NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="whitespace-nowrap rounded-full px-4 py-2 text-[15px] text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[linear-gradient(180deg,rgba(2,8,23,0.98),rgba(2,8,23,0.9))] backdrop-blur">
      <div className="mx-auto flex h-[80px] w-[calc(100%-2.5rem)] max-w-[1640px] items-center gap-4 px-5 sm:w-[calc(100%-3rem)] sm:px-8 lg:w-[calc(100%-4rem)] lg:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Image
            src="/images/icone-tdb-seveno.png"
            alt="Seven’O"
            width={1254}
            height={1254}
            sizes="(max-width: 1024px) 44px, 52px"
            className="h-11 w-11 shrink-0 sm:h-12 sm:w-12 lg:h-[52px] lg:w-[52px]"
          />
          <div className="min-w-0 leading-none">
            <p className="whitespace-nowrap text-[18px] font-semibold tracking-[0.03em] text-slate-50 sm:text-[20px] lg:text-[24px]">
              <span className="text-white">Seven</span>
              <span className="text-amber-300">’</span>
              <span className="text-sky-400">O</span>
            </p>
            <p className="mt-1 whitespace-nowrap text-[8px] font-medium tracking-[0.22em] text-cyan-200/90 sm:text-[9px] lg:text-[10px]">
              Recrutement et observatoire des talents
            </p>
          </div>
        </Link>

        <div className="hidden flex-1 justify-center lg:flex">
          <PublicNavLinks />
        </div>

        <div className="hidden lg:block">
          <PublicAccountActions />
        </div>

        <PublicMobileNavigation links={PUBLIC_NAV_LINKS} />
      </div>
    </header>
  );
}
