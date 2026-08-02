import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './types/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        seveno: {
          brand: {
            cyan: 'rgb(var(--seveno-brand-cyan) / <alpha-value>)',
            'cyan-soft': 'rgb(var(--seveno-brand-cyan-soft) / <alpha-value>)',
            blue: 'rgb(var(--seveno-brand-blue) / <alpha-value>)',
            'blue-strong': 'rgb(var(--seveno-brand-blue-strong) / <alpha-value>)',
            warm: 'rgb(var(--seveno-brand-warm) / <alpha-value>)',
          },
          surface: {
            page: 'rgb(var(--seveno-surface-page) / <alpha-value>)',
            section: 'rgb(var(--seveno-surface-section) / <alpha-value>)',
            panel: 'rgb(var(--seveno-surface-panel) / <alpha-value>)',
            elevated: 'rgb(var(--seveno-surface-elevated) / <alpha-value>)',
            active: 'rgb(var(--seveno-surface-active) / <alpha-value>)',
            hover: 'rgb(var(--seveno-surface-hover) / <alpha-value>)',
            overlay: 'rgb(var(--seveno-surface-overlay) / <alpha-value>)',
          },
          text: {
            primary: 'rgb(var(--seveno-text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--seveno-text-secondary) / <alpha-value>)',
            muted: 'rgb(var(--seveno-text-muted) / <alpha-value>)',
            disabled: 'rgb(var(--seveno-text-disabled) / <alpha-value>)',
            'on-accent': 'rgb(var(--seveno-text-on-accent) / <alpha-value>)',
            link: 'rgb(var(--seveno-text-link) / <alpha-value>)',
          },
          border: {
            subtle: 'rgb(var(--seveno-border-subtle) / <alpha-value>)',
            default: 'rgb(var(--seveno-border-default) / <alpha-value>)',
            strong: 'rgb(var(--seveno-border-strong) / <alpha-value>)',
            active: 'rgb(var(--seveno-border-active) / <alpha-value>)',
            focus: 'rgb(var(--seveno-border-focus) / <alpha-value>)',
          },
          action: {
            primary: 'rgb(var(--seveno-action-primary) / <alpha-value>)',
            'primary-hover': 'rgb(var(--seveno-action-primary-hover) / <alpha-value>)',
            secondary: 'rgb(var(--seveno-action-secondary) / <alpha-value>)',
            'secondary-hover': 'rgb(var(--seveno-action-secondary-hover) / <alpha-value>)',
            danger: 'rgb(var(--seveno-action-danger) / <alpha-value>)',
            disabled: 'rgb(var(--seveno-action-disabled) / <alpha-value>)',
          },
          state: {
            success: 'rgb(var(--seveno-state-success) / <alpha-value>)',
            warning: 'rgb(var(--seveno-state-warning) / <alpha-value>)',
            error: 'rgb(var(--seveno-state-error) / <alpha-value>)',
            info: 'rgb(var(--seveno-state-info) / <alpha-value>)',
            pending: 'rgb(var(--seveno-state-pending) / <alpha-value>)',
          },
          assessment: {
            general: 'rgb(var(--seveno-assessment-general) / <alpha-value>)',
            job: 'rgb(var(--seveno-assessment-job) / <alpha-value>)',
          },
          skill: 'rgb(var(--seveno-skill) / <alpha-value>)',
          prerequisite: 'rgb(var(--seveno-prerequisite) / <alpha-value>)',
          candidate: 'rgb(var(--seveno-candidate) / <alpha-value>)',
          company: 'rgb(var(--seveno-company) / <alpha-value>)',
          conversation: 'rgb(var(--seveno-conversation) / <alpha-value>)',
          'reciprocal-agreement': 'rgb(var(--seveno-reciprocal-agreement) / <alpha-value>)',
          'identity-reveal': 'rgb(var(--seveno-identity-reveal) / <alpha-value>)',
          score: {
            qualified: 'rgb(var(--seveno-score-qualified) / <alpha-value>)',
            'near-threshold': 'rgb(var(--seveno-score-near-threshold) / <alpha-value>)',
            'below-threshold': 'rgb(var(--seveno-score-below-threshold) / <alpha-value>)',
          },
        },
      },
      boxShadow: {
        soft: '0 18px 50px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
