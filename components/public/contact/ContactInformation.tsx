const CONTACT_INFORMATION_ITEMS = [
  {
    title: 'Adresse email',
    content: (
      <a href="mailto:contact@ust-france.com" className="font-medium text-cyan-200 transition hover:text-cyan-100">
        contact@ust-france.com
      </a>
    ),
  },
  {
    title: 'Pour une demande candidat',
    content:
      'Indiquez l’adresse utilisée pour votre compte, la page concernée et le message d’erreur rencontré, sans transmettre votre mot de passe.',
  },
  {
    title: 'Pour un accès entreprise',
    content:
      'Précisez le nom de l’organisation, son activité, le besoin de recrutement envisagé et les coordonnées de la personne qui utilisera Seven’O.',
  },
  {
    title: 'Pour une recommandation',
    content:
      'Indiquez si vous êtes le candidat ou le recommandant et précisez l’état du lien : reçu, expiré, révoqué ou déjà utilisé.',
  },
  {
    title: 'Sécurité',
    content:
      'Ne transmettez jamais votre mot de passe, un code de connexion ou une copie complète d’un document d’identité dans ce formulaire.',
  },
] as const;

export function ContactInformation() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,13,26,0.98),rgba(5,10,21,0.95))] p-6 shadow-[0_18px_80px_rgba(2,6,23,0.25)] sm:p-7">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200/85">CONTACTER SEVEN’O</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
        Les informations utiles avant l’envoi.
      </h2>

      <div className="mt-6 space-y-3">
        {CONTACT_INFORMATION_ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 shadow-[0_12px_40px_rgba(2,6,23,0.12)]"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">{item.title}</p>
            <div className="mt-2 text-sm leading-7 text-slate-300">{item.content}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
