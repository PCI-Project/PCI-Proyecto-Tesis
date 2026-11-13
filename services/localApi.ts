import { MongoUser } from '../types';
import { validateNewPassword } from './passwordPolicy';
import { MAX_FAILED_ATTEMPTS } from './authConfig';

// Mini "backend" que corre en el navegador y reemplaza al servidor Express + MongoDB de la versión web.
// Expone la misma forma que usa el resto de la app (`API.get/post/put/delete` con respuestas `{ data }` y
// errores `err.response.data`), así AuthContext y App.tsx casi no cambian respecto a la versión web.
//
// Todo se guarda en localStorage de este navegador:
//   - cuentas:   asphalt-pci-mapa.users.v1
//   - proyectos: asphalt-pci-mapa.projects.v1 (cada uno con su propietario)
// Las contraseñas se guardan con sal y hash, pero esto NO es seguridad real: cualquiera con acceso al
// navegador puede leer o borrar los datos. Sirve para separar cuentas en un equipo local.

const USERS_KEY = 'asphalt-pci-mapa.users.v1';
const PROJECTS_KEY = 'asphalt-pci-mapa.projects.v1';
const TOKEN_KEY = 'token';
const TOKEN_PREFIX = 'local:';
const LEGACY_OWNER = 'local-user'; // propietario de los proyectos de la edición local anterior
// OWASP Password Storage: PBKDF2-HMAC-SHA256 con 600 000 iteraciones. Las cuentas antiguas guardan
// su número de iteraciones y se actualizan solas al iniciar sesión.
const PBKDF2_ITERATIONS = 600000;
const LEGACY_PBKDF2_ITERATIONS = 120000;
const SHA256_ROUNDS = 20000; // respaldo cuando crypto.subtle no existe (http que no es localhost)
const LEGACY_SHA256_ROUNDS = 2000;
const ATTEMPTS_KEY = 'asphalt-pci-mapa.auth-attempts.v1';

type HashScheme = 'pbkdf2' | 'sha256';

interface StoredUser extends MongoUser {
  salt: string;
  passwordHash: string;
  scheme: HashScheme;
  iterations?: number;
  recoveryIterations?: number;
  // Código de recuperación (sin correo): se muestra una sola vez y se guarda con hash
  recoverySalt?: string;
  recoveryHash?: string;
  recoveryScheme?: HashScheme;
}

type StoredProject = Record<string, any> & { _id: string; id: string; propietario: string };

export interface ApiResponse<T = any> { data: T; status: number; }

// El mensaje queda vacío a propósito: la interfaz usa sus textos traducidos cuando no hay `message`.
const apiError = (status: number, message?: string) =>
  Object.assign(new Error(message || `Error ${status}`), { response: { status, data: message ? { message } : {} } });

// --- Almacenamiento ---

const readList = <T,>(key: string): T[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const writeList = (key: string, value: unknown[]) => localStorage.setItem(key, JSON.stringify(value));

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// --- Contraseñas ---

const toHex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

const randomSalt = (): string => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  return toHex(bytes);
};

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

// SHA-256 en JavaScript puro, para cuando crypto.subtle no existe (páginas http que no son localhost).
export const sha256Hex = (message: string): string => {
  const data = new TextEncoder().encode(message);
  const paddedLength = ((data.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor((data.length * 8) / 0x100000000));
  view.setUint32(paddedLength - 4, (data.length * 8) >>> 0);
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rotr = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => { hash[index] = (hash[index] + value) >>> 0; });
  }
  return hash.map(value => value.toString(16).padStart(8, '0')).join('');
};

const canUseSubtle = () => typeof crypto !== 'undefined' && Boolean(crypto.subtle);

const currentIterations = (scheme: HashScheme) => scheme === 'pbkdf2' ? PBKDF2_ITERATIONS : SHA256_ROUNDS;
const legacyIterations = (scheme: HashScheme) => scheme === 'pbkdf2' ? LEGACY_PBKDF2_ITERATIONS : LEGACY_SHA256_ROUNDS;

const hashPassword = async (password: string, salt: string, scheme: HashScheme, iterations = currentIterations(scheme)): Promise<string> => {
  if (scheme === 'pbkdf2') {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256);
    return toHex(new Uint8Array(bits));
  }
  let digest = sha256Hex(`${salt}:${password}`);
  for (let round = 0; round < iterations; round += 1) digest = sha256Hex(`${salt}:${digest}`);
  return digest;
};

// --- Límite de intentos fallidos (bloqueo temporal creciente) ---

interface Attempts { failures: number; lockedUntil: number; }
const readAttempts = (): Record<string, Attempts> => {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}') || {}; } catch { return {}; }
};
const writeAttempts = (value: Record<string, Attempts>) => localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(value));
const assertNotLocked = (key: string) => {
  const entry = readAttempts()[key];
  if (entry && entry.lockedUntil > Date.now()) {
    const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    throw apiError(429, `Demasiados intentos fallidos. Intenta de nuevo en ${minutes} min.`);
  }
};
const registerFailure = (key: string) => {
  const all = readAttempts();
  const failures = (all[key]?.failures || 0) + 1;
  // A partir del intento 5: 1, 2, 4, 8 y como máximo 15 minutos de espera
  const lockedUntil = failures >= MAX_FAILED_ATTEMPTS ? Date.now() + Math.min(15, 2 ** (failures - MAX_FAILED_ATTEMPTS)) * 60000 : 0;
  all[key] = { failures, lockedUntil };
  writeAttempts(all);
};
const clearFailures = (key: string) => { const all = readAttempts(); delete all[key]; writeAttempts(all); };

// --- Código de recuperación ---

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para evitar confusiones

const newRecoveryCode = (): string => {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  const chars = Array.from(bytes, byte => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
};

const normalizeRecoveryCode = (code: unknown) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const recoveryFields = async (code: string) => {
  const recoveryScheme: HashScheme = canUseSubtle() ? 'pbkdf2' : 'sha256';
  const recoverySalt = randomSalt();
  return { recoverySalt, recoveryScheme, recoveryIterations: currentIterations(recoveryScheme), recoveryHash: await hashPassword(normalizeRecoveryCode(code), recoverySalt, recoveryScheme) };
};

// --- Sesión ---

const currentUserId = (): string | null => {
  try {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    return token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null;
  } catch {
    return null;
  }
};

const requireUserId = (): string => {
  const id = currentUserId();
  if (!id || !readList<StoredUser>(USERS_KEY).some(user => user._id === id)) throw apiError(401);
  return id;
};

const publicUser = ({ salt: _salt, passwordHash: _hash, scheme: _scheme, iterations: _it, recoverySalt: _rs, recoveryHash: _rh, recoveryScheme: _rsc, recoveryIterations: _rit, ...user }: StoredUser): MongoUser => user;
const sessionFor = (user: StoredUser) => ({ token: `${TOKEN_PREFIX}${user._id}`, user: publicUser(user) });
const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase();

// --- Rutas ---

const register = async (body: any): Promise<ApiResponse> => {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const nombre = String(body.nombre || '').trim();
  if (!email || !password || !nombre) throw apiError(400);
  if (validateNewPassword(password, { email, name: nombre })) throw apiError(400, 'La contraseña no cumple la política de seguridad.');
  const users = readList<StoredUser>(USERS_KEY);
  if (users.some(user => normalizeEmail(user.email) === email)) throw apiError(400);

  const scheme: HashScheme = canUseSubtle() ? 'pbkdf2' : 'sha256';
  const salt = randomSalt();
  const isFirstAccount = users.length === 0;
  const now = new Date().toISOString();
  const user: StoredUser = {
    _id: newId(), email, nombre, rol: isFirstAccount ? 'admin' : 'user',
    company: String(body.company || ''), jobTitle: String(body.jobTitle || ''), phone: '', country: '',
    createdAt: now, updatedAt: now, salt, scheme, iterations: currentIterations(scheme), passwordHash: await hashPassword(password, salt, scheme),
  };
  const recoveryCode = newRecoveryCode();
  Object.assign(user, await recoveryFields(recoveryCode));
  writeList(USERS_KEY, [...users, user]);

  if (isFirstAccount) {
    // La primera cuenta es la administradora y hereda los proyectos de la edición local anterior (sin cuentas).
    const projects = readList<StoredProject>(PROJECTS_KEY).map(project =>
      project.propietario === LEGACY_OWNER ? { ...project, propietario: user._id } : project);
    writeList(PROJECTS_KEY, projects);
  }
  return { status: 201, data: { ...sessionFor(user), recoveryCode } };
};

const login = async (body: any): Promise<ApiResponse> => {
  const email = normalizeEmail(body.email);
  const attemptKey = `login:${email}`;
  assertNotLocked(attemptKey);
  const users = readList<StoredUser>(USERS_KEY);
  const user = users.find(item => normalizeEmail(item.email) === email);
  const password = String(body.password || '');
  const valid = user ? await hashPassword(password, user.salt, user.scheme, user.iterations ?? legacyIterations(user.scheme)) === user.passwordHash : false;
  if (!user || !valid) { registerFailure(attemptKey); throw apiError(401); } // mismo error exista o no la cuenta
  clearFailures(attemptKey);
  const scheme: HashScheme = canUseSubtle() ? 'pbkdf2' : 'sha256';
  if ((user.iterations ?? legacyIterations(user.scheme)) < currentIterations(scheme) || user.scheme !== scheme) {
    const salt = randomSalt();
    const upgraded = { ...user, salt, scheme, iterations: currentIterations(scheme), passwordHash: await hashPassword(password, salt, scheme) };
    writeList(USERS_KEY, users.map(item => item._id === user._id ? upgraded : item));
    return { status: 200, data: sessionFor(upgraded) };
  }
  return { status: 200, data: sessionFor(user) };
};

const updateUsers = (change: (user: StoredUser) => StoredUser): StoredUser => {
  const id = requireUserId();
  let updated: StoredUser | undefined;
  const users = readList<StoredUser>(USERS_KEY).map(user => {
    if (user._id !== id) return user;
    updated = { ...change(user), updatedAt: new Date().toISOString() };
    return updated;
  });
  writeList(USERS_KEY, users);
  return updated!;
};

const updateProfile = async (body: any): Promise<ApiResponse> => {
  const user = updateUsers(current => ({
    ...current,
    nombre: String(body.nombre ?? current.nombre).trim() || current.nombre,
    company: String(body.company ?? ''), jobTitle: String(body.jobTitle ?? ''),
    phone: String(body.phone ?? ''), country: String(body.country ?? ''),
  }));
  return { status: 200, data: publicUser(user) };
};

const changePassword = async (body: any): Promise<ApiResponse> => {
  const id = requireUserId();
  const user = readList<StoredUser>(USERS_KEY).find(item => item._id === id)!;
  if (await hashPassword(String(body.oldPassword || ''), user.salt, user.scheme, user.iterations ?? legacyIterations(user.scheme)) !== user.passwordHash) throw apiError(400);
  const newPassword = String(body.newPassword || '');
  if (validateNewPassword(newPassword, { email: user.email, name: user.nombre })) throw apiError(400, 'La contraseña no cumple la política de seguridad.');
  const scheme: HashScheme = canUseSubtle() ? 'pbkdf2' : 'sha256';
  const salt = randomSalt();
  const passwordHash = await hashPassword(newPassword, salt, scheme);
  updateUsers(current => ({ ...current, salt, scheme, iterations: currentIterations(scheme), passwordHash }));
  return { status: 200, data: { msg: 'Contraseña actualizada' } };
};

// POST /auth/forgot-password: misma respuesta exista o no la cuenta (OWASP). En modo local no se envía nada.
const forgotPassword = async (body: any): Promise<ApiResponse> => {
  normalizeEmail(body.email);
  await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 300)); // tiempo similar en todos los casos
  return { status: 202, data: { emailDelivery: false } };
};

// Genera un código nuevo para la cuenta con sesión iniciada (invalida el anterior)
const createRecoveryCode = async (): Promise<ApiResponse> => {
  requireUserId();
  const recoveryCode = newRecoveryCode();
  const fields = await recoveryFields(recoveryCode);
  updateUsers(current => ({ ...current, ...fields }));
  return { status: 200, data: { recoveryCode } };
};

// "Olvidé mi contraseña": correo + código de recuperación -> contraseña nueva (y un código nuevo)
const resetPassword = async (body: any): Promise<ApiResponse> => {
  const email = normalizeEmail(body.email);
  const code = normalizeRecoveryCode(body.code);
  const newPassword = String(body.newPassword || '');
  if (!email || !code) throw apiError(400);
  const attemptKey = `recovery:${email}`;
  assertNotLocked(attemptKey);
  const users = readList<StoredUser>(USERS_KEY);
  const user = users.find(item => normalizeEmail(item.email) === email);
  const codeOk = Boolean(user && user.recoveryHash && user.recoverySalt && user.recoveryScheme)
    && await hashPassword(code, user!.recoverySalt!, user!.recoveryScheme!, user!.recoveryIterations ?? legacyIterations(user!.recoveryScheme!)) === user!.recoveryHash;
  if (!user || !codeOk) { registerFailure(attemptKey); throw apiError(400); }
  if (validateNewPassword(newPassword, { email: user.email, name: user.nombre })) throw apiError(400, 'La contraseña no cumple la política de seguridad.');
  clearFailures(attemptKey);
  const scheme: HashScheme = canUseSubtle() ? 'pbkdf2' : 'sha256';
  const salt = randomSalt();
  const passwordHash = await hashPassword(newPassword, salt, scheme);
  const recoveryCode = newRecoveryCode();
  const fields = await recoveryFields(recoveryCode);
  writeList(USERS_KEY, users.map(item => item._id === user._id ? { ...item, salt, scheme, iterations: currentIterations(scheme), passwordHash, ...fields, updatedAt: new Date().toISOString() } : item));
  return { status: 200, data: { recoveryCode } };
};

const deleteAccount = async (userId: string): Promise<ApiResponse> => {
  const id = requireUserId();
  if (id !== userId) throw apiError(403);
  writeList(USERS_KEY, readList<StoredUser>(USERS_KEY).filter(user => user._id !== id));
  writeList(PROJECTS_KEY, readList<StoredProject>(PROJECTS_KEY).filter(project => project.propietario !== id));
  return { status: 200, data: { msg: 'Cuenta eliminada' } };
};

const listProjects = async (): Promise<ApiResponse> => {
  const owner = requireUserId();
  return { status: 200, data: readList<StoredProject>(PROJECTS_KEY).filter(project => project.propietario === owner) };
};

const createProject = async (body: any): Promise<ApiResponse> => {
  const owner = requireUserId();
  const id = newId();
  const now = new Date().toISOString();
  const project: StoredProject = {
    ...body, _id: id, id, nombre: body.nombre || body.name, name: body.name || body.nombre,
    propietario: owner, createdAt: now, updatedAt: now,
  };
  writeList(PROJECTS_KEY, [...readList<StoredProject>(PROJECTS_KEY), project]);
  return { status: 201, data: project };
};

const updateProject = async (id: string, body: any): Promise<ApiResponse> => {
  const owner = requireUserId();
  let updated: StoredProject | undefined;
  const projects = readList<StoredProject>(PROJECTS_KEY).map(project => {
    if (project._id !== id || project.propietario !== owner) return project;
    const { propietario: _ignored, _id: _ignoredId, ...changes } = body; // el propietario no se cambia desde el cliente
    updated = { ...project, ...changes, id: project.id, nombre: changes.nombre || changes.name || project.nombre, updatedAt: new Date().toISOString() };
    return updated;
  });
  if (!updated) throw apiError(404);
  writeList(PROJECTS_KEY, projects);
  return { status: 200, data: updated };
};

const deleteProject = async (id: string): Promise<ApiResponse> => {
  const owner = requireUserId();
  const projects = readList<StoredProject>(PROJECTS_KEY);
  if (!projects.some(project => project._id === id && project.propietario === owner)) throw apiError(404);
  writeList(PROJECTS_KEY, projects.filter(project => !(project._id === id && project.propietario === owner)));
  return { status: 200, data: { msg: 'Proyecto eliminado' } };
};

const notFound = (method: string, url: string) => apiError(404, `Ruta local no encontrada: ${method} ${url}`);

const route = async (method: string, url: string, body?: any): Promise<ApiResponse> => {
  try {
    if (method === 'POST' && url === '/auth/register') return await register(body || {});
    if (method === 'POST' && url === '/auth/login') return await login(body || {});
    if (method === 'PUT' && url === '/auth/profile') return await updateProfile(body || {});
    if (method === 'PUT' && url === '/auth/password') return await changePassword(body || {});
    if (method === 'POST' && url === '/auth/recovery-code') return await createRecoveryCode();
    if (method === 'POST' && url === '/auth/reset-password') return await resetPassword(body || {});
    if (method === 'POST' && url === '/auth/forgot-password') return await forgotPassword(body || {});
    if (method === 'DELETE' && url.startsWith('/auth/')) return await deleteAccount(url.slice('/auth/'.length));
    if (method === 'GET' && url === '/projects') return await listProjects();
    if (method === 'POST' && url === '/projects') return await createProject(body || {});
    if (method === 'PUT' && url.startsWith('/projects/')) return await updateProject(url.slice('/projects/'.length), body || {});
    if (method === 'DELETE' && url.startsWith('/projects/')) return await deleteProject(url.slice('/projects/'.length));
  } catch (error: any) {
    if (error?.response) throw error;
    // Casi siempre es QuotaExceededError: el navegador se quedó sin espacio de almacenamiento.
    console.error('Error en el almacenamiento local', error);
    throw apiError(500, 'No se pudo guardar en el almacenamiento local del navegador.');
  }
  throw notFound(method, url);
};

export const API = {
  get: <T = any>(url: string) => route('GET', url) as Promise<ApiResponse<T>>,
  post: <T = any>(url: string, body?: unknown) => route('POST', url, body) as Promise<ApiResponse<T>>,
  put: <T = any>(url: string, body?: unknown) => route('PUT', url, body) as Promise<ApiResponse<T>>,
  delete: <T = any>(url: string) => route('DELETE', url) as Promise<ApiResponse<T>>,
};
