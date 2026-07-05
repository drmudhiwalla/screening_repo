export type BloodPressureCategory =
  | 'Hypertensive Emergency'
  | 'Severe Hypertension'
  | 'Stage 2 Hypertension'
  | 'Stage 1 Hypertension'
  | 'Elevated'
  | 'Normal';

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

export function calculateBMI(weightKg: number, heightCm: number) {
  if (!weightKg || !heightCm) {
    return null;
  }

  const heightMeters = heightCm / 100;
  if (heightMeters <= 0) {
    return null;
  }

  return Number((weightKg / (heightMeters * heightMeters)).toFixed(1));
}

export function getBmiCategory(bmi: number | null | undefined) {
  if (bmi === null || bmi === undefined) {
    return 'Not available';
  }

  if (bmi < 18.5) {
    return 'Underweight';
  }

  if (bmi < 25) {
    return 'Healthy';
  }

  if (bmi < 30) {
    return 'Overweight';
  }

  return 'Obese';
}

export function getBmiStatus(bmi: number | null | undefined) {
  if (bmi === null || bmi === undefined) {
    return { label: 'Pending', tone: 'slate' as const };
  }

  if (bmi < 25) {
    return { label: 'Green', tone: 'green' as const };
  }

  if (bmi < 30) {
    return { label: 'Yellow', tone: 'amber' as const };
  }

  return { label: 'Red', tone: 'red' as const };
}

export function calculateBRI(heightCm: number, waistCm: number) {
  if (!heightCm || !waistCm) {
    return null;
  }

  const heightMeters = heightCm / 100;
  const waistMeters = waistCm / 100;
  if (heightMeters <= 0 || waistMeters <= 0) {
    return null;
  }

  const denominator = 0.5 * heightMeters;
  const ratio = ((waistMeters / (2 * Math.PI)) ** 2) / (denominator ** 2);
  const bri = 364.2 - 365.5 * Math.sqrt(Math.max(0, 1 - ratio));
  return Number(bri.toFixed(2));
}

export function getBriStatus(bri: number | null | undefined) {
  if (bri === null || bri === undefined) {
    return { label: 'Pending', tone: 'slate' as const };
  }

  if (bri < 3.5) {
    return { label: 'Green', tone: 'green' as const };
  }

  if (bri < 5.5) {
    return { label: 'Yellow', tone: 'amber' as const };
  }

  return { label: 'Red', tone: 'red' as const };
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
