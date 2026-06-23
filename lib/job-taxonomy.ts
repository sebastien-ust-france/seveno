export interface JobRole {
  code: string;
  label: string;
  aliases?: string[];
}

export interface JobFamily {
  code: string;
  label: string;
  roles: JobRole[];
}

export interface JobSector {
  code: string;
  label: string;
  families: JobFamily[];
}

export interface JobTaxonomy {
  version: string;
  sectors: JobSector[];
}

const createRole = (code: string, label: string, aliases: string[] = []): JobRole => ({
  code,
  label,
  ...(aliases.length > 0 ? { aliases } : {}),
});

const createFamily = (code: string, label: string, roles: JobRole[]): JobFamily => ({
  code,
  label,
  roles,
});

const createSector = (code: string, label: string, families: JobFamily[]): JobSector => ({
  code,
  label,
  families,
});

export const JOB_TAXONOMY: JobTaxonomy = {
  version: '1.0.0',
  sectors: [
    createSector('informatique-et-numerique', 'Informatique et numérique', [
      createFamily('informatique-et-numerique-developpement-logiciel', 'Développement logiciel', [
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-full-stack', 'Développeur full stack', [
          'full stack',
          'fullstack',
          'full stack developer',
        ]),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-front-end', 'Développeur front-end', [
          'frontend',
          'front end developer',
        ]),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-back-end', 'Développeur back-end', [
          'backend',
          'back end developer',
        ]),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-mobile', 'Développeur mobile'),
        createRole('informatique-et-numerique-developpement-logiciel-ingenieur-logiciel', 'Ingénieur logiciel', [
          'software engineer',
        ]),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-java', 'Développeur Java'),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-python', 'Développeur Python'),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-php', 'Développeur PHP'),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-web', 'Développeur web'),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-dotnet', 'Développeur .NET', ['dotnet developer']),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-nodejs', 'Développeur Node.js', ['node developer']),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-react', 'Développeur React'),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-angular', 'Développeur Angular'),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-mobile-ios', 'Développeur mobile iOS', ['ios developer']),
        createRole('informatique-et-numerique-developpement-logiciel-developpeur-mobile-android', 'Développeur mobile Android', ['android developer']),
        createRole('informatique-et-numerique-developpement-logiciel-tech-lead', 'Tech lead', ['technical lead']),
        createRole('informatique-et-numerique-developpement-logiciel-architecte-logiciel', 'Architecte logiciel', ['software architect']),
      ]),
      createFamily('informatique-et-numerique-data-et-ia', 'Data et IA', [
        createRole('informatique-et-numerique-data-et-ia-data-analyst', 'Data analyst'),
        createRole('informatique-et-numerique-data-et-ia-data-engineer', 'Data engineer'),
        createRole('informatique-et-numerique-data-et-ia-data-scientist', 'Data scientist'),
        createRole(
          'informatique-et-numerique-data-et-ia-ingenieur-machine-learning',
          'Ingénieur machine learning',
          ['machine learning engineer', 'ml engineer'],
        ),
        createRole('informatique-et-numerique-data-et-ia-analytics-engineer', 'Analytics engineer'),
        createRole('informatique-et-numerique-data-et-ia-bi-analyst', 'BI analyst', ['business intelligence analyst']),
        createRole('informatique-et-numerique-data-et-ia-data-architect', 'Data architect'),
        createRole('informatique-et-numerique-data-et-ia-mlops-engineer', 'MLOps engineer'),
      ]),
      createFamily('informatique-et-numerique-infrastructure-cloud-cybersecurite', 'Infrastructure, cloud et cybersécurité', [
        createRole(
          'informatique-et-numerique-infrastructure-cloud-cybersecurite-administrateur-systemes-et-reseaux',
          'Administrateur systèmes et réseaux',
          ['admin systèmes et réseaux', 'sysadmin'],
        ),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-ingenieur-devops', 'Ingénieur DevOps', [
          'devops engineer',
        ]),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-ingenieur-cloud', 'Ingénieur cloud'),
        createRole(
          'informatique-et-numerique-infrastructure-cloud-cybersecurite-ingenieur-cybersecurite',
          'Ingénieur cybersécurité',
          ['cybersecurity engineer'],
        ),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-analyste-soc', 'Analyste SOC'),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-ingenieur-reseau', 'Ingénieur réseau'),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-ingenieur-iam', 'Ingénieur IAM'),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-architecte-infrastructure', 'Architecte infrastructure'),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-sre', 'Site reliability engineer', ['sre']),
        createRole('informatique-et-numerique-infrastructure-cloud-cybersecurite-platform-engineer', 'Platform engineer'),
      ]),
      createFamily('informatique-et-numerique-produit-ux-qa', 'Produit, UX et QA', [
        createRole('informatique-et-numerique-produit-ux-qa-chef-de-produit', 'Chef de produit', ['product manager']),
        createRole('informatique-et-numerique-produit-ux-qa-product-owner', 'Product owner'),
        createRole('informatique-et-numerique-produit-ux-qa-product-manager', 'Product manager'),
        createRole('informatique-et-numerique-produit-ux-qa-designer-ux-ui', 'Designer UX/UI', [
          'ux ui designer',
          'product designer',
        ]),
        createRole('informatique-et-numerique-produit-ux-qa-ux-researcher', 'UX researcher'),
        createRole('informatique-et-numerique-produit-ux-qa-testeur-qa', 'Testeur QA', ['qa tester']),
        createRole('informatique-et-numerique-produit-ux-qa-testeur-automatisation', 'Testeur automatisation', [
          'automation tester',
        ]),
        createRole('informatique-et-numerique-produit-ux-qa-specialiste-accessibilite', 'Spécialiste accessibilité'),
      ]),
      createFamily('informatique-et-numerique-integration-erp-applications-metiers', 'Intégration ERP et applications métiers', [
        createRole('informatique-et-numerique-integration-erp-applications-metiers-consultant-erp', 'Consultant ERP'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-integrateur-erp', 'Intégrateur ERP'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-consultant-fonctionnel', 'Consultant fonctionnel'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-business-analyst', 'Business analyst'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-chef-de-projet-applicatif', 'Chef de projet applicatif'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-support-applicatif', 'Support applicatif'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-consultant-informatique', 'Consultant informatique'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-amoa', 'AMOA'),
        createRole('informatique-et-numerique-integration-erp-applications-metiers-integrateur-api', 'Intégrateur API'),
      ]),
      createFamily('informatique-et-numerique-support-informatique-service-desk', 'Support informatique et service desk', [
        createRole('informatique-et-numerique-support-informatique-service-desk-technicien-support', 'Technicien support'),
        createRole('informatique-et-numerique-support-informatique-service-desk-technicien-support-informatique', 'Technicien support informatique'),
        createRole('informatique-et-numerique-support-informatique-service-desk-helpdesk', 'Helpdesk'),
        createRole('informatique-et-numerique-support-informatique-service-desk-technicien-proximite', 'Technicien de proximité'),
        createRole('informatique-et-numerique-support-informatique-service-desk-administrateur-poste-de-travail', 'Administrateur poste de travail'),
        createRole('informatique-et-numerique-support-informatique-service-desk-gestionnaire-parc-informatique', 'Gestionnaire parc informatique'),
        createRole('informatique-et-numerique-support-informatique-service-desk-coordinateur-support', 'Coordinateur support'),
        createRole('informatique-et-numerique-support-informatique-service-desk-support-n2', 'Support N2'),
        createRole('informatique-et-numerique-support-informatique-service-desk-support-n3', 'Support N3'),
      ]),
      createFamily('informatique-et-numerique-architecture-tech-lead-management', 'Architecture, tech lead et management', [
        createRole('informatique-et-numerique-architecture-tech-lead-management-architecte-technique', 'Architecte technique'),
        createRole('informatique-et-numerique-architecture-tech-lead-management-architecte-solution', 'Architecte solution'),
        createRole('informatique-et-numerique-architecture-tech-lead-management-tech-lead', 'Tech lead', ['technical lead']),
        createRole('informatique-et-numerique-architecture-tech-lead-management-engineering-manager', 'Engineering manager'),
        createRole('informatique-et-numerique-architecture-tech-lead-management-chef-de-projet-it', 'Chef de projet IT'),
        createRole('informatique-et-numerique-architecture-tech-lead-management-lead-developer', 'Lead developer'),
        createRole('informatique-et-numerique-architecture-tech-lead-management-release-manager', 'Release manager'),
        createRole('informatique-et-numerique-architecture-tech-lead-management-scrum-master', 'Scrum master'),
        createRole('informatique-et-numerique-architecture-tech-lead-management-manager-technique', 'Manager technique'),
      ]),
      createFamily('informatique-et-numerique-devops-platform-sre', 'DevOps, platform et SRE', [
        createRole('informatique-et-numerique-devops-platform-sre-site-reliability-engineer', 'Site reliability engineer', ['sre']),
        createRole('informatique-et-numerique-devops-platform-sre-platform-engineer', 'Platform engineer'),
        createRole('informatique-et-numerique-devops-platform-sre-build-and-release-engineer', 'Build and release engineer'),
        createRole('informatique-et-numerique-devops-platform-sre-ingenieur-ci-cd', 'Ingénieur CI/CD'),
        createRole('informatique-et-numerique-devops-platform-sre-cloud-architect', 'Cloud architect'),
        createRole('informatique-et-numerique-devops-platform-sre-observability-engineer', 'Observability engineer'),
        createRole('informatique-et-numerique-devops-platform-sre-ingenieur-plateforme', 'Ingénieur plateforme'),
        createRole('informatique-et-numerique-devops-platform-sre-ingenieur-automatisation-deploiement', 'Ingénieur automatisation déploiement'),
      ]),
    ]),
    createSector('commerce-vente-relation-client', 'Commerce, vente et relation client', [
      createFamily('commerce-vente-relation-client-vente-b2b', 'Vente B2B', [
        createRole('commerce-vente-relation-client-vente-b2b-developpeur-commercial', 'Développeur commercial', [
          'bizdev',
          'business developer',
        ]),
        createRole('commerce-vente-relation-client-vente-b2b-commercial-terrain', 'Commercial terrain'),
        createRole('commerce-vente-relation-client-vente-b2b-commercial-sedentaire', 'Commercial sédentaire'),
        createRole('commerce-vente-relation-client-vente-b2b-business-developer', 'Business developer', ['sales development representative', 'sdr']),
        createRole('commerce-vente-relation-client-vente-b2b-responsable-commercial', 'Responsable commercial'),
      ]),
      createFamily('commerce-vente-relation-client-comptes-strategiques', 'Comptes stratégiques', [
        createRole('commerce-vente-relation-client-comptes-strategiques-account-manager', 'Account manager'),
        createRole('commerce-vente-relation-client-comptes-strategiques-key-account-manager', 'Key account manager', [
          'kAM',
        ]),
        createRole('commerce-vente-relation-client-comptes-strategiques-ingenieur-commercial', 'Ingénieur commercial'),
        createRole('commerce-vente-relation-client-comptes-strategiques-responsable-comptes-strategiques', 'Responsable comptes stratégiques'),
        createRole('commerce-vente-relation-client-comptes-strategiques-responsable-grands-comptes', 'Responsable grands comptes'),
      ]),
      createFamily('commerce-vente-relation-client-vente-b2c-retail', 'Vente B2C et retail', [
        createRole('commerce-vente-relation-client-vente-b2c-retail-conseiller-de-vente', 'Conseiller de vente'),
        createRole('commerce-vente-relation-client-vente-b2c-retail-vendeur', 'Vendeur'),
        createRole('commerce-vente-relation-client-vente-b2c-retail-chef-de-rayon', 'Chef de rayon'),
        createRole('commerce-vente-relation-client-vente-b2c-retail-chef-de-secteur', 'Chef de secteur'),
        createRole('commerce-vente-relation-client-vente-b2c-retail-responsable-magasin', 'Responsable magasin'),
        createRole('commerce-vente-relation-client-vente-b2c-retail-directeur-de-magasin', 'Directeur de magasin'),
      ]),
      createFamily('commerce-vente-relation-client-relation-client-et-success', 'Relation client et success', [
        createRole('commerce-vente-relation-client-relation-client-et-success-charge-de-clientele', 'Chargé de clientèle'),
        createRole('commerce-vente-relation-client-relation-client-et-success-teleconseiller', 'Téléconseiller'),
        createRole('commerce-vente-relation-client-relation-client-et-success-conseiller-commercial', 'Conseiller commercial'),
        createRole('commerce-vente-relation-client-relation-client-et-success-charge-de-relation-client', 'Chargé de relation client'),
        createRole('commerce-vente-relation-client-relation-client-et-success-responsable-service-client', 'Responsable service client'),
        createRole('commerce-vente-relation-client-relation-client-et-success-customer-success-manager', 'Customer success manager', [
          'csm',
        ]),
      ]),
    ]),
    createSector('marketing-communication-contenu', 'Marketing, communication et contenu', [
      createFamily('marketing-communication-contenu-acquisition-digitale', 'Acquisition digitale', [
        createRole('marketing-communication-contenu-acquisition-digitale-responsable-acquisition', 'Responsable acquisition'),
        createRole('marketing-communication-contenu-acquisition-digitale-traffic-manager', 'Traffic manager'),
        createRole('marketing-communication-contenu-acquisition-digitale-responsable-growth', 'Responsable growth', [
          'growth manager',
        ]),
        createRole('marketing-communication-contenu-acquisition-digitale-seo-specialist', 'Référent SEO', [
          'seo specialist',
        ]),
      ]),
      createFamily('marketing-communication-contenu-brand-communication', 'Brand et communication', [
        createRole('marketing-communication-contenu-brand-communication-charge-de-communication', 'Chargé de communication'),
        createRole('marketing-communication-contenu-brand-communication-responsable-communication', 'Responsable communication'),
        createRole('marketing-communication-contenu-brand-communication-responsable-relations-presse', 'Responsable relations presse'),
        createRole('marketing-communication-contenu-brand-communication-brand-manager', 'Brand manager'),
      ]),
      createFamily('marketing-communication-contenu-contenu-redaction', 'Contenu et rédaction', [
        createRole('marketing-communication-contenu-contenu-redaction-content-manager', 'Content manager'),
        createRole('marketing-communication-contenu-contenu-redaction-redacteur-web', 'Rédacteur web'),
        createRole('marketing-communication-contenu-contenu-redaction-copywriter', 'Copywriter'),
        createRole('marketing-communication-contenu-contenu-redaction-community-manager', 'Community manager'),
      ]),
      createFamily('marketing-communication-contenu-crm-evenementiel', 'CRM et événementiel', [
        createRole('marketing-communication-contenu-crm-evenementiel-crm-manager', 'CRM manager'),
        createRole('marketing-communication-contenu-crm-evenementiel-lifecycle-manager', 'Lifecycle manager'),
        createRole('marketing-communication-contenu-crm-evenementiel-chef-de-projet-marketing', 'Chef de projet marketing'),
        createRole('marketing-communication-contenu-crm-evenementiel-chef-de-projet-evenementiel', 'Chef de projet événementiel'),
      ]),
    ]),
    createSector('finance-comptabilite-audit', 'Finance, comptabilité et audit', [
      createFamily('finance-comptabilite-audit-comptabilite', 'Comptabilité', [
        createRole('finance-comptabilite-audit-comptabilite-comptable', 'Comptable'),
        createRole('finance-comptabilite-audit-comptabilite-assistant-comptable', 'Assistant comptable'),
        createRole('finance-comptabilite-audit-comptabilite-comptable-fournisseurs', 'Comptable fournisseurs'),
        createRole('finance-comptabilite-audit-comptabilite-comptable-clients', 'Comptable clients'),
        createRole('finance-comptabilite-audit-comptabilite-chef-comptable', 'Chef comptable'),
        createRole('finance-comptabilite-audit-comptabilite-comptable-general', 'Comptable général'),
      ]),
      createFamily('finance-comptabilite-audit-controle-de-gestion', 'Contrôle de gestion', [
        createRole('finance-comptabilite-audit-controle-de-gestion-controleur-de-gestion', 'Contrôleur de gestion'),
        createRole('finance-comptabilite-audit-controle-de-gestion-controleur-financier', 'Contrôleur financier'),
        createRole('finance-comptabilite-audit-controle-de-gestion-fp-and-a-analyst', 'Analyste FP&A', ['fp&a analyst']),
        createRole('finance-comptabilite-audit-controle-de-gestion-business-controller', 'Business controller'),
      ]),
      createFamily('finance-comptabilite-audit-audit-tresorerie', 'Audit et trésorerie', [
        createRole('finance-comptabilite-audit-audit-tresorerie-auditeur', 'Auditeur'),
        createRole('finance-comptabilite-audit-audit-tresorerie-auditeur-interne', 'Auditeur interne'),
        createRole('finance-comptabilite-audit-audit-tresorerie-auditeur-externe', 'Auditeur externe'),
        createRole('finance-comptabilite-audit-audit-tresorerie-tresorier', 'Trésorier'),
        createRole('finance-comptabilite-audit-audit-tresorerie-analyste-financier', 'Analyste financier'),
      ]),
      createFamily('finance-comptabilite-audit-facturation-recouvrement', 'Facturation et recouvrement', [
        createRole('finance-comptabilite-audit-facturation-recouvrement-gestionnaire-facturation', 'Gestionnaire de facturation'),
        createRole('finance-comptabilite-audit-facturation-recouvrement-charge-de-recouvrement', 'Chargé de recouvrement'),
        createRole('finance-comptabilite-audit-facturation-recouvrement-credit-manager', 'Credit manager'),
        createRole('finance-comptabilite-audit-facturation-recouvrement-gestionnaire-adv', 'Gestionnaire ADV'),
      ]),
      createFamily('finance-comptabilite-audit-direction-financiere', 'Direction financière', [
        createRole('finance-comptabilite-audit-direction-financiere-responsable-administratif-et-financier', 'Responsable administratif et financier'),
        createRole('finance-comptabilite-audit-direction-financiere-directeur-financier', 'Directeur financier'),
      ]),
    ]),
    createSector('rh-paie-administration', 'RH, paie et administration', [
      createFamily('rh-paie-administration-recrutement-et-talent', 'Recrutement et talent', [
        createRole('rh-paie-administration-recrutement-et-talent-charge-de-recrutement', 'Chargé de recrutement'),
        createRole('rh-paie-administration-recrutement-et-talent-talent-acquisition-specialist', 'Talent acquisition specialist', [
          'talent acquisition',
        ]),
        createRole('rh-paie-administration-recrutement-et-talent-recruteur', 'Recruteur'),
        createRole('rh-paie-administration-recrutement-et-talent-responsable-recrutement', 'Responsable recrutement'),
      ]),
      createFamily('rh-paie-administration-paie', 'Paie', [
        createRole('rh-paie-administration-paie-gestionnaire-paie', 'Gestionnaire paie'),
        createRole('rh-paie-administration-paie-expert-paie', 'Expert paie'),
        createRole('rh-paie-administration-paie-responsable-paie', 'Responsable paie'),
        createRole('rh-paie-administration-paie-gestionnaire-administration-paie', 'Gestionnaire administration paie'),
      ]),
      createFamily('rh-paie-administration-administration-du-personnel', 'Administration du personnel', [
        createRole('rh-paie-administration-administration-du-personnel-assistant-rh', 'Assistant RH'),
        createRole(
          'rh-paie-administration-administration-du-personnel-gestionnaire-administration-du-personnel',
          'Gestionnaire administration du personnel',
        ),
        createRole('rh-paie-administration-administration-du-personnel-charge-rh', 'Chargé RH'),
        createRole('rh-paie-administration-administration-du-personnel-gestionnaire-rh', 'Gestionnaire RH'),
        createRole('rh-paie-administration-administration-du-personnel-hrbp', 'HRBP', ['human resources business partner']),
        createRole('rh-paie-administration-administration-du-personnel-responsable-rh', 'Responsable RH'),
        createRole('rh-paie-administration-administration-du-personnel-consultant-rh', 'Consultant RH'),
      ]),
      createFamily('rh-paie-administration-formation-relations-sociales', 'Formation et relations sociales', [
        createRole('rh-paie-administration-formation-relations-sociales-charge-de-formation', 'Chargé de formation'),
        createRole('rh-paie-administration-formation-relations-sociales-responsable-formation', 'Responsable formation'),
        createRole('rh-paie-administration-formation-relations-sociales-charge-de-relations-sociales', 'Chargé de relations sociales'),
        createRole('rh-paie-administration-formation-relations-sociales-responsable-relations-sociales', 'Responsable relations sociales'),
      ]),
      createFamily('rh-paie-administration-direction-rh', 'Direction des ressources humaines', [
        createRole('rh-paie-administration-direction-rh-directeur-des-ressources-humaines', 'Directeur des ressources humaines', ['drh']),
      ]),
    ]),
    createSector('juridique-conformite-fiscalite', 'Juridique, conformité et fiscalité', [
      createFamily('juridique-conformite-fiscalite-droit-social-affaires', 'Droit social et affaires', [
        createRole('juridique-conformite-fiscalite-droit-social-affaires-juriste-droit-social', 'Juriste droit social'),
        createRole('juridique-conformite-fiscalite-droit-social-affaires-juriste-dentreprise', "Juriste d'entreprise"),
        createRole('juridique-conformite-fiscalite-droit-social-affaires-juriste-contrats', 'Juriste contrats'),
        createRole('juridique-conformite-fiscalite-droit-social-affaires-avocat', 'Avocat'),
      ]),
      createFamily('juridique-conformite-fiscalite-conformite-risques', 'Conformité et risques', [
        createRole('juridique-conformite-fiscalite-conformite-risques-compliance-officer', 'Compliance officer'),
        createRole('juridique-conformite-fiscalite-conformite-risques-responsable-conformite', 'Responsable conformité'),
        createRole('juridique-conformite-fiscalite-conformite-risques-risk-manager', 'Risk manager'),
        createRole('juridique-conformite-fiscalite-conformite-risques-charge-de-conformite', 'Chargé de conformité'),
      ]),
      createFamily('juridique-conformite-fiscalite-fiscalite', 'Fiscalité', [
        createRole('juridique-conformite-fiscalite-fiscalite-fiscaliste', 'Fiscaliste'),
        createRole('juridique-conformite-fiscalite-fiscalite-gestionnaire-fiscal', 'Gestionnaire fiscal'),
        createRole('juridique-conformite-fiscalite-fiscalite-consultant-fiscal', 'Consultant fiscal'),
      ]),
      createFamily('juridique-conformite-fiscalite-contentieux-support-juridique', 'Contentieux et support juridique', [
        createRole('juridique-conformite-fiscalite-contentieux-support-juridique-assistant-juridique', 'Assistant juridique'),
        createRole('juridique-conformite-fiscalite-contentieux-support-juridique-paralegal', 'Paralégal'),
        createRole('juridique-conformite-fiscalite-contentieux-support-juridique-gestionnaire-contentieux', 'Gestionnaire contentieux'),
        createRole('juridique-conformite-fiscalite-contentieux-support-juridique-secretaire-juridique', 'Secrétaire juridique'),
      ]),
    ]),
    createSector('btp-construction-travaux-publics', 'BTP, construction et travaux publics', [
      createFamily('btp-construction-travaux-publics-gros-oeuvre', 'Gros œuvre', [
        createRole('btp-construction-travaux-publics-gros-oeuvre-macon', 'Maçon'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-macon-vrd', 'Maçon VRD', ['macon vrd', 'maçon voirie réseaux divers']),
        createRole('btp-construction-travaux-publics-gros-oeuvre-coffreur-bancheur', 'Coffreur bancheur'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-ferrailleur', 'Ferrailleur'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-bancheur', 'Bancheur'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-ouvrier-gros-oeuvre', 'Ouvrier gros œuvre'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-manoeuvre', 'Manœuvre'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-ouvrier-polyvalent', 'Ouvrier polyvalent'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-chef-dequipe-gros-oeuvre', "Chef d'équipe gros œuvre"),
        createRole('btp-construction-travaux-publics-gros-oeuvre-chef-dequipe-maconnerie', "Chef d'équipe maçonnerie"),
        createRole('btp-construction-travaux-publics-gros-oeuvre-conducteur-dengins', "Conducteur d'engins"),
        createRole('btp-construction-travaux-publics-gros-oeuvre-grutier', 'Grutier'),
        createRole('btp-construction-travaux-publics-gros-oeuvre-tailleur-de-pierre', 'Tailleur de pierre'),
      ]),
      createFamily('btp-construction-travaux-publics-second-oeuvre', 'Second œuvre', [
        createRole('btp-construction-travaux-publics-second-oeuvre-electricien-batiment', 'Électricien bâtiment'),
        createRole('btp-construction-travaux-publics-second-oeuvre-plombier-chauffagiste', 'Plombier chauffagiste'),
        createRole('btp-construction-travaux-publics-second-oeuvre-peintre-en-batiment', 'Peintre en bâtiment'),
        createRole('btp-construction-travaux-publics-second-oeuvre-couvreur', 'Couvreur'),
        createRole('btp-construction-travaux-publics-second-oeuvre-menuisier', 'Menuisier'),
        createRole('btp-construction-travaux-publics-second-oeuvre-plaquiste', 'Plaquiste'),
        createRole('btp-construction-travaux-publics-second-oeuvre-jointeur', 'Jointeur'),
        createRole('btp-construction-travaux-publics-second-oeuvre-carreleur', 'Carreleur'),
        createRole('btp-construction-travaux-publics-second-oeuvre-solier-moquettiste', 'Solier moquettiste'),
        createRole('btp-construction-travaux-publics-second-oeuvre-climaticien', 'Climaticien'),
        createRole('btp-construction-travaux-publics-second-oeuvre-serrurier-metallier', 'Serrurier métallier'),
      ]),
      createFamily('btp-construction-travaux-publics-charpente-bois-metal', 'Charpente bois et métal', [
        createRole('btp-construction-travaux-publics-charpente-bois-metal-charpentier-bois', 'Charpentier bois', ['charpentier bois traditionnel']),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-charpentier-metallique', 'Charpentier métallique', ['charpentier metal', 'charpentier acier']),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-charpentier-couvreur', 'Charpentier couvreur'),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-aide-charpentier', 'Aide charpentier'),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-chef-dequipe-charpente', "Chef d'équipe charpente"),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-poseur-charpente-bois', 'Poseur charpente bois'),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-poseur-charpente-metallique', 'Poseur charpente métallique'),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-monteur-charpente-metallique', 'Monteur charpente métallique'),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-bardeur-metallique', 'Bardeur métallique'),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-constructeur-ossature-bois', 'Constructeur ossature bois', ['ossature bois']),
        createRole('btp-construction-travaux-publics-charpente-bois-metal-menuisier-charpentier', 'Menuisier charpentier'),
      ]),
      createFamily('btp-construction-travaux-publics-travaux-publics', 'Travaux publics', [
        createRole('btp-construction-travaux-publics-travaux-publics-conducteur-de-travaux-tp', 'Conducteur de travaux TP'),
        createRole('btp-construction-travaux-publics-travaux-publics-chef-de-chantier-tp', 'Chef de chantier TP'),
        createRole('btp-construction-travaux-publics-travaux-publics-terrassier', 'Terrassier'),
        createRole('btp-construction-travaux-publics-travaux-publics-canalisateur', 'Canalisateur'),
        createRole('btp-construction-travaux-publics-travaux-publics-manoeuvre-tp', 'Manœuvre TP'),
        createRole('btp-construction-travaux-publics-travaux-publics-conducteur-dengins-tp', "Conducteur d'engins TP", ['conducteur pelle', 'conducteur pelle mécanique']),
        createRole('btp-construction-travaux-publics-travaux-publics-poseur-de-reseaux', 'Poseur de réseaux'),
        createRole('btp-construction-travaux-publics-travaux-publics-geometre-vrd', 'Géomètre VRD'),
      ]),
      createFamily('btp-construction-travaux-publics-etudes-methodes-chantier', 'Études, méthodes et chantier', [
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-conducteur-de-travaux', 'Conducteur de travaux'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-dessinateur-projeteur', 'Dessinateur projeteur'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-geometre-topographe', 'Géomètre-topographe'),
        createRole("btp-construction-travaux-publics-etudes-methodes-chantier-charge-d-etudes-de-prix", "Chargé d'études de prix"),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-charge-de-methodes', 'Chargé de méthodes'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-preparateur-de-chantier', 'Préparateur de chantier'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-chef-dequipe-btp', "Chef d'équipe BTP"),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-conducteur-de-travaux-principal', 'Conducteur de travaux principal'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-charge-daffaires-travaux', "Chargé d'affaires travaux"),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-coordinateur-travaux', 'Coordinateur travaux'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-metreur', 'Métreur'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-opc', 'OPC'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-economiste-de-la-construction', 'Économiste de la construction'),
        createRole('btp-construction-travaux-publics-etudes-methodes-chantier-maitre-doeuvre', "Maître d'œuvre"),
      ]),
      createFamily('btp-construction-travaux-publics-facade-couverture-enveloppe', 'Façade, couverture et enveloppe', [
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-couvreur', 'Couvreur', ['couvreur toiture']),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-couvreur-zingueur', 'Couvreur zingueur', ['zingueur couvreur']),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-zingueur', 'Zingueur'),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-etancheur-toiture', 'Étancheur toiture'),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-bardeur', 'Bardeur'),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-facadier', 'Façadier'),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-chef-dequipe-couverture', "Chef d'équipe couverture"),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-chef-de-chantier-facade', 'Chef de chantier façade'),
        createRole('btp-construction-travaux-publics-facade-couverture-enveloppe-responsable-couverture', 'Responsable couverture'),
      ]),
      createFamily('btp-construction-travaux-publics-genie-civil-ouvrages-dart', 'Génie civil et ouvrages d’art', [
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-macon-genie-civil', 'Maçon génie civil'),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-coffreur-genie-civil', 'Coffreur génie civil'),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-ferrailleur-genie-civil', 'Ferrailleur génie civil'),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-chef-de-chantier-gc', 'Chef de chantier GC'),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-conducteur-de-travaux-gc', 'Conducteur de travaux GC'),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-ingenieur-travaux', 'Ingénieur travaux'),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-chef-dequipe-gc', "Chef d'équipe GC"),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-conducteur-dengins-gc', "Conducteur d'engins GC"),
        createRole('btp-construction-travaux-publics-genie-civil-ouvrages-dart-poseur-prefabrication', 'Poseur préfabrication'),
      ]),
      createFamily('btp-construction-travaux-publics-vrd-reseaux', 'VRD et réseaux', [
        createRole('btp-construction-travaux-publics-vrd-reseaux-macon-vrd', 'Maçon VRD', ['macon vrd', 'maçon voirie réseaux divers']),
        createRole('btp-construction-travaux-publics-vrd-reseaux-canalisateur', 'Canalisateur'),
        createRole('btp-construction-travaux-publics-vrd-reseaux-poseur-reseaux-humides', 'Poseur réseaux humides'),
        createRole('btp-construction-travaux-publics-vrd-reseaux-poseur-reseaux-secs', 'Poseur réseaux secs'),
        createRole('btp-construction-travaux-publics-vrd-reseaux-terrassier-vrd', 'Terrassier VRD'),
        createRole('btp-construction-travaux-publics-vrd-reseaux-ouvrier-vrd', 'Ouvrier VRD'),
        createRole('btp-construction-travaux-publics-vrd-reseaux-chef-dequipe-vrd', "Chef d'équipe VRD"),
        createRole('btp-construction-travaux-publics-vrd-reseaux-chef-de-chantier-vrd', 'Chef de chantier VRD'),
        createRole('btp-construction-travaux-publics-vrd-reseaux-conducteur-dengins-vrd', "Conducteur d'engins VRD", ['conducteur pelle', 'conducteur pelle mécanique']),
      ]),
      createFamily('btp-construction-travaux-publics-amenagement-interieur-finition', 'Aménagement intérieur et finition', [
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-plaquiste', 'Plaquiste'),
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-jointeur', 'Jointeur'),
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-peintre-finition', 'Peintre finition'),
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-poseur-de-revetements', 'Poseur de revêtements'),
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-menuisier-interieur', 'Menuisier intérieur'),
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-agenceur', 'Agenceur'),
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-poseur-de-plafond', 'Poseur de plafond'),
        createRole('btp-construction-travaux-publics-amenagement-interieur-finition-chef-dequipe-finition', "Chef d'équipe finition"),
      ]),
    ]),
    createSector('industrie-production-maintenance', 'Industrie, production et maintenance', [
      createFamily('industrie-production-maintenance-production', 'Production', [
        createRole('industrie-production-maintenance-production-operateur-de-production', 'Opérateur de production'),
        createRole('industrie-production-maintenance-production-conducteur-de-ligne', 'Conducteur de ligne'),
        createRole('industrie-production-maintenance-production-regleur', 'Régleur'),
        createRole('industrie-production-maintenance-production-operateur-de-fabrication', 'Opérateur de fabrication'),
        createRole('industrie-production-maintenance-production-conducteur-de-machine', 'Conducteur de machine'),
        createRole('industrie-production-maintenance-production-pilote-de-ligne', 'Pilote de ligne'),
        createRole('industrie-production-maintenance-production-monteur-assembleur', 'Monteur assembleur'),
        createRole('industrie-production-maintenance-production-conditionneur', 'Conditionneur'),
        createRole('industrie-production-maintenance-production-agent-de-production', 'Agent de production'),
        createRole('industrie-production-maintenance-production-chef-dequipe-production', "Chef d'équipe production"),
        createRole('industrie-production-maintenance-production-chef-datelier', "Chef d'atelier"),
        createRole('industrie-production-maintenance-production-responsable-datelier', "Responsable d'atelier"),
        createRole('industrie-production-maintenance-production-responsable-production', 'Responsable production'),
      ]),
      createFamily('industrie-production-maintenance-maintenance', 'Maintenance', [
        createRole('industrie-production-maintenance-maintenance-technicien-de-maintenance', 'Technicien de maintenance'),
        createRole('industrie-production-maintenance-maintenance-electromecanicien', 'Électromécanicien'),
        createRole('industrie-production-maintenance-maintenance-automaticien', 'Automaticien'),
        createRole('industrie-production-maintenance-maintenance-technicien-de-maintenance-industrielle', 'Technicien de maintenance industrielle'),
        createRole('industrie-production-maintenance-maintenance-electrotechnicien', 'Électrotechnicien'),
        createRole('industrie-production-maintenance-maintenance-mecanicien-industriel', 'Mécanicien industriel'),
        createRole('industrie-production-maintenance-maintenance-technicien-sav-industriel', 'Technicien SAV industriel'),
        createRole('industrie-production-maintenance-maintenance-automaticien-maintenance', 'Automaticien maintenance'),
        createRole('industrie-production-maintenance-maintenance-chef-dequipe-maintenance', "Chef d'équipe maintenance"),
        createRole('industrie-production-maintenance-maintenance-responsable-maintenance', 'Responsable maintenance'),
        createRole('industrie-production-maintenance-maintenance-technicien-utilites', 'Technicien utilités'),
      ]),
      createFamily('industrie-production-maintenance-methodes-industrialisation', 'Méthodes et industrialisation', [
        createRole('industrie-production-maintenance-methodes-industrialisation-ingenieur-methodes', 'Ingénieur méthodes'),
        createRole('industrie-production-maintenance-methodes-industrialisation-ingenieur-industrialisation', 'Ingénieur industrialisation'),
        createRole('industrie-production-maintenance-methodes-industrialisation-chef-de-projet-industriel', 'Chef de projet industriel'),
        createRole('industrie-production-maintenance-methodes-industrialisation-methodiste', 'Méthodiste'),
        createRole('industrie-production-maintenance-methodes-industrialisation-technicien-methodes', 'Technicien méthodes'),
        createRole('industrie-production-maintenance-methodes-industrialisation-technicien-process', 'Technicien process'),
        createRole('industrie-production-maintenance-methodes-industrialisation-ingenieur-process', 'Ingénieur process'),
        createRole('industrie-production-maintenance-methodes-industrialisation-lean-manager', 'Lean manager'),
        createRole('industrie-production-maintenance-methodes-industrialisation-responsable-methodes', 'Responsable méthodes'),
        createRole('industrie-production-maintenance-methodes-industrialisation-technicien-documentation-industrielle', 'Technicien documentation industrielle'),
      ]),
      createFamily('industrie-production-maintenance-qualite-hse', 'Qualité et HSE', [
        createRole('industrie-production-maintenance-qualite-hse-responsable-qualite', 'Responsable qualité'),
        createRole('industrie-production-maintenance-qualite-hse-technicien-qhse', 'Technicien QHSE'),
        createRole('industrie-production-maintenance-qualite-hse-ingenieur-qualite', 'Ingénieur qualité'),
        createRole('industrie-production-maintenance-qualite-hse-responsable-hse', 'Responsable HSE'),
        createRole('industrie-production-maintenance-qualite-hse-coordinateur-hse', 'Coordinateur HSE'),
        createRole('industrie-production-maintenance-qualite-hse-auditeur-qualite', 'Auditeur qualité'),
        createRole('industrie-production-maintenance-qualite-hse-technicien-controle-qualite', 'Technicien contrôle qualité'),
        createRole('industrie-production-maintenance-qualite-hse-technicien-qualite', 'Technicien qualité'),
        createRole('industrie-production-maintenance-qualite-hse-controleur-qualite', 'Contrôleur qualité'),
        createRole('industrie-production-maintenance-qualite-hse-responsable-amelioration-continue', 'Responsable amélioration continue'),
        createRole('industrie-production-maintenance-qualite-hse-responsable-securite', 'Responsable sécurité'),
        createRole('industrie-production-maintenance-qualite-hse-responsable-qhse', 'Responsable QHSE'),
        createRole('industrie-production-maintenance-qualite-hse-technicien-laboratoire-qualite', 'Technicien laboratoire qualité'),
      ]),
      createFamily('industrie-production-maintenance-automatisme-robotique-systemes', 'Automatisme, robotique et systèmes', [
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-automaticien', 'Automaticien', ['programmeur automate']),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-roboticien', 'Roboticien'),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-programmeur-automate', 'Programmeur automate'),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-integrateur-robot', 'Intégrateur robot'),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-ingenieur-automatisme', 'Ingénieur automatisme'),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-technicien-automatisme', 'Technicien automatisme'),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-superviseur-scada', 'Superviseur SCADA'),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-ingenieur-controle-commande', 'Ingénieur contrôle-commande'),
        createRole('industrie-production-maintenance-automatisme-robotique-systemes-technicien-mise-en-service', 'Technicien mise en service'),
      ]),
      createFamily('industrie-production-maintenance-usinage-mecanique-fabrication', 'Usinage, mécanique et fabrication', [
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-usineur', 'Usineur'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-tourneur', 'Tourneur', ['tourneur-fraiseur']),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-fraiseur', 'Fraiseur'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-operateur-sur-machines-cn', 'Opérateur sur machines CN', ['opérateur CN']),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-technicien-usinage', 'Technicien usinage'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-ajusteur-monteur', 'Ajusteur-monteur'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-outilleur', 'Outilleur'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-rectifieur', 'Rectifieur'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-monteur-cableur', 'Monteur câbleur'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-chaudronnier', 'Chaudronnier'),
        createRole('industrie-production-maintenance-usinage-mecanique-fabrication-soudeur', 'Soudeur'),
      ]),
      createFamily('industrie-production-maintenance-supply-chain-industrielle-ordonnancement', 'Supply chain industrielle et ordonnancement', [
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-approvisionneur-industriel', 'Approvisionneur industriel'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-ordonnanceur', 'Ordonnanceur'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-planificateur-de-production', 'Planificateur de production'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-supply-planner', 'Supply planner'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-demand-planner', 'Demand planner'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-gestionnaire-de-stocks-industriels', 'Gestionnaire de stocks industriels'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-coordinateur-supply-chain', 'Coordinateur supply chain'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-responsable-supply-chain', 'Responsable supply chain'),
        createRole('industrie-production-maintenance-supply-chain-industrielle-ordonnancement-logisticien-industriel', 'Logisticien industriel'),
      ]),
    ]),
    createSector('logistique-supply-chain-transport', 'Logistique, supply chain et transport', [
      createFamily('logistique-supply-chain-transport-entrepot-preparation', 'Entrepôt et préparation', [
        createRole('logistique-supply-chain-transport-entrepot-preparation-preparateur-de-commandes', 'Préparateur de commandes'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-cariste', 'Cariste'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-magasinier', 'Magasinier'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-gestionnaire-de-stocks', 'Gestionnaire de stocks'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-receptionnaire', 'Réceptionnaire'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-agent-de-quai', 'Agent de quai'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-inventaireur', 'Inventaireur'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-chef-dequipe-logistique', "Chef d'équipe logistique"),
        createRole('logistique-supply-chain-transport-entrepot-preparation-responsable-entrepot', 'Responsable entrepôt'),
        createRole('logistique-supply-chain-transport-entrepot-preparation-coordinateur-logistique', 'Coordinateur logistique'),
      ]),
      createFamily('logistique-supply-chain-transport-transport-exploitation', 'Transport et exploitation', [
        createRole('logistique-supply-chain-transport-transport-exploitation-chauffeur-poids-lourd', 'Chauffeur poids lourd', [
          'chauffeur PL',
          'conducteur routier',
        ]),
        createRole('logistique-supply-chain-transport-transport-exploitation-chauffeur-super-poids-lourd', 'Chauffeur super poids lourd', ['chauffeur SPL']),
        createRole('logistique-supply-chain-transport-transport-exploitation-chauffeur-livreur', 'Chauffeur livreur'),
        createRole('logistique-supply-chain-transport-transport-exploitation-conducteur-utilitaire-leger', 'Conducteur utilitaire léger'),
        createRole('logistique-supply-chain-transport-transport-exploitation-exploitant-transport', 'Exploitant transport'),
        createRole('logistique-supply-chain-transport-transport-exploitation-affreteur', 'Affréteur'),
        createRole('logistique-supply-chain-transport-transport-exploitation-gestionnaire-de-tournees', 'Gestionnaire de tournées'),
        createRole('logistique-supply-chain-transport-transport-exploitation-agent-dexploitation-transport', "Agent d'exploitation transport"),
        createRole('logistique-supply-chain-transport-transport-exploitation-responsable-transport', 'Responsable transport'),
        createRole('logistique-supply-chain-transport-transport-exploitation-dispatcheur', 'Dispatcheur'),
      ]),
      createFamily('logistique-supply-chain-transport-approvisionnement-planification', 'Approvisionnement et planification', [
        createRole('logistique-supply-chain-transport-approvisionnement-planification-approvisionneur', 'Approvisionneur'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-planificateur-supply-chain', 'Planificateur supply chain'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-coordinateur-supply-chain', 'Coordinateur supply chain'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-responsable-approvisionnement', 'Responsable approvisionnement'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-coordinateur-flux', 'Coordinateur flux'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-gestionnaire-de-flux', 'Gestionnaire de flux'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-analyste-supply-chain', 'Analyste supply chain'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-supply-planner', 'Supply planner'),
        createRole('logistique-supply-chain-transport-approvisionnement-planification-demand-planner', 'Demand planner'),
      ]),
      createFamily('logistique-supply-chain-transport-achat-douane', 'Achat et douane', [
        createRole('logistique-supply-chain-transport-achat-douane-acheteur', 'Acheteur'),
        createRole('logistique-supply-chain-transport-achat-douane-assistant-import-export', 'Assistant import-export'),
        createRole('logistique-supply-chain-transport-achat-douane-declarant-en-douane', 'Déclarant en douane'),
        createRole('logistique-supply-chain-transport-achat-douane-gestionnaire-transport-international', 'Gestionnaire transport international'),
        createRole('logistique-supply-chain-transport-achat-douane-agent-de-transit', 'Agent de transit', ['transitaire']),
        createRole('logistique-supply-chain-transport-achat-douane-coordinateur-export', 'Coordinateur export'),
        createRole('logistique-supply-chain-transport-achat-douane-gestionnaire-douane', 'Gestionnaire douane'),
        createRole('logistique-supply-chain-transport-achat-douane-assistant-commercial-international', 'Assistant commercial international'),
      ]),
      createFamily('logistique-supply-chain-transport-import-export-transit', 'Import-export et transit', [
        createRole('logistique-supply-chain-transport-import-export-transit-assistant-import-export', 'Assistant import-export'),
        createRole('logistique-supply-chain-transport-import-export-transit-agent-de-transit', 'Agent de transit', ['transitaire']),
        createRole('logistique-supply-chain-transport-import-export-transit-declarant-en-douane', 'Déclarant en douane'),
        createRole('logistique-supply-chain-transport-import-export-transit-coordinateur-export', 'Coordinateur export'),
        createRole('logistique-supply-chain-transport-import-export-transit-charge-de-transport-international', 'Chargé de transport international'),
        createRole('logistique-supply-chain-transport-import-export-transit-freight-forwarder', 'Freight forwarder'),
        createRole('logistique-supply-chain-transport-import-export-transit-gestionnaire-douane', 'Gestionnaire douane'),
        createRole('logistique-supply-chain-transport-import-export-transit-assistant-commercial-international', 'Assistant commercial international'),
      ]),
      createFamily('logistique-supply-chain-transport-transport-voyageurs', 'Transport voyageurs', [
        createRole('logistique-supply-chain-transport-transport-voyageurs-chauffeur-de-bus', 'Chauffeur de bus'),
        createRole('logistique-supply-chain-transport-transport-voyageurs-conducteur-autocar', 'Conducteur autocar'),
        createRole('logistique-supply-chain-transport-transport-voyageurs-conducteur-de-transport-scolaire', 'Conducteur de transport scolaire'),
        createRole('logistique-supply-chain-transport-transport-voyageurs-conducteur-de-car', 'Conducteur de car'),
        createRole('logistique-supply-chain-transport-transport-voyageurs-conducteur-de-transport-en-commun', 'Conducteur de transport en commun'),
        createRole('logistique-supply-chain-transport-transport-voyageurs-exploitant-voyageurs', 'Exploitant voyageurs'),
        createRole('logistique-supply-chain-transport-transport-voyageurs-regulateur-trafic', 'Régulateur trafic'),
      ]),
      createFamily('logistique-supply-chain-transport-dernier-kilometre-livraison', 'Dernier kilomètre et livraison', [
        createRole('logistique-supply-chain-transport-dernier-kilometre-livraison-livreur', 'Livreur'),
        createRole('logistique-supply-chain-transport-dernier-kilometre-livraison-agent-de-livraison', 'Agent de livraison'),
        createRole('logistique-supply-chain-transport-dernier-kilometre-livraison-gestionnaire-de-tournee-last-mile', 'Gestionnaire tournée last mile'),
        createRole('logistique-supply-chain-transport-dernier-kilometre-livraison-responsable-livraison', 'Responsable livraison'),
        createRole('logistique-supply-chain-transport-dernier-kilometre-livraison-coordinateur-distribution', 'Coordinateur distribution'),
        createRole('logistique-supply-chain-transport-dernier-kilometre-livraison-coursier', 'Coursier'),
        createRole('logistique-supply-chain-transport-dernier-kilometre-livraison-dispatcher-livraison', 'Dispatcher livraison'),
      ]),
    ]),
    createSector('sante-medical-paramedical', 'Santé, médical et paramédical', [
      createFamily('sante-medical-paramedical-soins-infirmiers', 'Soins infirmiers', [
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier', 'Infirmier', ['IDE']),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-diplome-detat', "Infirmier diplômé d'État", ['IDE']),
        createRole('sante-medical-paramedical-soins-infirmiers-aide-soignant', 'Aide-soignant'),
        createRole('sante-medical-paramedical-soins-infirmiers-aide-soignante', 'Aide-soignante'),
        createRole('sante-medical-paramedical-soins-infirmiers-cadre-de-sante', 'Cadre de santé'),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-coordinateur', 'Infirmier coordinateur'),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-de-nuit', 'Infirmier de nuit'),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-de-bloc-operatoire', 'Infirmier de bloc opératoire', ['IBODE']),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-anesthesiste', 'Infirmier anesthésiste', ['IADE']),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-puericulteur', 'Infirmier puériculteur'),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-urgentiste', 'Infirmier urgentiste'),
        createRole('sante-medical-paramedical-soins-infirmiers-infirmier-de-reanimation', 'Infirmier de réanimation'),
      ]),
      createFamily('sante-medical-paramedical-medecine-pharmacie', 'Médecine et pharmacie', [
        createRole('sante-medical-paramedical-medecine-pharmacie-medecin', 'Médecin'),
        createRole('sante-medical-paramedical-medecine-pharmacie-medecin-generaliste', 'Médecin généraliste'),
        createRole('sante-medical-paramedical-medecine-pharmacie-medecin-urgentiste', 'Médecin urgentiste'),
        createRole('sante-medical-paramedical-medecine-pharmacie-medecin-specialiste', 'Médecin spécialiste'),
        createRole('sante-medical-paramedical-medecine-pharmacie-pharmacien', 'Pharmacien'),
        createRole('sante-medical-paramedical-medecine-pharmacie-preparateur-en-pharmacie', 'Préparateur en pharmacie'),
        createRole('sante-medical-paramedical-medecine-pharmacie-assistant-medical', 'Assistant médical'),
        createRole('sante-medical-paramedical-medecine-pharmacie-medecin-du-travail', 'Médecin du travail'),
        createRole('sante-medical-paramedical-medecine-pharmacie-medecin-coordinateur', 'Médecin coordinateur'),
      ]),
      createFamily('sante-medical-paramedical-paramedical', 'Paramédical', [
        createRole('sante-medical-paramedical-paramedical-kinesitherapeute', 'Kinésithérapeute'),
        createRole('sante-medical-paramedical-paramedical-orthophoniste', 'Orthophoniste'),
        createRole('sante-medical-paramedical-paramedical-ergotherapeute', 'Ergothérapeute'),
        createRole('sante-medical-paramedical-paramedical-psychomotricien', 'Psychomotricien'),
        createRole('sante-medical-paramedical-paramedical-manipulateur-radio', 'Manipulateur radio'),
        createRole('sante-medical-paramedical-paramedical-sage-femme', 'Sage-femme'),
        createRole('sante-medical-paramedical-paramedical-orthoptiste', 'Orthoptiste'),
        createRole('sante-medical-paramedical-paramedical-dieteticien', 'Diététicien'),
        createRole('sante-medical-paramedical-paramedical-podologue', 'Podologue'),
        createRole('sante-medical-paramedical-paramedical-audioprothesiste', 'Audioprothésiste'),
      ]),
      createFamily('sante-medical-paramedical-medico-social', 'Médico-social', [
        createRole('sante-medical-paramedical-medico-social-secretaire-medicale', 'Secrétaire médicale'),
        createRole('sante-medical-paramedical-medico-social-auxiliaire-de-puericulture', 'Auxiliaire de puériculture'),
        createRole('sante-medical-paramedical-medico-social-coordinateur-medico-social', 'Coordinateur médico-social'),
        createRole('sante-medical-paramedical-medico-social-assistant-medico-social', 'Assistant médico-social'),
        createRole('sante-medical-paramedical-medico-social-accompagnant-educatif-et-social', 'Accompagnant éducatif et social', ['AES']),
        createRole('sante-medical-paramedical-medico-social-educateur-specialise', 'Éducateur spécialisé'),
        createRole('sante-medical-paramedical-medico-social-charge-de-coordination-de-parcours', 'Chargé de coordination de parcours'),
        createRole('sante-medical-paramedical-medico-social-conseiller-en-economie-sociale-et-familiale', 'Conseiller en économie sociale et familiale'),
      ]),
      createFamily('sante-medical-paramedical-bloc-urgence-reanimation', 'Bloc opératoire, urgence et réanimation', [
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-aide-operatoire', 'Aide-opératoire'),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-brancardier', 'Brancardier'),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-infirmier-durgence', "Infirmier d'urgence"),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-infirmier-de-reanimation', 'Infirmier de réanimation'),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-cadre-de-bloc', 'Cadre de bloc'),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-secretaire-de-bloc', 'Secrétaire de bloc'),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-agent-de-sterilisation', 'Agent de stérilisation'),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-infirmier-de-bloc-operatoire', 'Infirmier de bloc opératoire', ['IBODE']),
        createRole('sante-medical-paramedical-bloc-urgence-reanimation-infirmier-anesthesiste', 'Infirmier anesthésiste', ['IADE']),
      ]),
      createFamily('sante-medical-paramedical-imagerie-biologie-medicale', 'Imagerie et biologie médicale', [
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-technicien-de-laboratoire', 'Technicien de laboratoire'),
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-biologiste-medical', 'Biologiste médical'),
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-preparateur-en-biologie', 'Préparateur en biologie'),
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-preleveur', 'Préleveur'),
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-assistant-de-laboratoire', 'Assistant de laboratoire'),
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-radiologue', 'Radiologue'),
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-manipulateur-en-electroradiologie', 'Manipulateur en électroradiologie'),
        createRole('sante-medical-paramedical-imagerie-biologie-medicale-technicien-dimagerie', "Technicien d'imagerie"),
      ]),
      createFamily('sante-medical-paramedical-secretariat-coordination-medicale', 'Secrétariat et coordination médicale', [
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-coordinateur-de-soins', 'Coordinateur de soins'),
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-gestionnaire-de-rendez-vous', 'Gestionnaire de rendez-vous'),
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-responsable-admissions', 'Responsable admissions'),
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-coordinateur-de-parcours', 'Coordinateur de parcours'),
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-secretaire-medicale', 'Secrétaire médicale'),
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-assistant-de-coordination', 'Assistant de coordination'),
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-referent-parcours-patient', 'Référent parcours patient'),
        createRole('sante-medical-paramedical-secretariat-coordination-medicale-telesecretaire-medical', 'Télésecrétaire médical'),
      ]),
    ]),
    createSector('social-education-petite-enfance', 'Social, éducation et petite enfance', [
      createFamily('social-education-petite-enfance-social-insertion', 'Social et insertion', [
        createRole('social-education-petite-enfance-social-insertion-assistant-social', 'Assistant social'),
        createRole('social-education-petite-enfance-social-insertion-conseiller-insertion', 'Conseiller insertion'),
        createRole('social-education-petite-enfance-social-insertion-educateur-specialise', 'Éducateur spécialisé'),
        createRole('social-education-petite-enfance-social-insertion-moniteur-educateur', 'Moniteur éducateur'),
      ]),
      createFamily('social-education-petite-enfance-education-pedagogie', 'Éducation et pédagogie', [
        createRole('social-education-petite-enfance-education-pedagogie-formateur', 'Formateur'),
        createRole('social-education-petite-enfance-education-pedagogie-coordinateur-pedagogique', 'Coordinateur pédagogique'),
        createRole('social-education-petite-enfance-education-pedagogie-professeur', 'Professeur'),
        createRole('social-education-petite-enfance-education-pedagogie-chef-de-projet-pedagogique', 'Chef de projet pédagogique'),
      ]),
      createFamily('social-education-petite-enfance-petite-enfance', 'Petite enfance', [
        createRole('social-education-petite-enfance-petite-enfance-auxiliaire-de-creche', 'Auxiliaire de crèche'),
        createRole('social-education-petite-enfance-petite-enfance-educateur-de-jeunes-enfants', 'Éducateur de jeunes enfants'),
        createRole('social-education-petite-enfance-petite-enfance-assistant-maternel', 'Assistant maternel'),
        createRole('social-education-petite-enfance-petite-enfance-directeur-de-creche', 'Directeur de crèche'),
      ]),
      createFamily('social-education-petite-enfance-animation-accompagnement', 'Animation et accompagnement', [
        createRole('social-education-petite-enfance-animation-accompagnement-animateur-socio-culturel', 'Animateur socio-culturel'),
        createRole('social-education-petite-enfance-animation-accompagnement-animateur-periscolaire', 'Animateur périscolaire'),
        createRole('social-education-petite-enfance-animation-accompagnement-mediateur-social', 'Médiateur social'),
        createRole('social-education-petite-enfance-animation-accompagnement-accompagnant-educatif', 'Accompagnant éducatif'),
      ]),
    ]),
    createSector('hotellerie-restauration-tourisme', 'Hôtellerie, restauration et tourisme', [
      createFamily('hotellerie-restauration-tourisme-cuisine', 'Cuisine', [
        createRole('hotellerie-restauration-tourisme-cuisine-cuisinier', 'Cuisinier'),
        createRole('hotellerie-restauration-tourisme-cuisine-chef-de-partie', 'Chef de partie'),
        createRole('hotellerie-restauration-tourisme-cuisine-chef-de-cuisine', 'Chef de cuisine'),
        createRole('hotellerie-restauration-tourisme-cuisine-commis-de-cuisine', 'Commis de cuisine'),
      ]),
      createFamily('hotellerie-restauration-tourisme-salle-bar', 'Salle et bar', [
        createRole('hotellerie-restauration-tourisme-salle-bar-serveur', 'Serveur'),
        createRole('hotellerie-restauration-tourisme-salle-bar-chef-de-rang', 'Chef de rang'),
        createRole('hotellerie-restauration-tourisme-salle-bar-barman', 'Barman'),
        createRole('hotellerie-restauration-tourisme-salle-bar-maitre-dhotel', "Maître d'hôtel"),
      ]),
      createFamily('hotellerie-restauration-tourisme-hebergement-reception', 'Hébergement et réception', [
        createRole('hotellerie-restauration-tourisme-hebergement-reception-receptionniste', 'Réceptionniste'),
        createRole('hotellerie-restauration-tourisme-hebergement-reception-gouvernant', 'Gouvernant'),
        createRole('hotellerie-restauration-tourisme-hebergement-reception-concierge-dhotel', "Concierge d'hôtel"),
        createRole('hotellerie-restauration-tourisme-hebergement-reception-assistant-dexploitation-hoteliere', "Assistant d'exploitation hôtelière"),
      ]),
      createFamily('hotellerie-restauration-tourisme-tourisme-evenementiel', 'Tourisme et événementiel', [
        createRole('hotellerie-restauration-tourisme-tourisme-evenementiel-conseiller-voyages', 'Conseiller voyages'),
        createRole('hotellerie-restauration-tourisme-tourisme-evenementiel-guide-accompagnateur', 'Guide accompagnateur'),
        createRole('hotellerie-restauration-tourisme-tourisme-evenementiel-responsable-evenementiel', 'Responsable événementiel'),
        createRole('hotellerie-restauration-tourisme-tourisme-evenementiel-chef-de-projet-tourisme', 'Chef de projet tourisme'),
      ]),
    ]),
    createSector('immobilier-banque-assurance-patrimoine', 'Immobilier, banque, assurance et patrimoine', [
      createFamily('immobilier-banque-assurance-patrimoine-immobilier-transaction-gestion', 'Immobilier transaction et gestion', [
        createRole('immobilier-banque-assurance-patrimoine-immobilier-transaction-gestion-agent-immobilier', 'Agent immobilier'),
        createRole('immobilier-banque-assurance-patrimoine-immobilier-transaction-gestion-negociateur-immobilier', 'Négociateur immobilier'),
        createRole('immobilier-banque-assurance-patrimoine-immobilier-transaction-gestion-gestionnaire-locatif', 'Gestionnaire locatif'),
        createRole('immobilier-banque-assurance-patrimoine-immobilier-transaction-gestion-syndic-de-copropriete', 'Syndic de copropriété'),
      ]),
      createFamily('immobilier-banque-assurance-patrimoine-banque-credit', 'Banque et crédit', [
        createRole('immobilier-banque-assurance-patrimoine-banque-credit-conseiller-bancaire', 'Conseiller bancaire'),
        createRole('immobilier-banque-assurance-patrimoine-banque-credit-charge-de-clientele-bancaire', 'Chargé de clientèle bancaire'),
        createRole('immobilier-banque-assurance-patrimoine-banque-credit-analyste-credit', 'Analyste crédit'),
        createRole('immobilier-banque-assurance-patrimoine-banque-credit-gestionnaire-middle-office', 'Gestionnaire middle office'),
      ]),
      createFamily('immobilier-banque-assurance-patrimoine-assurance-sinistres', 'Assurance et sinistres', [
        createRole('immobilier-banque-assurance-patrimoine-assurance-sinistres-conseiller-assurance', 'Conseiller assurance'),
        createRole('immobilier-banque-assurance-patrimoine-assurance-sinistres-gestionnaire-sinistres', 'Gestionnaire sinistres'),
        createRole('immobilier-banque-assurance-patrimoine-assurance-sinistres-souscripteur', 'Souscripteur'),
        createRole('immobilier-banque-assurance-patrimoine-assurance-sinistres-courtier-en-assurance', 'Courtier en assurance'),
      ]),
      createFamily('immobilier-banque-assurance-patrimoine-patrimoine-conseil', 'Patrimoine et conseil', [
        createRole('immobilier-banque-assurance-patrimoine-patrimoine-conseil-conseiller-patrimonial', 'Conseiller patrimonial'),
        createRole('immobilier-banque-assurance-patrimoine-patrimoine-conseil-gestionnaire-de-patrimoine', 'Gestionnaire de patrimoine'),
        createRole('immobilier-banque-assurance-patrimoine-patrimoine-conseil-charge-daffaires-entreprises', "Chargé d'affaires entreprises"),
        createRole('immobilier-banque-assurance-patrimoine-patrimoine-conseil-conseiller-en-investissements-financiers', 'Conseiller en investissements financiers'),
      ]),
      createFamily('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique', 'Copropriété, patrimoine et technique', [
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-gestionnaire-de-copropriete', 'Gestionnaire de copropriété'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-assistant-copropriete', 'Assistant copropriété'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-comptable-copropriete', 'Comptable copropriété'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-responsable-patrimoine', 'Responsable patrimoine'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-charge-doperations-immobilieres', "Chargé d'opérations immobilières"),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-charge-de-patrimoine', 'Chargé de patrimoine'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-property-manager', 'Property manager'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-asset-manager-immobilier', 'Asset manager immobilier'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-responsable-technique-immobilier', 'Responsable technique immobilier'),
        createRole('immobilier-banque-assurance-patrimoine-copropriete-patrimoine-technique-charge-de-maintenance-patrimoine', 'Chargé de maintenance patrimoine'),
      ]),
    ]),
    createSector('conseil-ingenierie-recherche', 'Conseil, ingénierie et recherche', [
      createFamily('conseil-ingenierie-recherche-conseil-transformation', 'Conseil et transformation', [
        createRole('conseil-ingenierie-recherche-conseil-transformation-consultant', 'Consultant'),
        createRole('conseil-ingenierie-recherche-conseil-transformation-consultant-en-organisation', "Consultant en organisation"),
        createRole('conseil-ingenierie-recherche-conseil-transformation-business-analyst', 'Business analyst'),
        createRole('conseil-ingenierie-recherche-conseil-transformation-consultant-transformation', 'Consultant transformation'),
      ]),
      createFamily('conseil-ingenierie-recherche-ingenierie-etudes', 'Ingénierie et études', [
        createRole('conseil-ingenierie-recherche-ingenierie-etudes-ingenieur-detudes', "Ingénieur d'études"),
        createRole('conseil-ingenierie-recherche-ingenierie-etudes-ingenieur-projet', 'Ingénieur projet'),
        createRole('conseil-ingenierie-recherche-ingenierie-etudes-responsable-bureau-detudes', "Responsable bureau d'études"),
        createRole('conseil-ingenierie-recherche-ingenierie-etudes-ingenieur-systeme', 'Ingénieur système'),
      ]),
      createFamily('conseil-ingenierie-recherche-gestion-de-projet', 'Gestion de projet', [
        createRole('conseil-ingenierie-recherche-gestion-de-projet-chef-de-projet', 'Chef de projet'),
        createRole('conseil-ingenierie-recherche-gestion-de-projet-pmo', 'PMO'),
        createRole('conseil-ingenierie-recherche-gestion-de-projet-coordinateur-de-projet', 'Coordinateur de projet'),
        createRole('conseil-ingenierie-recherche-gestion-de-projet-directeur-de-projet', 'Directeur de projet'),
      ]),
      createFamily('conseil-ingenierie-recherche-rd-innovation-qse', 'R&D, innovation et QSE', [
        createRole('conseil-ingenierie-recherche-rd-innovation-qse-ingenieur-rd', 'Ingénieur R&D'),
        createRole('conseil-ingenierie-recherche-rd-innovation-qse-charge-dinnovation', "Chargé d'innovation"),
        createRole('conseil-ingenierie-recherche-rd-innovation-qse-responsable-qse', 'Responsable QSE'),
        createRole('conseil-ingenierie-recherche-rd-innovation-qse-ingenieur-qualite', 'Ingénieur qualité'),
      ]),
    ]),
    createSector('agriculture-agroalimentaire-environnement', 'Agriculture, agroalimentaire et environnement', [
      createFamily('agriculture-agroalimentaire-environnement-production-agricole', 'Production agricole', [
        createRole('agriculture-agroalimentaire-environnement-production-agricole-ouvrier-agricole', 'Ouvrier agricole'),
        createRole('agriculture-agroalimentaire-environnement-production-agricole-chef-de-culture', 'Chef de culture'),
        createRole('agriculture-agroalimentaire-environnement-production-agricole-conducteur-dengins-agricoles', "Conducteur d'engins agricoles"),
        createRole('agriculture-agroalimentaire-environnement-production-agricole-technicien-agricole', 'Technicien agricole'),
      ]),
      createFamily('agriculture-agroalimentaire-environnement-agroalimentaire', 'Agroalimentaire', [
        createRole('agriculture-agroalimentaire-environnement-agroalimentaire-operateur-agroalimentaire', 'Opérateur agroalimentaire'),
        createRole('agriculture-agroalimentaire-environnement-agroalimentaire-conducteur-de-ligne-agro', 'Conducteur de ligne agro'),
        createRole(
          'agriculture-agroalimentaire-environnement-agroalimentaire-responsable-production-agroalimentaire',
          'Responsable production agroalimentaire',
        ),
        createRole('agriculture-agroalimentaire-environnement-agroalimentaire-technicien-qualite-agro', 'Technicien qualité agro'),
      ]),
      createFamily('agriculture-agroalimentaire-environnement-espaces-verts-paysage', 'Espaces verts et paysage', [
        createRole('agriculture-agroalimentaire-environnement-espaces-verts-paysage-jardinier-paysagiste', 'Jardinier paysagiste'),
        createRole('agriculture-agroalimentaire-environnement-espaces-verts-paysage-elagueur', 'Élagueur'),
        createRole('agriculture-agroalimentaire-environnement-espaces-verts-paysage-chef-dequipe-espaces-verts', "Chef d'équipe espaces verts"),
        createRole('agriculture-agroalimentaire-environnement-espaces-verts-paysage-ouvrier-paysagiste', 'Ouvrier paysagiste'),
      ]),
      createFamily('agriculture-agroalimentaire-environnement-environnement-soins-aux-animaux', 'Environnement et soins aux animaux', [
        createRole('agriculture-agroalimentaire-environnement-environnement-soins-aux-animaux-technicien-environnement', 'Technicien environnement'),
        createRole('agriculture-agroalimentaire-environnement-environnement-soins-aux-animaux-charge-de-mission-environnement', 'Chargé de mission environnement'),
        createRole('agriculture-agroalimentaire-environnement-environnement-soins-aux-animaux-soigneur-animalier', 'Soigneur animalier'),
        createRole('agriculture-agroalimentaire-environnement-environnement-soins-aux-animaux-auxiliaire-veterinaire', 'Auxiliaire vétérinaire'),
      ]),
    ]),
    createSector('securite-proprete-services-batiments', 'Sécurité, propreté et services aux bâtiments', [
      createFamily('securite-proprete-services-batiments-securite-privee', 'Sécurité privée', [
        createRole('securite-proprete-services-batiments-securite-privee-agent-de-securite', 'Agent de sécurité'),
        createRole('securite-proprete-services-batiments-securite-privee-chef-dequipe-securite', "Chef d'équipe sécurité"),
        createRole('securite-proprete-services-batiments-securite-privee-agent-cynophile', 'Agent cynophile'),
        createRole('securite-proprete-services-batiments-securite-privee-agent-ssiap', 'Agent SSIAP', ['ssiap']),
      ]),
      createFamily('securite-proprete-services-batiments-proprete', 'Propreté', [
        createRole('securite-proprete-services-batiments-proprete-agent-de-proprete', 'Agent de propreté'),
        createRole('securite-proprete-services-batiments-proprete-chef-dequipe-proprete', "Chef d'équipe propreté"),
        createRole('securite-proprete-services-batiments-proprete-agent-de-nettoyage-industriel', 'Agent de nettoyage industriel'),
        createRole('securite-proprete-services-batiments-proprete-responsable-proprete', 'Responsable propreté'),
      ]),
      createFamily('securite-proprete-services-batiments-maintenance-de-site', 'Maintenance de site', [
        createRole('securite-proprete-services-batiments-maintenance-de-site-technicien-de-maintenance-site', 'Technicien de maintenance site'),
        createRole('securite-proprete-services-batiments-maintenance-de-site-agent-multi-services', 'Agent multi-services'),
        createRole('securite-proprete-services-batiments-maintenance-de-site-gardien-dimmeuble', "Gardien d'immeuble"),
        createRole('securite-proprete-services-batiments-maintenance-de-site-factotum', 'Factotum'),
      ]),
      createFamily('securite-proprete-services-batiments-maintenance-technique', 'Maintenance technique et services généraux', [
        createRole('securite-proprete-services-batiments-maintenance-technique-agent-de-maintenance', 'Agent de maintenance'),
        createRole('securite-proprete-services-batiments-maintenance-technique-coordinateur-maintenance', 'Coordinateur maintenance'),
        createRole('securite-proprete-services-batiments-maintenance-technique-technicien-multitechnique', 'Technicien multitechnique'),
        createRole('securite-proprete-services-batiments-maintenance-technique-technicien-cvc', 'Technicien CVC'),
        createRole('securite-proprete-services-batiments-maintenance-technique-technicien-electricite-batiment', 'Technicien électricité bâtiment'),
        createRole('securite-proprete-services-batiments-maintenance-technique-technicien-plomberie', 'Technicien plomberie'),
        createRole('securite-proprete-services-batiments-maintenance-technique-technicien-securite-incendie', 'Technicien sécurité incendie'),
        createRole('securite-proprete-services-batiments-maintenance-technique-facility-manager', 'Facility manager'),
        createRole('securite-proprete-services-batiments-maintenance-technique-responsable-exploitation-technique', 'Responsable exploitation technique'),
      ]),
      createFamily('securite-proprete-services-batiments-accueil-services-generaux', 'Accueil et services généraux', [
        createRole('securite-proprete-services-batiments-accueil-services-generaux-hote-daccueil', "Hôte d'accueil"),
        createRole('securite-proprete-services-batiments-accueil-services-generaux-standardiste', 'Standardiste'),
        createRole('securite-proprete-services-batiments-accueil-services-generaux-office-manager', 'Office manager'),
        createRole('securite-proprete-services-batiments-accueil-services-generaux-responsable-services-generaux', 'Responsable services généraux'),
      ]),
    ]),
    createSector('administration-publique-collectivites', 'Administration publique et collectivités', [
      createFamily('administration-publique-collectivites-administration-generale', 'Administration générale', [
        createRole('administration-publique-collectivites-administration-generale-assistant-administratif', 'Assistant administratif'),
        createRole('administration-publique-collectivites-administration-generale-gestionnaire-administratif', 'Gestionnaire administratif'),
        createRole('administration-publique-collectivites-administration-generale-secretaire-de-mairie', 'Secrétaire de mairie'),
        createRole('administration-publique-collectivites-administration-generale-attache-territorial', 'Attaché territorial'),
      ]),
      createFamily('administration-publique-collectivites-finances-publiques-marches', 'Finances publiques et marchés', [
        createRole('administration-publique-collectivites-finances-publiques-marches-acheteur-public', 'Acheteur public'),
        createRole('administration-publique-collectivites-finances-publiques-marches-charge-des-marches-publics', 'Chargé des marchés publics'),
        createRole('administration-publique-collectivites-finances-publiques-marches-controleur-de-gestion-public', 'Contrôleur de gestion public'),
        createRole('administration-publique-collectivites-finances-publiques-marches-gestionnaire-comptable-public', 'Gestionnaire comptable public'),
      ]),
      createFamily('administration-publique-collectivites-services-techniques', 'Services techniques', [
        createRole('administration-publique-collectivites-services-techniques-technicien-voirie', 'Technicien voirie'),
        createRole('administration-publique-collectivites-services-techniques-agent-technique-territorial', 'Agent technique territorial'),
        createRole('administration-publique-collectivites-services-techniques-responsable-maintenance-batiments-publics', 'Responsable maintenance bâtiments publics'),
        createRole('administration-publique-collectivites-services-techniques-urbaniste', 'Urbaniste'),
      ]),
      createFamily('administration-publique-collectivites-sante-social-education-publics', 'Santé, social et éducation publics', [
        createRole('administration-publique-collectivites-sante-social-education-publics-infirmier-public', 'Infirmier public'),
        createRole('administration-publique-collectivites-sante-social-education-publics-assistant-social-public', 'Assistant social public'),
        createRole('administration-publique-collectivites-sante-social-education-publics-educateur-territorial', 'Éducateur territorial'),
        createRole('administration-publique-collectivites-sante-social-education-publics-animateur-territorial', 'Animateur territorial'),
      ]),
    ]),
    createSector('direction-management', 'Direction et management', [
      createFamily('direction-management-direction-generale-pilotage', 'Direction générale et pilotage', [
        createRole('direction-management-direction-generale-pilotage-dirigeant', 'Dirigeant'),
        createRole('direction-management-direction-generale-pilotage-gerant', 'Gérant'),
        createRole('direction-management-direction-generale-pilotage-directeur-general', 'Directeur général'),
        createRole('direction-management-direction-generale-pilotage-directeur-operationnel', 'Directeur opérationnel'),
        createRole('direction-management-direction-generale-pilotage-directeur-dagence', "Directeur d'agence"),
        createRole('direction-management-direction-generale-pilotage-responsable-dagence', "Responsable d'agence"),
        createRole('direction-management-direction-generale-pilotage-responsable-de-site', 'Responsable de site'),
        createRole('direction-management-direction-generale-pilotage-responsable-dexploitation', "Responsable d'exploitation"),
        createRole('direction-management-direction-generale-pilotage-manager-operationnel', 'Manager opérationnel'),
      ]),
    ]),
    createSector('administration-support', 'Administration et support', [
      createFamily('administration-support-support-administratif', 'Support administratif', [
        createRole('administration-support-support-administratif-assistant-de-direction', 'Assistant de direction'),
        createRole('administration-support-support-administratif-secretaire', 'Secrétaire'),
        createRole('administration-support-support-administratif-agent-daccueil', "Agent d'accueil"),
        createRole('administration-support-support-administratif-charge-de-planning', 'Chargé de planning'),
        createRole('administration-support-support-administratif-coordinateur-administratif', 'Coordinateur administratif'),
      ]),
    ]),
  ],
};

export const JOB_SECTORS = JOB_TAXONOMY.sectors;

export function getFamiliesBySector(sectorCode: string): JobFamily[] {
  return JOB_SECTORS.find((sector) => sector.code === sectorCode)?.families ?? [];
}

export function getRolesByFamily(familyCode: string): JobRole[] {
  for (const sector of JOB_SECTORS) {
    const family = sector.families.find((candidate) => candidate.code === familyCode);
    if (family) {
      return family.roles;
    }
  }

  return [];
}

export function findSectorLabel(sectorCode: string): string | undefined {
  return JOB_SECTORS.find((sector) => sector.code === sectorCode)?.label;
}

export function findFamilyLabel(familyCode: string): string | undefined {
  for (const sector of JOB_SECTORS) {
    const family = sector.families.find((candidate) => candidate.code === familyCode);
    if (family) {
      return family.label;
    }
  }

  return undefined;
}

export function findRoleLabel(roleCode: string): string | undefined {
  for (const sector of JOB_SECTORS) {
    for (const family of sector.families) {
      const role = family.roles.find((candidate) => candidate.code === roleCode);
      if (role) {
        return role.label;
      }
    }
  }

  return undefined;
}
