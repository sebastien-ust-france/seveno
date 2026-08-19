import Image from 'next/image';
import Link from 'next/link';
import {
  SEVENO_LOGO_ALT,
  SEVENO_LOGO_HEIGHT,
  SEVENO_LOGO_SRC,
  SEVENO_LOGO_WIDTH,
} from '@/lib/branding';

const PUBLIC_FOOTER_LINKS = {
  seveno: [
    { href: '/', label: 'Accueil' },
    { href: '/candidats', label: 'Candidats' },
    { href: '/entreprises', label: 'Entreprises' },
    { href: '/observatoire', label: 'Observatoire' },
  ],
  project: [
    { href: '/etude', label: 'Étude' },
    { href: '/a-propos', label: 'À propos' },
    { href: '/contact', label: 'Contact' },
  ],
  information: [
    { href: '/mentions-legales', label: 'Mentions légales' },
    { href: '/cgu', label: 'CGU' },
    { href: '/cgv-entreprises', label: 'CGV Entreprises' },
    { href: '/confidentialite', label: 'Politique de confidentialité' },
    { href: '/cookies', label: 'Cookies' },
  ],
} as const;

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(4,10,24,0.96),rgba(3,8,20,0.99))]">
      <div className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1640px] gap-10 px-5 py-12 sm:w-[calc(100%-3rem)] sm:px-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] lg:w-[calc(100%-4rem)] lg:px-10 lg:py-14">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src={SEVENO_LOGO_SRC}
              alt={SEVENO_LOGO_ALT}
              width={SEVENO_LOGO_WIDTH}
              height={SEVENO_LOGO_HEIGHT}
              sizes="180px"
              className="h-10 w-auto"
            />
          </Link>
          <p className="max-w-sm text-base leading-7 text-slate-300">
            Une plateforme pensée pour mieux préparer la rencontre entre candidats et entreprises, tout en gardant
            l’étude publique à part.
          </p>
          <p className="text-sm text-slate-400">Seven&apos;O fait partie de l’écosystème UST-Workflow.</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white">Seven&apos;O</p>
          <div className="flex flex-col gap-2 text-[15px] leading-6 text-slate-300">
            {PUBLIC_FOOTER_LINKS.seveno.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white">Projet</p>
          <div className="flex flex-col gap-2 text-[15px] leading-6 text-slate-300">
            {PUBLIC_FOOTER_LINKS.project.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white">Informations</p>
          <div className="flex flex-col gap-2 text-[15px] leading-6 text-slate-300">
            {PUBLIC_FOOTER_LINKS.information.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
          <p className="pt-2 text-sm leading-6 text-slate-400">
            Contact :{' '}
            <a
              href="mailto:sebastien@seveno.eu"
              className="font-medium text-cyan-200 transition hover:text-cyan-100"
            >
              sebastien@seveno.eu
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-[calc(100%-2.5rem)] max-w-[1640px] flex-col gap-2 px-5 py-4 text-sm text-slate-500 sm:w-[calc(100%-3rem)] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:w-[calc(100%-4rem)] lg:px-10">
          <p>Seven&apos;O et UST-Workflow. Recrutement sans CV et étude publique distincte.</p>
          <p>Les informations personnelles restent protégées jusqu’au bon moment.</p>
        </div>
      </div>
    </footer>
  );
}
