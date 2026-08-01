export function calculateCompanyQuestionnaireScorePercent(
  correctAnswerCount: number,
  scoredQuestionCount: number,
) {
  if (!Number.isInteger(correctAnswerCount) || !Number.isInteger(scoredQuestionCount)) {
    throw new Error('Les compteurs du questionnaire entreprise doivent être des entiers.');
  }
  if (correctAnswerCount < 0 || scoredQuestionCount < 0 || correctAnswerCount > scoredQuestionCount) {
    throw new Error('Les compteurs du questionnaire entreprise sont incohérents.');
  }
  return scoredQuestionCount > 0
    ? Math.round((correctAnswerCount / scoredQuestionCount) * 100)
    : null;
}
