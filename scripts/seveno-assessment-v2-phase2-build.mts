import { writePhase2BankFiles } from './seveno-assessment-v2-phase2-content.mts';

const { bank, audit } = writePhase2BankFiles();

console.log(JSON.stringify({
  version: bank.versionMetadata.version,
  essentialQuestions: bank.essentialQuestionPool.length,
  extendedQuestions: bank.extendedQuestionPool.length,
  classifications: audit.classificationCounts,
  rewrittenQuestions: audit.rewrittenQuestionCount,
  rewrittenOptions: audit.rewrittenOptionCount,
}, null, 2));
