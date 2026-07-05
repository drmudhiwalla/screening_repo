import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../data');
const defaultDbPath = path.join(dataDir, 'registrations.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const databaseCache = new Map();

function normalizeRegistration(row) {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
  return {
    id: row.id,
    ...payload,
    createdAt: payload.createdAt || new Date().toISOString(),
    status: payload.status || 'REGISTERED',
    notes: payload.notes || '',
    hasEmergencySymptoms: Boolean(payload.hasEmergencySymptoms),
    emergencySymptoms: Array.isArray(payload.emergencySymptoms) ? payload.emergencySymptoms : [],
  };
}

function serializeRegistration(payload) {
  const normalized = {
    ...payload,
    createdAt: payload.createdAt || new Date().toISOString(),
    status: payload.status || 'REGISTERED',
    notes: payload.notes || '',
    hasEmergencySymptoms: Boolean(payload.hasEmergencySymptoms),
    emergencySymptoms: Array.isArray(payload.emergencySymptoms) ? payload.emergencySymptoms : [],
  };

  return JSON.stringify(normalized);
}

export function initializeDatabase(dbPath = defaultDbPath) {
  if (!databaseCache.has(dbPath)) {
    const db = new DatabaseSync(dbPath);
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL
      );
    `);
    databaseCache.set(dbPath, db);
  }

  return databaseCache.get(dbPath);
}

export function closeDatabase(dbPath = defaultDbPath) {
  const db = databaseCache.get(dbPath);
  if (db) {
    db.close();
    databaseCache.delete(dbPath);
  }
}

export function readRegistrations(dbPath = defaultDbPath) {
  const db = initializeDatabase(dbPath);
  const rows = db.prepare('SELECT id, payload FROM registrations ORDER BY id DESC').all();
  return rows.map(normalizeRegistration);
}

export function getRegistrationById(id, dbPath = defaultDbPath) {
  const db = initializeDatabase(dbPath);
  const row = db.prepare('SELECT id, payload FROM registrations WHERE id = ?').get(id);
  return row ? normalizeRegistration(row) : null;
}

export function createRegistration(payload, dbPath = defaultDbPath) {
  const db = initializeDatabase(dbPath);
  const statement = db.prepare('INSERT INTO registrations (payload) VALUES (?)');
  const result = statement.run(serializeRegistration(payload));
  return getRegistrationById(result.lastInsertRowid, dbPath);
}

export function updateRegistration(id, payload, dbPath = defaultDbPath) {
  const db = initializeDatabase(dbPath);
  const existing = getRegistrationById(id, dbPath);
  if (!existing) {
    throw new Error('Registration not found');
  }

  const nextPayload = {
    ...existing,
    ...payload,
    id: existing.id,
  };

  db.prepare('UPDATE registrations SET payload = ? WHERE id = ?').run(serializeRegistration(nextPayload), id);
  return getRegistrationById(id, dbPath);
}
