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
        'rounded-[34px] border border-seveno-border-default bg-seveno-surface-section p-6 shadow-2xl sm:p-8 lg:p-10',
        className,
      ].join(' ')}
    >
      <div className="space-y-6">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-seveno-brand-cyan">{eyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-seveno-text-primary sm:text-4xl">{title}</h2>
          {description ? <p className="mt-5 max-w-4xl text-lg leading-8 text-seveno-text-secondary">{description}</p> : null}
        </div>

        {children}
      </div>
    </section>
  );
}
