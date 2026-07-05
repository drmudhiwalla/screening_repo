import * as assert from 'node:assert/strict';
import test from 'node:test';

import { classifyBloodPressure } from './medical';

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
