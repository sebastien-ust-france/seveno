'use client';

import { useEffect, useState } from 'react';
import { readLogoFeedbackFromStorage, writeLogoFeedbackToStorage } from '@/lib/logo-feedback';

export function LogoFeedbackPrompt() {
  const [selected, setSelected] = useState<'' | 'yes' | 'no'>('');

  useEffect(() => {
    setSelected(readLogoFeedbackFromStorage());
  }, []);

  function handleChoice(value: 'yes' | 'no') {
    setSelected(value);
    writeLogoFeedbackToStorage(value);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xl text-blue-200">
          💬
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-white">Ce logo vous plaît-il ?</p>
          <p className="mt-2 max-w-xl text-base leading-7 text-slate-300">
            Votre avis compte et nous aide à construire une identité forte pour Seveno.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
        <button
          type="button"
          onClick={() => handleChoice('yes')}
          className={
            'inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition ' +
            (selected === 'yes'
              ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300'
              : 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20')
          }
        >
          👍 Oui, j&apos;aime
        </button>
        <button
          type="button"
          onClick={() => handleChoice('no')}
          className={
            'inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition ' +
            (selected === 'no'
              ? 'border-rose-400 bg-rose-400/15 text-rose-300'
              : 'border-rose-400/35 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20')
          }
        >
          👎 Non, je n&apos;aime pas
        </button>
      </div>
    </div>
  );
}
