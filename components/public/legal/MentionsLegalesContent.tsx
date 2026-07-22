import Link from 'next/link';
import type { ReactNode } from 'react';

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 pt-8 sm:pt-10">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">{number}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{title}</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-8 text-slate-300 sm:text-[17px]">{children}</div>
    </section>
  );
}

export function MentionsLegalesContent() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
      <section className="rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,17,32,0.98),rgba(8,15,28,0.93))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.34)] sm:p-8 lg:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">MENTIONS LÉGALES</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Informations légales relatives à Seven’O
        </h1>
        <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">
          La présente page définit les informations légales applicables au site Seven’O, accessible à l’adresse
          seveno.eu, ainsi qu’à son éditeur, UST-WORKFLOW.
        </p>
      </section>

      <div className="space-y-0">
        <Section number="1." title="Éditeur du site">
          <p>Le site Seven’O est édité par :</p>
          <p>Dénomination sociale : UST-WORKFLOW</p>
          <p>Forme juridique : Société par actions simplifiée unipersonnelle — SASU</p>
          <p>Capital social : 500 euros</p>
          <p>Siège social : 69 rue Georges Clemenceau, 33530 Bassens, France</p>
          <p>SIREN : 103 480 349</p>
          <p>SIRET du siège social : 103 480 349 00010</p>
          <p>Immatriculation : RCS Bordeaux 103 480 349</p>
          <p>Numéro de TVA intracommunautaire : FR28 103 480 349</p>
          <p>
            Adresse électronique :{' '}
            <a href="mailto:contact@ust-france.com" className="text-cyan-200 transition hover:text-cyan-100">
              contact@ust-france.com
            </a>
          </p>
          <p>
            Téléphone : <span className="text-slate-200">07 68 01 75 00</span>
          </p>
        </Section>

        <Section number="2." title="Directeur de publication">
          <p>Le directeur de la publication est Sébastien COLLENNE, président et représentant légal de la société UST-WORKFLOW.</p>
        </Section>

        <Section number="3." title="Hébergement">
          <p>Le site Seven’O et ses services applicatifs sont hébergés au moyen des services Firebase App Hosting et Google Cloud.</p>
          <p>Hébergeur et prestataire cloud pour les comptes clients établis en France :</p>
          <p>Google Cloud France SARL</p>
          <p>Adresse : 8 rue de Londres, 75009 Paris, France</p>
          <p>RCS Paris : 881 721 583</p>
          <p>
            Téléphone : <span className="text-slate-200">01 42 68 53 00</span>
          </p>
        </Section>

        <Section
          number="4."
          title="Conception et exploitation"
        >
          <p>La conception, le développement, la maintenance et l’exploitation de Seven’O sont assurés par UST-WORKFLOW.</p>
          <p>Seven’O est une plateforme de recrutement et un observatoire des talents développés dans le cadre des activités numériques de UST-WORKFLOW.</p>
        </Section>

        <Section number="5." title="Objet du site">
          <p>Seven’O propose un parcours destiné à mieux préparer la rencontre entre les candidats et les entreprises.</p>
          <p>
            La plateforme permet notamment aux candidats de créer un profil professionnel, de préciser leur recherche
            et leur disponibilité, de compléter des questionnaires et de réunir des recommandations professionnelles.
          </p>
          <p>
            Elle permet également aux entreprises disposant d’un accès autorisé de créer des offres, de définir des
            prérequis, de préparer des questionnaires liés aux postes et d’étudier les candidatures reçues.
          </p>
          <p>
            Seven’O comprend également une étude publique et un observatoire destinés à mieux comprendre les attentes
            des professionnels et les besoins des entreprises.
          </p>
        </Section>

        <Section
          number="6."
          title="Propriété intellectuelle"
        >
          <p>
            L’ensemble des éléments présents sur Seven’O, notamment les textes, dénominations, logos, éléments
            graphiques, interfaces, structures de pages, questionnaires, modèles de données, fonctionnalités et
            composants logiciels, est protégé par les règles applicables à la propriété intellectuelle.
          </p>
          <p>
            Sauf mention contraire, ces éléments sont la propriété de UST-WORKFLOW ou sont utilisés dans un cadre
            autorisé.
          </p>
          <p>
            Toute reproduction, représentation, adaptation, extraction, réutilisation ou exploitation, totale ou
            partielle, sans autorisation écrite préalable de UST-WORKFLOW est interdite, sauf dans les cas autorisés
            par la loi.
          </p>
          <p>
            Les contenus transmis par les utilisateurs restent soumis aux droits de leurs auteurs et aux conditions
            définies dans les Conditions générales d’utilisation de Seven’O.
          </p>
        </Section>

        <Section
          number="7."
          title="Disponibilité et responsabilité"
        >
          <p>
            UST-WORKFLOW met en œuvre les moyens raisonnables nécessaires pour assurer l’accessibilité, la sécurité et
            le bon fonctionnement de Seven’O.
          </p>
          <p>La disponibilité permanente et sans interruption de la plateforme ne peut toutefois être garantie.</p>
          <p>Seven’O peut être temporairement suspendu ou limité pour des opérations de maintenance, de sécurité, de correction ou d’évolution.</p>
          <p>
            UST-WORKFLOW ne peut être tenu responsable des interruptions résultant d’un événement extérieur, d’une
            défaillance d’un prestataire technique, d’un équipement de l’utilisateur ou d’un usage non conforme de la
            plateforme.
          </p>
          <p>
            Seven’O fournit des outils d’aide à la préparation et à la lecture du recrutement. La décision de
            candidater, de poursuivre un échange, de recruter ou d’accepter une proposition reste prise par les
            utilisateurs concernés.
          </p>
        </Section>

        <Section
          number="8."
          title="Décisions de recrutement"
        >
          <p>Seven’O ne remplace pas la décision humaine des candidats ou des entreprises.</p>
          <p>
            Les profils, questionnaires, résultats, seuils et recommandations constituent des éléments d’aide à la
            lecture et à la préparation de la rencontre.
          </p>
          <p>
            Ils ne doivent pas être considérés comme une garantie de recrutement, de compétence générale, de
            performance professionnelle ou d’adéquation définitive à un poste.
          </p>
          <p>
            Les décisions relatives à une candidature, à une mise en relation ou à un recrutement restent sous la
            responsabilité des utilisateurs concernés.
          </p>
        </Section>

        <Section
          number="9."
          title="Liens externes"
        >
          <p>Seven’O peut contenir des liens vers des sites, services ou ressources exploités par des tiers.</p>
          <p>
            UST-WORKFLOW ne contrôle pas ces services externes et ne peut être tenu responsable de leur contenu, de
            leur disponibilité, de leur sécurité ou de leurs pratiques.
          </p>
          <p>L’utilisateur est invité à consulter les conditions d’utilisation et les politiques de confidentialité des services externes concernés.</p>
        </Section>

        <Section number="10." title="Données personnelles">
          <p>
            UST-WORKFLOW est responsable des traitements de données personnelles réalisés dans le cadre de Seven’O,
            sous réserve des traitements dont un prestataire tiers serait directement responsable.
          </p>
          <p>
            Les informations relatives aux données collectées, aux finalités des traitements, aux bases légales, aux
            destinataires, aux durées de conservation et aux droits des personnes sont détaillées dans la Politique de
            confidentialité de Seven’O.
          </p>
          <p>
            <Link href="/confidentialite" className="text-cyan-200 transition hover:text-cyan-100">
              Consulter la Politique de confidentialité
            </Link>
          </p>
          <p>Pour exercer ses droits ou poser une question relative aux données personnelles, l’utilisateur peut écrire à contact@ust-france.com.</p>
        </Section>

        <Section number="11." title="Cookies et traceurs">
          <p>
            Les informations relatives aux cookies, aux moyens de stockage local et aux autres traceurs éventuellement
            utilisés sur Seven’O sont présentées dans la Politique cookies.
          </p>
          <p>
            <Link href="/cookies" className="text-cyan-200 transition hover:text-cyan-100">
              Consulter la Politique cookies
            </Link>
          </p>
        </Section>

        <Section number="12." title="Conditions d’utilisation">
          <p>L’utilisation de Seven’O est également soumise aux Conditions générales d’utilisation de la plateforme.</p>
          <p>
            <Link href="/cgu" className="text-cyan-200 transition hover:text-cyan-100">
              Consulter les Conditions générales d’utilisation
            </Link>
          </p>
        </Section>

        <Section number="13." title="Droit applicable">
          <p>Le site et la plateforme Seven’O sont soumis au droit français.</p>
          <p>En cas de difficulté, les parties sont invitées à rechercher une solution amiable avant toute action contentieuse.</p>
          <p>À défaut de résolution amiable, les règles légales de compétence territoriale et matérielle s’appliquent.</p>
        </Section>

        <Section number="14." title="Contact">
          <p>Pour toute question relative à Seven’O ou aux présentes mentions légales :</p>
          <p>UST-WORKFLOW</p>
          <p>69 rue Georges Clemenceau</p>
          <p>33530 Bassens</p>
          <p>France</p>
          <p>
            Email :{' '}
            <a href="mailto:contact@ust-france.com" className="text-cyan-200 transition hover:text-cyan-100">
              contact@ust-france.com
            </a>
          </p>
          <p>
            Téléphone : <span className="text-slate-200">07 68 01 75 00</span>
          </p>
        </Section>
      </div>

      <p className="border-t border-white/10 pt-8 text-sm text-slate-400">Dernière mise à jour : 21 juillet 2026</p>
    </div>
  );
}
