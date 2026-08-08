'use client';

export function CompanySalesTermsPrintButton() {
  return <button type="button" onClick={() => window.print()} data-cgv-no-print="true" className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-300/60">Imprimer ou enregistrer les CGV</button>;
}
