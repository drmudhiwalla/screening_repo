import type { BloodPressureCategory } from './medical';

export type Registration = {
  id: number;
  name: string;
  age: string;
  gender: string;
  signature: string;
  createdAt: string;
  status: string;
  notes: string;
  uhid?: string;
  whatsappNumber?: string;
  assessmentUrl?: string | null;
  assessmentStatus?: string | null;
  assessmentSentAt?: string | null;
  assessmentSyncedAt?: string | null;
  assessmentCompletedAt?: string | null;
  assessmentResponseUrl?: string | null;
  assessmentResponseData?: Record<string, unknown> | null;
  assessmentAnalysis?: {
    score: number;
    maxScore: number;
    percent: number;
    riskLevel: string;
    riskColor?: 'green' | 'yellow' | 'red' | 'grey' | null;
    sheetScore?: number | null;
    sheetRiskLevel?: string | null;
    summary: string;
    recommendation?: string;
    focusAreas: string[];
    answers: Array<{ question: string; answer: string; score: number }>;
  } | null;
  assessmentError?: string | null;
  reportUrl?: string | null;
  reportSentAt?: string | null;
  reportError?: string | null;
  reportPdfSentAt?: string | null;
  reportPdfSendStatus?: string | null;
  reportPdfProviderMessageId?: string | null;
  reportPdfErrorMessage?: string | null;
  systolic?: number | null;
  diastolic?: number | null;
  bloodPressureCategory?: BloodPressureCategory | null;
  emergencySymptoms?: string[];
  hasEmergencySymptoms?: boolean;
  measuredAt?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  waistCm?: number | null;
  bmi?: number | null;
  bri?: number | null;
  bmiCategory?: string | null;
  briLabel?: string | null;
  bmiValue?: number | null;
  bmiLevel?: string | null;
  bmiColor?: 'green' | 'yellow' | 'red' | 'grey' | null;
  bmiBadge?: string | null;
  briValue?: number | null;
  briLevel?: string | null;
  briColor?: 'green' | 'yellow' | 'red' | 'grey' | null;
  briBadge?: string | null;
  familyHistoryDiabetes?: boolean | null;
  familyHistoryHypertension?: boolean | null;
  familyHistoryHeartDisease?: boolean | null;
  familyHistoryStroke?: boolean | null;
  familyHistoryRiskLevel?: string | null;
  familyHistoryRiskColor?: 'green' | 'yellow' | 'red' | 'grey' | null;
  familyHistorySummary?: string | null;
  familyHistoryRaw?: string | null;
  familyHistoryConditions?: string[];
  medicalHistoryDiabetes?: boolean | null;
  medicalHistoryHypertension?: boolean | null;
  medicalHistoryHeartDisease?: boolean | null;
  medicalHistoryHighCholesterol?: boolean | null;
  medicalHistoryRiskLevel?: string | null;
  medicalHistoryRiskColor?: 'green' | 'yellow' | 'red' | 'grey' | null;
  medicalHistorySummary?: string | null;
  medicalHistoryRaw?: string | null;
  medicalHistoryConditions?: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message || text;
    } catch {
      // Keep the plain response text when the backend did not return JSON.
    }
    throw new Error(message || 'Request failed');
  }

  return response.json() as Promise<T>;
}

export const loadRegistrations = async (): Promise<Registration[]> => {
  try {
    return await request<Registration[]>('/api/registrations');
  } catch {
    return [];
  }
};

export const createRegistration = async (payload: Omit<Registration, 'id' | 'createdAt' | 'status' | 'notes'> & { notes?: string; status?: string }) => {
  return request<Registration>('/api/registrations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const loginAdmin = async (email: string, password: string) => {
  return request<{ ok: boolean }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const updateRegistrationRecord = async (id: number, payload: Partial<Registration>) => {
  return request<Registration>(`/api/registrations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const updateRegistrationVitals = async (id: number, payload: Partial<Registration>) => {
  return request<Registration>(`/api/registrations/${id}/vitals`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const sendWhatsappMessage = async (id: number, message: string, phoneNumber?: string, assessmentUrl?: string) => {
  return request<{ ok: boolean; message: string; provider?: string; registration: Registration }>(`/api/registrations/${id}/whatsapp`, {
    method: 'POST',
    body: JSON.stringify({ message, phoneNumber, assessmentUrl }),
  });
};

export const sendReportWhatsappMessage = async (id: number, phoneNumber?: string) => {
  return request<{ ok: boolean; message: string; provider?: string; reportUrl: string; whatsappShareUrl?: string; registration: Registration }>(`/api/registrations/${id}/report-whatsapp`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
};

export const sendReportPdfMessage = async (id: number, phoneNumber?: string) => {
  return request<{ ok: boolean; message: string; provider?: string; filename?: string; providerMessageId?: string | null; registration: Registration }>(`/api/registrations/${id}/send-report-pdf`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
};

export const markAssessmentCompleted = async (id: number, payload: { assessmentUrl?: string; assessmentResponseUrl?: string | null; assessmentResponseData?: Record<string, unknown> | null; assessmentCompletedAt?: string }) => {
  return request<Registration>(`/api/registrations/${id}/assessment-complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const syncAssessmentResponse = async (id: number) => {
  return request<Registration>(`/api/registrations/${id}/assessment-sync`, {
    method: 'POST',
  });
};

export const downloadRegistrationPdf = (id: number) => {
  window.open(`${API_BASE}/api/registrations/${id}/pdf`, '_blank');
};
