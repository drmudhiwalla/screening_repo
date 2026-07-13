function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateBMI(heightCm, weightKg) {
  const height = positiveNumber(heightCm);
  const weight = positiveNumber(weightKg);
  if (!height || !weight) return null;

  const heightM = height / 100;
  return round(weight / (heightM * heightM), 1);
}

export function classifyBMI(bmi) {
  if (bmi === null || bmi === undefined || !Number.isFinite(Number(bmi))) {
    return {
      value: null,
      level: 'Not calculated',
      badge: 'Pending',
      color: 'grey',
    };
  }

  const value = round(Number(bmi), 1);
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

export function calculateBRI(heightCm, waistCm) {
  const height = positiveNumber(heightCm);
  const waist = positiveNumber(waistCm);
  if (!height || !waist) return null;

  const heightM = height / 100;
  const waistM = waist / 100;
  const denominator = 0.5 * heightM;
  const ratio = ((waistM / (2 * Math.PI)) ** 2) / (denominator ** 2);
  const bri = 364.2 - 365.5 * Math.sqrt(Math.max(0, 1 - ratio));
  return round(bri, 1);
}

export function classifyBRI(bri) {
  if (bri === null || bri === undefined || !Number.isFinite(Number(bri))) {
    return {
      value: null,
      level: 'Not calculated',
      badge: 'Pending',
      color: 'grey',
    };
  }

  const value = round(Number(bri), 1);
  if (value < 3.5) {
    return { value, level: 'Lower BRI', badge: '🟢', color: 'green' };
  }
  if (value < 5.0) {
    return { value, level: 'Elevated BRI', badge: '🟡', color: 'yellow' };
  }
  return { value, level: 'High BRI', badge: '🔴', color: 'red' };
}

export function calculateBodyMetrics(heightCm, weightKg, waistCm) {
  const bmiValue = calculateBMI(heightCm, weightKg);
  const briValue = calculateBRI(heightCm, waistCm);

  return {
    bmi: classifyBMI(bmiValue),
    bri: classifyBRI(briValue),
  };
}
