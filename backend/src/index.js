import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import {
  createRegistration,
  getRegistrationById,
  readRegistrations,
  updateRegistration,
} from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3101;
const HOST = process.env.HOST || '0.0.0.0';
const ASSESSMENT_URL = process.env.ASSESSMENT_URL || 'https://docs.google.com/forms/d/e/1FAIpQLScaiud61RFRtgV-jcO1xY1FySX5YtZhmD7nbLqqFxUOR9ZPNQ/viewform?usp=sharing&ouid=118247222024506353673';
const MSG91_WHATSAPP_URL = 'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1Jr1AQ0Hx2Z1ETWxspipEZNbedHmhXvCHWr4JyUn7hDo';
const GOOGLE_SHEET_GID = process.env.GOOGLE_SHEET_GID || '1941647567';
const GOOGLE_SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'A:ZZ';

let googleAccessTokenCache = null;

function normalizePhoneNumber(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const withoutLeadingZeros = digits.replace(/^0+/, '');
  if (withoutLeadingZeros.length === 10) return `91${withoutLeadingZeros}`;
  return withoutLeadingZeros;
}

function normalizeLookupValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeNumberValue(value) {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : '';
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function getCell(row, candidates) {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    const entry = Object.entries(row).find(([key]) => {
      const normalizedKey = normalizeHeader(key);
      return normalizedKey === normalizedCandidate || normalizedKey.includes(normalizedCandidate);
    });
    if (entry?.[1]) return entry[1];
  }
  return '';
}

function getAssessmentCsvUrl() {
  const configuredUrl = process.env.GOOGLE_SHEET_CSV_URL;
  if (configuredUrl) return configuredUrl;
  if (!GOOGLE_SHEET_ID || !GOOGLE_SHEET_GID) return '';
  return `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${GOOGLE_SHEET_GID}`;
}

function getGoogleServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const raw = rawJson || (filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
  if (!raw) return null;

  try {
    const credentials = JSON.parse(raw);
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Service account JSON must include client_email and private_key.');
    }
    return credentials;
  } catch (error) {
    throw new Error(`Invalid Google service account config: ${error instanceof Error ? error.message : 'Unable to parse JSON'}`);
  }
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (googleAccessTokenCache && googleAccessTokenCache.expiresAt - 60 > now) {
    return googleAccessTokenCache.token;
  }

  const credentials = getGoogleServiceAccount();
  if (!credentials) return '';

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(credentials.private_key, 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to authenticate with Google Sheets.');
  }

  googleAccessTokenCache = {
    token: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600),
  };
  return googleAccessTokenCache.token;
}

async function fetchAssessmentRowsWithServiceAccount() {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return null;

  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is not configured.');
  }

  const range = encodeURIComponent(GOOGLE_SHEET_RANGE);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || `Google Sheets API returned ${response.status}.`;
    throw new Error(`${message} Share the response sheet with the service account email.`);
  }

  const [headers = [], ...records] = data.values || [];
  return records.map((record) => headers.reduce((row, header, index) => {
    row[header || `Column ${index + 1}`] = record[index] || '';
    return row;
  }, {}));
}

function rowTimestamp(row) {
  const timestamp = getCell(row, ['Timestamp', 'Submitted At', 'Created At', 'Date']);
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function scoreStressAnswer(question, answer) {
  const questionText = String(question || '').toLowerCase();
  const answerText = String(answer || '').toLowerCase();
  const isPositiveControl = /\b(confident|handle personal problems|going your way|ability to handle)\b/.test(questionText);
  let baseScore = 0;

  if (/\b(never|कभी नहीं)\b/.test(answerText)) baseScore = 0;
  else if (/\b(almost never|rarely|बहुत कम|कभी-कभार)\b/.test(answerText)) baseScore = 1;
  else if (/\b(sometimes|कभी कभी|कभी-कभी)\b/.test(answerText)) baseScore = 2;
  else if (/\b(fairly often|often|अक्सर)\b/.test(answerText)) baseScore = 3;
  else if (/\b(very often|always|बहुत बार|हमेशा)\b/.test(answerText)) baseScore = 4;
  else {
    const numericMatch = answerText.match(/\b([0-4])\b/);
    baseScore = numericMatch ? Number(numericMatch[1]) : 0;
  }

  return isPositiveControl ? 4 - baseScore : baseScore;
}

function analyzeAssessmentResponse(row) {
  const ignoredHeaders = new Set(['timestamp', 'name', 'fullname', 'customername', 'patientname', 'whatsapp', 'whatsappnumber', 'phone', 'phonenumber', 'mobilenumber', 'email', 'score']);
  const answers = Object.entries(row)
    .map(([question, answer]) => ({ question, answer: String(answer || '').trim(), score: scoreStressAnswer(question, answer) }))
    .filter(({ question, answer }) => answer && !ignoredHeaders.has(normalizeHeader(question)));

  const score = answers.reduce((sum, answer) => sum + answer.score, 0);
  const maxScore = Math.max(answers.length * 4, 1);
  const percent = Math.round((score / maxScore) * 100);
  const riskLevel = score >= 11 ? 'High Stress' : score >= 6 ? 'Moderate Stress' : 'Low Stress';
  const focusAreas = answers
    .filter((answer) => answer.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((answer) => answer.question);
  const summary = focusAreas.length
    ? `${riskLevel}. The response pattern suggests stress is affecting perceived control and coping in the highlighted areas.`
    : `${riskLevel}. The response pattern does not indicate a major current stress burden.`;
  const recommendation = score >= 11
    ? 'Recommend clinician review, stress-management counselling, sleep routine support, and follow-up assessment.'
    : score >= 6
      ? 'Recommend lifestyle counselling, relaxation practice, sleep hygiene support, and periodic reassessment.'
      : 'Continue preventive wellness habits and repeat screening if symptoms or stress levels change.';

  return {
    score,
    maxScore,
    percent,
    riskLevel,
    summary,
    recommendation,
    focusAreas,
    answers,
  };
}

async function fetchAssessmentRows() {
  const serviceAccountRows = await fetchAssessmentRowsWithServiceAccount();
  if (serviceAccountRows) return serviceAccountRows;

  const csvUrl = getAssessmentCsvUrl();
  if (!csvUrl) {
    throw new Error('Google Sheet CSV URL is not configured.');
  }

  const response = await fetch(csvUrl);
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Google Sheet responses are private. Share/publish the response sheet, set GOOGLE_SHEET_CSV_URL to a public CSV export URL, or configure GOOGLE_SERVICE_ACCOUNT_JSON and share the sheet with that service account email.');
    }
    throw new Error(`Unable to fetch Google Sheet responses. Google returned ${response.status}.`);
  }

  const [headers = [], ...records] = parseCsv(text);
  return records.map((record) => headers.reduce((row, header, index) => {
    row[header || `Column ${index + 1}`] = record[index] || '';
    return row;
  }, {}));
}

function findAssessmentResponseForRegistration(registration, rows) {
  const patientName = normalizeLookupValue(registration.name);
  const patientPhone = normalizePhoneNumber(registration.whatsappNumber);
  const patientAge = normalizeNumberValue(registration.age);
  const sentAt = registration.assessmentSentAt ? Date.parse(registration.assessmentSentAt) : 0;

  const scoredRows = rows.map((row) => {
    const rowName = normalizeLookupValue(getCell(row, ['Name', 'Full Name', 'Customer Name', 'Patient Name', 'Name अपना नाम']));
    const rowPhone = normalizePhoneNumber(getCell(row, ['WhatsApp', 'WhatsApp Number', 'Phone', 'Phone Number', 'Mobile Number', 'Mobile number', 'Mobile']));
    const rowAge = normalizeNumberValue(getCell(row, ['Age', 'Age उम्र']));
    const timestamp = rowTimestamp(row);
    let score = 0;
    const reasons = [];

    if (patientPhone && rowPhone === patientPhone) {
      score += 140;
      reasons.push('mobile');
    }
    if (patientName && rowName === patientName) {
      score += 80;
      reasons.push('name');
    } else if (patientName && rowName && (rowName.includes(patientName) || patientName.includes(rowName))) {
      score += 45;
      reasons.push('similar name');
    }
    if (patientAge && rowAge === patientAge) {
      score += 35;
      reasons.push('age');
    }
    if (timestamp && sentAt && timestamp >= sentAt) {
      score += 10;
      reasons.push('submitted after link');
    }

    return { row, score, timestamp, reasons };
  }).filter((entry) => entry.score >= 100);

  scoredRows.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

  if (scoredRows.length > 1 && scoredRows[0].score === scoredRows[1].score && scoredRows[0].timestamp === scoredRows[1].timestamp) {
    throw new Error(`Multiple Google Form responses match ${registration.name}. Use the patient's mobile number in the form, or add a unique UHID/registration id question.`);
  }

  return scoredRows[0]?.row || null;
}

async function syncAssessmentForRegistration(registration) {
  const rows = await fetchAssessmentRows();
  const matchedRow = findAssessmentResponseForRegistration(registration, rows);

  if (!matchedRow) {
    throw new Error(`No Google Form response found for ${registration.name}. Check that the form response includes matching mobile number, or matching name and age.`);
  }

  const analysis = analyzeAssessmentResponse(matchedRow);
  return updateRegistration(registration.id, {
    assessmentStatus: 'COMPLETED',
    assessmentCompletedAt: getCell(matchedRow, ['Timestamp', 'Submitted At', 'Created At', 'Date']) || new Date().toISOString(),
    assessmentResponseData: matchedRow,
    assessmentAnalysis: analysis,
    assessmentError: null,
    status: 'ASSESSMENT COMPLETED',
  });
}

function isMissingCredential(value) {
  return !value || value.includes('your_') || value.includes('XXXXX') || value.includes('xxxx');
}

function parseTemplateVariables(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveTemplateValue(variableName, { registration, message, assessmentUrl }) {
  const reportBaseUrl = process.env.PUBLIC_REPORT_BASE_URL || process.env.BACKEND_PUBLIC_URL || '';
  const reportUrl = reportBaseUrl ? `${reportBaseUrl.replace(/\/$/, '')}/api/registrations/${registration.id}/pdf` : '';
  const values = {
    assessmentUrl,
    assessment_url: assessmentUrl,
    reportUrl,
    report_url: reportUrl,
    link: assessmentUrl,
    reportLink: reportUrl,
    report_link: reportUrl,
    message,
    name: registration.name,
    patientName: registration.name,
    patient_name: registration.name,
    customerName: registration.name,
    customer_name: registration.name,
    uhid: registration.uhid || 'Pending',
  };

  return values[variableName] || assessmentUrl || message || ASSESSMENT_URL;
}

function createTextTemplateComponents(type, variableNames, context) {
  if (!variableNames.length) return null;

  return variableNames.reduce((components, variableName) => {
    components[`${type}_${variableName}`] = {
      type: 'text',
      value: resolveTemplateValue(variableName, context),
      parameter_name: variableName,
    };
    return components;
  }, {});
}

async function sendWhatsAppViaMsg91({ registration, phoneNumber, message, assessmentUrl, templateName: overrideTemplateName, templateVariables: overrideTemplateVariables }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_WHATSAPP_NUMBER;
  const templateName = overrideTemplateName || process.env.MSG91_TEMPLATE_NAME;
  const templateNamespace = process.env.MSG91_TEMPLATE_NAMESPACE;
  const languageCode = process.env.MSG91_TEMPLATE_LANGUAGE || 'en';
  const bodyVariableConfig = Object.prototype.hasOwnProperty.call(process.env, 'MSG91_TEMPLATE_VARIABLES')
    ? process.env.MSG91_TEMPLATE_VARIABLES
    : 'assessmentUrl';
  const templateVariables = overrideTemplateVariables || parseTemplateVariables(bodyVariableConfig);
  const templateHeaderVariables = parseTemplateVariables(process.env.MSG91_TEMPLATE_HEADER_VARIABLES);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!normalizedPhone) {
    throw new Error('Enter a WhatsApp number before sending the assessment link.');
  }

  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    throw new Error('Enter a valid WhatsApp number with country code, for example +91 98765 43210.');
  }

  if (isMissingCredential(authKey) || isMissingCredential(integratedNumber) || isMissingCredential(templateName)) {
    throw new Error('MSG91 credentials are not configured. Add MSG91_AUTH_KEY, MSG91_WHATSAPP_NUMBER, and MSG91_TEMPLATE_NAME in backend/.env.');
  }

  const templateContext = { registration, message, assessmentUrl };
  const components = {
    ...createTextTemplateComponents('header', templateHeaderVariables, templateContext),
    ...createTextTemplateComponents('body', templateVariables, templateContext),
  };

  const payload = {
    integrated_number: integratedNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode, policy: 'deterministic' },
        ...(templateNamespace ? { namespace: templateNamespace } : {}),
        to_and_components: [
          {
            to: [normalizedPhone],
            components,
          },
        ],
      },
    },
  };

  const response = await fetch(MSG91_WHATSAPP_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authkey: authKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.text();
  if (!response.ok) {
    throw new Error(data || 'MSG91 request failed');
  }

  return { ok: true, provider: 'msg91', message: data, phoneNumber: normalizedPhone };
}

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : '*',
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'screening-backend' });
});

app.post('/api/admin/login', (req, res) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return res.status(500).json({ message: 'Admin credentials are not configured on the backend.' });
  }

  if (req.body?.email === adminEmail && req.body?.password === adminPassword) {
    return res.json({ ok: true });
  }

  return res.status(401).json({ message: 'Invalid admin credentials.' });
});

app.get('/api/registrations', (_req, res) => {
  try {
    res.json(readRegistrations());
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to load registrations' });
  }
});

app.post('/api/registrations', (req, res) => {
  try {
    const registration = createRegistration(req.body);
    res.status(201).json(registration);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to create registration' });
  }
});

app.patch('/api/registrations/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid registration id' });
  }

  const existing = getRegistrationById(id);
  if (!existing) {
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const updated = updateRegistration(id, req.body);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to update registration' });
  }
});

app.post('/api/registrations/:id/whatsapp', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid registration id' });
  }

  const registration = getRegistrationById(id);
  if (!registration) {
    return res.status(404).json({ message: 'Not found' });
  }

  const message = req.body?.message || `Hello ${registration.name}, please complete your assessment here: ${ASSESSMENT_URL}. Please enter the same mobile number used during registration.`;
  const phoneNumber = req.body?.phoneNumber || registration.whatsappNumber;
  const assessmentUrl = req.body?.assessmentUrl || registration.assessmentUrl || ASSESSMENT_URL;
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  try {
    const result = await sendWhatsAppViaMsg91({
      registration,
      phoneNumber: normalizedPhone || phoneNumber,
      message,
      assessmentUrl,
    });
    const updated = updateRegistration(id, {
      whatsappNumber: result.phoneNumber,
      assessmentUrl,
      assessmentStatus: 'SENT',
      assessmentSentAt: new Date().toISOString(),
      assessmentError: null,
      status: 'ASSESSMENT SENT',
    });

    return res.json({ ...result, registration: updated });
  } catch (error) {
    updateRegistration(id, {
      whatsappNumber: normalizedPhone || phoneNumber,
      assessmentUrl,
      assessmentStatus: 'PENDING',
      assessmentError: error instanceof Error ? error.message : 'Failed to send WhatsApp message',
    });
    return res.status(502).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to send WhatsApp message' });
  }
});

app.post('/api/registrations/:id/report-whatsapp', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid registration id' });
  }

  const registration = getRegistrationById(id);
  if (!registration) {
    return res.status(404).json({ message: 'Not found' });
  }

  const reportBaseUrl = process.env.PUBLIC_REPORT_BASE_URL || process.env.BACKEND_PUBLIC_URL || '';
  if (!reportBaseUrl) {
    return res.status(400).json({
      message: 'PUBLIC_REPORT_BASE_URL is not configured. Set it to a public backend URL before sending report links on WhatsApp.',
    });
  }

  if (!process.env.MSG91_REPORT_TEMPLATE_NAME) {
    return res.status(400).json({
      message: 'MSG91_REPORT_TEMPLATE_NAME is not configured. Create an approved MSG91 WhatsApp template for report links and set MSG91_REPORT_TEMPLATE_NAME.',
    });
  }

  const phoneNumber = req.body?.phoneNumber || registration.whatsappNumber;
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const reportUrl = `${reportBaseUrl.replace(/\/$/, '')}/api/registrations/${registration.id}/pdf`;
  const message = req.body?.message || `Hello ${registration.name}, your health screening report is ready: ${reportUrl}`;
  const reportTemplateName = process.env.MSG91_REPORT_TEMPLATE_NAME;
  const reportVariables = parseTemplateVariables(process.env.MSG91_REPORT_TEMPLATE_VARIABLES || 'customer_name,report_url');

  try {
    const result = await sendWhatsAppViaMsg91({
      registration,
      phoneNumber: normalizedPhone || phoneNumber,
      message,
      assessmentUrl: registration.assessmentUrl || ASSESSMENT_URL,
      templateName: reportTemplateName,
      templateVariables: reportVariables,
    });
    const updated = updateRegistration(id, {
      whatsappNumber: result.phoneNumber,
      reportUrl,
      reportSentAt: new Date().toISOString(),
      reportError: null,
    });

    return res.json({ ...result, reportUrl, registration: updated });
  } catch (error) {
    updateRegistration(id, {
      whatsappNumber: normalizedPhone || phoneNumber,
      reportUrl,
      reportError: error instanceof Error ? error.message : 'Failed to send report on WhatsApp',
    });
    return res.status(502).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to send report on WhatsApp' });
  }
});

app.post('/api/registrations/:id/assessment-complete', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid registration id' });
  }

  const existing = getRegistrationById(id);
  if (!existing) {
    return res.status(404).json({ message: 'Not found' });
  }

  const updated = updateRegistration(id, {
    assessmentStatus: 'COMPLETED',
    assessmentCompletedAt: req.body?.assessmentCompletedAt || new Date().toISOString(),
    assessmentResponseUrl: req.body?.assessmentResponseUrl || null,
    assessmentResponseData: req.body?.assessmentResponseData || null,
    assessmentUrl: req.body?.assessmentUrl || existing.assessmentUrl || ASSESSMENT_URL,
    status: 'ASSESSMENT COMPLETED',
  });

  return res.json(updated);
});

app.post('/api/registrations/:id/assessment-sync', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid registration id' });
  }

  const registration = getRegistrationById(id);
  if (!registration) return res.status(404).json({ message: 'Not found' });

  try {
    const updated = await syncAssessmentForRegistration(registration);
    return res.json(updated);
  } catch (error) {
    updateRegistration(id, {
      assessmentError: error instanceof Error ? error.message : 'Unable to sync assessment response',
    });
    return res.status(502).json({ message: error instanceof Error ? error.message : 'Unable to sync assessment response' });
  }
});

app.get('/api/registrations/:id/pdf', async (req, res) => {
  const id = Number(req.params.id);
  let registration = getRegistrationById(id);
  if (!registration) return res.status(404).json({ message: 'Not found' });

  if (!registration.assessmentResponseData && getAssessmentCsvUrl()) {
    try {
      registration = await syncAssessmentForRegistration(registration);
    } catch (error) {
      registration = updateRegistration(id, {
        assessmentError: error instanceof Error ? error.message : 'Unable to sync assessment response',
      });
    }
  }

  const doc = new PDFDocument({ margin: 40, size: 'A4', font: 'Helvetica' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${registration.name}-pass.pdf`);
  doc.pipe(res);

  const pageLeft = 40;
  const pageRight = 555;
  const contentWidth = pageRight - pageLeft;
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const drawSectionTitle = (title, y) => {
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(title, pageLeft, y, { width: contentWidth, height: 16 });
    doc.moveTo(pageLeft, y + 20).lineTo(pageRight, y + 20).strokeColor('#0f766e').lineWidth(1.5).stroke();
  };

  const drawField = (label, value, x, y, width) => {
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(label, x, y, { width, height: 10 });
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(String(value || 'N/A'), x, y + 13, { width, height: 16 });
  };

  const drawMetric = (label, value, x, y, width) => {
    doc.roundedRect(x, y, width, 48, 5).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.6).stroke();
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(String(value || 'N/A'), x + 12, y + 11, { width: width - 24, height: 14 });
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(label, x + 12, y + 29, { width: width - 24, height: 10 });
  };

  doc.rect(0, 0, doc.page.width, 96).fill('#0f766e');
  doc.rect(0, 88, doc.page.width, 8).fill('#0d9488');
  doc.circle(58, 47, 22).fill('#ffffff');
  doc.fillColor('#0f766e').fontSize(14).font('Helvetica-Bold').text('DM', 46, 40, { width: 24, align: 'center', height: 16 });
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('Dr. Mudhiwalla Healthtech', 92, 30, { width: 300, height: 24 });
  doc.fontSize(10).font('Helvetica').fillColor('#d1fae5').text('Stress Assessment Analysis Report', 92, 57, { width: 300, height: 14 });
  doc.fontSize(8).font('Helvetica').fillColor('#ccfbf1').text(`Report ID: ${registration.id}`, 392, 31, { width: 160, align: 'right', height: 11 });
  doc.text(`Generated: ${generatedAt}`, 392, 47, { width: 160, align: 'right', height: 22 });

  const patientY = 118;
  drawSectionTitle('PATIENT INFORMATION', patientY);
  doc.roundedRect(pageLeft, patientY + 34, contentWidth, 72, 6).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.8).stroke();
  drawField('Full Name', registration.name, 58, patientY + 50, 210);
  drawField('Age / Gender', `${registration.age} / ${registration.gender}`, 290, patientY + 50, 110);
  drawField('UHID', registration.uhid || 'N/A', 420, patientY + 50, 95);
  drawField('Registration Date', new Date(registration.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 58, patientY + 78, 170);

  const vitalsY = 246;
  drawSectionTitle('VITAL SIGNS & MEASUREMENTS', vitalsY);
  const metricWidth = 160;
  const metricGap = 17.5;
  const metricRows = [
    [
      ['Blood Pressure', registration.systolic && registration.diastolic ? `${registration.systolic}/${registration.diastolic} mmHg` : 'N/A'],
      ['BP Category', registration.bloodPressureCategory || 'Pending'],
      ['BMI', registration.bmi || 'N/A'],
    ],
    [
      ['BRI', registration.bri || 'N/A'],
      ['Height', registration.heightCm ? `${registration.heightCm} cm` : 'N/A'],
      ['Weight', registration.weightKg ? `${registration.weightKg} kg` : 'N/A'],
    ],
  ];

  metricRows.forEach((row, rowIndex) => {
    row.forEach(([label, value], colIndex) => {
      drawMetric(label, value, pageLeft + colIndex * (metricWidth + metricGap), vitalsY + 34 + rowIndex * 58, metricWidth);
    });
  });

  const analysis = registration.assessmentAnalysis;
  const analysisY = 418;
  drawSectionTitle('STRESS ASSESSMENT ANALYSIS', analysisY);
  doc.roundedRect(pageLeft, analysisY + 34, contentWidth, 205, 6).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.8).stroke();

  if (analysis) {
    const riskColor = analysis.riskLevel?.startsWith('High') ? '#b91c1c' : analysis.riskLevel?.startsWith('Moderate') ? '#b45309' : '#047857';
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Stress Level', 58, analysisY + 52, { width: 180, height: 10 });
    doc.fillColor(riskColor).fontSize(17).font('Helvetica-Bold').text(analysis.riskLevel || 'Pending', 58, analysisY + 66, { width: 220, height: 22 });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Assessment Score', 330, analysisY + 52, { width: 150, height: 10 });
    doc.fillColor('#0f172a').fontSize(17).font('Helvetica-Bold').text(`${analysis.score}/${analysis.maxScore} (${analysis.percent}%)`, 330, analysisY + 66, { width: 160, height: 22 });

    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Interpretation', 58, analysisY + 102, { width: 150, height: 10 });
    doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(analysis.summary, 58, analysisY + 116, { width: 475, height: 38, lineGap: 3 });

    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Recommendation', 58, analysisY + 160, { width: 150, height: 10 });
    doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(analysis.recommendation || 'Continue wellness monitoring and clinical review as needed.', 58, analysisY + 174, { width: 475, height: 34, lineGap: 3 });

    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Focus Areas', 58, analysisY + 216, { width: 100, height: 10 });
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(analysis.focusAreas?.length ? analysis.focusAreas.slice(0, 3).join(', ') : 'None flagged', 145, analysisY + 216, { width: 388, height: 12 });
  } else {
    doc.fillColor('#334155').fontSize(10).font('Helvetica').text(
      'Assessment analysis is not available yet. Sync the submitted Google Form response before generating the final report.',
      58,
      analysisY + 58,
      { width: 475, height: 42, lineGap: 4 },
    );
  }

  const footerY = 724;
  doc.moveTo(pageLeft, footerY).lineTo(pageRight, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('This report is generated for clinical review and wellness counselling.', pageLeft, footerY + 12, { width: 380, height: 10 });
  doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('Dr. Mudhiwalla Healthtech - All Rights Reserved', pageLeft, footerY + 28, { width: 280, height: 10 });
  doc.fillColor('#94a3b8').fontSize(7).text('Page 1 of 1', 500, footerY + 28, { width: 55, align: 'right', height: 10 });

  doc.end();
});

app.listen(PORT, HOST, () => {
  console.log(`Backend listening on http://${HOST}:${PORT}`);
});
