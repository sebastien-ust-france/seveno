import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSevenoAssessmentV1Draft } from './seveno-assessment-v1-content-builder.mts';
import type { AssessmentDimensionCode, AssessmentQuestion, AssessmentQuestionOption, AssessmentVersionDescriptor } from '@/types/seveno-assessment';

type FormulaKey = 'A' | 'B' | 'C';

interface DimensionCalibrationStats {
  formula: FormulaKey;
  min: number;
  max: number;
  mean: number;
  median: number;
  p05: number;
  p25: number;
  p75: number;
  p95: number;
  stdDev: number;
}

interface DimensionCalibrationReport {
  dimensionCode: AssessmentDimensionCode;
  label: string;
  questionCount: number;
  theoreticalMinimumPoints: number;
  theoreticalMaximumPoints: number;
  floorOffsetPoints: number;
  floorOffsetRatio: number;
  raw0to4: DimensionCalibrationStats;
  normalizedWithFloorRemoval: DimensionCalibrationStats;
  normalizedWithFloorKept: DimensionCalibrationStats;
  recommendation: FormulaKey;
  rationale: string;
}

interface CalibrationReport {
  generatedAt: string;
  sampleCount: number;
  versionId: string;
  versionCode: string;
  versionNumber: string;
  recommendation: FormulaKey;
  dimensions: DimensionCalibrationReport[];
}

interface DimensionBounds {
  minimumPoints: number;
  maximumPoints: number;
  questionCount: number;
}

const SAMPLE_COUNT = 20_000;
const CALIBRATION_SEED = 0x7e0a19;

function mulberry32(seed: number) {
  let state = seed >>> 0;

  return function nextRandom() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const position = (sortedValues.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex] ?? 0;
  const upperValue = sortedValues[upperIndex] ?? lowerValue;

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stdDev(values: number[], average: number) {
  if (values.length === 0) {
    return 0;
  }

  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function pickRandomOption(question: AssessmentQuestion, random: () => number): AssessmentQuestionOption {
  const index = Math.floor(random() * question.options.length) % question.options.length;
  return question.options[index]!;
}

function buildDimensionBounds(version: AssessmentVersionDescriptor) {
  const bounds = new Map<AssessmentDimensionCode, DimensionBounds>();

  for (const dimension of version.dimensions) {
    bounds.set(dimension.code, {
      minimumPoints: 0,
      maximumPoints: 0,
      questionCount: 0,
    });
  }

  for (const question of version.questions) {
    const dimensions = [...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])];
    for (const dimensionCode of dimensions) {
      const current = bounds.get(dimensionCode);
      if (!current) {
        continue;
      }

      const minimum = question.options.reduce((min, option) => {
        const score = option.dimensionScores[dimensionCode] ?? 0;
        return score < min ? score : min;
      }, 4);
      const maximum = question.options.reduce((max, option) => {
        const score = option.dimensionScores[dimensionCode] ?? 0;
        return score > max ? score : max;
      }, 0);

      current.minimumPoints += minimum;
      current.maximumPoints += maximum;
      current.questionCount += 1;
    }
  }

  return bounds;
}

function scoreDimensionSample(
  questions: AssessmentQuestion[],
  dimensionCode: AssessmentDimensionCode,
  selectedOptions: AssessmentQuestionOption[],
) {
  let obtainedPoints = 0;
  let relevantQuestions = 0;

  for (const [index, question] of questions.entries()) {
    const dimensions = [...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])];
    if (!dimensions.includes(dimensionCode)) {
      continue;
    }

    relevantQuestions += 1;
    const selectedOption = selectedOptions[index] ?? question.options[0];
    obtainedPoints += selectedOption.dimensionScores[dimensionCode] ?? 0;
  }

  return { obtainedPoints, relevantQuestions };
}

function buildFormulaScores(
  obtainedPoints: number,
  bounds: DimensionBounds,
  relevantQuestions: number,
) {
  const raw0to4Denominator = Math.max(1, relevantQuestions * 4);
  const floorRemovalDenominator = Math.max(1, bounds.maximumPoints - bounds.minimumPoints);
  const floorKeptDenominator = Math.max(1, bounds.maximumPoints);

  return {
    A: clampScore((obtainedPoints / raw0to4Denominator) * 100),
    B: clampScore(((obtainedPoints - bounds.minimumPoints) / floorRemovalDenominator) * 100),
    C: clampScore((obtainedPoints / floorKeptDenominator) * 100),
  } satisfies Record<FormulaKey, number>;
}

function summarizeFormula(values: number[], formula: FormulaKey): DimensionCalibrationStats {
  const sorted = [...values].sort((left, right) => left - right);
  const average = mean(sorted);

  return {
    formula,
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
    mean: Number(average.toFixed(1)),
    median: Number(percentile(sorted, 0.5).toFixed(1)),
    p05: Number(percentile(sorted, 0.05).toFixed(1)),
    p25: Number(percentile(sorted, 0.25).toFixed(1)),
    p75: Number(percentile(sorted, 0.75).toFixed(1)),
    p95: Number(percentile(sorted, 0.95).toFixed(1)),
    stdDev: Number(stdDev(sorted, average).toFixed(1)),
  };
}

function chooseRecommendation(raw: DimensionCalibrationStats, floorRemoval: DimensionCalibrationStats, floorKept: DimensionCalibrationStats) {
  const floorRemovalDistance = Math.abs(floorRemoval.mean - 50) + Math.abs(floorRemoval.median - 50);
  const floorKeptDistance = Math.abs(floorKept.mean - 50) + Math.abs(floorKept.median - 50);
  const rawDistance = Math.abs(raw.mean - 50) + Math.abs(raw.median - 50);

  if (floorRemovalDistance <= rawDistance && floorRemovalDistance <= floorKeptDistance) {
    return 'B' as const;
  }

  if (rawDistance <= floorKeptDistance) {
    return 'A' as const;
  }

  return 'C' as const;
}

function buildCalibrationReport(): CalibrationReport {
  const version = buildSevenoAssessmentV1Draft();
  const random = mulberry32(CALIBRATION_SEED);
  const bounds = buildDimensionBounds(version);
  const samplesByDimension = new Map<AssessmentDimensionCode, { A: number[]; B: number[]; C: number[] }>();

  for (const dimension of version.dimensions) {
    samplesByDimension.set(dimension.code, { A: [], B: [], C: [] });
  }

  for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
    const selectedOptions = version.questions.map((question) => pickRandomOption(question, random));

    for (const dimension of version.dimensions) {
      const dimensionBounds = bounds.get(dimension.code);
      const sampleBuckets = samplesByDimension.get(dimension.code);
      if (!dimensionBounds || !sampleBuckets) {
        continue;
      }

      const { obtainedPoints, relevantQuestions } = scoreDimensionSample(version.questions, dimension.code, selectedOptions);
      const scores = buildFormulaScores(obtainedPoints, dimensionBounds, relevantQuestions);
      sampleBuckets.A.push(scores.A);
      sampleBuckets.B.push(scores.B);
      sampleBuckets.C.push(scores.C);
    }
  }

  const dimensions = version.dimensions.map((dimension) => {
    const dimensionBounds = bounds.get(dimension.code);
    const samples = samplesByDimension.get(dimension.code);
    assert.ok(dimensionBounds);
    assert.ok(samples);

    const rawStats = summarizeFormula(samples.A, 'A');
    const floorRemovalStats = summarizeFormula(samples.B, 'B');
    const floorKeptStats = summarizeFormula(samples.C, 'C');
    const recommendation = chooseRecommendation(rawStats, floorRemovalStats, floorKeptStats);
    const floorOffsetPoints = dimensionBounds.minimumPoints;
    const floorOffsetRatio = dimensionBounds.maximumPoints > 0
      ? Number(((floorOffsetPoints / dimensionBounds.maximumPoints) * 100).toFixed(1))
      : 0;

    return {
      dimensionCode: dimension.code,
      label: dimension.label,
      questionCount: dimensionBounds.questionCount,
      theoreticalMinimumPoints: floorOffsetPoints,
      theoreticalMaximumPoints: dimensionBounds.maximumPoints,
      floorOffsetPoints,
      floorOffsetRatio,
      raw0to4: rawStats,
      normalizedWithFloorRemoval: floorRemovalStats,
      normalizedWithFloorKept: floorKeptStats,
      recommendation,
      rationale: recommendation === 'B'
        ? 'La banque n utilise pas un plancher nul: la normalisation doit retirer la borne minimale observée pour utiliser toute la plage 0-100.'
        : recommendation === 'A'
          ? 'La distribution est mieux lue sur une echelle brute 0-4 pour cette dimension.'
          : 'Le maintien du plancher actuel reste statistiquement acceptable pour cette dimension.',
    } satisfies DimensionCalibrationReport;
  });

  const recommendationCounts = dimensions.reduce((counts, dimension) => {
    counts[dimension.recommendation] += 1;
    return counts;
  }, { A: 0, B: 0, C: 0 } satisfies Record<FormulaKey, number>);
  const recommendation = (recommendationCounts.B >= recommendationCounts.A && recommendationCounts.B >= recommendationCounts.C
    ? 'B'
    : recommendationCounts.A >= recommendationCounts.C
      ? 'A'
      : 'C') as FormulaKey;

  return {
    generatedAt: new Date().toISOString(),
    sampleCount: SAMPLE_COUNT,
    versionId: version.id,
    versionCode: version.code,
    versionNumber: version.version,
    recommendation,
    dimensions,
  };
}

function renderCalibrationMarkdown(report: CalibrationReport) {
  const lines = [
    '# Calibration Seven’O v1',
    '',
    `- Version: ${report.versionCode} (${report.versionNumber})`,
    `- Échantillons simulés: ${report.sampleCount}`,
    `- Recommandation globale: ${report.recommendation}`,
    '',
    '## Décision',
    '',
    'La formule B est retenue pour le socle v1: elle retire le plancher implicite des questions et restitue une lecture plus juste de la plage 0-100.',
    '',
    '## Détails par dimension',
    '',
  ];

  for (const dimension of report.dimensions) {
    lines.push(
      `### ${dimension.dimensionCode} — ${dimension.label}`,
      `- Questions contributrices: ${dimension.questionCount}`,
      `- Bornes théoriques: ${dimension.theoreticalMinimumPoints} à ${dimension.theoreticalMaximumPoints}`,
      `- Écart plancher: ${dimension.floorOffsetPoints} (${dimension.floorOffsetRatio} % de la borne maximale)`,
      `- Recommandation: ${dimension.recommendation}`,
      `- Justification: ${dimension.rationale}`,
      `- Formule A (0-4 brut): min=${dimension.raw0to4.min}, max=${dimension.raw0to4.max}, moyenne=${dimension.raw0to4.mean}, médiane=${dimension.raw0to4.median}, p05=${dimension.raw0to4.p05}, p25=${dimension.raw0to4.p25}, p75=${dimension.raw0to4.p75}, p95=${dimension.raw0to4.p95}, écart-type=${dimension.raw0to4.stdDev}`,
      `- Formule B (plancher retiré): min=${dimension.normalizedWithFloorRemoval.min}, max=${dimension.normalizedWithFloorRemoval.max}, moyenne=${dimension.normalizedWithFloorRemoval.mean}, médiane=${dimension.normalizedWithFloorRemoval.median}, p05=${dimension.normalizedWithFloorRemoval.p05}, p25=${dimension.normalizedWithFloorRemoval.p25}, p75=${dimension.normalizedWithFloorRemoval.p75}, p95=${dimension.normalizedWithFloorRemoval.p95}, écart-type=${dimension.normalizedWithFloorRemoval.stdDev}`,
      `- Formule C (plancher conservé): min=${dimension.normalizedWithFloorKept.min}, max=${dimension.normalizedWithFloorKept.max}, moyenne=${dimension.normalizedWithFloorKept.mean}, médiane=${dimension.normalizedWithFloorKept.median}, p05=${dimension.normalizedWithFloorKept.p05}, p25=${dimension.normalizedWithFloorKept.p25}, p75=${dimension.normalizedWithFloorKept.p75}, p95=${dimension.normalizedWithFloorKept.p95}, écart-type=${dimension.normalizedWithFloorKept.stdDev}`,
      '',
    );
  }

  return lines.join('\n');
}

function writeCalibrationFiles(report: CalibrationReport) {
  const root = process.cwd();
  const dataDir = resolve(root, 'scripts/data');
  const docsDir = resolve(root, 'docs');
  const reportPath = resolve(dataDir, 'seveno-professional-assessment-v1-calibration.json');
  const markdownPath = resolve(docsDir, 'seveno-assessment-v1-calibration.md');

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, `${renderCalibrationMarkdown(report)}\n`, 'utf8');

  return { reportPath, markdownPath };
}

function main() {
  const report = buildCalibrationReport();
  const paths = writeCalibrationFiles(report);

  assert.equal(report.sampleCount, SAMPLE_COUNT);
  assert.equal(report.recommendation, 'B');
  assert.equal(report.dimensions.length, buildSevenoAssessmentV1Draft().dimensions.length);

  console.log(JSON.stringify({
    recommendation: report.recommendation,
    sampleCount: report.sampleCount,
    versionId: report.versionId,
    paths,
  }, null, 2));
}

main();
