'use client';

import { FormEvent, useState } from 'react';
import { createRegistration } from './lib/demo';

const initialForm = {
  name: '',
  age: '',
  gender: '',
  consent: false,
  signature: '',
};

export default function HomePage() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.consent) {
      setStatus('Please confirm your consent before continuing.');
      return;
    }

    try {
      await createRegistration({
        name: form.name.trim(),
        age: form.age,
        gender: form.gender,
        signature: form.signature.trim(),
        notes: '',
        status: 'REGISTERED',
      });

      setStatus('Your registration and consent have been submitted successfully.');
      alert('Your registration and consent have been submitted successfully.');
      setForm(initialForm);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save registration.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <img src="/images/image.jpeg" alt="Logo" className="h-10 w-auto" />
            <p className="mt-2 text-sm text-slate-500">Preventive Health Screeningggg</p>
          </div>

          <a href="/admin" className="text-sm font-medium text-slate-700 hover:text-slate-950">
            Staff Portal
          </a>
        </header>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
              Screening Registration
            </p>

            <h1 className="text-2xl font-semibold text-slate-950">
              Consent & Registration
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Please read the consent information carefully. Once you have understood and accepted the terms, complete your details below to register for your health screening.
            </p>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 px-5 py-6 sm:px-8">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Please read before continuing
              </p>

              <h2 className="mt-2 text-lg font-semibold text-slate-950">Health Screening Consent</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">स्वास्थ्य जांच सहमति</p>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
              <div>
                <div className="p-4">
                <p className="text-sm leading-6 text-slate-800">
                  I voluntarily agree to participate in the health screening conducted by Dr. Mudhiwalla.
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  मैं Dr. Mudhiwalla द्वारा आयोजित स्वास्थ्य जांच में स्वेच्छा से भाग लेने के लिए सहमत हूँ।
                </p>
                </div>
              </div>

              <div className="p-4">
                <p className="text-sm leading-6 text-slate-800">
                  I consent to the recording of my health information and screening results for health assessment and healthcare support.
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  मैं अपने स्वास्थ्य मूल्यांकन और स्वास्थ्य संबंधी सहायता के लिए अपनी स्वास्थ्य जानकारी एवं जांच परिणाम दर्ज किए जाने की सहमति देता/देती हूँ।
                </p>
              </div>

              <div className="p-4">
                <p className="text-sm leading-6 text-slate-800">
                  I allow Dr. Mudhiwalla to use my contact details only for sharing my screening report and relevant healthcare communications.
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  मैं Dr. Mudhiwalla को अपनी संपर्क जानकारी का उपयोग केवल मेरी स्वास्थ्य जांच रिपोर्ट और संबंधित स्वास्थ्य जानकारी साझा करने के लिए करने की अनुमति देता/देती हूँ।
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="px-5 py-6 sm:px-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase text-slate-500">Your Details</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Complete your registration</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Fields marked with an asterisk (*) are required.</p>
            </div>






            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Full name *</span>
                <input
                  required
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-900"
                  placeholder="Enter your full name"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">Age *</span>
                  <input
                    required
                    type="number"
                    min="1"
                    max="120"
                    inputMode="numeric"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="w-full border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-900"
                    placeholder="Enter your age"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">Gender *</span>
                  <select
                    required
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none focus:border-slate-900"
                  >
                    <option value="" disabled>Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>

              <label className="flex cursor-pointer items-start gap-3 border border-slate-300 bg-slate-50 p-4">
                <input
                  required
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                  className="mt-1 h-4 w-4 shrink-0 border-slate-300 accent-slate-900"
                />

                <span className="text-sm leading-6 text-slate-700">
                  I confirm that I have read and understood the consent information above, and I voluntarily agree to participate in the health screening.
                </span>
              </label>

              <button
                type="submit"
                className="w-full bg-slate-900 px-5 py-3 text-base font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                Submit Consent & Register
              </button>
            </div>







            {status ? (
              <div role="status" className="mt-5 border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                {status}
              </div>
            ) : null}
          </form>
        </section>

        <footer className="py-5 text-center text-xs leading-5 text-slate-500">
          Your information is used only for health screening and related healthcare communication.
        </footer>
      </div>
    </main>
  );
}
