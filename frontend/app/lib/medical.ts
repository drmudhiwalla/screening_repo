export type BloodPressureCategory =
  | 'Hypertensive Emergency'
  | 'Severe Hypertension'
  | 'Stage 2 Hypertension'
  | 'Stage 1 Hypertension'
  | 'Elevated'
  | 'Normal';

export type FamilyHistoryRiskColor = 'green' | 'yellow' | 'red' | 'grey';
export type StressRiskColor = 'green' | 'yellow' | 'red' | 'grey';
export type ScreeningColor = 'green' | 'yellow' | 'red' | 'grey';

export type BodyMetricResult = {
  value: number | null;
  level: string;
  badge: string;
  color: ScreeningColor;
};

export type FamilyHistoryInput = {
  diabetes?: boolean | null;
  hypertension?: boolean | null;
  heartDisease?: boolean | null;
  stroke?: boolean | null;
  highCholesterol?: boolean | null;
  multipleConditions?: boolean | null;
  submitted?: boolean | null;
};

export function classifyBloodPressure(
  systolic: number,
  diastolic: number,
  hasEmergencySymptoms = false
): BloodPressureCategory {
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    return 'Normal';
  }

  if (systolic > 180 || diastolic > 120) {
    if (hasEmergencySymptoms) {
      return 'Hypertensive Emergency';
    }
    return 'Severe Hypertension';
  }

  if (systolic >= 140 || diastolic >= 90) {
    return 'Stage 2 Hypertension';
  }

  if (
    (systolic >= 130 && systolic <= 139) ||
    (diastolic >= 80 && diastolic <= 89)
  ) {
    return 'Stage 1 Hypertension';
  }

  if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
    return 'Elevated';
  }

  if (systolic < 120 && diastolic < 80) {
    return 'Normal';
  }

  return 'Normal';
}

export function calculateBMI(heightCm: number, weightKg: number) {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightMeters = heightCm / 100;
  return Number((weightKg / (heightMeters * heightMeters)).toFixed(1));
}

export function classifyBMI(bmi: number | null | undefined): BodyMetricResult {
  if (bmi === null || bmi === undefined || !Number.isFinite(Number(bmi))) {
    return { value: null, level: 'Not calculated', badge: 'Pending', color: 'grey' };
  }

  const value = Number(Number(bmi).toFixed(1));
  if (value < 18.5) {
    return { value, level: 'Underweight', badge: '🟡', color: 'yellow' };
  }
  if (value <= 22.9) {
    return { value, level: 'Normal BMI', badge: '🟢', color: 'green' };
  }
  if (value <= 24.9) {
    return { value, level: 'Overweight / Increased Risk', badge: '🟡', color: 'yellow' };
  }
  return { value, level: 'Obese / High Risk', badge: '🔴', color: 'red' };
}

export function getBmiCategory(bmi: number | null | undefined) {
  return classifyBMI(bmi).level;
}

export function getBmiStatus(bmi: number | null | undefined) {
  const result = classifyBMI(bmi);
  return {
    ...result,
    label: result.color === 'grey' ? 'Pending' : `${result.badge} ${result.level}`,
    tone: result.color === 'yellow' ? 'amber' as const : result.color,
  };
}

export function calculateBRI(heightCm: number, waistCm: number) {
  if (!heightCm || !waistCm || heightCm <= 0 || waistCm <= 0) {
    return null;
  }

  const heightMeters = heightCm / 100;
  const waistMeters = waistCm / 100;
  const denominator = 0.5 * heightMeters;
  const ratio = ((waistMeters / (2 * Math.PI)) ** 2) / (denominator ** 2);
  const bri = 364.2 - 365.5 * Math.sqrt(Math.max(0, 1 - ratio));
  return Number(bri.toFixed(1));
}

export function classifyBRI(bri: number | null | undefined): BodyMetricResult {
  if (bri === null || bri === undefined || !Number.isFinite(Number(bri))) {
    return { value: null, level: 'Not calculated', badge: 'Pending', color: 'grey' };
  }

  const value = Number(Number(bri).toFixed(1));
  if (value < 3.5) {
    return { value, level: 'Lower BRI', badge: '🟢', color: 'green' };
  }
  if (value < 5.0) {
    return { value, level: 'Elevated BRI', badge: '🟡', color: 'yellow' };
  }
  return { value, level: 'High BRI', badge: '🔴', color: 'red' };
}

export function getBriStatus(bri: number | null | undefined) {
  const result = classifyBRI(bri);
  return {
    ...result,
    label: result.color === 'grey' ? 'Pending' : `${result.badge} ${result.level}`,
    tone: result.color === 'yellow' ? 'amber' as const : result.color,
  };
}

export function calculateBodyMetrics(heightCm: number, weightKg: number, waistCm: number) {
  const bmi = classifyBMI(calculateBMI(heightCm, weightKg));
  const bri = classifyBRI(calculateBRI(heightCm, waistCm));
  return { bmi, bri };
}

export function calculateFamilyHistoryRisk(input: FamilyHistoryInput | null | undefined) {
  if (!input?.submitted) {
    return {
      label: 'Pending',
      riskLevel: 'Family history not submitted yet',
      color: 'grey' as const,
      summary: 'Family history not submitted yet',
    };
  }

  const selectedConditions = [
    input.diabetes ? 'diabetes' : null,
    input.hypertension ? 'high blood pressure' : null,
    input.heartDisease ? 'heart disease' : null,
    input.stroke ? 'stroke' : null,
  ].filter(Boolean);

  if (!selectedConditions.length && !input.multipleConditions) {
    return {
      label: 'Green',
      riskLevel: 'Low Family History Risk',
      color: 'green' as const,
      summary: 'No family history of diabetes, high blood pressure, heart disease, or stroke reported.',
    };
  }

  const isHighRisk = Boolean(
    input.heartDisease ||
    input.stroke ||
    input.multipleConditions ||
    selectedConditions.length > 1
  );

  if (isHighRisk) {
    return {
      label: 'Red',
      riskLevel: 'High Family History Risk',
      color: 'red' as const,
      summary: 'Family history of heart disease/stroke or multiple cardiometabolic conditions reported.',
    };
  }

  return {
    label: 'Yellow',
    riskLevel: 'Moderate Family History Risk',
    color: 'yellow' as const,
    summary: `Family history of ${selectedConditions[0]} reported.`,
  };
}

export function getFamilyHistoryBadgeClasses(color: FamilyHistoryRiskColor | null | undefined) {
  return getRiskBadgeClasses(color);
}

export function getStressRiskColor(riskLevel: string | null | undefined): StressRiskColor {
  const normalized = String(riskLevel || '').toLowerCase();
  if (normalized.includes('high')) return 'red';
  if (normalized.includes('moderate')) return 'yellow';
  if (normalized.includes('low')) return 'green';
  return 'grey';
}

export function getStressBadgeClasses(color: StressRiskColor | null | undefined) {
  return getRiskBadgeClasses(color);
}

export function getRiskBadgeClasses(color: FamilyHistoryRiskColor | StressRiskColor | 'amber' | 'slate' | null | undefined) {
  switch (color) {
    case 'green':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'yellow':
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'red':
      return 'border-red-200 bg-red-50 text-red-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export function calculateMedicalHistoryRisk(input: FamilyHistoryInput | null | undefined) {
  if (!input?.submitted) {
    return {
      label: 'Pending',
      riskLevel: 'Medical history not submitted yet',
      color: 'grey' as const,
      summary: 'Medical history not submitted yet',
    };
  }

  const selectedConditions = [
    input.diabetes ? 'diabetes' : null,
    input.hypertension ? 'high blood pressure' : null,
    input.heartDisease ? 'heart disease' : null,
    input.highCholesterol ? 'high cholesterol' : null,
  ].filter(Boolean);

  if (!selectedConditions.length && !input.multipleConditions) {
    return {
      label: 'Green',
      riskLevel: 'Low Medical History Risk',
      color: 'green' as const,
      summary: 'No diagnosis or current medicines for diabetes, high blood pressure, heart disease, or high cholesterol reported.',
    };
  }

  const isHighRisk = Boolean(
    input.heartDisease ||
    input.multipleConditions ||
    selectedConditions.length > 1
  );

  if (isHighRisk) {
    return {
      label: 'Red',
      riskLevel: 'High Medical History Risk',
      color: 'red' as const,
      summary: 'Heart disease or multiple current cardiometabolic conditions/medicines reported.',
    };
  }

  return {
    label: 'Yellow',
    riskLevel: 'Moderate Medical History Risk',
    color: 'yellow' as const,
    summary: `Diagnosis or current medicines for ${selectedConditions[0]} reported.`,
  };
}

export function getBloodPressureBadgeClasses(category: BloodPressureCategory | null) {
  switch (category) {
    case 'Normal':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'Elevated':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'Stage 1 Hypertension':
      return 'border-orange-200 bg-orange-50 text-orange-800';
    case 'Stage 2 Hypertension':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'Severe Hypertension':
      return 'border-rose-500 bg-rose-50 text-rose-800';
    case 'Hypertensive Emergency':
      return 'border-red-700 bg-red-100 text-red-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}
