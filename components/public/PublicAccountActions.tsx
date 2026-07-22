import Link from 'next/link';

function actionBaseClasses(variant: 'primary' | 'secondary') {
  const shared =
    'inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817] sm:min-w-[8.5rem]';

  if (variant === 'primary') {
    return (
      shared +
      ' border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/35 hover:bg-cyan-400/15 focus-visible:ring-cyan-300/60'
    );
  }

  return (
    shared +
    ' border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10 focus-visible:ring-white/40'
  );
}

export function PublicAccountActions() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/connexion" className={actionBaseClasses('secondary')}>
        Se connecter
      </Link>
      <Link href="/connexion" className={actionBaseClasses('primary')}>
        Créer mon profil
      </Link>
    </div>
  );
}
