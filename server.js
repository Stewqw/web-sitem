const express = require('express');
const fs = require('fs');
const path = require('path');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_this';
const USERS_FILE = path.join(__dirname, 'users.json');

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

app.post('/api/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Eksik alanlar' });

  const users = readUsers();
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'E-posta zaten kayıtlı' });

  try {
    const hash = await bcryptjs.hash(password, 10);
    const user = { id: Date.now(), name, email, password: hash, phone, isAdmin: false };
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
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

  try {
    const ok = await bcryptjs.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Hatalı şifre' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { name: user.name, email: user.email, phone: user.phone } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Eksik alanlar' });

  if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Şifre kurallara uymuyor' });
  }

  const users = readUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = users.find(u => String(u.email || '').trim().toLowerCase() === normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  try {
    const hash = await bcryptjs.hash(newPassword, 10);
    user.password = hash;
    writeUsers(users);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
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
    const user = users.find(u => u.email === payload.email || u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    return res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: !!user.isAdmin } });
  } catch (e) {
    return res.status(401).json({ error: 'Token geçersiz' });
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
    const requester = users.find(u => u.id === payload.id || u.email === payload.email);
    if (!requester || !requester.isAdmin) return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    const out = users.map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, isAdmin: !!u.isAdmin }));
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
    const requester = users.find(u => u.id === payload.id || u.email === payload.email);
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