export type LogoFeedbackValue = 'yes' | 'no';

export const LOGO_FEEDBACK_STORAGE_KEY = 'seveno_logo_feedback';

export function isLogoFeedbackValue(value: unknown): value is LogoFeedbackValue {
  return value === 'yes' || value === 'no';
}

export function readLogoFeedbackFromStorage(): LogoFeedbackValue | '' {
  if (typeof window === 'undefined') {
    return '';
  }

  const value = window.localStorage.getItem(LOGO_FEEDBACK_STORAGE_KEY);
  return isLogoFeedbackValue(value) ? value : '';
}

export function writeLogoFeedbackToStorage(value: LogoFeedbackValue) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOGO_FEEDBACK_STORAGE_KEY, value);
}
