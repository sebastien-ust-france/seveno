import type { Metadata } from 'next';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';

export const metadata: Metadata = {
  title: "Seven'O - Cookies",
  alternates: {
    canonical: '/cookies',
  },
  description: "Informations sur les cookies Seven'O.",
};

export default function CookiesPage() {
  return (
    <PublicSiteShell>
      <div className="space-y-10">
        <section className="rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Cookies</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Gestion des cookies</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Cette page précisera les cookies et les traceurs utilisés par Seven&apos;O lorsque la documentation finale
            sera prête. Le site ne présente pas de faux dispositifs de suivi.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-orange-200/85">Utilisation</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Les cookies nécessaires au fonctionnement du site et à l&apos;authentification seront listés ici.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-blue-200/85">Options</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Pour toute question sur les réglages, contactez-nous à{' '}
              <a href="mailto:sebastien@seveno.eu" className="text-cyan-200 transition hover:text-cyan-100">
                sebastien@seveno.eu
              </a>
              .
            </p>
          </article>
        </section>
      </div>
    </PublicSiteShell>
  );
}
