import * as assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBMI,
  calculateBRI,
  calculateFamilyHistoryRisk,
  calculateMedicalHistoryRisk,
  classifyBMI,
  classifyBRI,
  classifyBloodPressure,
  getStressRiskColor,
} from './medical';

test('classifies blood pressure boundaries correctly', () => {
  const cases: Array<[number, number, boolean | undefined, ReturnType<typeof classifyBloodPressure>]> = [
    [119, 79, false, 'Normal'],
    [120, 79, false, 'Elevated'],
    [129, 79, false, 'Elevated'],
    [129, 80, false, 'Stage 1 Hypertension'],
    [130, 70, false, 'Stage 1 Hypertension'],
    [139, 89, false, 'Stage 1 Hypertension'],
    [120, 89, false, 'Stage 1 Hypertension'],
    [140, 70, false, 'Stage 2 Hypertension'],
    [139, 90, false, 'Stage 2 Hypertension'],
    [180, 120, false, 'Stage 2 Hypertension'],
    [181, 70, false, 'Severe Hypertension'],
    [120, 121, false, 'Severe Hypertension'],
    [181, 121, false, 'Severe Hypertension'],
    [181, 70, true, 'Hypertensive Emergency'],
    [120, 121, true, 'Hypertensive Emergency'],
    [125, 85, false, 'Stage 1 Hypertension'],
    [135, 95, false, 'Stage 2 Hypertension'],
    [110, 121, false, 'Severe Hypertension'],
  ];

  for (const [systolic, diastolic, hasSymptoms, expected] of cases) {
    assert.equal(classifyBloodPressure(systolic, diastolic, hasSymptoms), expected);
  }
});

test('classifies family history risk correctly', () => {
  const cases: Array<[string, Parameters<typeof calculateFamilyHistoryRisk>[0], ReturnType<typeof calculateFamilyHistoryRisk>['color']]> = [
    ['No family history', { submitted: true }, 'green'],
    ['Diabetes only', { submitted: true, diabetes: true }, 'yellow'],
    ['BP only', { submitted: true, hypertension: true }, 'yellow'],
    ['Heart disease', { submitted: true, heartDisease: true }, 'red'],
    ['Stroke', { submitted: true, stroke: true }, 'red'],
    ['Diabetes + BP', { submitted: true, diabetes: true, hypertension: true }, 'red'],
  ];

  for (const [label, input, expectedColor] of cases) {
    assert.equal(calculateFamilyHistoryRisk(input).color, expectedColor, label);
  }
});

test('classifies medical history risk correctly', () => {
  const cases: Array<[string, Parameters<typeof calculateMedicalHistoryRisk>[0], ReturnType<typeof calculateMedicalHistoryRisk>['color']]> = [
    ['No medical history', { submitted: true }, 'green'],
    ['Diabetes only', { submitted: true, diabetes: true }, 'yellow'],
    ['BP only', { submitted: true, hypertension: true }, 'yellow'],
    ['High cholesterol only', { submitted: true, highCholesterol: true }, 'yellow'],
    ['Heart disease', { submitted: true, heartDisease: true }, 'red'],
    ['Diabetes + BP', { submitted: true, diabetes: true, hypertension: true }, 'red'],
  ];

  for (const [label, input, expectedColor] of cases) {
    assert.equal(calculateMedicalHistoryRisk(input).color, expectedColor, label);
  }
});

test('maps stress risk level to badge color', () => {
  assert.equal(getStressRiskColor('🟢 Low Stress'), 'green');
  assert.equal(getStressRiskColor('🟡 Moderate Stress'), 'yellow');
  assert.equal(getStressRiskColor('🔴 High Stress'), 'red');
  assert.equal(getStressRiskColor(''), 'grey');
});

test('calculates and classifies BMI using Indian/Asian screening thresholds', () => {
  const normalBmi = calculateBMI(170, 65);
  assert.equal(normalBmi, 22.5);
  assert.equal(classifyBMI(normalBmi).color, 'green');
  assert.equal(classifyBMI(normalBmi).level, 'Normal BMI');

  const highBmi = calculateBMI(170, 75);
  assert.equal(highBmi, 26.0);
  assert.equal(classifyBMI(highBmi).color, 'red');
  assert.equal(classifyBMI(highBmi).level, 'Obese / High Risk');

  assert.equal(classifyBMI(null).level, 'Not calculated');
});

test('calculates and classifies BRI using MVP screening thresholds', () => {
  const lowerBri = calculateBRI(170, 75);
  assert.equal(classifyBRI(lowerBri).color, 'green');
  assert.equal(classifyBRI(lowerBri).level, 'Lower BRI');

  const elevatedBri = calculateBRI(170, 90);
  assert.equal(classifyBRI(elevatedBri).color, 'yellow');
  assert.equal(classifyBRI(elevatedBri).level, 'Elevated BRI');

  const highBri = calculateBRI(170, 100);
  assert.equal(classifyBRI(highBri).color, 'red');
  assert.equal(classifyBRI(highBri).level, 'High BRI');

  assert.equal(classifyBRI(null).level, 'Not calculated');
});
