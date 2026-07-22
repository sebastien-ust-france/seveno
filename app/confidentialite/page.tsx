import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PublicSiteShell } from '@/components/public/PublicSiteShell';
import { PrivacyPolicyPrintButton } from '@/components/public/legal/PrivacyPolicyPrintButton';

export const metadata: Metadata = {
  title: "Politique de confidentialité — Seven’O",
  description:
    "Découvrez comment Seven’O collecte, utilise, protège et conserve les données des candidats, entreprises, recommandants et participants à l’étude.",
  alternates: {
    canonical: '/confidentialite',
  },
};

type PolicySectionProps = {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
};

type RetentionRow = {
  category: string;
  duration: string;
  note: string;
};

const RETENTION_ROWS: RetentionRow[] = [
  {
    category: 'Site public et journaux techniques',
    duration: 'Le temps strictement nécessaire au fonctionnement, à la sécurité et au diagnostic, puis conservation limitée si une preuve ou une obligation légale l’exige.',
    note: 'Les traces de sécurité ne sont pas conservées plus longtemps que nécessaire.',
  },
  {
    category: 'Compte, authentification et preuve des acceptations',
    duration: 'Tant que le compte reste actif, puis pendant la durée nécessaire à la preuve, à la sécurité et aux obligations légales.',
    note: 'Les versions de CGU ou de documents juridiques acceptées peuvent être conservées séparément.',
  },
  {
    category: 'Identité privée du Candidat',
    duration: 'Pendant la vie du compte et, après suppression, uniquement pour la sécurité, la preuve ou les obligations légales applicables.',
    note: 'La politique ne promet pas une suppression immédiate si une conservation est encore requise.',
  },
  {
    category: 'Profil professionnel anonyme',
    duration: 'Pendant la vie du compte candidat et tant que le profil reste utile au service, puis conservation limitée lorsque cela est nécessaire à la preuve ou aux obligations légales.',
    note: 'La projection anonyme reste distincte de l’identité privée.',
  },
  {
    category: 'Étude Seven’O',
    duration: 'Le temps nécessaire à l’exploitation de l’étude, à son analyse et à la conservation de la preuve associée.',
    note: 'Les réponses publiques ne servent pas à exposer une identité privée aux entreprises.',
  },
  {
    category: 'Recommandations, candidatures, mises en relation et messages',
    duration: 'Pendant la relation active et le délai nécessaire à la preuve, à la sécurité et à la gestion d’un éventuel litige.',
    note: 'Les données restent séparées selon leur finalité propre.',
  },
  {
    category: 'Notifications et jetons d’appareil',
    duration: 'Jusqu’au retrait de l’autorisation, à la désactivation du dispositif ou à la purge des appareils inactifs, puis conservation limitée de certains événements techniques si nécessaire.',
    note: 'L’utilisateur peut retirer l’autorisation du navigateur à tout moment.',
  },
  {
    category: 'Administration et modération',
    duration: 'Le temps nécessaire au contrôle, à la sécurité, à la modération et à la preuve.',
    note: 'Les logs administratifs sont réservés aux personnes habilitées.',
  },
];

const POLICY_SECTIONS = [
  {
    id: 'responsable',
    number: '1.',
    title: 'Responsable du traitement',
    content: (
      <>
        <p>Le responsable du traitement est :</p>
        <p>UST-WORKFLOW</p>
        <p>Société par actions simplifiée unipersonnelle — SASU</p>
        <p>Capital social : 500 euros</p>
        <p>Siège social : 69 rue Georges Clemenceau, 33530 Bassens, France</p>
        <p>SIREN : 103 480 349</p>
        <p>RCS Bordeaux : 103 480 349</p>
        <p>Adresse électronique : contact@ust-france.com</p>
        <p>
          UST-WORKFLOW détermine les finalités et les moyens essentiels des traitements réalisés dans le cadre de Seven’O,
          sous réserve des traitements pour lesquels un prestataire ou une entreprise utilisatrice agit sous sa propre
          responsabilité.
        </p>
        <p className="font-medium text-white">Contact relatif à la protection des données</p>
        <p>
          Toute question ou demande relative aux données personnelles peut être adressée à contact@ust-france.com ou par
          courrier postal au siège social de UST-WORKFLOW.
        </p>
      </>
    ),
  },
  {
    id: 'personnes-concernees',
    number: '2.',
    title: 'Personnes concernées',
    content: (
      <>
        <p>La présente politique concerne notamment :</p>
        <ul className="space-y-3">
          <li>les visiteurs du site public ;</li>
          <li>les participants à l’étude Seven’O ;</li>
          <li>les candidats disposant ou non d’un Compte ;</li>
          <li>les représentants et utilisateurs des Entreprises ;</li>
          <li>les personnes invitées à transmettre une Recommandation ;</li>
          <li>les personnes qui contactent Seven’O ;</li>
          <li>les personnes dont les données sont mentionnées dans un contenu transmis sur la plateforme.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'sources',
    number: '3.',
    title: 'Sources des données',
    content: (
      <>
        <p>Les données sont principalement collectées :</p>
        <ul className="space-y-3">
          <li>directement auprès de la personne concernée ;</li>
          <li>auprès d’un Candidat lorsqu’il invite un Recommandant ;</li>
          <li>auprès d’un Recommandant lorsqu’il transmet une Recommandation ;</li>
          <li>auprès d’une Entreprise lorsqu’elle crée une Offre, un questionnaire ou traite une candidature ;</li>
          <li>auprès d’un fournisseur d’authentification lorsque l’Utilisateur choisit une connexion externe ;</li>
          <li>automatiquement lors de l’utilisation technique de Seven’O ;</li>
          <li>auprès des systèmes de sécurité, de journalisation et de notification de la plateforme.</li>
        </ul>
        <p>
          Lorsqu’une donnée concernant une personne est transmise par un tiers, celui-ci doit disposer d’un motif
          légitime pour la communiquer et limiter cette transmission aux informations nécessaires.
        </p>
      </>
    ),
  },
  {
    id: 'visiteurs',
    number: '4.',
    title: 'Données liées à la consultation du site public',
    content: (
      <>
        <p>
          Lors de la consultation du site, Seven’O peut traiter des informations techniques nécessaires à l’affichage, à
          la sécurité et au fonctionnement du service.
        </p>
        <ul className="space-y-3">
          <li>Adresse IP ;</li>
          <li>Date et heure de la requête ;</li>
          <li>Page demandée ;</li>
          <li>Type de navigateur ;</li>
          <li>Système d’exploitation ;</li>
          <li>Informations techniques relatives à l’appareil ;</li>
          <li>Erreurs et événements de sécurité ;</li>
          <li>Identifiants techniques strictement nécessaires au fonctionnement.</li>
        </ul>
        <p className="font-medium text-white">Finalités exactes</p>
        <ul className="space-y-3">
          <li>fournir le site ;</li>
          <li>sécuriser les accès ;</li>
          <li>prévenir les abus ;</li>
          <li>diagnostiquer les erreurs ;</li>
          <li>assurer la continuité du service.</li>
        </ul>
        <p className="font-medium text-white">Base légale exacte</p>
        <p>
          Ces traitements reposent sur l’intérêt légitime de UST-WORKFLOW à fournir, sécuriser et maintenir Seven’O.
        </p>
      </>
    ),
  },
  {
    id: 'comptes',
    number: '5.',
    title: 'Création de Compte et authentification',
    content: (
      <>
        <p>Pour créer et sécuriser un Compte, Seven’O peut traiter notamment :</p>
        <ul className="space-y-3">
          <li>l’adresse électronique ;</li>
          <li>l’identifiant technique du Compte ;</li>
          <li>le rôle attribué au Compte ;</li>
          <li>l’état de vérification de l’adresse électronique ;</li>
          <li>les dates de création, de connexion et de mise à jour ;</li>
          <li>le fournisseur d’authentification utilisé ;</li>
          <li>les événements liés à la sécurité du Compte ;</li>
          <li>les versions de documents juridiques acceptées.</li>
        </ul>
        <p>
          Lorsqu’un Utilisateur choisit une connexion Google, Seven’O reçoit uniquement les informations autorisées par
          la configuration du service d’authentification et nécessaires à la création ou à la connexion du Compte.
        </p>
        <p className="font-medium text-white">Finalités exactes</p>
        <ul className="space-y-3">
          <li>créer le Compte ;</li>
          <li>authentifier l’Utilisateur ;</li>
          <li>sécuriser les accès ;</li>
          <li>gérer les rôles et autorisations ;</li>
          <li>conserver la preuve des acceptations juridiques.</li>
        </ul>
        <p className="font-medium text-white">Bases légales exactes</p>
        <ul className="space-y-3">
          <li>exécution des CGU et fourniture du service demandé ;</li>
          <li>intérêt légitime de UST-WORKFLOW pour la sécurité ;</li>
          <li>respect des obligations légales et conservation de la preuve lorsque cela est applicable.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'identite-privee',
    number: '6.',
    title: 'Identité et données privées du Candidat',
    content: (
      <>
        <p>Seven’O peut traiter dans l’espace privé du Candidat :</p>
        <ul className="space-y-3">
          <li>le nom ;</li>
          <li>le prénom ;</li>
          <li>l’adresse électronique ;</li>
          <li>le numéro de téléphone lorsqu’il est demandé ;</li>
          <li>les informations nécessaires à l’identification et à la gestion du Compte ;</li>
          <li>les données nécessaires à l’exercice des droits ou à la sécurité.</li>
        </ul>
        <p>Ces informations sont séparées du Profil professionnel anonyme.</p>
        <p>Elles ne sont pas destinées à être présentées aux Entreprises pendant les premières étapes du parcours.</p>
        <p>
          Elles peuvent être révélées lorsqu’une étape de Mise en relation et les validations prévues autorisent cette
          révélation, ou lorsqu’une obligation légale l’exige.
        </p>
        <p className="font-medium text-white">Finalités exactes</p>
        <ul className="space-y-3">
          <li>gérer le Compte ;</li>
          <li>permettre la Mise en relation ;</li>
          <li>communiquer avec le Candidat ;</li>
          <li>protéger le service et les Utilisateurs ;</li>
          <li>répondre aux demandes de droits.</li>
        </ul>
        <p className="font-medium text-white">Base légale exacte</p>
        <p>
          Ces traitements reposent principalement sur l’exécution du service demandé par le Candidat et, pour la
          sécurité, sur l’intérêt légitime de UST-WORKFLOW.
        </p>
      </>
    ),
  },
  {
    id: 'etude',
    number: '7.',
    title: 'Étude Seven’O',
    content: (
      <>
        <p>
          La participation à l’étude Seven’O peut entraîner la collecte des réponses transmises via le formulaire
          public, ainsi que des horodatages et des éléments de session nécessaires à l’exploitation du formulaire et à
          l’analyse du retour des participants.
        </p>
        <p>
          L’étude reste séparée des espaces candidats et entreprises. Les réponses ne servent pas à exposer une identité
          privée aux entreprises.
        </p>
        <p>
          Les données de l’étude sont utilisées pour comprendre le marché, documenter les attentes des professionnels et
          améliorer le produit.
        </p>
      </>
    ),
  },
  {
    id: 'profil-anonyme',
    number: '8.',
    title: 'Profil professionnel anonyme',
    content: (
      <>
        <p>Seven’O peut traiter, dans le profil professionnel anonyme du Candidat :</p>
        <ul className="space-y-3">
          <li>l’identifiant public Seven’O ;</li>
          <li>les métiers ciblés ;</li>
          <li>le secteur, la famille métier et le métier précis ;</li>
          <li>la disponibilité ;</li>
          <li>la zone de recherche ;</li>
          <li>le niveau d’expérience ;</li>
          <li>le score vérifié et l’état du test associé ;</li>
          <li>les identifiants de résultat et de session de test nécessaires à la preuve ;</li>
          <li>les compteurs de recommandations visibles et les états publics utiles à la lecture.</li>
        </ul>
        <p>
          Les Entreprises reçoivent uniquement une projection anonyme renvoyée par les API du serveur. Le `uid`, les
          coordonnées et les autres données d’identité privée n’y figurent pas.
        </p>
        <p>
          Ce profil sert à présenter une lecture professionnelle sans exposer inutilement l’identité du Candidat.
        </p>
      </>
    ),
  },
  {
    id: 'entreprises',
    number: '9.',
    title: 'Entreprises, offres, questionnaires et candidatures',
    content: (
      <>
        <p>Le profil entreprise peut contenir notamment :</p>
        <ul className="space-y-3">
          <li>companyName ;</li>
          <li>legalName ;</li>
          <li>companyType ;</li>
          <li>siret ;</li>
          <li>website ;</li>
          <li>businessSector ;</li>
          <li>companySize ;</li>
          <li>headquartersArea ;</li>
          <li>recruitmentAreas ;</li>
          <li>contactRole ;</li>
          <li>profileStatus ;</li>
          <li>verificationStatus.</li>
        </ul>
        <p>
          Les entreprises autorisées peuvent créer des offres, définir des prérequis, préparer un questionnaire lié à
          l’offre, consulter les candidatures et gérer la suite du parcours.
        </p>
        <p>
          Le questionnaire Seven’O reste distinct du questionnaire propre à l’offre d’une entreprise et les résultats
          associés ne remplacent pas une décision humaine de recrutement.
        </p>
      </>
    ),
  },
  {
    id: 'recommandations',
    number: '10.',
    title: 'Recommandations professionnelles',
    content: (
      <>
        <p>
          Une recommandation professionnelle est transmise directement sur Seven’O à partir d’un lien sécurisé. Elle ne
          doit jamais être récupérée depuis une boîte de réception Gmail ni importée depuis un service de messagerie tiers.
        </p>
        <p>
          Les données traitées peuvent inclure l’identité du répondant, ses coordonnées professionnelles, son lien avec
          le Candidat, les réponses structurées, le statut de vérification et les horodatages d’envoi ou de validation.
        </p>
        <p>
          La recommandation reste invisible côté Entreprise tant qu’elle n’a pas été vérifiée et rendue visible par le
          Candidat.
        </p>
      </>
    ),
  },
  {
    id: 'mises-en-relation',
    number: '11.',
    title: 'Mises en relation, messages et notifications',
    content: (
      <>
        <p>
          Les candidatures, les demandes de mise en relation, les réponses et les messages servent à organiser la suite
          de l’échange entre les utilisateurs concernés.
        </p>
        <p>
          Seven’O peut conserver les messages, les confirmations et les données de statut nécessaires à la preuve, à la
          sécurité et au suivi du parcours.
        </p>
        <p>
          Les notifications web ou push ne sont actives que si l’utilisateur les autorise. Le service peut alors traiter
          la permission du navigateur, un jeton d’appareil, un identifiant technique, le fuseau horaire et les événements
          d’envoi utiles au fonctionnement.
        </p>
      </>
    ),
  },
  {
    id: 'securite',
    number: '12.',
    title: 'Sécurité, journalisation et administration',
    content: (
      <>
        <p>
          Seven’O conserve des journaux et des événements techniques nécessaires à la sécurité, à la traçabilité, à la
          modération et à la gestion des abus.
        </p>
        <p>
          Ces journaux peuvent contenir des identifiants techniques, des horodatages, des actions, des cibles et des
          métadonnées nécessaires à la preuve.
        </p>
        <p>
          Seven’O ne prend aucune décision finale de recrutement exclusivement automatisée. Les scores, seuils et statuts
          restent des outils d’aide à la lecture.
        </p>
      </>
    ),
  },
  {
    id: 'destinataires',
    number: '13.',
    title: 'Destinataires, prestataires et transferts',
    content: (
      <>
        <p>
          Les données sont destinées à UST-WORKFLOW, aux utilisateurs habilités concernés par le service, aux
          administrateurs autorisés et aux prestataires techniques indispensables au fonctionnement de Seven’O.
        </p>
        <p>
          Seven’O utilise notamment Firebase et les services Google nécessaires à son fonctionnement. Selon
          l’infrastructure des prestataires utilisés, certains traitements techniques peuvent impliquer des transferts
          hors de l’Union européenne ou de l’Espace économique européen.
        </p>
        <p>
          Les garanties applicables dépendent alors des mécanismes contractuels et organisationnels mis en place par ces
          prestataires.
        </p>
      </>
    ),
  },
  {
    id: 'droits',
    number: '14.',
    title: 'Droits des personnes',
    content: (
      <>
        <p>Conformément à la réglementation applicable, chaque personne concernée peut demander :</p>
        <ul className="space-y-3">
          <li>l’accès à ses données ;</li>
          <li>la rectification de données inexactes ;</li>
          <li>l’effacement lorsque cela est possible ;</li>
          <li>la limitation de certains traitements ;</li>
          <li>l’opposition pour les traitements concernés ;</li>
          <li>la portabilité lorsque la loi le prévoit ;</li>
          <li>le retrait d’un consentement lorsqu’un traitement repose réellement sur le consentement.</li>
        </ul>
        <p>
          La demande peut être adressée à contact@ust-france.com ou par courrier au siège social de UST-WORKFLOW.
        </p>
        <p>
          Si une personne estime, après avoir contacté UST-WORKFLOW, que ses droits ne sont pas respectés, elle peut
          adresser une réclamation à la CNIL.
        </p>
        <p>CNIL — 3 place de Fontenoy — TSA 80715 — 75334 Paris Cedex 07 — France.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    number: '15.',
    title: 'Cookies, stockage local et technologies similaires',
    content: (
      <>
        <p>
          Seven’O utilise des mécanismes techniques nécessaires au fonctionnement du site, à l’authentification, à la
          sécurité, aux préférences et, lorsque cette fonction est activée, aux notifications.
        </p>
        <p>
          Certains états techniques peuvent aussi être conservés localement dans le navigateur pour faire fonctionner
          correctement les parcours candidats, entreprises, administrateurs, l’étude et les notifications.
        </p>
        <p>
          Les informations détaillées sur ces mécanismes, leur finalité, leur durée et les moyens de contrôle sont
          présentées dans la Politique cookies.
        </p>
        <p>
          <Link href="/cookies" className="text-cyan-200 transition hover:text-cyan-100">
            Consulter la Politique cookies
          </Link>
        </p>
      </>
    ),
  },
  {
    id: 'evolution',
    number: '16.',
    title: 'Évolution de la Politique de confidentialité',
    content: (
      <>
        <p>
          UST-WORKFLOW peut modifier la présente politique afin de tenir compte d’une évolution de Seven’O, de ses
          prestataires, de ses traitements ou de la réglementation.
        </p>
        <p>
          La version et la date d’entrée en vigueur sont affichées en tête du document.
        </p>
        <p>
          Lorsqu’une modification importante affecte la manière dont les données sont traitées, une information adaptée
          est communiquée aux personnes concernées.
        </p>
      </>
    ),
  },
  {
    id: 'entree-en-vigueur',
    number: '17.',
    title: 'Entrée en vigueur',
    content: (
      <>
        <p>La présente Politique de confidentialité correspond à la version 1.0.</p>
        <p>Elle entre en vigueur le 21 juillet 2026.</p>
      </>
    ),
  },
] as const;

function PolicySection({ id, number, title, children }: PolicySectionProps) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-white/10 pt-8 sm:pt-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">{number}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{title}</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-8 text-slate-300 sm:text-[17px]">{children}</div>
    </section>
  );
}

function RetentionTable() {
  return (
    <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-white/5">
      <table className="min-w-[960px] w-full border-collapse text-left text-sm text-slate-300">
        <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.22em] text-violet-200/80">
          <tr>
            <th className="px-5 py-4 font-semibold">Catégorie</th>
            <th className="px-5 py-4 font-semibold">Durée de conservation de référence</th>
            <th className="px-5 py-4 font-semibold">Observation</th>
          </tr>
        </thead>
        <tbody>
          {RETENTION_ROWS.map((row) => (
            <tr key={row.category} className="border-t border-white/10 align-top">
              <td className="px-5 py-4 font-medium text-white">{row.category}</td>
              <td className="px-5 py-4">{row.duration}</td>
              <td className="px-5 py-4">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOC = [
  ['responsable', 'Responsable du traitement'],
  ['personnes-concernees', 'Personnes concernées'],
  ['sources', 'Sources des données'],
  ['visiteurs', 'Données du site public'],
  ['comptes', 'Comptes et authentification'],
  ['identite-privee', 'Identité privée du Candidat'],
  ['etude', 'Étude Seven’O'],
  ['profil-anonyme', 'Profil professionnel anonyme'],
  ['entreprises', 'Entreprises et questionnaires'],
  ['recommandations', 'Recommandations'],
  ['mises-en-relation', 'Mises en relation et notifications'],
  ['securite', 'Sécurité et journalisation'],
  ['destinataires', 'Destinataires et transferts'],
  ['droits', 'Droits et CNIL'],
  ['cookies', 'Cookies et stockage local'],
  ['evolution', 'Évolution de la politique'],
  ['entree-en-vigueur', 'Entrée en vigueur'],
] as const;

export default function ConfidentialitePage() {
  return (
    <PublicSiteShell>
      <div className="grid gap-10 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="order-1 xl:sticky xl:top-28 xl:self-start">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,13,26,0.98),rgba(5,10,21,0.95))] p-5 shadow-[0_18px_80px_rgba(2,6,23,0.25)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200/85">Sommaire</p>
            <nav className="mt-4 flex flex-col gap-2">
              {TOC.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-slate-950/80 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-5" data-privacy-no-print="true">
              <PrivacyPolicyPrintButton />
            </div>
          </div>
        </aside>

        <div className="order-2 min-w-0 space-y-10">
          <style>{`
            @media print {
              header,
              footer,
              nav,
              button,
              [data-privacy-no-print='true'] {
                display: none !important;
              }

              main {
                width: 100% !important;
                max-width: none !important;
                padding: 0 !important;
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

          <section className="rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">POLITIQUE DE CONFIDENTIALITÉ</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Protection des données personnelles sur Seven’O
            </h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Version 1.0</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Entrée en vigueur : 21 juillet 2026</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Responsable du traitement : UST-WORKFLOW</span>
            </div>
            <div className="mt-5 space-y-4 text-lg leading-8 text-slate-300">
              <p>
                La présente Politique de confidentialité explique comment UST-WORKFLOW collecte, utilise, conserve,
                protège et partage les données personnelles traitées dans le cadre de Seven’O.
              </p>
              <p>
                Elle concerne le site public, l’étude Seven’O, les espaces candidats et entreprises, les
                recommandations professionnelles, les candidatures, les questionnaires, les mises en relation et les
                échanges réalisés sur la plateforme.
              </p>
              <p>
                Seven’O distingue les données d’identité privées des informations professionnelles susceptibles d’être
                présentées de manière anonyme. Cette séparation limite l’exposition initiale des identités, mais ne
                dispense pas UST-WORKFLOW de ses obligations relatives à l’ensemble des données personnelles traitées.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200/85">Séparation</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Les identités privées du candidat restent séparées du profil professionnel anonyme visible par les
                  entreprises.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-200/85">Finalité</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  La politique décrit les traitements réellement réalisés pour le site public, le compte, les profils,
                  les questionnaires, les recommandations et les mises en relation.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200/85">Action</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Vous pouvez imprimer ou enregistrer cette politique et consulter la Politique cookies dédiée aux
                  stockages techniques.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-cyan-200/85">Durées de conservation de référence</p>
            <div className="mt-4">
              <RetentionTable />
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Lorsque Seven’O ne dispose pas encore d’un mécanisme d’archivage ou de purge automatisé, la conservation reste
              limitée aux besoins de sécurité, de preuve et aux obligations légales applicables.
            </p>
          </section>

          <div className="space-y-0">
            {POLICY_SECTIONS.map((section) => (
              <PolicySection key={section.id} id={section.id} number={section.number} title={section.title}>
                {section.content}
              </PolicySection>
            ))}
          </div>

          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.9))] p-6 text-sm leading-7 text-slate-300">
            <p className="font-medium text-white">Points de collecte et information locale</p>
            <p className="mt-3">
              La politique générale n’exonère pas Seven’O d’informer les personnes au plus près des formulaires et des
              parcours concernés. Les mentions courtes doivent rappeler qui traite les données, pourquoi, si le champ est
              obligatoire ou facultatif, et renvoyer vers `/confidentialite` lorsque cela est utile.
            </p>
            <p className="mt-3">
              Cette politique n’est pas une acceptation générale. Les consentements réellement nécessaires doivent rester
              séparés et ne jamais être précochés.
            </p>
          </section>
        </div>
      </div>
    </PublicSiteShell>
  );
}
