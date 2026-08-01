export const COMPANY_QUESTION_TIME_LIMIT_SECONDS = 15;
// Difficulty describes reasoning depth only; every company questionnaire question has the same weight.
export const COMPANY_QUESTION_POINTS = 1;
export const COMPANY_QUESTIONNAIRE_QUESTION_COUNT = 20;
export const COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION = {
  easy: 6,
  medium: 10,
  hard: 4,
} as const;
export const COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT = 70;
export const COMPANY_QUESTIONNAIRE_NEAR_THRESHOLD_MARGIN_POINTS = 5;
export const COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES = [
  50,
  55,
  60,
  65,
  70,
  75,
  80,
  85,
  90,
  95,
  100,
] as const;
export const COMPANY_QUESTIONNAIRE_AI_SCHEMA = 'seveno_company_questionnaire_v1';
