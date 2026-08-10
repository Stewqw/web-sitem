const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const firebaseAdmin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_this';
const UNLIMITED_USER_EMAILS = String(process.env.UNLIMITED_USER_EMAILS || '');
const USERS_FILE = path.join(__dirname, 'users.json');
const FIREBASE_SERVICE_ACCOUNT_FILE = String(process.env.FIREBASE_SERVICE_ACCOUNT_FILE || path.join(__dirname, 'serviceAccount.json'));
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || 'https://parabol-kocluk.web.app,https://parabolkocluk.com,http://127.0.0.1:5500,http://localhost:5500,http://localhost:3000,http://127.0.0.1:3000');
const RESET_CODE_EXPIRE_MS = 10 * 60 * 1000;
const RESET_CODE_RESEND_MS = 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const ACCESS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_SUFFIX_LENGTH = 6;
const ACCESS_CODE_EXPIRE_MS = Number(process.env.ACCESS_CODE_EXPIRE_MS || 180 * 24 * 60 * 60 * 1000);
const ACCESS_CODE_MAX_EXCHANGES = Number(process.env.ACCESS_CODE_MAX_EXCHANGES || 0);
const pendingResetCodes = new Map();

const app = express();

if (JWT_SECRET === 'dev_secret_change_this') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET zorunlu. Uretim ortaminda varsayilan secret kullanilamaz.');
  }
  console.warn('UYARI: Varsayilan JWT_SECRET kullaniliyor. Gelistirme disinda degistirin.');
}

const allowedOrigins = CORS_ORIGINS
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(bodyParser.json());

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(String(origin))) {
    return res.status(403).json({ error: 'Bu origin icin API erisimi kapali.' });
  }
  return next();
});

const blockedStaticPathPattern = /(^\/(server\.js|users\.json|package\.json|package-lock\.json|render\.ya?ml|\.env|\.git|\.github|memories)(\/|$))|(\.(pem|key|crt|p12|sqlite|db)$)/i;
app.use((req, res, next) => {
  if (blockedStaticPathPattern.test(req.path || '')) {
    return res.status(404).send('Not Found');
  }
  return next();
});

app.use(express.static(__dirname, {
  index: false,
  dotfiles: 'deny'
}));

const rateLimitStore = new Map();

function getRateLimitKey(req, bucketName, keySuffix) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown').split(',')[0].trim();
  return `${bucketName}:${keySuffix || ip}`;
}

function createRateLimiter(options) {
  const windowMs = Number(options.windowMs);
  const maxRequests = Number(options.maxRequests);
  const bucketName = String(options.bucketName || 'default');
  const keyFromRequest = typeof options.keyFromRequest === 'function' ? options.keyFromRequest : null;

  return function rateLimiter(req, res, next) {
    const keySuffix = keyFromRequest ? keyFromRequest(req) : null;
    const key = getRateLimitKey(req, bucketName, keySuffix);
    const now = Date.now();
    const current = rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Cok fazla istek gonderildi. Lutfen tekrar deneyin.' });
    }

    current.count += 1;
    rateLimitStore.set(key, current);
    return next();
  };
}

const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 25, bucketName: 'login' });
const registerRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 20, bucketName: 'register' });
const forgotRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 15,
  bucketName: 'forgot',
  keyFromRequest(req) {
    const email = normalizeEmail(req.body && req.body.email);
    return email || null;
  }
});
const accessProvisionRateLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 40, bucketName: 'access-provision' });
const accessExchangeRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 60,
  bucketName: 'access-exchange',
  keyFromRequest(req) {
    const code = normalizeAccessCode(req.body && req.body.code);
    return code || null;
  }
});

const loginIdentityRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  bucketName: 'login-identity',
  keyFromRequest(req) {
    const email = normalizeEmail(req.body && req.body.email);
    return email || null;
  }
});

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isEmailInUnlimitedList(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return UNLIMITED_USER_EMAILS
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean)
    .includes(normalizedEmail);
}

function hasUnlimitedAccess(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.isAdmin) return true;
  if (user.unlimitedAccess === true) return true;
  return isEmailInUnlimitedList(user.email);
}

function getUserCreatedAtIso(user) {
  if (!user || typeof user !== 'object') return null;
  if (user.createdAtIso) return String(user.createdAtIso);
  const numericId = Number(user.id);
  if (Number.isFinite(numericId) && numericId > 0) {
    return new Date(numericId).toISOString();
  }
  return null;
}

function getAuthUserFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;

  const parts = auth.split(' ');
  if (parts.length !== 2) return null;

  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
    return users.find((u) => u.id === payload.id || normalizeEmail(u.email) === normalizeEmail(payload.email)) || null;
  } catch (e) {
    return null;
  }
}

function isValidPasswordRule(password) {
  return typeof password === 'string' && password.length >= 8 && /[a-z]/.test(password) && /[0-9]/.test(password);
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function normalizeAccessCode(code) {
  return String(code || '').trim().toUpperCase();
}

function hashAccessCode(code) {
  return crypto.createHash('sha256').update(normalizeAccessCode(code)).digest('hex');
}

function randomTokenString(length) {
  const bytes = crypto.randomBytes(length);
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += ACCESS_CODE_CHARS[bytes[i] % ACCESS_CODE_CHARS.length];
  }
  return value;
}

function generateAccessCode(prefix) {
  return `${String(prefix || '').toUpperCase()}-${randomTokenString(ACCESS_CODE_SUFFIX_LENGTH)}`;
}

function generateAccessUid(prefix) {
  return `${String(prefix || '').toLowerCase()}_${crypto.randomBytes(10).toString('hex')}`;
}

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.private_key && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (error) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON parse edilemedi:', error.message || error);
    return null;
  }
}

function parseServiceAccountFromFile() {
  try {
    if (!fs.existsSync(FIREBASE_SERVICE_ACCOUNT_FILE)) return null;
    const raw = fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.private_key && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (error) {
    console.error('Firebase service account dosyasi okunamadi:', error.message || error);
    return null;
  }
}

function ensureFirebaseAdminApp() {
  if (firebaseAdmin.apps.length > 0) {
    return firebaseAdmin.app();
  }

  const serviceAccount = parseServiceAccountFromEnv() || parseServiceAccountFromFile();
  try {
    if (serviceAccount) {
      return firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(serviceAccount) });
    }
    return firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.applicationDefault() });
  } catch (error) {
    console.error('Firebase Admin baslatilamadi:', error.message || error);
    return null;
  }
}

const firebaseAdminApp = ensureFirebaseAdminApp();
const firebaseAuth = firebaseAdminApp ? firebaseAdmin.auth() : null;
const firebaseDb = firebaseAdminApp ? firebaseAdmin.firestore() : null;

async function verifyFirebaseIdTokenFromRequest(req) {
  if (!firebaseAuth) {
    const err = new Error('Firebase Admin yapılandırılmamış.');
    err.status = 503;
    throw err;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    const err = new Error('Yetkisiz');
    err.status = 401;
    throw err;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    const err = new Error('Yetkisiz');
    err.status = 401;
    throw err;
  }

  try {
    return await firebaseAuth.verifyIdToken(parts[1]);
  } catch (error) {
    console.error('Firebase token dogrulama hatasi:', error && (error.code || error.message || error));
    const err = new Error('Firebase oturumu doğrulanamadı. Service account dosyasının doğru projeye ait olduğunu kontrol edin.');
    err.status = 401;
    throw err;
  }
}

async function getFirebaseUserProfile(uid) {
  if (!firebaseDb) return null;
  const doc = await firebaseDb.collection('users').doc(String(uid)).get();
  return doc.exists ? doc.data() : null;
}

function isCoachRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'coach' || normalizedRole === 'admin' || normalizedRole === 'owner';
}

async function resolveCoachIdentity(req) {
  const decoded = await verifyFirebaseIdTokenFromRequest(req);
  const profile = await getFirebaseUserProfile(decoded.uid);
  if (!profile || !isCoachRole(profile.role)) {
    const err = new Error('Öğretmen yetkisi gerekli.');
    err.status = 403;
    throw err;
  }
  return { decoded, profile };
}

async function storeAccessCodeRecord({
  code,
  uid,
  role,
  coachUid,
  studentUid,
  parentUid,
  studentId,
  classLevel,
  branch,
  displayName,
  linkedStudentIds
}) {
  if (!firebaseDb) {
    throw new Error('Firestore kullanıma hazır değil.');
  }

  const normalizedCode = normalizeAccessCode(code);
  const codeHash = hashAccessCode(normalizedCode);
  const nowIso = new Date().toISOString();

  await firebaseDb.collection('accessCodes').doc(codeHash).set(
    {
      codeHash,
      uid,
      role,
      coachUid,
      studentUid,
      parentUid,
      studentId,
      classLevel: String(classLevel || '').trim(),
      branch: String(branch || '').trim(),
      displayName: String(displayName || '').trim(),
      linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : [],
      isActive: true,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

function buildMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendResetCodeEmail(email, code) {
  const transporter = buildMailTransporter();
  if (!transporter) {
    return false;
  }

  const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: 'Parabol Koçluk Şifre Sıfırlama Kodu',
    text: `Parabol Koçluk şifre sıfırlama kodunuz: ${code}\n\nBu kod 10 dakika boyunca geçerlidir.`,
    html: `<p>Parabol Koçluk şifre sıfırlama kodunuz:</p><p style="font-size:22px;font-weight:700;letter-spacing:2px;">${code}</p><p>Bu kod 10 dakika boyunca geçerlidir.</p>`
  });

  return true;
}

app.post('/api/register', registerRateLimiter, async (req, res) => {
  const { name, email, password, phone, branch } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Eksik alanlar' });
  if (!isValidPasswordRule(password)) return res.status(400).json({ error: 'Sifre kurallara uymuyor' });

  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  if (users.find(u => normalizeEmail(u.email) === normalizedEmail)) return res.status(409).json({ error: 'E-posta zaten kayıtlı' });

  try {
    const hash = await bcryptjs.hash(password, 10);
    const createdAtIso = new Date().toISOString();
    const user = {
      id: Date.now(),
      name,
      email: normalizedEmail,
      password: hash,
      phone,
      branch: String(branch || '').trim(),
      isAdmin: false,
      plan: 'explore',
      isDemoAccount: true,
      studentLimit: 1,
      createdAtIso
    };
    users.push(user);
    writeUsers(users);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

app.post('/api/login', loginRateLimiter, loginIdentityRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Eksik alanlar' });

  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  const user = users.find(u => normalizeEmail(u.email) === normalizedEmail);
  if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

  try {
    const ok = await bcryptjs.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Hatalı şifre' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const normalizedPlan = String(user.plan || '').trim().toLowerCase();
    const studentLimit = typeof user.studentLimit === 'number'
      ? user.studentLimit
      : (normalizedPlan === 'explore' || normalizedPlan === 'kesfet' ? 1 : null);
    const createdAtIso = getUserCreatedAtIso(user);
    const isUnlimitedAccess = hasUnlimitedAccess(user);
    return res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        branch: user.branch || '',
        plan: user.plan || '',
        isDemoAccount: user.isDemoAccount === true,
        studentLimit,
        createdAtIso,
        isUnlimitedAccess
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

app.post('/api/forgot-password/request-code', forgotRateLimiter, async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
  }

  const users = readUsers();
  const user = users.find(u => normalizeEmail(u.email) === email);
  const now = Date.now();

  const existing = pendingResetCodes.get(email);
  if (existing && (now - existing.lastSentAt) < RESET_CODE_RESEND_MS) {
    return res.status(429).json({ error: 'Yeni kod istemek için lütfen biraz bekleyin.' });
  }

  // Kullanıcı var/yok bilgisini dışarı sızdırmamak için her zaman başarılı cevap dön.
  if (!user) {
    return res.json({ ok: true, message: 'Eğer e-posta kayıtlıysa doğrulama kodu gönderilecektir.' });
  }

  const code = generateResetCode();
  pendingResetCodes.set(email, {
    codeHash: hashResetCode(code),
    expiresAt: now + RESET_CODE_EXPIRE_MS,
    attempts: 0,
    lastSentAt: now
  });

  try {
    const sent = await sendResetCodeEmail(email, code);
    if (!sent) {
      pendingResetCodes.delete(email);
      return res.status(503).json({ error: 'E-posta servisi yapılandırılmamış. SMTP ayarlarını tamamlayın.' });
    }
    return res.json({ ok: true, message: 'Doğrulama kodu e-posta adresinize gönderildi.' });
  } catch (e) {
    console.error('Reset kod e-postası gönderilemedi:', e);
    pendingResetCodes.delete(email);
    return res.status(500).json({ error: 'Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.' });
  }
});

app.post('/api/forgot-password/confirm-code', forgotRateLimiter, async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const code = String((req.body && req.body.code) || '').trim();
  const newPassword = String((req.body && req.body.newPassword) || '');

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Eksik alanlar' });
  }

  if (!isValidPasswordRule(newPassword)) {
    return res.status(400).json({ error: 'Şifre kurallara uymuyor' });
  }

  const pending = pendingResetCodes.get(email);
  if (!pending) {
    return res.status(400).json({ error: 'Kod geçersiz veya süresi dolmuş.' });
  }

  if (Date.now() > pending.expiresAt) {
    pendingResetCodes.delete(email);
    return res.status(400).json({ error: 'Kodun süresi doldu. Lütfen yeni kod isteyin.' });
  }

  if (pending.attempts >= RESET_CODE_MAX_ATTEMPTS) {
    pendingResetCodes.delete(email);
    return res.status(429).json({ error: 'Çok fazla hatalı deneme. Lütfen yeni kod isteyin.' });
  }

  const incomingHash = hashResetCode(code);
  if (incomingHash !== pending.codeHash) {
    pending.attempts += 1;
    pendingResetCodes.set(email, pending);
    return res.status(400).json({ error: 'Doğrulama kodu hatalı.' });
  }

  const users = readUsers();
  const user = users.find(u => normalizeEmail(u.email) === email);
  if (!user) {
    pendingResetCodes.delete(email);
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  try {
    const hash = await bcryptjs.hash(newPassword, 10);
    user.password = hash;
    writeUsers(users);
    pendingResetCodes.delete(email);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Eski endpoint artık güvenlik nedeniyle devre dışı.
app.post('/api/forgot-password', async (req, res) => {
  return res.status(410).json({ error: 'Bu işlem güncellendi. Önce kod isteyip sonra doğrulama yapmalısınız.' });
});

app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Yetkisiz' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Yetkisiz' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
    const user = users.find(u => normalizeEmail(u.email) === normalizeEmail(payload.email) || u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    const normalizedPlan = String(user.plan || '').trim().toLowerCase();
    const studentLimit = typeof user.studentLimit === 'number'
      ? user.studentLimit
      : (normalizedPlan === 'explore' || normalizedPlan === 'kesfet' ? 1 : null);
    const createdAtIso = getUserCreatedAtIso(user);
    const isUnlimitedAccess = hasUnlimitedAccess(user);
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        branch: user.branch || '',
        isAdmin: !!user.isAdmin,
        plan: user.plan || '',
        isDemoAccount: user.isDemoAccount === true,
        studentLimit,
        createdAtIso,
        isUnlimitedAccess
      }
    });
  } catch (e) {
    return res.status(401).json({ error: 'Token geçersiz' });
  }
});

// Public: yalnızca toplam kullanıcı sayısını döndür
app.get('/api/users/count', (req, res) => {
  try {
    const users = readUsers();
    return res.json({ count: users.length });
  } catch (e) {
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Helper: ensure admin user exists from env vars if provided
function ensureInitialAdmin() {
  const users = readUsers();
  if (users.length > 0) return;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASS;
  if (adminEmail && adminPass) {
    bcryptjs.hash(adminPass, 10).then(hash => {
      const admin = { id: Date.now(), name: 'Admin', email: adminEmail, password: hash, phone: '', isAdmin: true };
      users.push(admin);
      writeUsers(users);
      console.log('Initial admin created:', adminEmail);
    }).catch(e => console.error('Admin create error', e));
  }
}

// Admin: kullanıcı listesini döndür (parola hariç)
app.get('/api/users', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Yetkisiz' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Yetkisiz' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
    const requester = users.find(u => u.id === payload.id || normalizeEmail(u.email) === normalizeEmail(payload.email));
    if (!requester || !requester.isAdmin) return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    const out = users.map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, branch: u.branch || '', isAdmin: !!u.isAdmin, isUnlimitedAccess: hasUnlimitedAccess(u) }));
    return res.json({ users: out });
  } catch (e) {
    return res.status(401).json({ error: 'Token geçersiz' });
  }
});

// Admin atama/görev kaldırma: sadece adminler çağırabilir
app.post('/api/users/:id/admin', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Yetkisiz' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Yetkisiz' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
    const requester = users.find(u => u.id === payload.id || normalizeEmail(u.email) === normalizeEmail(payload.email));
    if (!requester || !requester.isAdmin) return res.status(403).json({ error: 'Admin yetkisi gerekli' });

    const targetId = parseInt(req.params.id, 10);
    const target = users.find(u => u.id === targetId);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const makeAdmin = !!req.body.isAdmin;
    target.isAdmin = makeAdmin;
    writeUsers(users);
    return res.json({ ok: true, user: { id: target.id, isAdmin: !!target.isAdmin } });
  } catch (e) {
    return res.status(401).json({ error: 'Token geçersiz' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
  ensureInitialAdmin();
});

app.post('/api/student-access/provision', accessProvisionRateLimiter, async (req, res) => {
  try {
    if (!firebaseDb || !firebaseAuth) {
      return res.status(503).json({ error: 'Firebase Admin yapılandırılmamış. Sunucuda servis hesabı tanımlayın.' });
    }

    const { decoded, profile } = await resolveCoachIdentity(req);
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const studentName = String(payload.studentName || '').trim();
    if (!studentName) {
      return res.status(400).json({ error: 'Öğrenci adı gerekli.' });
    }

    const studentUid = String(payload.studentUid || '').trim() || generateAccessUid('stu');
    const parentUid = String(payload.parentUid || '').trim() || generateAccessUid('par');
    const studentId = String(payload.studentId || studentUid).trim();
    const branch = String(payload.branch || profile.branch || '').trim();
    const classLevel = String(payload.classLevel || '').trim();
    const parentDisplayName = String(payload.parentDisplayName || `${studentName} Velisi`).trim();

    const studentLoginCode = generateAccessCode('OG');
    const parentLoginCode = generateAccessCode('VL');
    const nowIso = new Date().toISOString();

    const batch = firebaseDb.batch();
    batch.set(
      firebaseDb.collection('users').doc(studentUid),
      {
        uid: studentUid,
        role: 'student',
        displayName: studentName,
        loginCode: studentLoginCode,
        studentId,
        branch,
        classLevel,
        coachUid: decoded.uid,
        linkedStudentIds: [studentUid],
        parentUid,
        authProvider: 'custom-token',
        emailVerified: true,
        updatedAtIso: nowIso,
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        createdAtIso: nowIso,
        createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    batch.set(
      firebaseDb.collection('users').doc(parentUid),
      {
        uid: parentUid,
        role: 'parent',
        displayName: parentDisplayName,
        loginCode: parentLoginCode,
        studentId: studentUid,
        branch,
        classLevel,
        coachUid: decoded.uid,
        linkedStudentIds: [studentUid],
        authProvider: 'custom-token',
        emailVerified: true,
        updatedAtIso: nowIso,
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        createdAtIso: nowIso,
        createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await batch.commit();

    await Promise.all([
      storeAccessCodeRecord({
        code: studentLoginCode,
        uid: studentUid,
        role: 'student',
        coachUid: decoded.uid,
        studentUid,
        parentUid,
        studentId,
        classLevel,
        branch,
        displayName: studentName,
        linkedStudentIds: [studentUid]
      }),
      storeAccessCodeRecord({
        code: parentLoginCode,
        uid: parentUid,
        role: 'parent',
        coachUid: decoded.uid,
        studentUid,
        parentUid,
        studentId: studentUid,
        classLevel,
        branch,
        displayName: parentDisplayName,
        linkedStudentIds: [studentUid]
      })
    ]);

    return res.json({
      student: {
        uid: studentUid,
        loginCode: studentLoginCode,
        displayName: studentName,
        role: 'student',
        linkedStudentIds: [studentUid],
        studentId,
        branch,
        classLevel
      },
      parent: {
        uid: parentUid,
        loginCode: parentLoginCode,
        displayName: parentDisplayName,
        role: 'parent',
        linkedStudentIds: [studentUid],
        studentId: studentUid,
        branch,
        classLevel
      }
    });
  } catch (error) {
    const status = Number(error && error.status) || 500;
    const message = error && error.message ? error.message : 'Öğrenci/veli erişim kodları oluşturulamadı.';
    return res.status(status).json({ error: message });
  }
});

app.post('/api/student-access/exchange', accessExchangeRateLimiter, async (req, res) => {
  try {
    if (!firebaseDb || !firebaseAuth) {
      return res.status(503).json({ error: 'Firebase Admin yapılandırılmamış.' });
    }

    const code = normalizeAccessCode(req.body && req.body.code);
    if (!code) {
      return res.status(400).json({ error: 'Giriş kodu gerekli.' });
    }

    const codeHash = hashAccessCode(code);
    const codeDoc = await firebaseDb.collection('accessCodes').doc(codeHash).get();
    if (!codeDoc.exists) {
      return res.status(401).json({ error: 'Kod geçersiz.' });
    }

    const codeData = codeDoc.data() || {};
    if (codeData.isActive === false) {
      return res.status(403).json({ error: 'Kod pasif durumda.' });
    }

    const createdAtMs = Date.parse(String(codeData.createdAtIso || ''));
    if (Number.isFinite(createdAtMs) && (Date.now() - createdAtMs) > ACCESS_CODE_EXPIRE_MS) {
      await codeDoc.ref.set({
        isActive: false,
        disabledReason: 'expired',
        disabledAtIso: new Date().toISOString(),
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return res.status(403).json({ error: 'Kodun suresi dolmus. Ogretmeninizden yeni kod isteyin.' });
    }

    const exchangeCount = Number(codeData.exchangeCount || 0);
    if (ACCESS_CODE_MAX_EXCHANGES > 0 && exchangeCount >= ACCESS_CODE_MAX_EXCHANGES) {
      await codeDoc.ref.set({
        isActive: false,
        disabledReason: 'max-usage',
        disabledAtIso: new Date().toISOString(),
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return res.status(403).json({ error: 'Kod kullanim limiti doldu. Ogretmeninizden yeni kod isteyin.' });
    }

    const uid = String(codeData.uid || '').trim();
    const role = String(codeData.role || '').trim();
    if (!uid || !role) {
      return res.status(500).json({ error: 'Kod kaydı bozuk.' });
    }

    const customClaims = {
      role,
      coachUid: String(codeData.coachUid || ''),
      studentUid: String(codeData.studentUid || ''),
      parentUid: String(codeData.parentUid || ''),
      linkedStudentIds: Array.isArray(codeData.linkedStudentIds) ? codeData.linkedStudentIds : []
    };

    const token = await firebaseAuth.createCustomToken(uid, customClaims);

    await codeDoc.ref.set({
      exchangeCount: exchangeCount + 1,
      lastUsedAtIso: new Date().toISOString(),
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({
      token,
      uid,
      role,
      profile: {
        displayName: String(codeData.displayName || ''),
        classLevel: String(codeData.classLevel || ''),
        branch: String(codeData.branch || ''),
        linkedStudentIds: customClaims.linkedStudentIds
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Kod doğrulanamadı.' });
  }
});