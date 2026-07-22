'use client';

export function PrivacyPolicyPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60 focus:ring-offset-2 focus:ring-offset-[#020817]"
      data-privacy-no-print="true"
    >
      Imprimer ou enregistrer la Politique de confidentialité
    </button>
  );
}
