import type { Metadata } from 'next';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { CompanySalesTermsPrintButton } from '@/components/public/legal/CompanySalesTermsPrintButton';

type Article = { title: string; paragraphs?: string[]; bullets?: string[] };

export const metadata: Metadata = {
  title: 'Conditions générales de vente — Seven’O Entreprises',
  description: 'Conditions commerciales applicables aux services payants Seven’O destinés aux Entreprises.',
  alternates: { canonical: '/cgv-entreprises' },
};

const ARTICLES: Article[] = [
  { title: '1. Objet et champ d’application', paragraphs: [
    'Les présentes Conditions générales de vente, ci-après « CGV », régissent les services payants proposés aux Entreprises par Seven’O.',
    'Seven’O est édité et exploité par UST-WORKFLOW, société par actions simplifiée unipersonnelle au capital de 500 euros, dont le siège social est situé 69 rue Georges Clemenceau, 33530 Bassens, immatriculée au Registre du commerce et des sociétés de Bordeaux sous le numéro 103 480 349.',
    'Les présentes CGV complètent les Conditions générales d’utilisation de Seven’O.',
    'Elles s’appliquent aux achats de crédits de recrutement, packs de crédits, prolongations de campagne et capacités additionnelles proposés aux Entreprises sur Seven’O.',
    'En cas de contradiction entre les CGU et les présentes CGV concernant une condition commerciale ou financière, les présentes CGV prévalent pour leur objet spécifique.',
    'Les services destinés aux Candidats sont gratuits et ne sont pas concernés par les présentes CGV.',
  ] },
  { title: '2. Définitions', paragraphs: [
    '« Entreprise » : toute organisation autorisée à utiliser les services de recrutement de Seven’O.',
    '« Crédit de recrutement » : droit permettant d’activer une campagne de recrutement dans les conditions prévues par les présentes CGV.',
    '« Campagne » : période ouverte à compter de la première publication d’une Offre et de l’activation correspondante du recrutement.',
    '« Capacité de campagne » : nombre maximal de candidats qualifiés pouvant être pris en compte dans une campagne selon l’offre commerciale applicable.',
    '« Option » : service complémentaire acheté pour une campagne, notamment une prolongation de durée ou une augmentation de capacité.',
  ] },
  { title: '3. Tarifs Seven’O Entreprises', paragraphs: ['Les tarifs de lancement de Seven’O sont les suivants :'], bullets: [
    '1 crédit de recrutement : 390 € HT ;', 'pack de 3 crédits de recrutement : 990 € HT ;', 'pack de 10 crédits de recrutement : 2 990 € HT ;', 'prolongation d’une campagne de 30 jours : 90 € HT ;', 'augmentation de capacité de 10 candidats qualifiés : 190 € HT.',
  ] },
  { title: '', paragraphs: [
    'Les taxes et la TVA légalement applicables sont ajoutées au prix hors taxes lors du paiement.',
    'Seven’O fonctionne sans abonnement, sans renouvellement automatique et sans commission liée à une embauche.',
    'Les modifications futures de tarifs n’affectent pas les crédits ou options déjà achetés.',
  ] },
  { title: '4. Commande et paiement', paragraphs: [
    'Les achats réalisés directement sur Seven’O sont payables comptant par carte bancaire au moyen de la solution de paiement Stripe.',
    'Le prix, le produit acheté et les taxes applicables sont présentés à l’Entreprise avant la validation du paiement.',
    'La commande n’est considérée comme payée qu’après confirmation effective du paiement.',
    'Un paiement refusé, annulé, expiré ou non confirmé ne donne lieu à aucune attribution de crédit ou d’option.',
    'Une facture est mise à disposition de l’Entreprise pour les opérations facturées.',
    'Aucun escompte n’est accordé pour paiement anticipé.',
    'Lorsqu’une somme demeure exceptionnellement exigible après son échéance, des pénalités de retard sont applicables de plein droit, sans rappel préalable, au taux de la Banque centrale européenne applicable à son opération de refinancement la plus récente majoré de dix points de pourcentage, sans pouvoir être inférieur au minimum légal.',
    'Tout professionnel en situation de retard de paiement est également redevable de plein droit d’une indemnité forfaitaire de 40 euros pour frais de recouvrement. Lorsque les frais de recouvrement exposés sont supérieurs à cette somme, une indemnisation complémentaire peut être demandée sur justification.',
  ] },
  { title: '5. Acceptation des CGV', paragraphs: [
    'Avant l’accès au paiement lorsqu’une acceptation est requise, le Représentant de l’Entreprise doit pouvoir consulter, imprimer et enregistrer les présentes CGV.',
    'Leur acceptation résulte d’une action positive. Aucune case d’acceptation ne doit être précochée.',
    'Seven’O enregistre notamment la version acceptée, la date et l’heure serveur de l’acceptation, l’Entreprise concernée et l’identifiant du Représentant ayant effectué l’acceptation.',
    'Le Représentant déclare disposer de l’habilitation nécessaire pour accepter les présentes CGV au nom de l’Entreprise.',
    'Lorsqu’une nouvelle version des CGV nécessite une nouvelle acceptation, l’accès à un nouvel achat peut être conditionné à cette acceptation.',
  ] },
  { title: '6. Validité des crédits de recrutement', paragraphs: [
    'Les crédits de recrutement achetés sont valables pendant 24 mois à compter de la confirmation de leur paiement.',
    'Les crédits provenant d’un même achat ou d’un même pack disposent de la même date d’expiration.',
    'Les crédits disponibles sont utilisés en priorité du plus ancien au plus récent.',
    'À l’expiration de leur période de validité, les crédits achetés qui n’ont pas été utilisés deviennent indisponibles et ne donnent lieu à aucun remboursement, sous réserve des dispositions légales impératives.',
    'L’expiration d’un crédit n’interrompt jamais une campagne déjà activée avec ce crédit. Dès l’activation d’une campagne, les règles de durée propres à cette campagne s’appliquent.',
  ] },
  { title: '7. Activation et durée d’une campagne', paragraphs: [
    'Un crédit de recrutement est consommé lors de la première publication de l’Offre et de l’activation de la campagne correspondante.',
    'Une campagne standard est ouverte pour une durée de 60 jours.',
    'Une campagne dispose initialement d’une capacité maximale de 20 candidats qualifiés.',
    'Seven’O peut présenter simultanément à l’Entreprise jusqu’à 5 dossiers nécessitant sa décision.',
    'Lorsqu’un dossier est refusé dans les conditions prévues par Seven’O, la place correspondante peut être libérée afin de permettre la présentation d’un autre dossier.',
  ] },
  { title: '8. Options de campagne', paragraphs: [
    'Une prolongation achetée au tarif applicable ajoute 30 jours à la durée de la campagne concernée.',
    'Une augmentation de capacité achetée au tarif applicable ajoute une capacité maximale de 10 candidats qualifiés à la campagne concernée.',
    'L’achat d’une capacité additionnelle augmente uniquement la capacité maximale de la campagne. Il ne constitue pas une garantie que ce nombre de candidats existe, corresponde à l’Offre, soit disponible ou termine le parcours de qualification.',
  ] },
  { title: '9. Absence de garantie de recrutement', paragraphs: [
    'Seven’O fournit un service de recrutement, de qualification, de mise en relation et d’aide à la décision dans le cadre d’une obligation de moyens.',
    'Seven’O ne garantit aucun nombre minimal de candidatures ou de candidats qualifiés pour une Offre.',
    'La capacité indiquée pour une campagne constitue un maximum de traitement et non un engagement de remplissage.',
    'Seven’O ne garantit ni la disponibilité d’un candidat déterminé, ni l’acceptation d’une mise en relation, ni la réalisation d’un entretien, ni la conclusion d’un contrat de travail ou d’une collaboration.',
    'Les décisions de recrutement restent de la responsabilité de l’Entreprise et du Candidat concernés.',
  ] },
  { title: '10. Annulation et remboursement', paragraphs: ['Les achats de crédits, packs, prolongations et capacités additionnelles sont fermes.', 'Ils ne donnent lieu à aucun remboursement du fait :'], bullets: [
    'de l’absence d’embauche ;', 'de l’arrêt ou de l’abandon du recrutement par l’Entreprise ;', 'de la non-utilisation ou de l’utilisation partielle des crédits achetés ;', 'de l’expiration d’un crédit arrivé au terme de sa période de validité de 24 mois ;', 'de la non-utilisation ou de l’utilisation partielle d’une option achetée ;', 'du fait que la capacité maximale d’une campagne n’a pas été atteinte ;', 'du nombre insuffisant de candidats correspondant aux conditions de l’Offre ;', 'du refus d’un Candidat de poursuivre une mise en relation.',
  ] },
  { title: '', paragraphs: [
    'Ces dispositions s’appliquent sous réserve des règles légales impératives.',
    'Elles ne font notamment pas obstacle au remboursement ou à la régularisation d’un encaissement indu, d’un paiement effectué en double ou d’une opération dans laquelle un manquement imputable à Seven’O rend impossible l’exécution de la prestation achetée.',
  ] },
  { title: '11. Responsabilité de l’Entreprise', paragraphs: [
    'L’Entreprise reste responsable de la réalité de son besoin de recrutement, du contenu de ses Offres, des critères et prérequis qu’elle définit ainsi que des décisions qu’elle prend.',
    'Elle s’engage à utiliser les crédits, campagnes et options conformément aux CGU, aux présentes CGV et à l’objet de Seven’O.',
  ] },
  { title: '12. Suspension', paragraphs: [
    'UST-WORKFLOW peut suspendre ou limiter l’utilisation des services payants lorsqu’une Entreprise enfreint les CGU, les présentes CGV, les règles de sécurité de Seven’O ou les dispositions légales applicables.',
    'Une suspension destinée à prévenir une fraude, une atteinte à la sécurité ou un usage manifestement abusif ne constitue pas en elle-même une annulation des obligations contractuelles déjà nées.',
  ] },
  { title: '13. Preuve des opérations', paragraphs: [
    'Les enregistrements conservés par Seven’O et ses prestataires techniques peuvent contribuer à établir la preuve des opérations réalisées.',
    'Cela comprend notamment les acceptations de CGV, horodatages serveur, commandes, confirmations de paiement, attributions de crédits, consommations de crédits, activations de campagne et achats d’options.',
  ] },
  { title: '14. Évolution des CGV', paragraphs: [
    'UST-WORKFLOW peut modifier les présentes CGV pour les achats futurs afin de tenir compte notamment d’une évolution du service, des tarifs, de la réglementation ou du fonctionnement de Seven’O.',
    'Une modification des CGV n’a pas pour effet de réduire rétroactivement la durée de validité ou les droits attachés à un crédit ou une option déjà acheté.',
    'Lorsqu’une nouvelle version nécessite une acceptation, celle-ci est demandée avant un nouvel achat concerné.',
  ] },
  { title: '15. Droit applicable et réclamations', paragraphs: [
    'Les présentes CGV sont soumises au droit français.',
    'En cas de difficulté, l’Entreprise et UST-WORKFLOW sont invités à rechercher une solution amiable avant toute action contentieuse.',
    'À défaut de résolution amiable, les règles légales de compétence territoriale et matérielle s’appliquent.',
  ] },
];

export default function CompanySalesTermsPage() {
  return <PublicSiteShell><div className="space-y-10">
    <style>{`@media print { header, footer, nav, button, [data-cgv-no-print='true'] { display:none!important; } main { padding:0!important;width:100%!important;max-width:none!important; } body { background:#fff!important;color:#000!important; } a { color:#000!important;text-decoration:none!important; } }`}</style>
    <section className="rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Conditions générales de vente</p><h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Conditions générales de vente — Seven’O Entreprises</h1></div><CompanySalesTermsPrintButton /></div>
      <p className="mt-5 text-sm text-slate-300">Version 1.0 — Entrée en vigueur : 10 août 2026 — Éditeur : UST-WORKFLOW</p>
    </section>
    <section className="space-y-8">{ARTICLES.map((article, index) => <article key={`${article.title}-${index}`} className={article.title ? 'border-t border-white/10 pt-8' : '-mt-4'}>{article.title ? <h2 className="text-2xl font-semibold text-white">{article.title}</h2> : null}<div className="mt-5 space-y-4 text-[15px] leading-8 text-slate-300 sm:text-[17px]">{article.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{article.bullets ? <ul className="space-y-3">{article.bullets.map((bullet) => <li key={bullet} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">{bullet}</li>)}</ul> : null}</div></article>)}</section>
  </div></PublicSiteShell>;
}
