const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_this';
const USERS_FILE = path.join(__dirname, 'users.json');
const RESET_CODE_EXPIRE_MS = 10 * 60 * 1000;
const RESET_CODE_RESEND_MS = 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const pendingResetCodes = new Map();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

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

function isValidPasswordRule(password) {
  return typeof password === 'string' && password.length >= 8 && /[a-z]/.test(password) && /[0-9]/.test(password);
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
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

app.post('/api/register', async (req, res) => {
  const { name, email, password, phone, branch } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Eksik alanlar' });

  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  if (users.find(u => normalizeEmail(u.email) === normalizedEmail)) return res.status(409).json({ error: 'E-posta zaten kayıtlı' });

  try {
    const hash = await bcryptjs.hash(password, 10);
    const user = { id: Date.now(), name, email: normalizedEmail, password: hash, phone, branch: String(branch || '').trim(), isAdmin: false };
    users.push(user);
    writeUsers(users);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

app.post('/api/login', async (req, res) => {
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
    return res.json({ token, user: { name: user.name, email: user.email, phone: user.phone, branch: user.branch || '' } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

app.post('/api/forgot-password/request-code', async (req, res) => {
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

app.post('/api/forgot-password/confirm-code', async (req, res) => {
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
    return res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, branch: user.branch || '', isAdmin: !!user.isAdmin } });
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
    const out = users.map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, branch: u.branch || '', isAdmin: !!u.isAdmin }));
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