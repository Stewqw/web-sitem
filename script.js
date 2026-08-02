function resolveApiBaseUrl() {
  const loc = window.location;
  const isLocalhost = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';

  if (loc.protocol === 'file:') {
    return 'http://localhost:3000';
  }

  if (isLocalhost && loc.port && loc.port !== '3000') {
    return loc.protocol + '//' + loc.hostname + ':3000';
  }

  return loc.origin;
}

const API_URL = resolveApiBaseUrl();
let activeStudentId = null;
let programWeekOffset = 0;
let currentUserEmail = null;
let savedResourceSuggestions = [];

const initialResourceSuggestions = [
  { sinif: '8', lesson: 'Matematik', name: 'FENOMEN B', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'PRUVA', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'HIZ', level: 'Orta' },
  { sinif: '8', lesson: 'Fen Bilimleri', name: 'MOZAIK', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'OKYANUS PRE-MASTER', level: 'Orta' },
  { sinif: '8', lesson: 'Türkçe', name: 'NAR TEST MOOD', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'FULL MATEMATİK*', level: 'Kolay' },
  { sinif: '8', lesson: 'Matematik', name: 'NEWTON ADIM ADIM', level: 'Kolay' },
  { sinif: '8', lesson: 'Matematik', name: 'ANKARA GÜÇLENDİREN', level: 'Kolay' },
  { sinif: '8', lesson: 'Fen Bilimleri', name: 'OKYANUS CLASSMATE', level: 'Kolay' },
  { sinif: '8', lesson: 'Matematik', name: 'ATÖLYEM', level: 'Kolay' },
  { sinif: '8', lesson: 'Matematik', name: 'BUMERANG', level: 'Kolay' },
  { sinif: '8', lesson: 'Matematik', name: 'HIZ HİBRİT', level: 'Kolay' },
  { sinif: '8', lesson: 'Matematik', name: 'FENOMEN A*', level: 'Kolay' },
  { sinif: '8', lesson: 'Matematik', name: 'HIZ UZMAN (DENEME)', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'HIZ UZMAN', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'MUBA MUTLAK BAŞARI', level: 'Zor' },
  { sinif: '8', lesson: 'Fen Bilimleri', name: 'BİLFEN PRO-BİL', level: 'Zor' },
  { sinif: '8', lesson: 'Türkçe', name: 'NİTELİK SÜPER B', level: 'Zor' },
  { sinif: '8', lesson: 'Türkçe', name: 'PALME ENERJİ', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'OKYANUS MASTER', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'NAR TEST POWER-UP', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'KAFA DENGİ CHELLENGER', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'SİNAN KUZUCU**', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'SİNAN KUZUCU (DENEME)', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'BUMERANG (DENEME)', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'ANKARA (DENEME)', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'HIZ (DENEME)', level: 'Orta' },
  { sinif: '8', lesson: 'Fen Bilimleri', name: 'MOZİK HİT DENEME', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'NEWTON KONDİSYON HAFTALIK DENEME', level: 'Orta' },
  { sinif: '8', lesson: 'Fen Bilimleri', name: 'FENOMEN KKD', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'ANKARA GÜÇLENDİREN HAFTALIK DENEME', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'BUMERANG HAFTALIK DENEME', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'ANKARA GÜÇLENDİREN FASİKÜL', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'HIZ UZMAN', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'FULL GEOMETRİ TABANLI', level: 'Orta' },
  { sinif: '8', lesson: 'Fen Bilimleri', name: 'HİPER ZEKA BAL', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'ANKARA (DENEME)', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'SİNAN KUZUCU**', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'FENOMEN A*', level: 'Orta' },
  { sinif: '8', lesson: 'Matematik', name: 'HIZ UZMAN', level: 'Zor' },
  { sinif: '8', lesson: 'Matematik', name: 'ANKARA GÜÇLENDİREN', level: 'Zor' },
  { sinif: '7', lesson: 'Matematik', name: 'TAM SAYI SORU BANKASI', level: 'Kolay' },
  { sinif: '7', lesson: 'Fen Bilimleri', name: 'CANSU FEN SETİ', level: 'Orta' },
  { sinif: '7', lesson: 'Türkçe', name: 'EKOL TÜRKÇE KONU ANLATIM', level: 'Kolay' },
  { sinif: '6', lesson: 'Matematik', name: 'FIRAT 6. SINIF MATEMATİK', level: 'Orta' },
  { sinif: '6', lesson: 'Fen Bilimleri', name: 'KORKUT 6. SINIF FEN', level: 'Orta' },
  { sinif: '5', lesson: 'Türkçe', name: 'MEB 5. SINIF TÜRKÇE', level: 'Kolay' },
  { sinif: '5', lesson: 'Matematik', name: 'PALME 5. SINIF MATEMATİK', level: 'Kolay' },
  { sinif: '4', lesson: 'Matematik', name: 'SARMAL 4. SINIF MATEMATİK', level: 'Kolay' },
  { sinif: '4', lesson: 'Türkçe', name: 'ALTIN DÜŞÜNCE 4. SINIF TÜRKÇE', level: 'Kolay' }
];

function ekranıGoster(sayfaId) {
  document.getElementById('landingPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('promoPage').style.display = 'none';
  document.getElementById('dashboardApp').style.display = 'none';
  document.getElementById('mainNavbar').style.display = 'none';

  if (sayfaId === 'landingPage') {
    document.getElementById('landingPage').style.display = 'flex';
  } else if (sayfaId === 'loginPage') {
    document.getElementById('loginPage').style.display = 'flex';
  } else if (sayfaId === 'promoPage') {
    document.getElementById('promoPage').style.display = 'block';
    document.getElementById('mainNavbar').style.display = 'flex';
  } else if (sayfaId === 'dashboardApp') {
    document.getElementById('dashboardApp').style.display = 'block';
  }
}

function sayfaAcs(sayfaId, historyEkle = true) {
  ekranıGoster(sayfaId);
  if (historyEkle) {
    history.pushState({ sayfaId: sayfaId }, "", "#" + sayfaId);
  }
}

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.sayfaId) {
    ekranıGoster(e.state.sayfaId);
  } else {
    ekranıGoster('landingPage');
  }
});

function girisFormunaGit(rol) {
  document.getElementById('loginTitle').textContent = rol + ' Girişi';
  sayfaAcs('loginPage');
}

function tanitimaGit() {
  sayfaAcs('promoPage');
}

// SAĞ ÜSTTEKİ GİRİŞ / KAYIT POP-UP'INI AÇAN FONKSİYON (authModal)
function authModalAc(mod) {
  document.getElementById('authModal').style.display = 'flex';
  tabDegistir(mod);
}

function modalAc(id) {
  document.getElementById(id).style.display = 'flex';
}

function modalKapat(id) {
  document.getElementById(id).style.display = 'none';
}

function tabDegistir(mod) {
  const tabGiris = document.getElementById('tabGiris');
  const tabKayit = document.getElementById('tabKayit');
  const formGiris = document.getElementById('formGiris');
  const formKayit = document.getElementById('formKayit');

  if (mod === 'giris') {
    tabGiris.classList.add('active');
    tabKayit.classList.remove('active');
    formGiris.style.display = 'block';
    formKayit.style.display = 'none';
  } else {
    tabKayit.classList.add('active');
    tabGiris.classList.remove('active');
    formKayit.style.display = 'block';
    formGiris.style.display = 'none';
  }
}

function sifreKontrolEt(val) {
  const ruleLength = document.getElementById('ruleLength');
  const ruleLetter = document.getElementById('ruleLetter');
  const ruleNumber = document.getElementById('ruleNumber');

  const hasLength = val.length >= 8;
  const hasLetter = /[a-z]/.test(val);
  const hasNumber = /[0-9]/.test(val);

  ruleLength.innerHTML = (hasLength ? "✔" : "✕") + " En az 8 karakter";
  ruleLength.className = hasLength ? "valid" : "";

  ruleLetter.innerHTML = (hasLetter ? "✔" : "✕") + " En az bir küçük harf (a-z)";
  ruleLetter.className = hasLetter ? "valid" : "";

  ruleNumber.innerHTML = (hasNumber ? "✔" : "✕") + " En az bir sayı (0-9)";
  ruleNumber.className = hasNumber ? "valid" : "";
}

function togglePasswordVisibility(inputId, buttonEl) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  buttonEl.classList.toggle('password-visible', !showing);
  buttonEl.setAttribute('aria-pressed', String(!showing));
  buttonEl.setAttribute('aria-label', showing ? 'Şifreyi göster' : 'Şifreyi gizle');
}

function sifremiUnuttumAc(kaynak) {
  const forgotEmail = document.getElementById('forgotEmail');
  const forgotNewPass = document.getElementById('forgotNewPass');
  const forgotNewPassConfirm = document.getElementById('forgotNewPassConfirm');
  const forgotErrorBox = document.getElementById('forgotErrorBox');

  const sourceEmailId = kaynak === 'card' ? 'cardEmail' : 'modalEmail';
  const sourceEmailInput = document.getElementById(sourceEmailId);

  forgotEmail.value = sourceEmailInput ? sourceEmailInput.value.trim() : '';
  forgotNewPass.value = '';
  forgotNewPassConfirm.value = '';
  forgotErrorBox.style.display = 'none';
  forgotErrorBox.textContent = '';

  modalAc('forgotModal');
}

function sifreSifirla() {
  const email = document.getElementById('forgotEmail').value.trim();
  const newPassword = document.getElementById('forgotNewPass').value;
  const confirmPassword = document.getElementById('forgotNewPassConfirm').value;
  const forgotErrorBox = document.getElementById('forgotErrorBox');

  if (!email || !newPassword || !confirmPassword) {
    forgotErrorBox.textContent = 'Lütfen tüm alanları doldurun.';
    forgotErrorBox.style.display = 'block';
    return;
  }

  if (newPassword !== confirmPassword) {
    forgotErrorBox.textContent = 'Şifreler birbiriyle eşleşmiyor.';
    forgotErrorBox.style.display = 'block';
    return;
  }

  if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    forgotErrorBox.textContent = 'Şifre en az 8 karakter olmalı, bir küçük harf ve bir sayı içermeli.';
    forgotErrorBox.style.display = 'block';
    return;
  }

  fetch(API_URL + '/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword })
  }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      forgotErrorBox.style.display = 'none';
      modalKapat('forgotModal');
      alert('Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.');
      const cardEmail = document.getElementById('cardEmail');
      const modalEmail = document.getElementById('modalEmail');
      if (cardEmail) cardEmail.value = email;
      if (modalEmail) modalEmail.value = email;
      tabDegistir('giris');
    } else {
      forgotErrorBox.textContent = data.error || 'Şifre güncellenemedi.';
      forgotErrorBox.style.display = 'block';
    }
  }).catch(() => {
    forgotErrorBox.textContent = 'Sunucuya bağlanılamıyor.';
    forgotErrorBox.style.display = 'block';
  });
}

function kayitOl() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const passConfirm = document.getElementById('regPassConfirm').value;
  const phone = document.getElementById('regPhone').value.trim();
  const regErrorBox = document.getElementById('regErrorBox');

  if (!name || name.split(" ").filter(w => w.length > 0).length < 2) {
    regErrorBox.textContent = "Lütfen geçerli bir Ad ve Soyad girin.";
    regErrorBox.style.display = "block";
    return;
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone || phoneDigits.length < 10) {
    regErrorBox.textContent = "Lütfen en az 10 haneli geçerli bir telefon numarası girin.";
    regErrorBox.style.display = "block";
    return;
  }

  if (pass !== passConfirm) {
    regErrorBox.textContent = "Şifreler birbiriyle eşleşmiyor!";
    regErrorBox.style.display = "block";
    return;
  }

  if (pass.length < 8 || !/[a-z]/.test(pass) || !/[0-9]/.test(pass)) {
    regErrorBox.textContent = "Lütfen şifre kurallarının hepsini sağlayın.";
    regErrorBox.style.display = "block";
    return;
  }

  // Backend'e kayıt isteği gönder
  fetch(API_URL + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: pass, phone })
  }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      regErrorBox.style.display = "none";
      alert("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
      tabDegistir('giris');
    } else {
      regErrorBox.textContent = data.error || 'Kayıt sırasında hata oluştu.';
      regErrorBox.style.display = 'block';
    }
  }).catch(err => {
    regErrorBox.textContent = 'Sunucuya bağlanılamıyor.';
    regErrorBox.style.display = 'block';
  });
}

function paneleGirisYap(nereden) {
  let eposta = "";
  let sifre = "";
  let errorBox = null;

  if (nereden === 'card') {
    eposta = document.getElementById('cardEmail').value.trim();
    sifre = document.getElementById('cardPass').value.trim();
    errorBox = document.getElementById('cardErrorBox');
  } else {
    eposta = document.getElementById('modalEmail').value.trim();
    sifre = document.getElementById('modalPass').value.trim();
    errorBox = document.getElementById('modalErrorBox');
  }

  // Backend'e login isteği gönder
  fetch(API_URL + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: eposta, password: sifre })
  }).then(async res => {
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = {};
    }

    if (res.ok && data.token) {
      if (errorBox) errorBox.style.display = 'none';

      // Remember-me kontrolü: localStorage (kalıcı) / sessionStorage (oturum)
      let remember = false;
      if (nereden === 'card') {
        const cb = document.getElementById('rememberCard');
        remember = cb && cb.checked;
      } else {
        const cb = document.getElementById('rememberModal');
        remember = cb && cb.checked;
      }

      const userEmail = data.user && data.user.email ? data.user.email.toLowerCase() : eposta.toLowerCase();
      if (remember) {
        localStorage.setItem('koclukToken', data.token);
        localStorage.setItem('koclukUserEmail', userEmail);
        sessionStorage.removeItem('koclukUserEmail');
      } else {
        sessionStorage.setItem('koclukToken', data.token);
        sessionStorage.setItem('koclukUserEmail', userEmail);
        localStorage.removeItem('koclukUserEmail');
      }
      currentUserEmail = userEmail;
      loadSavedResourceSuggestions();

      modalKapat('authModal');
      sayfaAcs('dashboardApp');
      renderStoredOgrenciler();
      updateUserCountLabel();
    } else {
      if (errorBox) {
        errorBox.textContent = data.error || ('Giriş başarısız (HTTP ' + res.status + ').');
        errorBox.style.display = 'block';
      }
    }
  }).catch(err => {
    if (errorBox) {
      errorBox.textContent = 'Sunucuya bağlanılamıyor.';
      errorBox.style.display = 'block';
    }
  });
}

// Otomatik giriş (remember me) işlevselliği
async function attemptAutoLogin() {
  const token = localStorage.getItem('koclukToken') || sessionStorage.getItem('koclukToken');
  if (!token) return false;
  try {
    const res = await fetch(API_URL + '/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) {
      // Geçersiz token temizle
      localStorage.removeItem('koclukToken');
      sessionStorage.removeItem('koclukToken');
      localStorage.removeItem('koclukUserEmail');
      sessionStorage.removeItem('koclukUserEmail');
      return false;
    }
    const data = await res.json();
    if (data && data.user) {
      const email = data.user.email ? data.user.email.toLowerCase() : null;
      if (email) {
        currentUserEmail = email;
        loadSavedResourceSuggestions();
        if (localStorage.getItem('koclukToken')) {
          localStorage.setItem('koclukUserEmail', email);
          sessionStorage.removeItem('koclukUserEmail');
        } else {
          sessionStorage.setItem('koclukUserEmail', email);
          localStorage.removeItem('koclukUserEmail');
        }
      }
      sayfaAcs('dashboardApp', false);
      renderStoredOgrenciler();
      updateUserCountLabel();
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

function sekmeAcs(sekmeAd) {
  document.getElementById('tabKokpit').style.display = 'none';
  document.getElementById('tabOgrenci').style.display = 'none';
  document.getElementById('tabOgrenciDetay').style.display = 'none';
  document.getElementById('tabProgram').style.display = 'none';
  document.getElementById('tabKaynak').style.display = 'none';
  document.getElementById('tabBrans').style.display = 'none';
  const genelEl = document.getElementById('tabGenel');
  if (genelEl) genelEl.style.display = 'none';

  const markMenuActive = (menuId) => {
    const el = document.getElementById(menuId);
    if (el) el.classList.add('active');
  };

  const kaynakMenu = document.getElementById('menu-kaynak');
  if (kaynakMenu && sekmeAd !== 'kaynak') kaynakMenu.classList.remove('submenu-open');

  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

  if (sekmeAd === 'kokpit') {
    document.getElementById('tabKokpit').style.display = 'block';
    markMenuActive('menu-kokpit');
  } else if (sekmeAd === 'ogrenci') {
    document.getElementById('tabOgrenci').style.display = 'block';
    markMenuActive('menu-ogrenci');
  } else if (sekmeAd === 'ogrenci-detay') {
    document.getElementById('tabOgrenciDetay').style.display = 'block';
    markMenuActive('menu-ogrenci');
  } else if (sekmeAd === 'program') {
    document.getElementById('tabProgram').style.display = 'block';
    markMenuActive('menu-program');
  } else if (sekmeAd === 'brans') {
    document.getElementById('tabBrans').style.display = 'block';
    markMenuActive('menu-brans');
  } else if (sekmeAd === 'kaynak') {
    document.getElementById('tabKaynak').style.display = 'block';
    markMenuActive('menu-kaynak');
  }
}

function updateBransExamNet() {
  const questionCount = Number(document.getElementById('bransExamQuestionCount')?.value) || 0;
  const correct = Number(document.getElementById('bransExamCorrect')?.value) || 0;
  const wrong = Number(document.getElementById('bransExamWrong')?.value) || 0;
  const blank = Math.max(0, questionCount - correct - wrong);
  const net = correct - wrong * 0.25;
  const netEl = document.getElementById('bransExamNet');
  const blankEl = document.getElementById('bransExamBlank');
  if (blankEl) blankEl.value = String(blank);
  if (netEl) netEl.textContent = net.toFixed(2);
}

function formatDateInput(inputEl) {
  if (!inputEl) return;
  const digits = String(inputEl.value || '').replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  let formatted = day;
  if (month) formatted += '.' + month;
  if (year) formatted += '.' + year;

  inputEl.value = formatted;
}

function isValidTrDate(dateText) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(dateText || '').trim());
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const testDate = new Date(year, month - 1, day);
  return testDate.getFullYear() === year && testDate.getMonth() === (month - 1) && testDate.getDate() === day;
}

function getBransExamStorageKey() {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail') || 'default';
  const studentKey = activeStudentId ? String(activeStudentId) : 'none';
  return `brans_exam_${email}_${studentKey}`;
}

function getStoredBransExams() {
  const key = getBransExamStorageKey();
  const raw = localStorage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setStoredBransExams(records) {
  const key = getBransExamStorageKey();
  localStorage.setItem(key, JSON.stringify(records));
}

function formatExamDate(dateText) {
  if (!dateText) return '-';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateText)) return dateText;
  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return dateText;
  return d.toLocaleDateString('tr-TR');
}

function renderBransExamHistory() {
  const listEl = document.getElementById('bransExamSavedList');
  if (!listEl) return;

  const records = getStoredBransExams();
  if (!records.length) {
    listEl.innerHTML = '<div class="exam-history-empty">Henüz kayıt yok.</div>';
    return;
  }

  listEl.innerHTML = records.map((item) => {
    const title = item.examName || `${item.lesson || 'Ders'} Denemesi`;
    const meta = `${item.lesson || '-'} · ${formatExamDate(item.examDate)}`;
    const details = `Soru: ${item.questionCount} · D: ${item.correct} · Y: ${item.wrong} · B: ${item.blank}`;
    return `
      <div class="exam-history-item">
        <div>
          <strong>${title}</strong>
          <div class="exam-history-meta">${meta}</div>
          <div class="exam-history-actions">
            <button type="button" class="exam-delete-btn" onclick="deleteBransExam(${item.id})">Sil</button>
          </div>
        </div>
        <div class="exam-history-meta">${details}</div>
        <div class="exam-history-net">
          <div class="value">${Number(item.net || 0).toFixed(2)}</div>
          <div class="exam-history-meta">Net</div>
        </div>
      </div>
    `;
  }).join('');
}

function deleteBransExam(recordId) {
  if (!confirm('Bu branş denemesi kaydını silmek istiyor musunuz?')) return;

  const records = getStoredBransExams();
  const filtered = records.filter((r) => String(r.id) !== String(recordId));
  setStoredBransExams(filtered);
  renderBransExamHistory();
}

function indirTumBransDenemelerPdf() {
  const records = getStoredBransExams();
  if (!records.length) {
    alert('İndirilecek branş denemesi kaydı bulunamadı.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
    return;
  }

  const student = getStoredOgrenciler().find((s) => s.id === activeStudentId);
  const studentName = student && student.name ? student.name : 'Ogrenci';

  const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
  const marginLeft = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 44;

  const ensureSpace = (needed = 80) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 44;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Brans Deneme Karnesi', marginLeft, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Ogrenci: ${studentName}`, marginLeft, y);
  y += 16;
  doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, marginLeft, y);
  y += 22;

  records.forEach((item, index) => {
    ensureSpace(120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${index + 1}. ${item.examName || (item.lesson || 'Brans') + ' Denemesi'}`, marginLeft, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Ders: ${item.lesson || '-'}`, marginLeft, y);
    y += 14;
    doc.text(`Tarih: ${formatExamDate(item.examDate)}`, marginLeft, y);
    y += 14;

    const details = `Soru: ${item.questionCount || 0}   Dogru: ${item.correct || 0}   Yanlis: ${item.wrong || 0}   Bos: ${item.blank || 0}`;
    doc.text(details, marginLeft, y);
    y += 14;

    doc.setFont('helvetica', 'bold');
    doc.text(`Net: ${Number(item.net || 0).toFixed(2)}`, marginLeft, y);
    y += 18;

    doc.setDrawColor(220, 226, 232);
    doc.line(marginLeft, y, 555, y);
    y += 14;
  });

  const safeName = studentName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  doc.save(`${safeName || 'ogrenci'}_brans_deneme_karnesi.pdf`);
}

function kaydetBransDenemesi() {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const lesson = document.getElementById('bransExamLesson')?.value || '';
  const examDate = document.getElementById('bransExamDate')?.value || '';
  const examName = document.getElementById('bransExamName')?.value.trim() || '';
  const questionCount = Number(document.getElementById('bransExamQuestionCount')?.value) || 0;
  const correct = Number(document.getElementById('bransExamCorrect')?.value) || 0;
  const wrong = Number(document.getElementById('bransExamWrong')?.value) || 0;
  const blank = Math.max(0, questionCount - correct - wrong);

  if (!lesson || !examDate || !examName) {
    alert('Lütfen ders, deneme tarihi ve deneme adını doldurun.');
    return;
  }

  if (!isValidTrDate(examDate)) {
    alert('Deneme tarihi GG.AA.YYYY formatında ve geçerli olmalı.');
    return;
  }

  if (questionCount <= 0) {
    alert('Soru sayısı 0’dan büyük olmalı.');
    return;
  }

  if (correct + wrong + blank > questionCount) {
    alert('Doğru + yanlış + boş toplamı soru sayısından büyük olamaz.');
    return;
  }

  const net = correct - wrong * 0.25;
  const records = getStoredBransExams();
  records.unshift({
    id: Date.now(),
    lesson,
    examDate,
    examName,
    questionCount,
    correct,
    wrong,
    blank,
    net,
    savedAt: Date.now()
  });

  setStoredBransExams(records);
  renderBransExamHistory();

  document.getElementById('bransExamQuestionCount').value = '';
  document.getElementById('bransExamCorrect').value = '';
  document.getElementById('bransExamWrong').value = '';
  document.getElementById('bransExamBlank').value = '';
  document.getElementById('bransExamName').value = '';
  const netEl = document.getElementById('bransExamNet');
  if (netEl) netEl.textContent = '0.00';
}

const GENEL_LESSON_KEYS = ['Mat', 'Fen', 'Tur', 'Ink', 'Ing', 'Din'];

function getGenelExamStorageKey() {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail') || 'default';
  const studentKey = activeStudentId ? String(activeStudentId) : 'none';
  return `genel_exam_${email}_${studentKey}`;
}

function getStoredGenelExams() {
  const key = getGenelExamStorageKey();
  const raw = localStorage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setStoredGenelExams(records) {
  const key = getGenelExamStorageKey();
  localStorage.setItem(key, JSON.stringify(records));
}

function getGenelLessonValues(shortKey) {
  const q = Number(document.getElementById('genel' + shortKey + 'Q')?.value) || 0;
  const d = Number(document.getElementById('genel' + shortKey + 'D')?.value) || 0;
  const y = Number(document.getElementById('genel' + shortKey + 'Y')?.value) || 0;
  const b = Math.max(0, q - d - y);
  const net = d - y * 0.25;
  return { q, d, y, b, net };
}

function updateGenelLessonNet(shortKey) {
  const netEl = document.getElementById('genel' + shortKey + 'Net');
  const blankEl = document.getElementById('genel' + shortKey + 'B');
  if (!netEl) return;
  const values = getGenelLessonValues(shortKey);
  if (blankEl) blankEl.value = String(values.b);
  netEl.textContent = values.net.toFixed(2);
  updateGenelTotalNet();
}

function updateGenelTotalNet() {
  const totalEl = document.getElementById('genelTotalNet');
  if (!totalEl) return;

  const total = GENEL_LESSON_KEYS.reduce((sum, key) => {
    const values = getGenelLessonValues(key);
    return sum + values.net;
  }, 0);

  totalEl.textContent = total.toFixed(2);
}

function clearGenelExamForm() {
  document.getElementById('genelExamName').value = '';
  document.getElementById('genelExamDate').value = '';

  GENEL_LESSON_KEYS.forEach((key) => {
    const q = document.getElementById('genel' + key + 'Q');
    const d = document.getElementById('genel' + key + 'D');
    const y = document.getElementById('genel' + key + 'Y');
    const b = document.getElementById('genel' + key + 'B');
    const n = document.getElementById('genel' + key + 'Net');
    if (q) q.value = '';
    if (d) d.value = '';
    if (y) y.value = '';
    if (b) b.value = '';
    if (n) n.textContent = '0.00';
  });

  const totalEl = document.getElementById('genelTotalNet');
  if (totalEl) totalEl.textContent = '0.00';
}

function renderGenelExamHistory() {
  const listEl = document.getElementById('genelExamSavedList');
  if (!listEl) return;

  const records = getStoredGenelExams();
  if (!records.length) {
    listEl.innerHTML = '<div class="exam-history-empty">Henüz kayıt yok.</div>';
    return;
  }

  listEl.innerHTML = records.map((item) => {
    const lessonBreakdown = [
      `Mat ${Number(item.lessons?.Mat?.net || 0).toFixed(2)}`,
      `Fen ${Number(item.lessons?.Fen?.net || 0).toFixed(2)}`,
      `Tür ${Number(item.lessons?.Tur?.net || 0).toFixed(2)}`,
      `İnk ${Number(item.lessons?.Ink?.net || 0).toFixed(2)}`,
      `İng ${Number(item.lessons?.Ing?.net || 0).toFixed(2)}`,
      `Din ${Number(item.lessons?.Din?.net || 0).toFixed(2)}`
    ].join(' · ');

    return `
      <div class="exam-history-item">
        <div>
          <strong>${item.examName}</strong>
          <div class="exam-history-meta">${formatExamDate(item.examDate)}</div>
          <div class="exam-history-actions">
            <button type="button" class="exam-delete-btn" onclick="deleteGenelExam(${item.id})">Sil</button>
          </div>
        </div>
        <div class="exam-history-meta">${lessonBreakdown}</div>
        <div class="exam-history-net">
          <div class="value">${Number(item.totalNet || 0).toFixed(2)}</div>
          <div class="exam-history-meta">Toplam Net</div>
        </div>
      </div>
    `;
  }).join('');
}

function indirTumGenelDenemelerPdf() {
  const records = getStoredGenelExams();
  if (!records.length) {
    alert('İndirilecek genel deneme kaydı bulunamadı.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
    return;
  }

  const student = getStoredOgrenciler().find((s) => s.id === activeStudentId);
  const studentName = student && student.name ? student.name : 'Ogrenci';

  const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
  const marginLeft = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 44;

  const ensureSpace = (needed = 80) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 44;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Genel Deneme Karnesi', marginLeft, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Ogrenci: ${studentName}`, marginLeft, y);
  y += 16;
  doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, marginLeft, y);
  y += 22;

  records.forEach((item, index) => {
    ensureSpace(130);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${index + 1}. ${item.examName || 'Genel Deneme'}`, marginLeft, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Tarih: ${formatExamDate(item.examDate)}`, marginLeft, y);
    y += 14;

    const breakdown = [
      `Mat: ${Number(item.lessons?.Mat?.net || 0).toFixed(2)}`,
      `Fen: ${Number(item.lessons?.Fen?.net || 0).toFixed(2)}`,
      `Tur: ${Number(item.lessons?.Tur?.net || 0).toFixed(2)}`,
      `Ink: ${Number(item.lessons?.Ink?.net || 0).toFixed(2)}`,
      `Ing: ${Number(item.lessons?.Ing?.net || 0).toFixed(2)}`,
      `Din: ${Number(item.lessons?.Din?.net || 0).toFixed(2)}`
    ].join('   |   ');

    const wrapped = doc.splitTextToSize(breakdown, 510);
    doc.text(wrapped, marginLeft, y);
    y += wrapped.length * 12 + 8;

    doc.setFont('helvetica', 'bold');
    doc.text(`Toplam Net: ${Number(item.totalNet || 0).toFixed(2)}`, marginLeft, y);
    y += 20;

    doc.setDrawColor(220, 226, 232);
    doc.line(marginLeft, y, 555, y);
    y += 14;
  });

  const safeName = studentName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  doc.save(`${safeName || 'ogrenci'}_genel_deneme_karnesi.pdf`);
}

function deleteGenelExam(recordId) {
  if (!confirm('Bu genel deneme kaydını silmek istiyor musunuz?')) return;

  const records = getStoredGenelExams();
  const filtered = records.filter((r) => String(r.id) !== String(recordId));
  setStoredGenelExams(filtered);
  renderGenelExamHistory();
}

function kaydetGenelDeneme() {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const examName = document.getElementById('genelExamName')?.value.trim() || '';
  const examDate = document.getElementById('genelExamDate')?.value.trim() || '';

  if (!examName || !examDate) {
    alert('Lütfen deneme adı ve tarih alanlarını doldurun.');
    return;
  }

  if (!isValidTrDate(examDate)) {
    alert('Deneme tarihi GG.AA.YYYY formatında ve geçerli olmalı.');
    return;
  }

  const lessons = {};
  let totalNet = 0;

  for (const key of GENEL_LESSON_KEYS) {
    const values = getGenelLessonValues(key);
    if (values.q > 0 && (values.d + values.y + values.b > values.q)) {
      alert('Bazı derslerde doğru + yanlış + boş, soru sayısından büyük olamaz.');
      return;
    }
    lessons[key] = values;
    totalNet += values.net;
  }

  const records = getStoredGenelExams();
  records.unshift({
    id: Date.now(),
    examName,
    examDate,
    lessons,
    totalNet,
    savedAt: Date.now()
  });

  setStoredGenelExams(records);
  renderGenelExamHistory();
  clearGenelExamForm();
}

function cikisYap() {
  // Oturum kapatma sırasında token temizlenir
  localStorage.removeItem('koclukToken');
  sessionStorage.removeItem('koclukToken');
  localStorage.removeItem('koclukUserEmail');
  sessionStorage.removeItem('koclukUserEmail');
  currentUserEmail = null;
  sayfaAcs('landingPage');
}

function createResourceCard(name, level, url, lesson) {
  const card = document.createElement('div');
  card.style.background = '#f8fafc';
  card.style.border = '1px solid #e2e8f0';
  card.style.borderRadius = '16px';
  card.style.padding = '18px';
  card.style.display = 'grid';
  card.style.gridTemplateColumns = '1fr auto';
  card.style.gap = '12px';
  card.style.alignItems = 'center';

  const left = document.createElement('div');
  left.innerHTML = `<div style="font-weight:700; color:#0f172a; margin-bottom:6px;">${name}</div>` +
    `${lesson ? `<div style="color:#475569; font-size:0.9rem; margin-bottom:6px;">${lesson}</div>` : ''}` +
    `${url ? `<div style="color:#475569; font-size:0.92rem;"><a href='${url}' target='_blank' style='color:#1d4ed8; text-decoration:none;'>Link</a></div>` : ''}`;

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.alignItems = 'center';
  right.style.gap = '10px';

  const badge = document.createElement('div');
  badge.textContent = level;
  badge.style.background = '#e0f2fe';
  badge.style.color = '#0369a1';
  badge.style.fontWeight = '700';
  badge.style.padding = '8px 12px';
  badge.style.borderRadius = '999px';

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '🗑';
  removeBtn.type = 'button';
  removeBtn.style.background = '#fde2e2';
  removeBtn.style.color = '#b91c1c';
  removeBtn.style.border = 'none';
  removeBtn.style.padding = '8px 12px';
  removeBtn.style.borderRadius = '12px';
  removeBtn.style.cursor = 'pointer';
  removeBtn.style.fontSize = '1rem';
  removeBtn.onclick = () => card.remove();

  right.appendChild(badge);
  right.appendChild(removeBtn);
  card.appendChild(left);
  card.appendChild(right);
  return card;
}

let selectedKaynakSinif = '8';

function renderResourceSuggestions() {
  const list = document.getElementById('resourceSuggestionsList');
  if (!list) return;
  list.innerHTML = '';
  const allResources = [...initialResourceSuggestions, ...savedResourceSuggestions];
  const filtered = allResources.filter(item => item.sinif === selectedKaynakSinif);
  filtered.forEach(item => {
    const card = createResourceCard(item.name, item.level, item.url || '', item.lesson || 'Matematik');
    list.appendChild(card);
  });
}

function selectKaynakSinif(sinif, element) {
  sekmeAcs('kaynak');
  selectedKaynakSinif = sinif;
  document.getElementById('kaynakClassTitle').textContent = `${sinif}. Sınıf Kaynakları`;
  document.getElementById('kaynakClassDescription').textContent = `Burada sadece ${sinif}. sınıf için atanmış kaynak önerilerini görür ve yenilerini ekleyebilirsiniz.`;

  document.querySelectorAll('.submenu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sinif === sinif);
  });
  document.querySelector('.menu-item.has-submenu').classList.add('active');

  renderResourceSuggestions();
}

function toggleKaynakSubmenu(event) {
  event.stopPropagation();
  const menu = document.querySelector('.menu-item.has-submenu');
  if (!menu) return;
  menu.classList.toggle('submenu-open');
}

function addKaynakOnerisi() {
  const name = document.getElementById('resourceNameInput').value.trim();
  const level = document.getElementById('resourceLevelSelect').value;
  const url = document.getElementById('resourceUrlInput').value.trim();
  const lesson = document.getElementById('resourceLessonSelect').value;
  const list = document.getElementById('resourceSuggestionsList');

  if (!name) {
    alert('Lütfen kaynak adı girin.');
    document.getElementById('resourceNameInput').focus();
    return;
  }

  const newResource = {
    sinif: selectedKaynakSinif,
    lesson,
    name,
    level,
    url
  };
  savedResourceSuggestions.unshift(newResource);
  setStoredResourceSuggestions(savedResourceSuggestions);

  const card = createResourceCard(name, level, url, lesson);
  list.prepend(card);

  document.getElementById('resourceNameInput').value = '';
  document.getElementById('resourceLevelSelect').value = 'Orta';
  document.getElementById('resourceUrlInput').value = '';
  document.getElementById('resourceNameInput').focus();
}

document.addEventListener('DOMContentLoaded', () => {
  history.replaceState({ sayfaId: 'landingPage' }, "", "#landingPage");
  loadSavedResourceSuggestions();
  startUserCountAutoRefresh();
  attemptAutoLogin().then(auto => {
    if (!auto) {
      sayfaAcs('landingPage', false);
    }
    renderResourceSuggestions();
  });
});

// Canlı saat ve tarih güncellemesi
function updateClockAndDate() {
  const clockEl = document.getElementById('clockBox');
  const dateEl = document.getElementById('dateBox');
  const now = new Date();

  if (clockEl) {
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    clockEl.textContent = timeStr;
  }

  if (dateEl) {
    // Örn: "27 Temmuz Pazartesi"
    const dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
    // Büyük harfle başlat (ay ve hafta günü genelde küçük olur), görsel uyum için capitalize
    const formatted = dateStr.replace(/(^|\s)\S/g, t => t.toUpperCase());
    dateEl.textContent = formatted;
  }
}

// Başlangıçta hemen çağır ve sonra her saniye güncelle
updateClockAndDate();
setInterval(updateClockAndDate, 1000);

// Kullanıcı listesi modal fonksiyonları
function getAuthToken() {
  return localStorage.getItem('koclukToken') || sessionStorage.getItem('koclukToken');
}

function updateUserCountLabel() {
  const labelEl = document.getElementById('userCountLabel');
  if (!labelEl) return;

  fetch(API_URL + '/api/users/count')
    .then(async res => {
      if (!res.ok) throw new Error('Fail');
      const data = await res.json().catch(() => null);
      if (data && typeof data.count === 'number') {
        labelEl.textContent = `${data.count} üye`;
      }
    })
    .catch(() => {
      // Ağ hatasında mevcut etiket korunur.
    });
}

let userCountIntervalId = null;

function startUserCountAutoRefresh() {
  updateUserCountLabel();

  if (userCountIntervalId) {
    clearInterval(userCountIntervalId);
  }

  userCountIntervalId = setInterval(updateUserCountLabel, 10000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateUserCountLabel();
    }
  });
}

function openUsersModal() {
  const token = getAuthToken();
  if (!token) {
    alert('Önce giriş yapmalısınız.');
    return;
  }
  document.getElementById('usersListModal').style.display = 'flex';
  const container = document.getElementById('usersListContent');
  container.innerHTML = '<em>Yükleniyor…</em>';

  fetch(API_URL + '/api/users', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(async res => {
      if (!res.ok) throw new Error('Yetkisiz veya sunucu hatası');
      const data = await res.json();
      if (!data.users) throw new Error('Boş cevap');
      if (data.users.length === 0) {
        container.innerHTML = '<div>Hiç kullanıcı yok.</div>';
        return;
      }
      const list = document.createElement('div');
      list.style.display = 'grid';
      list.style.gap = '10px';
      data.users.forEach(u => {
          const card = document.createElement('div');
          card.style.padding = '10px';
          card.style.border = '1px solid #eee';
          card.style.borderRadius = '10px';
          card.style.background = '#fff';
          const info = document.createElement('div');
          info.innerHTML = `<strong>${u.name}</strong> <br/><small>${u.email}</small> <br/><small>${u.phone || ''}</small>`;
          const actions = document.createElement('div');
          actions.style.marginTop = '8px';
          actions.style.display = 'flex';
          actions.style.gap = '8px';

          const adminBadge = document.createElement('span');
          adminBadge.style.padding = '4px 8px';
          adminBadge.style.borderRadius = '8px';
          adminBadge.style.fontSize = '0.8rem';
          adminBadge.style.background = u.isAdmin ? '#fde68a' : '#eef2ff';
          adminBadge.textContent = u.isAdmin ? 'Admin' : 'Kullanıcı';

          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'btn-nav-outline';
          toggleBtn.textContent = u.isAdmin ? 'Yönetici Kaldır' : 'Yönetici Yap';
          toggleBtn.onclick = () => toggleAdmin(u.id, !u.isAdmin);

          info.appendChild(document.createElement('br'));
          info.appendChild(adminBadge);
          actions.appendChild(toggleBtn);
          card.appendChild(info);
          card.appendChild(actions);
          list.appendChild(card);
      });
      container.innerHTML = '';
      container.appendChild(list);
    })
    .catch(err => {
      container.innerHTML = '<div style="color:#dc2626">Kullanıcılar alınamadı: ' + (err.message || '') + '</div>';
    });
}

function closeUsersModal() {
  document.getElementById('usersListModal').style.display = 'none';
}

function ogrenciEkle() {
  const name = document.getElementById('ogrenciAdiInput').value.trim();
  const email = document.getElementById('ogrenciEmailInput').value.trim();
  const phone = document.getElementById('ogrenciTelefonInput').value.trim();
  if (!name) {
    alert('Öğrenci adı girin.');
    return;
  }

  const student = {
    id: Date.now(),
    name,
    email,
    phone,
    classLevel: '4',
    status: 'Aktif',
    program: {
      weeks: {}
    }
  };

  const students = getStoredOgrenciler();
  students.push(student);
  setStoredOgrenciler(students);
  renderStoredOgrenciler();
  updateUserCountLabel();

  document.getElementById('ogrenciAdiInput').value = '';
  document.getElementById('ogrenciEmailInput').value = '';
  document.getElementById('ogrenciTelefonInput').value = '';
  modalKapat('ogrenciEkleModal');
}

function openStudentEditModal(studentId) {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id.toString() === studentId.toString());
  if (!student) return;

  activeStudentId = student.id;
  document.getElementById('editStudentName').value = student.name || '';
  document.getElementById('editStudentEmail').value = student.email || '';
  document.getElementById('editStudentPhone').value = student.phone || '';
  document.getElementById('editStudentClass').value = student.classLevel || '4';

  modalAc('ogrenciDuzenleModal');
}

function saveStudentEdits() {
  if (!activeStudentId) {
    alert('Düzenlenecek öğrenci seçilmedi.');
    return;
  }

  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Öğrenci bulunamadı.');
    return;
  }

  const name = document.getElementById('editStudentName').value.trim();
  const email = document.getElementById('editStudentEmail').value.trim();
  const phone = document.getElementById('editStudentPhone').value.trim();
  const classLevel = document.getElementById('editStudentClass').value;

  if (!name) {
    alert('Öğrenci adı girin.');
    return;
  }

  student.name = name;
  student.email = email;
  student.phone = phone;
  student.classLevel = classLevel;

  setStoredOgrenciler(students);
  renderStoredOgrenciler();
  modalKapat('ogrenciDuzenleModal');
}

function setStudentDetailButtonState(activeSection) {
  const buttonMap = {
    program: document.getElementById('studentInfoBtnProgram'),
    brans: document.getElementById('studentInfoBtnBrans'),
    genel: document.getElementById('studentInfoBtnGenel')
  };

  Object.keys(buttonMap).forEach((key) => {
    const btn = buttonMap[key];
    if (!btn) return;
    btn.classList.toggle('active', key === activeSection);
  });
}

function setStudentDetailSection(section) {
  const detailEl = document.getElementById('tabOgrenciDetay');
  const programEl = document.getElementById('tabProgram');
  const bransEl = document.getElementById('tabBrans');
  const genelEl = document.getElementById('tabGenel');
  const noteEl = document.getElementById('studentInfoNote');

  if (!detailEl || !programEl || !bransEl || !genelEl) return;

  detailEl.style.display = 'block';
  programEl.style.display = 'none';
  bransEl.style.display = 'none';
  genelEl.style.display = 'none';

  if (section === 'program') {
    programEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Program bölümü aşağıda açıldı. Buradan öğrenci için haftalık planı düzenleyebilirsiniz.';
  } else if (section === 'brans') {
    bransEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Branş denemeleri bölümü aşağıda açıldı. Öğrenciye özel deneme kayıtlarını buradan girebilirsiniz.';
  } else if (section === 'genel') {
    genelEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Genel denemeler bölümü aşağıda açıldı. Ders bazlı sonuçları girip kaydedebilirsiniz.';
  } else {
    if (noteEl) noteEl.textContent = 'Bu sayfa seçili öğrenci için hızlı geçiş ekranıdır. Buradaki butonlardan öğrenciye özel çalışma programı ve deneme alanlarına geçebilirsiniz.';
  }

  setStudentDetailButtonState(section);
}

function openStudentInfoPage(studentId) {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id.toString() === studentId.toString());
  if (!student) {
    sekmeAcs('ogrenci');
    return;
  }

  activeStudentId = student.id;

  const nameEl = document.getElementById('studentInfoName');
  const metaEl = document.getElementById('studentInfoMeta');
  if (nameEl) nameEl.textContent = student.name || 'Öğrenci Bilgi Sayfası';

  if (metaEl) {
    const classPart = student.classLevel ? `Sınıf ${student.classLevel}` : 'Sınıf bilgisi yok';
    const emailPart = student.email ? student.email : 'E-posta yok';
    metaEl.textContent = `${classPart} · ${emailPart}`;
  }

  sekmeAcs('ogrenci-detay');
  setStudentDetailSection('');
}

function openStudentProgramPage() {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  setStudentDetailSection('program');
  renderProgramForStudent(student);
}

function openStudentBransPage() {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  setStudentDetailSection('brans');
  renderBransExamHistory();
}

function openStudentGenelPage() {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  setStudentDetailSection('genel');
  renderGenelExamHistory();
  updateGenelTotalNet();
}

function ogrenciProgramunaGit(card) {
  const studentId = card.dataset.id || card.dataset.studentId;
  openStudentInfoPage(studentId);
}

function getWeekStartDate(offset = 0) {
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = (currentDay + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekRange(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const options = { day: 'numeric', month: 'long' };
  const startStr = startDate.toLocaleDateString('tr-TR', options);
  const endStr = endDate.toLocaleDateString('tr-TR', options);
  const yearStr = endDate.getFullYear();

  return `${startStr} - ${endStr} ${yearStr}`;
}

function getWeekDayLabels(startDate) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dayName = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][index];
    return `${dayName} ${date.getDate()}`;
  });
}

function getWeekStorageKey(offset = 0) {
  const start = getWeekStartDate(offset);
  return start.toISOString().slice(0, 10);
}

function ensureStudentWeekProgram(student, weekKey) {
  if (!student.program) {
    student.program = { weeks: {} };
  }

  if (!student.program.weeks) {
    const legacyProgram = student.program;
    student.program = { weeks: {} };
    const legacyKey = getWeekStorageKey(programWeekOffset);
    student.program.weeks = {
      [legacyKey]: {
        pzt: legacyProgram.pzt || [],
        sal: legacyProgram.sal || [],
        car: legacyProgram.car || [],
        per: legacyProgram.per || [],
        cum: legacyProgram.cum || [],
        cmt: legacyProgram.cmt || [],
        paz: legacyProgram.paz || []
      }
    };
  }

  if (!student.program.weeks[weekKey]) {
    student.program.weeks[weekKey] = {
      pzt: [],
      sal: [],
      car: [],
      per: [],
      cum: [],
      cmt: [],
      paz: []
    };
  }

  return student.program.weeks[weekKey];
}

function updateProgramCalendarHeader() {
  const rangeEl = document.getElementById('programWeekRange');
  if (!rangeEl) return;
  const start = getWeekStartDate(programWeekOffset);
  rangeEl.textContent = formatWeekRange(start);
}

function changeProgramWeek(delta) {
  programWeekOffset += delta;
  if (programWeekOffset < -12) programWeekOffset = -12;
  if (programWeekOffset > 12) programWeekOffset = 12;
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (student) {
    renderProgramForStudent(student);
  } else {
    updateProgramCalendarHeader();
  }
}

function goToCurrentProgramWeek() {
  programWeekOffset = 0;
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (student) {
    renderProgramForStudent(student);
  } else {
    updateProgramCalendarHeader();
  }
}

function renderProgramForStudent(student) {
  const header = document.getElementById('programHeaderTitle');
  const info = document.getElementById('programStudentInfo');
  const grid = document.getElementById('programDaysGrid');
  const addTaskBtn = document.getElementById('programAddTaskBtn');

  if (header) header.textContent = `📅 ${student.name} Programı`;
  if (info) info.textContent = `${student.name} için haftalık plan`;

  const weekStart = getWeekStartDate(programWeekOffset);
  const weekKey = getWeekStorageKey(programWeekOffset);
  const labels = getWeekDayLabels(weekStart);
  const dayKeys = ['pzt', 'sal', 'car', 'per', 'cum', 'cmt', 'paz'];
  const weekProgram = ensureStudentWeekProgram(student, weekKey);

  if (grid) {
    grid.innerHTML = '';
    dayKeys.forEach((key, index) => {
      const tasks = weekProgram[key] || [];
      const card = document.createElement('div');
      card.className = 'day-column';
      card.innerHTML = `
        <div class="day-header">${labels[index]}</div>
        ${tasks.length > 0 ? tasks.map((task, taskIndex) => formatTaskHtml(task, key, taskIndex)).join('') : '<p class="day-empty">Boş</p>'}
        <div class="day-footer">
          <button class="day-add-button" onclick="event.stopPropagation(); openTaskModal('${key}')">+\nGörev\nEkle</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  if (addTaskBtn) {
    addTaskBtn.onclick = () => openTaskModal('pzt');
  }

  updateProgramCalendarHeader();
}

function exportProgramPdf() {
  const student = getStoredOgrenciler().find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const exportArea = document.getElementById('programExportArea');
  if (!exportArea) {
    alert('Program alanı bulunamadı.');
    return;
  }

  html2canvas(exportArea, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true
  }).then(canvas => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imageData = canvas.toDataURL('image/png');
    const imageWidth = pdfWidth;
    const imageHeight = (canvas.height * pdfWidth) / canvas.width;

    let position = 0;
    pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight);

    while (imageHeight + position > pdfHeight) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight);
    }

    const filename = `${student.name.replace(/\s+/g, '_')}_Haftalik_Program.pdf`;
    pdf.save(filename);
  }).catch(err => {
    console.error(err);
    alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
  });
}

let pendingTaskDayKey = 'pzt';

function getLessonOptionsForClass(classLevel) {
  const lessonsByClass = {
    '4': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Sosyal Bilgiler', 'İngilizce'],
    '5': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Sosyal Bilgiler', 'İngilizce'],
    '6': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    '7': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    '8': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce']
  };
  return lessonsByClass[classLevel] || ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'];
}

function getUnitOptionsForLesson(classLevel, lesson) {
  const unitsByClass = {
    '8': {
      'Matematik': [
        '1. Ünite: Çarpanlar ve Katlar',
        '2. Ünite: Üslü İfadeler',
        '3. Ünite: Kareköklü İfadeler',
        '4. Ünite: Veri Analizi',
        '5. Ünite: Basit Olayların Olma Olasılığı',
        '6. Ünite: Cebirsel İfadeler ve Özdeşlikler',
        '7. Ünite: Doğrusal Denklemler',
        '8. Ünite: Eşitsizlikler',
        '9. Ünite: Üçgenler',
        '10. Ünite: Eşlik ve Benzerlik',
        '11. Ünite: Dönüşüm Geometrisi',
        '12. Ünite: Geometrik Cisimler'
      ]
    }
  };
  return (unitsByClass[classLevel] && unitsByClass[classLevel][lesson]) || [];
}

function getTopicOptionsForLesson(classLevel, lesson, unit) {
  const topics = {
    '4': {
      'Matematik': ['Doğal Sayılar', 'Kesirler', 'Geometrik Şekiller', 'Bölme', 'Uzunluk Ölçme'],
      'Fen Bilimleri': ['Canlılar ve Hayat', 'Maddenin Halleri', 'Isı ve Sıcaklık', 'Ses', 'Elektrik'],
      'Türkçe': ['Okuma', 'Yazım Kuralları', 'Dil Bilgisi', 'Sözcükte Anlam', 'Paragraf'],
      'Sosyal Bilgiler': ['Türkiye ve Komşuları', 'Yerşekilleri', 'Doğal Afetler', 'Çevre'],
      'İngilizce': ['Hello', 'Family', 'School', 'Numbers', 'Colors']
    },
    '5': {
      'Matematik': ['Bölme', 'Ondalık Kesirler', 'Geometrik Cisimler'],
      'Fen Bilimleri': ['Madde ve Değişim', 'İnsan ve Çevre'],
      'Türkçe': ['Okuma', 'Yazım Kuralları', 'Söz Sanatları'],
      'Sosyal Bilgiler': ['Ekoloji', 'Doğal Kaynaklar'],
      'İngilizce': ['Daily Routine', 'My School']
    },
    '8': {
      'Matematik': {
        '1. Ünite: Çarpanlar ve Katlar': ['Çarpanlar ve Katlar', 'EBOB - EKOK (En Büyük Ortak Bölen - En Küçük Ortak Kat)', 'Aralarında Asal Sayılar'],
        '2. Ünite: Üslü İfadeler': ['Tam Sayıların Kuvvetleri', 'Üslü Sayılarda Temel Kurallar ve İşlemler', 'Ondalık Gösterimlerin ve Çok Büyük/Çok Küçük Sayıların Üslü İfadeyle Yazılımı (Bilimsel Gösterim)'],
        '3. Ünite: Kareköklü İfadeler': ['Tam Kare Sayılar ve Karekök Arasındaki İlişki', 'Kareköklü İfadelerde Çarpma, Bölme, Toplama ve Çıkarma İşlemleri', 'Kareköklü İfadelerde Tahmin ve Gerçek Değer', 'Verilen Bir Kareköklü İfadenin Hangi İki Doğal Sayı Arasında Olduğunu Belirleme'],
        '4. Ünite: Veri Analizi': ['Verilerin Sütun, Çizgi ve Daire Grafikleriyle Gösterilmesi ve Yorumlanması'],
        '5. Ünite: Basit Olayların Olma Olasılığı': ['Olay Çeşitleri (Kesin, İmkânsız, Olası)', 'Basit Bir Olayın Olma Olasılığını Hesaplama'],
        '6. Ünite: Cebirsel İfadeler ve Özdeşlikler': ['Cebirsel İfadelerle Çarpma İşlemi', 'Özdeşlik Kavramı ve Temel Özdeşlikler (İki Kare Farkı, Tam Kare Özdeşlikleri)', 'Cebirsel İfadeleri Çarpanlarına Ayırma'],
        '7. Ünite: Doğrusal Denklemler': ['Koordinat Sistemi', 'Birinci Dereceden Bir ve İki Bilinmeyenli Denklemler', 'Doğrusal İlişkiler ve Grafiklerle Gösterimi', 'Doğrunun Eğimi'],
        '8. Ünite: Eşitsizlikler': ['Birinci Dereceden Bir Bilinmeyenli Eşitsizlikler ve Sayı Doğrusunda Gösterilmesi', 'Eşitlik ve Eşitsizlik Durumları İçeren Problem Çözümleri'],
        '9. Ünite: Üçgenler': ['Üçgenin Kenar ve Açı İlişkileri', 'Üçgen Çizimleri', 'Pisagor Bağıntısı'],
        '10. Ünite: Eşlik ve Benzerlik': ['Geometrik Şekillerde Eşlik ve Benzerlik', 'Benzerlik Oranı ve Uygulamaları'],
        '11. Ünite: Dönüşüm Geometrisi': ['Öteleme, Yansıma ve Dönme Hareketleri', 'Çokgenlerde Dönüşüm Uygulamaları'],
        '12. Ünite: Geometrik Cisimler': ['Dik Prizmalar (Yüzey Alanı ve Hacim Bağıntıları)', 'Dik Dairesel Silindir ve Dik Piramit']
      }
    }
  };

  if (classLevel === '8' && lesson === 'Matematik') {
    return (topics[classLevel] && topics[classLevel][lesson] && topics[classLevel][lesson][unit]) || [];
  }

  return (topics[classLevel] && topics[classLevel][lesson]) || ['Konu seçiniz'];
}

function populateTaskLessonOptions(classLevel) {
  const lessonSelect = document.getElementById('taskLesson');
  lessonSelect.innerHTML = '<option value="">Seçiniz</option>';
  getLessonOptionsForClass(classLevel).forEach(lesson => {
    const option = document.createElement('option');
    option.value = lesson;
    option.textContent = lesson;
    lessonSelect.appendChild(option);
  });
}

function populateTaskUnitOptions(classLevel, lesson) {
  const unitSelect = document.getElementById('taskUnit');
  unitSelect.innerHTML = '';
  const units = getUnitOptionsForLesson(classLevel, lesson);
  if (!lesson || units.length === 0) {
    unitSelect.innerHTML = '<option value="">Ünite seçiniz</option>';
    return;
  }
  unitSelect.innerHTML = '<option value="">Seçiniz</option>';
  units.forEach(unit => {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
    unitSelect.appendChild(option);
  });
}

function populateTaskTopicOptions(classLevel, lesson, unit) {
  const topicSelect = document.getElementById('taskTopic');
  topicSelect.innerHTML = '';
  if (!lesson) {
    topicSelect.innerHTML = '<option value="">Önce ders seçin</option>';
    return;
  }
  if (classLevel === '8' && lesson === 'Matematik' && !unit) {
    topicSelect.innerHTML = '<option value="">Önce ünite seçin</option>';
    return;
  }

  const topics = getTopicOptionsForLesson(classLevel, lesson, unit);
  if (!topics || topics.length === 0) {
    topicSelect.innerHTML = '<option value="">Konu seçiniz</option>';
    return;
  }
  topicSelect.innerHTML = '<option value="">Seçiniz</option>';
  topics.forEach(topic => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    topicSelect.appendChild(option);
  });
}

function getResourceOptionsForClass(classLevel, lesson = '') {
  const allResources = [...initialResourceSuggestions, ...savedResourceSuggestions];
  return Array.from(new Set(
    allResources
      .filter(item => item.sinif === classLevel && (!lesson || item.lesson === lesson))
      .map(item => item.name)
  ));
}

function getResourceStorageKey() {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail');
  return email ? `kaynaklar_${email}` : 'kaynaklar_default';
}

function getStoredResourceSuggestions() {
  const key = getResourceStorageKey();
  const raw = localStorage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setStoredResourceSuggestions(resources) {
  const key = getResourceStorageKey();
  localStorage.setItem(key, JSON.stringify(resources));
}

function loadSavedResourceSuggestions() {
  savedResourceSuggestions = getStoredResourceSuggestions();
}

function populateTaskSourceOptions(classLevel, lesson = '', currentSource = '') {
  const sourceSelect = document.getElementById('taskSource');
  sourceSelect.innerHTML = '<option value="">Kaynak seçiniz</option>';
  const sources = getResourceOptionsForClass(classLevel, lesson);
  sources.forEach(source => {
    const option = document.createElement('option');
    option.value = source;
    option.textContent = source;
    sourceSelect.appendChild(option);
  });
  if (currentSource) {
    const matches = sources.some(source => source === currentSource);
    if (!matches) {
      const customOption = document.createElement('option');
      customOption.value = currentSource;
      customOption.textContent = currentSource + ' (Özel)';
      sourceSelect.appendChild(customOption);
    }
    sourceSelect.value = currentSource;
  }
}

let pendingTaskEditIndex = null;

function openTaskModal(dayKey) {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  const classLevel = student ? student.classLevel || '4' : '4';
  pendingTaskDayKey = dayKey || 'pzt';
  pendingTaskEditIndex = null;
  document.getElementById('taskDayLabel').textContent = `Gün: ${pendingTaskDayKey.toUpperCase()}`;
  document.getElementById('taskDuration').value = 60;
  document.getElementById('taskType').value = 'Soru Çözümü';
  populateTaskLessonOptions(classLevel);
  populateTaskUnitOptions(classLevel, '');
  populateTaskTopicOptions(classLevel, '', '');
  populateTaskSourceOptions(classLevel, '');
  document.getElementById('taskLesson').value = '';
  document.getElementById('taskUnit').value = '';
  document.getElementById('taskTopic').value = '';
  document.getElementById('taskSource').value = '';
  const taskLessonSelect = document.getElementById('taskLesson');
  const taskUnitSelect = document.getElementById('taskUnit');
  taskLessonSelect.onchange = function() {
    populateTaskUnitOptions(classLevel, taskLessonSelect.value);
    taskUnitSelect.value = '';
    populateTaskTopicOptions(classLevel, taskLessonSelect.value, '');
    populateTaskSourceOptions(classLevel, taskLessonSelect.value);
  };
  taskUnitSelect.onchange = function() {
    populateTaskTopicOptions(classLevel, taskLessonSelect.value, taskUnitSelect.value);
  };
  modalAc('taskAddModal');
}

function openTaskEditModal(dayKey, taskIndex) {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Öğrenci bulunamadı.');
    return;
  }

  const weekKey = getWeekStorageKey(programWeekOffset);
  const weekProgram = ensureStudentWeekProgram(student, weekKey);
  const task = weekProgram[dayKey] && weekProgram[dayKey][taskIndex];
  if (!task) {
    alert('Görev bulunamadı.');
    return;
  }

  const classLevel = student.classLevel || '4';
  pendingTaskDayKey = dayKey;
  pendingTaskEditIndex = taskIndex;
  document.getElementById('taskDayLabel').textContent = `Gün: ${pendingTaskDayKey.toUpperCase()}`;
  document.getElementById('taskDuration').value = task.duration || 60;
  document.getElementById('taskType').value = task.type || 'Soru Çözümü';
  populateTaskLessonOptions(classLevel);
  populateTaskUnitOptions(classLevel, task.lesson || '');
  document.getElementById('taskLesson').value = task.lesson || '';
  document.getElementById('taskUnit').value = task.unit || '';
  populateTaskTopicOptions(classLevel, task.lesson || '', task.unit || '');
  document.getElementById('taskTopic').value = task.topic || '';
  populateTaskSourceOptions(classLevel, task.lesson || '', task.source || '');
  const taskLessonSelect = document.getElementById('taskLesson');
  const taskUnitSelect = document.getElementById('taskUnit');
  taskLessonSelect.onchange = function() {
    populateTaskUnitOptions(classLevel, taskLessonSelect.value);
    taskUnitSelect.value = '';
    populateTaskTopicOptions(classLevel, taskLessonSelect.value, '');
  };
  taskUnitSelect.onchange = function() {
    populateTaskTopicOptions(classLevel, taskLessonSelect.value, taskUnitSelect.value);
  };
  modalAc('taskAddModal');
}

function getTaskCardTypeClass(type) {
  if (type === 'Deneme') return 'type-deneme';
  if (type === 'Konu Anlatımı') return 'type-konu-anlatimi';
  return 'type-soru-cozumu';
}

function formatTaskHtml(task, dayKey, taskIndex) {
  if (typeof task === 'string') {
    return `<div class="task-card type-soru-cozumu"><div class="task-card-subject">Görev</div><div class="task-card-title">${task}</div></div>`;
  }
  const durationText = `${task.duration || 60} dk`;
  const subject = task.lesson || 'Ders';
  const topic = task.topic || 'Konu girilmedi';
  const type = task.type || 'Soru Çözümü';
  const source = task.source || 'Kaynak yok';
  const typeClass = getTaskCardTypeClass(type);

  return `
    <div class="task-card ${typeClass}">
      <div class="task-card-top">
        <div>
          <div class="task-card-subject">${subject}</div>
          <div class="task-card-time">${durationText}</div>
        </div>
        <div class="task-card-actions">
          <button type="button" class="task-card-action" onclick="event.stopPropagation(); openTaskEditModal('${dayKey}', ${taskIndex})">✎</button>
          <button type="button" class="task-card-action delete" onclick="event.stopPropagation(); deleteTaskFromCard('${dayKey}', ${taskIndex})">🗑</button>
        </div>
      </div>
      <div class="task-card-title">${topic}</div>
      <div class="task-card-type">${type}</div>
      <div class="task-card-footer">
        <span class="task-card-badge">${source}</span>
        <span class="task-card-status">Yapılmadı</span>
      </div>
    </div>
  `;
}

function deleteTaskFromCard(dayKey, taskIndex) {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  if (!confirm('Bu görevi silmek istiyor musunuz?')) {
    return;
  }

  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Öğrenci bulunamadı.');
    return;
  }

  const weekKey = getWeekStorageKey(programWeekOffset);
  const weekProgram = ensureStudentWeekProgram(student, weekKey);
  if (weekProgram[dayKey] && weekProgram[dayKey][taskIndex] !== undefined) {
    weekProgram[dayKey].splice(taskIndex, 1);
    setStoredOgrenciler(students);
    renderProgramForStudent(student);
  }
}

function saveTaskFromModal() {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const duration = document.getElementById('taskDuration').value.trim();
  const type = document.getElementById('taskType').value;
  const lesson = document.getElementById('taskLesson').value.trim();
  const unit = document.getElementById('taskUnit').value.trim();
  const topic = document.getElementById('taskTopic').value.trim();
  const source = document.getElementById('taskSource').value.trim();

  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Öğrenci bulunamadı.');
    return;
  }

  const weekKey = getWeekStorageKey(programWeekOffset);
  const weekProgram = ensureStudentWeekProgram(student, weekKey);

  const task = {
    duration: duration || 60,
    type: type || 'Soru Çözümü',
    lesson,
    unit,
    topic,
    source,
    savedAt: Date.now()
  };

  if (pendingTaskEditIndex !== null && typeof pendingTaskEditIndex === 'number') {
    weekProgram[pendingTaskDayKey][pendingTaskEditIndex] = task;
  } else {
    weekProgram[pendingTaskDayKey].push(task);
  }

  setStoredOgrenciler(students);
  renderProgramForStudent(student);
  modalKapat('taskAddModal');
  pendingTaskEditIndex = null;
  updateUserCountLabel();
}

function getUserStorageKey() {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail');
  return email ? `ogrenciler_${email}` : 'ogrenciler_default';
}

function getStoredOgrenciler() {
  const key = getUserStorageKey();
  const raw = localStorage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setStoredOgrenciler(students) {
  const key = getUserStorageKey();
  localStorage.setItem(key, JSON.stringify(students));
}

function renderStoredOgrenciler() {
  const container = document.getElementById('ogrenciListesi');
  if (!container) return;
  const stored = getStoredOgrenciler();
  container.innerHTML = '';

  stored.forEach(student => {
    const card = document.createElement('div');
    card.className = 'student-card-box';
    card.dataset.id = student.id;
    card.dataset.name = student.name;
    card.dataset.email = student.email;
    card.dataset.phone = student.phone;
    card.dataset.status = student.status;
    card.dataset.target = student.target;
    card.onclick = () => ogrenciProgramunaGit(card);
    const badges = [
      student.status || 'YKS',
      student.classLevel ? 'Sınıf ' + student.classLevel : 'Genel'
    ];

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 32px; height: 32px; background: var(--color-dark-teal); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800;">${student.name.charAt(0).toUpperCase()}</div>
        <strong style="font-size: 0.9rem;">${student.name}</strong>
      </div>
      <div class="student-badge-group">
        ${badges.map(b => `<span class="badge-item">${b}</span>`).join('')}
      </div>
      <p style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">${student.email ? '✉️ ' + student.email : ''}${student.email && student.phone ? ' • ' : ''}${student.phone ? '📞 ' + student.phone : ''}</p>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        <button class="edit-student-btn" style="border: none; background: #f1f5f9; padding: 6px 10px; border-radius: 8px; cursor: pointer;">✏️</button>
      </div>
    `;
    const editBtn = card.querySelector('.edit-student-btn');
    if (editBtn) {
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        openStudentEditModal(student.id);
      });
    }
    container.appendChild(card);
  });
}

function ogrenciPanelKapat() {
  const panel = document.getElementById('ogrenciDetailsPanel');
  if (!panel) return;
  panel.style.display = 'none';
}

function ogrencileriYukle() {
  const textarea = document.getElementById('topluEkleTextarea');
  const value = textarea.value.trim();
  if (!value) {
    alert('Lütfen CSV metni girin.');
    return;
  }

  const lines = value.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  const students = getStoredOgrenciler();
  let added = 0;

  lines.forEach(line => {
    const parts = line.split(',').map(p => p.trim());
    if (!parts[0]) return;
    const [name, email, password, phone] = parts;
    const student = {
      id: Date.now() + added,
      name,
      email,
      phone,
      classLevel: '4',
      status: 'Aktif',
      program: {
        weeks: {}
      }
    };
    students.push(student);
    added += 1;
  });

  setStoredOgrenciler(students);
  renderStoredOgrenciler();
  textarea.value = '';
  modalKapat('topluEkleModal');
  alert(added + ' öğrenci eklendi.');
}

function toggleAdmin(userId, makeAdmin) {
  const token = getAuthToken();
  if (!token) { alert('Önce giriş yapmalısınız.'); return; }
  fetch(API_URL + '/api/users/' + userId + '/admin', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ isAdmin: !!makeAdmin })
  }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      openUsersModal(); // yenile
    } else {
      alert('Yetki veya hata: ' + (data.error || 'Hata'));
    }
  }).catch(err => {
    alert('Sunucu hatası: ' + (err.message || ''));
  });
}