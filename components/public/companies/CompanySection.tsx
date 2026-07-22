import type { ReactNode } from 'react';

type CompanySectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function CompanySection({
  eyebrow,
  title,
  description,
  children,
  className = '',
  id,
}: CompanySectionProps) {
  return (
    <section
      id={id}
      className={[
        'rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.9))] p-6 shadow-[0_28px_100px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10',
        className,
      ].join(' ')}
    >
      <div className="space-y-6">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/90">{eyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
          {description ? <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">{description}</p> : null}
        </div>

        {children}
      </div>
    </section>
  );
}
