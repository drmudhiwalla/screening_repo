'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  downloadRegistrationPdf,
  loadRegistrations as loadRegistrationsFromApi,
  loginAdmin,
  sendReportWhatsappMessage,
  sendWhatsappMessage,
  syncAssessmentResponse,
  updateRegistrationRecord,
  type Registration,
} from '../lib/demo';
import {
  calculateBMI,
  calculateBRI,
  classifyBloodPressure,
  getBmiCategory,
  getBmiStatus,
  getBloodPressureBadgeClasses,
  getBriStatus,
} from '../lib/medical';

const ASSESSMENT_URL = process.env.NEXT_PUBLIC_ASSESSMENT_URL || 'https://docs.google.com/forms/d/e/1FAIpQLScaiud61RFRtgV-jcO1xY1FySX5YtZhmD7nbLqqFxUOR9ZPNQ/viewform?usp=sharing&ouid=118247222024506353673';
const symptomOptions = [
  'Chest pain',
  'Shortness of breath',
  'Back pain',
  'Numbness',
  'Weakness',
  'Change in vision',
  'Difficulty speaking',
  'None of the above',
];

function formatTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}

export default function AdminPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [emergencySymptoms, setEmergencySymptoms] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [systolicError, setSystolicError] = useState('');
  const [diastolicError, setDiastolicError] = useState('');
  const [hasMounted, setHasMounted] = useState(false);
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
  const [isSendingReportWhatsapp, setIsSendingReportWhatsapp] = useState(false);
  const [isSyncingAssessment, setIsSyncingAssessment] = useState(false);

  const syncFormFromRegistration = (entry: Registration) => {
    setSelectedId(entry.id);
    setNotes(entry.notes || '');
    setWhatsappNumber(entry.whatsappNumber || '');
    setHeightCm(entry.heightCm?.toString() || '');
    setWeightKg(entry.weightKg?.toString() || '');
    setWaistCm(entry.waistCm?.toString() || '');
    setSystolic(entry.systolic?.toString() || '');
    setDiastolic(entry.diastolic?.toString() || '');
    setEmergencySymptoms(entry.emergencySymptoms || []);
  };

  const loadRegistrations = async (preferredId?: number | null) => {
    const nextRegistrations = await loadRegistrationsFromApi();
    setRegistrations(nextRegistrations);
    const nextSelected = nextRegistrations.find((entry) => entry.id === preferredId) ?? nextRegistrations[0];
    if (nextSelected) {
      syncFormFromRegistration(nextSelected);
    }
  };

  useEffect(() => {
    setHasMounted(true);
    void loadRegistrations();
  }, []);

  const selected = registrations.find((entry) => entry.id === selectedId) ?? registrations[0];

  const bpCategory = useMemo(() => {
    const parsedSystolic = Number(systolic);
    const parsedDiastolic = Number(diastolic);
    if (!systolic || !diastolic) {
      return null;
    }
    if (Number.isNaN(parsedSystolic) || Number.isNaN(parsedDiastolic)) {
      return null;
    }
    const hasSymptoms = emergencySymptoms.includes('None of the above') ? false : emergencySymptoms.length > 0;
    return classifyBloodPressure(parsedSystolic, parsedDiastolic, hasSymptoms);
  }, [diastolic, emergencySymptoms, systolic]);

  const bmiValue = useMemo(() => {
    const parsedWeight = Number(weightKg);
    const parsedHeight = Number(heightCm);
    if (!parsedWeight || !parsedHeight) {
      return null;
    }
    return calculateBMI(parsedWeight, parsedHeight);
  }, [heightCm, weightKg]);

  const bmiCategory = useMemo(() => getBmiCategory(bmiValue), [bmiValue]);
  const bmiStatus = useMemo(() => getBmiStatus(bmiValue), [bmiValue]);
  const briValue = useMemo(() => {
    const parsedHeight = Number(heightCm);
    const parsedWaist = Number(waistCm);
    if (!parsedHeight || !parsedWaist) {
      return null;
    }
    return calculateBRI(parsedHeight, parsedWaist);
  }, [heightCm, waistCm]);

  const briStatus = useMemo(() => getBriStatus(briValue), [briValue]);

  const isReadyForReview = useMemo(() => {
    if (!selected) return false;
    return Boolean(
      selected.systolic &&
      selected.diastolic &&
      selected.heightCm &&
      selected.weightKg &&
      selected.waistCm &&
      selected.whatsappNumber &&
      selected.bloodPressureCategory
    );
  }, [selected]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await loginAdmin(email, password);
      setIsAuthenticated(true);
      setStatusMessage('Signed in successfully.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Invalid admin credentials.');
    }
  };

  const saveScreeningDetails = async () => {
    if (!selected) return;
    const payload: Partial<Registration> = {
      notes,
      whatsappNumber,
      systolic: Number(systolic) || null,
      diastolic: Number(diastolic) || null,
      bloodPressureCategory: bpCategory,
      emergencySymptoms,
      hasEmergencySymptoms: emergencySymptoms.some((symptom) => symptom !== 'None of the above'),
      measuredAt: new Date().toISOString(),
      heightCm: Number(heightCm) || null,
      weightKg: Number(weightKg) || null,
      waistCm: Number(waistCm) || null,
      bmi: bmiValue,
      bri: briValue,
      bmiCategory,
      briLabel: briStatus.label,
      status: selected.status === 'REGISTERED' ? 'SCREENING COMPLETED' : selected.status,
    };

    await updateRegistrationRecord(selected.id, payload);
    setStatusMessage('Screening details saved.');
    await loadRegistrations(selected.id);
  };

  const handleSelectPatient = (entry: Registration) => {
    syncFormFromRegistration(entry);
  };

  const handleUpdateStatus = async (nextStatus: string) => {
    if (!selected) return;
    if (nextStatus === 'READY FOR DOCTOR REVIEW' && !isReadyForReview) {
      setStatusMessage('Complete all required measurements and screening details before marking the patient ready for review.');
      return;
    }

    const updated = await updateRegistrationRecord(selected.id, { status: nextStatus });
    setStatusMessage(`Status updated to ${updated.status}.`);
    await loadRegistrations(selected.id);
  };

  const handleWhatsapp = async () => {
    if (!selected) return;
    const recipientNumber = (whatsappNumber || selected.whatsappNumber || '').trim();
    const message = `Hello ${selected.name}, please complete your assessment here: ${ASSESSMENT_URL}. Please enter the same mobile number used during registration.`;

    if (!recipientNumber) {
      setStatusMessage('Enter a WhatsApp number before sending the assessment link.');
      return;
    }

    setIsSendingWhatsapp(true);
    setStatusMessage(`Sending assessment template to ${selected.name}...`);

    try {
      const result = await sendWhatsappMessage(selected.id, message, recipientNumber, ASSESSMENT_URL);
      setStatusMessage(`Assessment template sent to ${selected.name}.`);
      syncFormFromRegistration(result.registration);
      await loadRegistrations(selected.id);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to send WhatsApp message right now.');
    } finally {
      setIsSendingWhatsapp(false);
    }
  };

  const handleAssessmentLink = async () => {
    if (!selected) return;
    await handleWhatsapp();
  };

  const handleSyncAssessment = async () => {
    if (!selected) return;
    setIsSyncingAssessment(true);
    setStatusMessage(`Syncing Google Form response for ${selected.name}...`);
    try {
      const updated = await syncAssessmentResponse(selected.id);
      setStatusMessage(`Assessment response matched for ${updated.name}.`);
      syncFormFromRegistration(updated);
      await loadRegistrations(selected.id);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to sync Google Form response right now.');
    } finally {
      setIsSyncingAssessment(false);
    }
  };

  const handlePdf = async () => {
    if (!selected) return;
    setIsSyncingAssessment(true);
    setStatusMessage(`Preparing final PDF for ${selected.name}...`);
    try {
      await syncAssessmentResponse(selected.id);
      await loadRegistrations(selected.id);
      setStatusMessage('Assessment synced. Opening final PDF.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? `${error.message} Opening PDF with available data.` : 'Opening PDF with available data.');
    } finally {
      setIsSyncingAssessment(false);
    }
    downloadRegistrationPdf(selected.id);
  };

  const handleReportWhatsapp = async () => {
    if (!selected) return;
    const recipientNumber = (whatsappNumber || selected.whatsappNumber || '').trim();

    if (!recipientNumber) {
      setStatusMessage('Enter a WhatsApp number before sending the report.');
      return;
    }

    setIsSendingReportWhatsapp(true);
    setStatusMessage(`Preparing report link for ${selected.name}...`);
    try {
      await syncAssessmentResponse(selected.id);
      const result = await sendReportWhatsappMessage(selected.id, recipientNumber);
      setStatusMessage(`Report sent to ${selected.name} on WhatsApp.`);
      syncFormFromRegistration(result.registration);
      await loadRegistrations(selected.id);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to send report on WhatsApp right now.');
    } finally {
      setIsSendingReportWhatsapp(false);
    }
  };

  const validateField = (value: string, setter: (next: string) => void, errorSetter: (next: string) => void) => {
    const numericValue = Number(value);
    if (!value) {
      setter(value);
      errorSetter('Required');
      return;
    }
    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      setter(value);
      errorSetter('Enter a positive whole number');
      return;
    }
    setter(value);
    errorSetter('');
  };

  useEffect(() => {
    if (!systolic) {
      setSystolicError('');
      return;
    }
    validateField(systolic, setSystolic, setSystolicError);
  }, [systolic]);

  useEffect(() => {
    if (!diastolic) {
      setDiastolicError('');
      return;
    }
    validateField(diastolic, setDiastolic, setDiastolicError);
  }, [diastolic]);

  if (!hasMounted) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-md border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase text-slate-500">Admin Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Staff Sign In</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to access the screening queue.</p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              <span className="mb-1 block">Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900" placeholder="admin@example.com" />
            </label>
            <label className="block text-sm font-medium">
              <span className="mb-1 block">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900" placeholder="Password" />
            </label>
            <button className="w-full bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800">Sign In</button>
          </form>
          {statusMessage ? <p className="mt-4 border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{statusMessage}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Admin Portal</p>
            <h1 className="text-2xl font-semibold text-slate-950">Patient Screening Queue</h1>
          </div>
          <a href="/" className="text-sm font-medium text-slate-700 hover:text-slate-950">Back to customer form</a>
        </div>

        {statusMessage ? <div className="mb-4 border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">{statusMessage}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-3 text-lg font-semibold">Queue</h2>
            <div className="space-y-2">
              {registrations.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelectPatient(entry)}
                  className={`w-full border px-3 py-2.5 text-left ${selected?.id === entry.id ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{entry.name}</span>
                    <span className="text-xs text-slate-500">{entry.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{entry.gender} • {entry.age} yrs</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="border border-slate-200 p-5">
            {selected ? (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div>
                      <h2 className="text-2xl font-semibold">{selected.name}</h2>
                      <p className="text-sm text-slate-600">UHID: {selected.uhid || 'Pending'}</p>
                    </div>
                    <p className="text-sm text-slate-600">Submitted {formatTime(selected.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">{selected.status}</span>
                    <button disabled={isSendingWhatsapp} onClick={() => void handleAssessmentLink()} className="border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60">{isSendingWhatsapp ? 'Sending...' : 'Send assessment link'}</button>
                    <button disabled={isSendingReportWhatsapp} onClick={() => void handleReportWhatsapp()} className="border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60">{isSendingReportWhatsapp ? 'Sending...' : 'Send report'}</button>
                    <button disabled={isSyncingAssessment} onClick={() => void handleSyncAssessment()} className="border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60">{isSyncingAssessment ? 'Syncing...' : 'Sync assessment'}</button>
                    <button onClick={() => void handleUpdateStatus('ASSESSMENT IN PROGRESS')} className="border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-900">Mark in progress</button>
                    <button onClick={() => void handleUpdateStatus('READY FOR DOCTOR REVIEW')} className="border border-slate-900 bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800">Ready for review</button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Age</p>
                    <p className="text-lg font-semibold">{selected.age}</p>
                  </div>
                  <div className="border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Gender</p>
                    <p className="text-lg font-semibold">{selected.gender}</p>
                  </div>
                </div>

                <div className="mt-6 border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Vitals & Screening</h3>
                    <span className={`border px-3 py-1 text-sm font-medium ${getBloodPressureBadgeClasses(bpCategory)}`}>{bpCategory || 'Awaiting values'}</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium">
                      <span className="mb-1 block">Systolic Blood Pressure</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={systolic}
                        onChange={(event) => setSystolic(event.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                        placeholder="e.g. 120"
                      />
                      {systolicError ? <span className="mt-1 block text-sm text-red-600">{systolicError}</span> : null}
                    </label>
                    <label className="block text-sm font-medium">
                      <span className="mb-1 block">Diastolic Blood Pressure</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={diastolic}
                        onChange={(event) => setDiastolic(event.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                        placeholder="e.g. 80"
                      />
                      {diastolicError ? <span className="mt-1 block text-sm text-red-600">{diastolicError}</span> : null}
                    </label>
                  </div>

                  {systolic && diastolic && !systolicError && !diastolicError && (Number(systolic) > 180 || Number(diastolic) > 120) ? (
                    <div className="mt-4 border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
                      <p className="font-semibold">Are you currently experiencing any of these symptoms?</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {symptomOptions.map((option) => (
                          <label key={option} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={emergencySymptoms.includes(option)}
                              onChange={() => {
                                if (option === 'None of the above') {
                                  setEmergencySymptoms((current) => (current.includes(option) ? [] : [option]));
                                  return;
                                }
                                setEmergencySymptoms((current) => {
                                  const next = current.filter((item) => item !== 'None of the above');
                                  if (next.includes(option)) {
                                    return next.filter((item) => item !== option);
                                  }
                                  return [...next, option];
                                });
                              }}
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                      {emergencySymptoms.length > 0 && !emergencySymptoms.includes('None of the above') ? (
                        <p className="mt-3 font-semibold">Your blood pressure is in the hypertensive emergency range and you have reported warning symptoms. Seek emergency medical care immediately.</p>
                      ) : (
                        <p className="mt-3 font-semibold">Your blood pressure is in the severe hypertension range. Contact a healthcare professional promptly.</p>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium">
                      <span className="mb-1 block">WhatsApp Number</span>
                      <input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(event) => setWhatsappNumber(event.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                        placeholder="+91 98765 43210"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      <span className="mb-1 block">Height (cm)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={heightCm}
                        onChange={(event) => setHeightCm(event.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                        placeholder="168"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      <span className="mb-1 block">Weight (kg)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={weightKg}
                        onChange={(event) => setWeightKg(event.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                        placeholder="78"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      <span className="mb-1 block">Waist (cm)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={waistCm}
                        onChange={(event) => setWaistCm(event.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                        placeholder="90"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">BMI</p>
                      <p className="text-lg font-semibold">{bmiValue ?? '—'}</p>
                      <p className="text-sm text-slate-600">{bmiCategory}</p>
                      <span className={`mt-2 inline-flex border px-2 py-1 text-xs font-semibold ${bmiStatus.tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : bmiStatus.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : bmiStatus.tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{bmiStatus.label}</span>
                    </div>
                    <div className="border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">BRI</p>
                      <p className="text-lg font-semibold">{briValue ?? '—'}</p>
                      <span className={`mt-2 inline-flex border px-2 py-1 text-xs font-semibold ${briStatus.tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : briStatus.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : briStatus.tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{briStatus.label}</span>
                    </div>
                    <div className="border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">Assessment</p>
                      <p className="text-lg font-semibold">{selected.assessmentAnalysis?.riskLevel || bpCategory || 'Pending'}</p>
                      <p className="text-sm text-slate-600">{selected.assessmentAnalysis ? selected.assessmentAnalysis.summary : 'Blood pressure classification'}</p>
                    </div>
                  </div>
                </div>

                <label className="mt-6 block text-sm font-medium">
                  <span className="mb-2 block">Admin Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    className="w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                    placeholder="Record screening notes"
                  />
                </label>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={saveScreeningDetails} className="bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800">Save Screening</button>
                  <button disabled={isSendingWhatsapp} onClick={() => void handleWhatsapp()} className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60">{isSendingWhatsapp ? 'Sending...' : 'Send to WhatsApp'}</button>
                  <button disabled={isSyncingAssessment} onClick={() => void handleSyncAssessment()} className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60">{isSyncingAssessment ? 'Syncing...' : 'Sync assessment'}</button>
                  <button disabled={isSyncingAssessment} onClick={() => void handlePdf()} className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60">{isSyncingAssessment ? 'Preparing...' : 'Generate final PDF'}</button>
                  <button disabled={isSendingReportWhatsapp} onClick={() => void handleReportWhatsapp()} className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60">{isSendingReportWhatsapp ? 'Sending...' : 'Send report to WhatsApp'}</button>
                </div>
              </>
            ) : (
              <p>No registrations yet.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
