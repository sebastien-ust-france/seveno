import type { Metadata } from 'next';
import Link from 'next/link';
import { CguAcceptancePanel } from '@/components/legal/CguAcceptancePanel';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';

type LegalArticle = {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation — Seven’O',
  description: 'Consultez les règles applicables aux candidats, aux entreprises, aux recommandations, aux questionnaires et aux mises en relation sur Seven’O.',
  alternates: {
    canonical: '/cgu',
  },
};

const ARTICLES: LegalArticle[] = [
  {
    id: 'article-1',
    number: '1.',
    title: 'Éditeur et objet de Seven’O',
    paragraphs: [
      `Seven’O est édité et exploité par UST-WORKFLOW, société par actions simplifiée unipersonnelle au capital de 500 euros, dont le siège social est situé 69 rue Georges Clemenceau, 33530 Bassens, immatriculée au Registre du commerce et des sociétés de Bordeaux sous le numéro 103 480 349.`,
      `Seven’O est une plateforme destinée à mieux préparer la rencontre entre des professionnels et des entreprises. Elle permet notamment de structurer des profils professionnels, des offres, des prérequis, des questionnaires, des recommandations, des candidatures, des validations de mise en relation et des échanges entre utilisateurs.`,
      `Seven’O comprend également une étude publique et un observatoire destinés à mieux comprendre les attentes des professionnels et les besoins des entreprises.`,
      `Seven’O ne constitue ni une entreprise de travail temporaire, ni un employeur, ni le représentant du candidat ou de l’entreprise dans la conclusion d’un contrat de travail.`,
    ],
  },
  {
    id: 'article-2',
    number: '2.',
    title: 'Définitions',
    paragraphs: [],
    bullets: [
      `« Seven’O » ou « la Plateforme » : le site, les interfaces, les services et les fonctionnalités exploités sous la marque Seven’O.`,
      `« UST-WORKFLOW » ou « l’Éditeur » : la société éditrice et exploitante de Seven’O.`,
      `« Utilisateur » : toute personne qui consulte ou utilise Seven’O, avec ou sans compte.`,
      `« Candidat » : toute personne physique utilisant Seven’O afin de présenter son profil professionnel, sa recherche, sa disponibilité ou une candidature.`,
      `« Entreprise » : toute personne morale, entreprise individuelle, cabinet de recrutement, agence, association ou organisation autorisée à accéder aux services de recrutement de Seven’O.`,
      `« Représentant de l’Entreprise » : la personne physique autorisée à utiliser Seven’O pour le compte d’une Entreprise.`,
      `« Recommandant » : toute personne invitée à transmettre une recommandation professionnelle concernant un Candidat.`,
      `« Compte » : l’espace personnel créé ou autorisé pour accéder aux services authentifiés.`,
      `« Profil candidat » : l’ensemble des informations professionnelles présentées dans le parcours Seven’O, distinct des données d’identité privées.`,
      `« Offre » : la présentation d’un besoin réel de recrutement créée sous la responsabilité d’une Entreprise.`,
      `« Prérequis » : les critères obligatoires ou complémentaires associés à une Offre.`,
      `« Questionnaire Seven’O » : l’évaluation générale destinée à enrichir la lecture du profil professionnel du Candidat.`,
      `« Questionnaire entreprise » : le questionnaire préparé par une Entreprise pour évaluer des connaissances ou situations liées à une Offre précise.`,
      `« Recommandation » : le témoignage professionnel transmis par un Recommandant à partir d’un lien sécurisé.`,
      `« Mise en relation » : le processus permettant à un Candidat et à une Entreprise de confirmer leur volonté de poursuivre avant l’ouverture complète de l’échange.`,
      `« Contenu » : toute information, offre, réponse, questionnaire, recommandation, message, texte ou donnée transmise sur Seven’O.`,
    ],
  },
  {
    id: 'article-3',
    number: '3.',
    title: 'Champ d’application',
    paragraphs: [
      `Les présentes Conditions générales d’utilisation s’appliquent au site public Seven’O, aux espaces authentifiés, aux formulaires publics liés aux recommandations et, plus généralement, à toute fonctionnalité qui y renvoie expressément.`,
      `Certaines fonctionnalités peuvent être soumises à des règles particulières affichées avant leur utilisation. Ces règles particulières complètent les présentes CGU.`,
      `Les services payants proposés aux Entreprises sont également soumis aux conditions commerciales ou contractuelles acceptées par l’Entreprise.`,
      `En cas de contradiction, les conditions particulières ou commerciales prévalent pour leur objet spécifique, sans écarter les règles générales d’utilisation de Seven’O.`,
    ],
  },
  {
    id: 'article-4',
    number: '4.',
    title: 'Acceptation des CGU',
    paragraphs: [
      `L’Utilisateur doit pouvoir consulter les présentes CGU avant leur acceptation, les imprimer et les enregistrer sur un support durable.`,
      `L’acceptation des CGU doit résulter d’une action positive de l’Utilisateur. Une case précochée ou la simple consultation du site ne constitue pas une acceptation des CGU applicables aux espaces authentifiés.`,
      `Lorsqu’une acceptation est requise, Seven’O enregistre la version acceptée, la date et l’heure de l’acceptation ainsi que l’identifiant du compte ou de la transmission concernée.`,
      `Une nouvelle acceptation peut être demandée lorsqu’une évolution substantielle des CGU modifie les droits ou obligations des Utilisateurs.`,
      `L’Utilisateur qui refuse les CGU ne peut pas accéder aux fonctionnalités nécessitant leur acceptation.`,
    ],
  },
  {
    id: 'article-5',
    number: '5.',
    title: 'Capacité et habilitation',
    paragraphs: [
      `L’Utilisateur déclare disposer de la capacité juridique nécessaire pour utiliser Seven’O et accepter les présentes CGU.`,
      `Le Représentant d’une Entreprise déclare être autorisé à agir au nom de l’organisation renseignée et à engager celle-ci dans l’utilisation de Seven’O.`,
      `UST-WORKFLOW peut demander tout justificatif permettant de vérifier l’identité, la capacité, l’existence de l’Entreprise ou l’habilitation de son représentant.`,
      `L’accès peut être refusé, limité ou suspendu lorsque les informations transmises sont insuffisantes, incohérentes, frauduleuses ou non vérifiables.`,
    ],
  },
  {
    id: 'article-6',
    number: '6.',
    title: 'Création et sécurité du Compte',
    paragraphs: [
      `Chaque Utilisateur ne peut créer que les Comptes nécessaires à son usage légitime de Seven’O.`,
      `Les informations fournies lors de la création ou de la mise à jour du Compte doivent être exactes, complètes et maintenues à jour.`,
      `L’Utilisateur est responsable de la confidentialité de ses moyens d’authentification et des opérations réalisées depuis son Compte, sauf utilisation frauduleuse ne résultant pas de son fait.`,
    ],
  },
  {
    id: 'article-7',
    number: '7.',
    title: 'Services destinés aux Candidats',
    paragraphs: [
      `Seven’O permet au Candidat de créer un profil professionnel anonyme, d’indiquer ses métiers recherchés, sa disponibilité, sa zone, ses informations d’identité privée et ses préférences de parcours.`,
      `Le Candidat peut compléter un questionnaire Seven’O, gérer des recommandations professionnelles et suivre les éléments utiles à la préparation de sa rencontre avec des Entreprises.`,
      `Les éléments visibles par les Entreprises restent limités à la projection anonyme et aux informations autorisées par le Candidat ou par les présentes CGU.`,
    ],
  },
  {
    id: 'article-8',
    number: '8.',
    title: 'Obligations des Candidats',
    paragraphs: [
      `Le Candidat s’engage à fournir des informations exactes, à ne pas masquer volontairement des éléments indispensables à la compréhension de son profil et à respecter les autres Utilisateurs.`,
      `Le Candidat ne doit pas publier de faux profils, de contenu trompeur ou de renseignement portant atteinte aux droits de tiers.`,
      `Le Candidat reste responsable des informations qu’il choisit de rendre visibles et des conséquences de ses réponses, dans le cadre des présentes CGU et de la loi.`,
    ],
  },
  {
    id: 'article-9',
    number: '9.',
    title: 'Accès des Entreprises',
    paragraphs: [
      `L’accès aux fonctions Entreprise peut être réservé, contrôlé, limité ou conditionné à une habilitation préalable.`,
      `L’Entreprise ne voit que les profils anonymes, les éléments utiles au recrutement et les informations qu’un Candidat a rendues visibles ou que les présentes CGU autorisent.`,
      `L’accès au profil entreprise, aux offres, aux questionnaires et aux mises en relation suppose le respect des présentes CGU et des conditions particulières applicables.`,
    ],
  },
  {
    id: 'article-10',
    number: '10.',
    title: 'Obligations des Entreprises',
    paragraphs: [
      `L’Entreprise s’engage à ne publier que des offres réelles, à préciser des besoins sérieux de recrutement et à utiliser Seven’O conformément à son objet.`,
      `L’Entreprise doit respecter la confidentialité, l’anonymat, les règles de mise en relation, les règles relatives aux questionnaires et les droits des Candidats.`,
      `L’Entreprise reste responsable des contenus qu’elle publie, des critères qu’elle définit et des décisions qu’elle prend.`,
    ],
  },
  {
    id: 'article-11',
    number: '11.',
    title: 'Questionnaire Seven’O',
    paragraphs: [
      `Le questionnaire Seven’O est une évaluation générale destinée à enrichir la lecture du profil professionnel du Candidat.`,
      `Il doit rester distinct d’une Offre précise, d’un questionnaire d’Entreprise et de toute autre évaluation ciblée.`,
      `Ses résultats servent à mieux comprendre un parcours, une disponibilité ou une manière de travailler, sans remplacer une décision humaine de recrutement.`,
    ],
  },
  {
    id: 'article-12',
    number: '12.',
    title: 'Questionnaire propre à une Offre',
    paragraphs: [
      `Une Entreprise peut associer à une Offre un questionnaire propre à son besoin, sous sa responsabilité.`,
      `Ce questionnaire évalue des critères liés au poste, aux pratiques de l’entreprise ou à des situations concrètes liées à l’offre concernée.`,
      `Il reste distinct des prérequis, du questionnaire Seven’O et de toute autre fonctionnalité générale de la Plateforme.`,
    ],
  },
  {
    id: 'article-13',
    number: '13.',
    title: 'Résultats et seuils',
    paragraphs: [
      `Les résultats d’un questionnaire, les seuils de réussite, les statuts et les indicateurs associés sont des outils de lecture.`,
      `Ils ne constituent pas une garantie d’embauche, une validation automatique d’un profil ou une décision finale de recrutement.`,
      `L’Entreprise reste décisionnaire de la suite à donner, dans le respect des présentes CGU et de la loi.`,
    ],
  },
  {
    id: 'article-14',
    number: '14.',
    title: 'Anonymat et intérêt mutuel',
    paragraphs: [
      `Seven’O repose sur une lecture anonyme des profils candidats par les Entreprises tant que le Candidat n’a pas accepté une mise en relation.`,
      `L’intérêt mutuel permet de présenter des signaux utiles avant l’échange complet, sans exposer d’identité privée inutilement.`,
      `L’anonymat ne vise pas à cacher indéfiniment un candidat, mais à organiser une rencontre plus juste et plus progressive.`,
    ],
  },
  {
    id: 'article-15',
    number: '15.',
    title: 'Recommandations professionnelles',
    paragraphs: [
      `Une recommandation professionnelle est un témoignage personnel transmis par un Recommandant via un lien sécurisé Seven’O.`,
      `Elle doit être rédigée directement sur Seven’O, sans lecture de boîte de réception et sans dépôt de réponse dans un service de messagerie tiers.`,
      `La recommandation reste invisible côté Entreprise tant qu’elle n’a pas été vérifiée et rendue visible par le Candidat.`,
    ],
  },
  {
    id: 'article-16',
    number: '16.',
    title: 'Candidatures et Mise en relation',
    paragraphs: [
      `La candidature, la demande de mise en relation et l’acceptation associée suivent un processus explicite.`,
      `L’ouverture de la discussion complète n’intervient qu’après les validations attendues par Seven’O ou par l’Entreprise concernée.`,
      `Le Candidat conserve la maîtrise de l’exposition de ses coordonnées et de la poursuite de l’échange.`,
    ],
  },
  {
    id: 'article-17',
    number: '17.',
    title: 'Messagerie et échanges',
    paragraphs: [
      `La messagerie Seven’O sert aux échanges utiles à la préparation du recrutement ou à la mise en relation.`,
      `Les messages doivent rester professionnels, respectueux et liés à l’objet du service.`,
      `Seven’O peut conserver les éléments nécessaires à la sécurité, à la preuve et au respect des présentes CGU.`,
    ],
  },
  {
    id: 'article-18',
    number: '18.',
    title: 'Contenus transmis par les Utilisateurs',
    paragraphs: [
      `Chaque Utilisateur reste responsable des contenus qu’il transmet sur Seven’O.`,
      `Les contenus doivent être exacts, licites, utiles au service et dépourvus d’éléments illicites ou abusifs.`,
      `UST-WORKFLOW peut conserver, analyser, retirer ou signaler les contenus nécessaires au bon fonctionnement et à la modération de la Plateforme.`,
    ],
  },
  {
    id: 'article-19',
    number: '19.',
    title: 'Utilisations interdites',
    paragraphs: [
      `Il est interdit d’utiliser Seven’O pour publier de fausses offres, tromper les Utilisateurs, contourner les contrôles d’accès ou porter atteinte à la sécurité de la Plateforme.`,
      `Les discriminations, les atteintes à la vie privée, les usurpations d’identité, les tentatives d’extraction non autorisée de données et les détournements de service sont interdits.`,
      `L’usage de Seven’O ne doit pas servir à contourner les règles applicables aux recrutements ou aux traitements de données.`,
    ],
  },
  {
    id: 'article-20',
    number: '20.',
    title: 'Signalement et modération',
    paragraphs: [
      `Tout Utilisateur peut signaler un Contenu, une Offre, une Recommandation, un message, un Compte ou un comportement qu’il estime illicite ou contraire aux présentes CGU.`,
      `UST-WORKFLOW peut analyser les signalements, suspendre des contenus, limiter des accès ou solliciter des vérifications complémentaires.`,
      `La modération vise à protéger les Utilisateurs, à maintenir la qualité du service et à prévenir les abus.`,
    ],
  },
  {
    id: 'article-21',
    number: '21.',
    title: 'Disponibilité et évolution de Seven’O',
    paragraphs: [
      `Seven’O est fourni avec un objectif de continuité de service, mais aucune disponibilité permanente n’est garantie.`,
      `L’Éditeur peut faire évoluer, suspendre, corriger, sécuriser ou enrichir la Plateforme à tout moment.`,
      `Les évolutions peuvent modifier l’apparence, l’organisation ou le fonctionnement de certaines fonctionnalités sans remettre en cause la validité des présentes CGU.`,
    ],
  },
  {
    id: 'article-22',
    number: '22.',
    title: 'Conditions financières',
    paragraphs: [
      `Certaines fonctions destinées aux Entreprises peuvent être soumises à des conditions financières distinctes.`,
      `Ces conditions sont définies séparément dans les documents contractuels, devis, bons de commande ou conditions générales de vente applicables.`,
      `Les présentes CGU ne remplacent pas ces documents commerciaux.`,
    ],
  },
  {
    id: 'article-23',
    number: '23.',
    title: 'Données personnelles',
    paragraphs: [
      `UST-WORKFLOW traite des données personnelles dans le cadre de Seven’O, notamment pour gérer les comptes, les profils, les recommandations, les candidatures, les questionnaires et la sécurité du service.`,
      `Les finalités, les bases légales, les durées de conservation et les droits des personnes sont détaillés dans la Politique de confidentialité.`,
      `Le Candidat, l’Entreprise et le Recommandant peuvent consulter cette politique avant toute utilisation concernée.`,
    ],
  },
  {
    id: 'article-24',
    number: '24.',
    title: 'Propriété intellectuelle de Seven’O',
    paragraphs: [
      `L’ensemble des éléments présents sur Seven’O, notamment les textes, dénominations, logos, éléments graphiques, interfaces, structures de pages, questionnaires, modèles de données, fonctionnalités et composants logiciels, est protégé par les règles applicables à la propriété intellectuelle.`,
      `Sauf mention contraire, ces éléments sont la propriété de UST-WORKFLOW ou sont utilisés dans un cadre autorisé.`,
      `Toute reproduction, représentation, adaptation, extraction, réutilisation ou exploitation, totale ou partielle, sans autorisation écrite préalable de UST-WORKFLOW est interdite, sauf dans les cas autorisés par la loi.`,
    ],
  },
  {
    id: 'article-25',
    number: '25.',
    title: 'Rôle de Seven’O et absence de garantie de résultat',
    paragraphs: [
      `Seven’O met en relation, structure, aide à la lecture et facilite la préparation du recrutement, mais ne décide pas à la place des Utilisateurs.`,
      `Les profils, questionnaires, résultats, seuils, recommandations et signaux de disponibilité sont des outils d’aide à la décision.`,
      `Ils ne constituent ni une garantie de recrutement, ni une garantie de compétence générale, ni une validation automatique d’un candidat ou d’une offre.`,
    ],
  },
  {
    id: 'article-26',
    number: '26.',
    title: 'Responsabilité',
    paragraphs: [
      `UST-WORKFLOW met en œuvre les moyens raisonnables pour assurer le fonctionnement de Seven’O, sans pouvoir garantir l’absence totale d’erreur ou d’interruption.`,
      `La responsabilité de l’Éditeur ne peut être engagée que dans les limites prévues par la loi et par les présentes CGU.`,
      `Chaque Utilisateur demeure responsable de ses choix, de ses contenus et de la manière dont il exploite les informations fournies par la Plateforme.`,
    ],
  },
  {
    id: 'article-27',
    number: '27.',
    title: 'Suspension et fermeture du Compte',
    paragraphs: [
      `UST-WORKFLOW peut suspendre, limiter ou fermer un Compte en cas de violation des présentes CGU, de risque de sécurité, d’usage abusif ou de demande légale.`,
      `La fermeture du Compte n’empêche pas la conservation des éléments nécessaires au respect d’une obligation légale, à la preuve des acceptations, à la sécurité ou à la défense des droits de UST-WORKFLOW.`,
      `Lorsque cela est pertinent, l’Utilisateur peut conserver l’accès aux informations nécessaires à ses droits ou à la gestion de sa suppression.`,
    ],
  },
  {
    id: 'article-28',
    number: '28.',
    title: 'Preuve des opérations',
    paragraphs: [
      `Les enregistrements conservés par les systèmes de Seven’O, notamment les acceptations de CGU, dates, actions, validations, candidatures, réponses, messages et événements techniques, peuvent contribuer à établir la preuve des opérations réalisées.`,
      `Les horodatages serveur sont réputés fiables pour les événements enregistrés côté Plateforme, sauf preuve contraire.`,
    ],
  },
  {
    id: 'article-29',
    number: '29.',
    title: 'Services et liens externes',
    paragraphs: [
      `Seven’O peut contenir des liens vers des services ou ressources tiers.`,
      `UST-WORKFLOW ne contrôle pas ces services externes et ne peut être tenu responsable de leur contenu, de leur disponibilité, de leur sécurité ou de leurs pratiques.`,
      `L’Utilisateur est invité à consulter les conditions d’utilisation et les politiques de confidentialité des services externes concernés.`,
    ],
  },
  {
    id: 'article-30',
    number: '30.',
    title: 'Modification des CGU',
    paragraphs: [
      `UST-WORKFLOW peut modifier les présentes CGU afin de tenir compte d’une évolution du service, de la réglementation, de la sécurité ou du fonctionnement de Seven’O.`,
      `Lorsqu’une modification substantielle intervient, une nouvelle acceptation peut être demandée avant la poursuite de l’utilisation des services concernés.`,
      `La version applicable est celle affichée sur la page /cgu au moment considéré.`,
    ],
  },
  {
    id: 'article-31',
    number: '31.',
    title: 'Droit applicable et réclamations',
    paragraphs: [
      `Les présentes CGU sont soumises au droit français.`,
      `En cas de difficulté, les parties sont invitées à rechercher une solution amiable avant toute action contentieuse.`,
      `À défaut de résolution amiable, les règles légales de compétence territoriale et matérielle s’appliquent.`,
    ],
  },
  {
    id: 'article-32',
    number: '32.',
    title: 'Entrée en vigueur',
    paragraphs: [
      `Les présentes Conditions générales d’utilisation correspondent à la version 1.0.`,
      `Elles entrent en vigueur le 21 juillet 2026 et restent applicables jusqu’à publication d’une nouvelle version acceptée selon les règles prévues.`,
      `La dernière mise à jour juridique figure en pied de page du document.`,
    ],
  },
];

function ArticleSection({ article }: { article: LegalArticle }) {
  return (
    <article id={article.id} className="scroll-mt-28 border-t border-white/10 pt-8 sm:pt-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">{article.number}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{article.title}</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-8 text-slate-300 sm:text-[17px]">
        {article.paragraphs.map((paragraph, paragraphIndex) => (
          <p key={`${article.id}-paragraph-${paragraphIndex}`}>{paragraph}</p>
        ))}
        {article.bullets ? (
          <ul className="space-y-3">
            {article.bullets.map((item, itemIndex) => (
              <li key={`${article.id}-bullet-${itemIndex}`} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {article.id === 'article-23' ? (
          <p>
            <Link href="/confidentialite" className="text-cyan-200 transition hover:text-cyan-100">
              Consulter la Politique de confidentialité
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function CGUPage() {
  return (
    <PublicSiteShell>
      <div className="space-y-10">
        <style>{`
          @media print {
            header,
            footer,
            nav,
            button,
            [data-cgu-no-print='true'] {
              display: none !important;
            }

            main {
              padding: 0 !important;
              width: 100% !important;
              max-width: none !important;
            }

            body {
              background: #ffffff !important;
              color: #000000 !important;
            }

            a {
              color: #000000 !important;
              text-decoration: none !important;
            }
          }
        `}</style>

        <section className="rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">CONDITIONS GÉNÉRALES D’UTILISATION</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Conditions générales d’utilisation de Seven’O
          </h1>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Version 1.0</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Entrée en vigueur : 21 juillet 2026</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Éditeur : UST-WORKFLOW</span>
          </div>
          <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">
            Les présentes Conditions générales d’utilisation définissent les règles applicables à l’accès et à l’utilisation du site, de l’étude publique et de la plateforme Seven’O.
          </p>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-300">
            Toute utilisation d’un espace authentifié, toute création de compte, toute demande d’accès entreprise ou toute transmission d’une recommandation professionnelle implique l’acceptation des conditions applicables au service utilisé.
          </p>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-300">
            Les conditions commerciales applicables aux services payants proposés aux entreprises sont définies séparément dans les documents contractuels, devis, bons de commande ou Conditions générales de vente acceptés par l’entreprise.
          </p>
        </section>

        <CguAcceptancePanel />

        <section className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-blue-200/85">Sommaire</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ARTICLES.map((article) => (
              <Link
                key={article.id}
                href={`#${article.id}`}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-slate-950/80"
              >
                {article.number} {article.title}
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-0">
          {ARTICLES.map((article) => (
            <ArticleSection key={article.id} article={article} />
          ))}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.9))] p-6 text-sm leading-7 text-slate-300">
          <p className="font-medium text-white">Impression et conservation</p>
          <p className="mt-3">
            Utilisez le bouton prévu pour imprimer ou enregistrer les CGU afin de conserver une copie lisible. La page imprimée reste centrée sur le contenu juridique et n’affiche pas le menu complet ni les éléments décoratifs inutiles.
          </p>
          <p className="mt-3">
            Les liens vers la Politique de confidentialité et la Politique cookies restent accessibles depuis les articles concernés.
          </p>
        </section>
      </div>
    </PublicSiteShell>
  );
}
