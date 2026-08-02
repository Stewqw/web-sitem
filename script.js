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
let activeMuhasebeStudentId = null;
let programWeekOffset = 0;
let currentUserEmail = null;
let currentUserName = null;
let currentUserBranch = null;
let savedResourceSuggestions = [];
let registerFormOpenedAt = Date.now();
let studentStorageHydrated = false;
let studentStorageHydratingPromise = null;

const REGISTER_MIN_SUBMIT_MS = 2500;
const REGISTER_MAX_TEXT_LEN = 120;

function getFirebaseServices() {
  return window.firebaseServices || null;
}

function isFirebaseReady() {
  const services = getFirebaseServices();
  return !!(services && typeof services.isEnabled === 'function' && services.isEnabled());
}

function shouldUseFirebaseAuth() {
  const services = getFirebaseServices();
  return !!(isFirebaseReady() && services.settings && services.settings.useFirebaseAuth);
}

function shouldUseFirestoreForms() {
  const services = getFirebaseServices();
  return !!(isFirebaseReady() && services.settings && services.settings.useFirestoreForms);
}

let isSignUpSubmitting = false;
let isSignInSubmitting = false;

function setSubmitButtonLoading(button, isLoading, loadingText = 'İşleniyor...') {
  if (!button) return;

  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || '';
    }
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    return;
  }

  button.disabled = false;
  button.removeAttribute('aria-busy');
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
}

function getSignUpSubmitButton() {
  const form = document.getElementById('formKayit');
  return form ? form.querySelector('button[type="submit"]') : null;
}

function getSignInSubmitButton(source) {
  if (source === 'card') {
    const loginPage = document.getElementById('loginPage');
    return loginPage ? loginPage.querySelector('form button[type="submit"]') : null;
  }

  const form = document.getElementById('formGiris');
  return form ? form.querySelector('button[type="submit"]') : null;
}

function getFirebaseAuthErrorMessage(error, fallbackMessage) {
  const code = error && error.code ? String(error.code) : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Bu e-posta adresi zaten kullanımda.';
    case 'auth/invalid-email':
      return 'Geçersiz bir e-posta adresi girdiniz.';
    case 'auth/weak-password':
      return 'Şifreniz çok zayıf. En az 6 karakter olmalı.';
    case 'auth/user-not-found':
      return 'Bu e-posta adresine ait bir hesap bulunamadı.';
    case 'auth/wrong-password':
      return 'Hatalı şifre girdiniz.';
    case 'auth/too-many-requests':
      return 'Çok fazla başarısız deneme yaptınız. Lütfen biraz bekleyin.';
    case 'auth/network-request-failed':
      return 'Ağ bağlantısı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';
    case 'app/auth-create-timeout':
    case 'app/auth-signin-timeout':
    case 'app/profile-update-timeout':
    case 'app/profile-read-timeout':
    case 'app/realtime-db-timeout':
    case 'app/firestore-timeout':
      return 'İşlem beklenenden uzun sürdü. Lütfen tekrar deneyin.';
    case 'app/firestore-unavailable':
      return 'Veritabanına bağlanılamadı. Lütfen daha sonra tekrar deneyin.';
    default:
      return fallbackMessage || 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

const MUHASEBE_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function normalizeClassLevel(value) {
  return String(value || '').trim().toUpperCase();
}

function getClassDisplayLabel(value) {
  const classLevel = normalizeClassLevel(value);
  if (!classLevel) return 'Sınıf bilgisi yok';
  if (classLevel === '8') return 'LGS';
  if (classLevel === 'YKS') return 'YKS';
  return `${classLevel}. Sınıf`;
}

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
  const promoPageEl = document.getElementById('promoPage');
  const dashboardAppEl = document.getElementById('dashboardApp');
  const mainNavbarEl = document.getElementById('mainNavbar');

  if (promoPageEl) promoPageEl.style.display = 'none';
  if (dashboardAppEl) dashboardAppEl.style.display = 'none';
  if (mainNavbarEl) mainNavbarEl.style.display = 'none';

  if (sayfaId === 'loginPage') {
    const loginPageEl = document.getElementById('loginPage');
    if (loginPageEl) loginPageEl.style.display = 'flex';
  } else if (sayfaId === 'promoPage') {
    if (promoPageEl) promoPageEl.style.display = 'block';
    if (mainNavbarEl) mainNavbarEl.style.display = 'flex';
  } else if (sayfaId === 'dashboardApp') {
    if (dashboardAppEl) dashboardAppEl.style.display = 'block';
  } else {
    if (promoPageEl) promoPageEl.style.display = 'block';
    if (mainNavbarEl) mainNavbarEl.style.display = 'flex';
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
    ekranıGoster('promoPage');
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

const LEGAL_TEXTS = {
  privacy: {
    title: 'Gizlilik Politikasi ve KVKK Aydinlatma Metni',
    html: `
      <h4>1. Veri Sorumlusu</h4>
      <p>Bu metin, Parabol Kocluk dijital ogrenci koclugu platformu tarafindan, 6698 sayili Kisisel Verilerin Korunmasi Kanunu (KVKK) kapsaminda hazirlanmistir. Platform uzerinden toplanan veriler, ogrenci koclugu hizmetlerinin planlanmasi ve yurutilmesi amaciyla islenir.</p>

      <h4>2. Islenen Kisisel Veriler</h4>
      <p>Hizmetin niteligine gore asagidaki veri kategorileri islenebilir:</p>
      <ul>
        <li>Kimlik ve iletisim verileri (ad-soyad, e-posta, telefon)</li>
        <li>Egitim sureci verileri (sinif seviyesi, ders programi, hedefler, deneme ve ilerleme kayitlari)</li>
        <li>Islem guvenligi verileri (oturum kayitlari, cihaz ve erisim bilgileri)</li>
        <li>Finansal surec verileri (odeme kayitlari, fatura bilgileri)</li>
      </ul>

      <h4>3. Veri Isleme Amaclari</h4>
      <p>Kisisel verileriniz; ogrenci koclugu hizmeti sunulmasi, kullanici hesabi yonetimi, performans takibi, iletisim sureclerinin yurutilmesi, yasal yukumluluklerin yerine getirilmesi ve hizmet kalitesinin artirilmasi amaclariyla islenir.</p>

      <h4>4. Hukuki Sebepler ve Toplama Yontemi</h4>
      <p>Verileriniz; platform uzerindeki formlar, kullanici giris ekranlari ve dijital kayit alanlari araciligiyla elektronik ortamda toplanir. Isleme faaliyetleri, KVKK madde 5/2 kapsamindaki sozlesmenin kurulmasi/ifasi, hukuki yukumluluklerin yerine getirilmesi ve mesru menfaat hukuki sebeplerine dayanir.</p>

      <h4>5. Veri Aktarimi</h4>
      <p>Kisisel verileriniz, mevzuata uygun olarak; teknik altyapi ve barindirma hizmeti aldigimiz tedarikcilere, hukuken yetkili kamu kurumlarina ve zorunlu hallerde profesyonel danismanlara aktarilabilir. Aktarim sureclerinde gerekli idari ve teknik guvenlik tedbirleri uygulanir.</p>

      <h4>6. Saklama Suresi ve Guvenlik</h4>
      <p>Verileriniz, ilgili mevzuatta ongorulen sureler boyunca veya isleme amaci gerekli kildigi surece saklanir. Yetkisiz erisimi onlemek icin erisim kontrolu, sifreleme, yedekleme ve loglama gibi guvenlik onlemleri uygulanir.</p>

      <h4>7. KVKK Kapsamindaki Haklariniz</h4>
      <p>KVKK madde 11 kapsaminda; verilerinizin islenip islenmedigini ogrenme, duzeltme talep etme, silinmesini isteme, aktarim bilgisi talep etme ve itiraz etme haklarina sahipsiniz. Taleplerinizi iletisim kanallarimiz uzerinden iletebilirsiniz.</p>
    `
  },
  terms: {
    title: 'Kullanim Kosullari',
    html: `
      <h4>1. Hizmetin Kapsami</h4>
      <p>Parabol Kocluk, YKS ve YDT basta olmak uzere sinav hazirlik surecine yonelik ogrenci koclugu, planlama, takip ve raporlama araclari sunan dijital bir platformdur. Platformu kullanan tum kullanicilar bu kosullari kabul etmis sayilir.</p>

      <h4>2. Hesap Guvenligi</h4>
      <p>Kullanici, hesap bilgilerinin dogrulugundan ve sifre guvenliginden sorumludur. Hesap bilgilerinin ucuncu kisilerle paylasilmasi sonucu dogabilecek risklerden kullanici sorumludur.</p>

      <h4>3. Kullanici Yukumlulukleri</h4>
      <ul>
        <li>Platformu hukuka ve genel ahlaka uygun sekilde kullanmak</li>
        <li>Baskalarinin haklarini ihlal edecek icerik paylasmamak</li>
        <li>Sistemi teknik olarak zayiflatacak veya manipule edecek girisimlerde bulunmamak</li>
      </ul>

      <h4>4. Fikri Mulkiyet</h4>
      <p>Platformdaki tasarim, metin, grafik, yazilim ve diger unsurlara iliskin tum fikri mulkiyet haklari Parabol Kocluk'a veya ilgili hak sahiplerine aittir. Izinsiz kopyalama, cogaltma ve dagitim yapilamaz.</p>

      <h4>5. Hizmet Degisiklikleri</h4>
      <p>Parabol Kocluk, hizmet kapsaminda teknik iyilestirme, guncelleme veya icerik degisikligi yapma hakkini sakli tutar. Gerekli durumlarda hizmete gecici sureyle ara verilebilir.</p>

      <h4>6. Sorumlulugun Sinirlandirilmasi</h4>
      <p>Platform, ogrenci koclugu surecini destekleyici bir arac olup sinav sonucu garantisi vermez. Kullanici karar ve uygulamalarindan dogan sonuclar kullanicinin sorumlulugundadir.</p>

      <h4>7. Uygulanacak Hukuk</h4>
      <p>Bu kosullar Turk hukukuna tabidir. Uyusmazliklarda ilgili mevzuat cercevesinde yetkili mahkeme ve icra daireleri esas alinir.</p>
    `
  },
  cookies: {
    title: 'Cerez Politikasi',
    html: `
      <h4>1. Cerez Nedir?</h4>
      <p>Cerezler, web sitesini ziyaret ettiginizde cihaziniza kaydedilen kucuk metin dosyalaridir. Bu dosyalar, platformun daha verimli calismasina ve tercihlerin hatirlanmasina yardimci olur.</p>

      <h4>2. Kullanilan Cerez Turleri</h4>
      <ul>
        <li>Zorunlu cerezler: Oturum acma ve temel guvenlik islemleri icin kullanilir.</li>
        <li>Islevsel cerezler: Kullanici tercihlerini (oturum devam, panel gorunumu vb.) hatirlar.</li>
        <li>Analitik cerezler: Platform performansini iyilestirmek icin anonim trafik verileri sunar.</li>
      </ul>

      <h4>3. Cerezlerin Kullanim Amaci</h4>
      <p>Cerezler; kullanici deneyimini gelistirmek, teknik hatalari azaltmak, guvenligi artirmak ve hizmet kalitesini olcmek amaclariyla kullanilir.</p>

      <h4>4. Cerez Yonetimi</h4>
      <p>Tarayici ayarlarinizdan cerezleri silebilir veya engelleyebilirsiniz. Ancak cerezleri devre disi birakmaniz durumunda platformun bazi ozellikleri beklenen sekilde calismayabilir.</p>

      <h4>5. Ucuncu Taraf Hizmetler</h4>
      <p>Platform, teknik barindirma ve performans olcumu amaciyla ucuncu taraf hizmet saglayicilardan yararlanabilir. Bu hizmetlerin kendi gizlilik/cerez politikalarina tabi olabilecegini hatirlatiriz.</p>

      <h4>6. Guncellemeler</h4>
      <p>Bu politika, mevzuat ve teknik gelismelere gore guncellenebilir. Guncel metin her zaman platform uzerinde yayinlanir.</p>
    `
  }
};

function openLegalModal(type) {
  const selected = LEGAL_TEXTS[type] || LEGAL_TEXTS.privacy;
  const titleEl = document.getElementById('legalModalTitle');
  const contentEl = document.getElementById('legalModalContent');
  if (!titleEl || !contentEl) return;

  titleEl.textContent = selected.title;
  contentEl.innerHTML = selected.html;
  modalAc('legalModal');
}

function scrollToLandingSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleLandingFaq(buttonEl) {
  const item = buttonEl && buttonEl.closest('.faq-item');
  if (!item) return;
  item.classList.toggle('open');
}

async function submitLandingApplyForm(event) {
  if (event) event.preventDefault();

  const nameEl = document.getElementById('landingApplyName');
  const emailEl = document.getElementById('landingApplyEmail');
  const phoneEl = document.getElementById('landingApplyPhone');
  const levelEl = document.getElementById('landingApplyLevel');
  const noteEl = document.getElementById('landingApplyNote');
  const successEl = document.getElementById('landingApplySuccess');

  if (!nameEl || !emailEl || !phoneEl || !levelEl || !successEl) return;

  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const phoneDigits = phoneEl.value.replace(/\D/g, '');
  const level = levelEl.value.trim();

  if (!name || name.split(/\s+/).length < 2) {
    alert('Lütfen ad ve soyad girin.');
    nameEl.focus();
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    alert('Lütfen geçerli bir e-posta adresi girin.');
    emailEl.focus();
    return;
  }

  if (phoneDigits.length < 10) {
    alert('Lütfen geçerli bir telefon numarası girin.');
    phoneEl.focus();
    return;
  }

  if (!level) {
    alert('Lütfen seviye seçin.');
    levelEl.focus();
    return;
  }

  const note = noteEl ? noteEl.value.trim() : '';

  if (shouldUseFirestoreForms()) {
    try {
      const services = getFirebaseServices();
      await services.saveLandingApplication({
        name: name,
        email: email,
        phone: phoneDigits,
        level: level,
        note: note
      });
    } catch (error) {
      console.error('Firestore başvuru kaydı hatası:', error);
      alert('Başvuru kaydedilirken bir sorun oluştu. Lütfen tekrar deneyin.');
      return;
    }
  }

  successEl.style.display = 'block';
  if (noteEl) noteEl.value = '';
  nameEl.value = '';
  emailEl.value = '';
  phoneEl.value = '';
  levelEl.value = '';
}

function refreshRegisterSpamGuards() {
  registerFormOpenedAt = Date.now();
  const honeypotEl = document.getElementById('regWebsite');
  if (honeypotEl) honeypotEl.value = '';
}

function isValidRegisterName(name) {
  const normalized = String(name || '').trim();
  if (!normalized) return false;
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  return /^[A-Za-zÇĞİÖŞÜçğıöşü\s.'-]+$/.test(normalized);
}

function isValidRegisterEmail(email) {
  const value = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
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
    refreshRegisterSpamGuards();
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

async function sifreSifirla() {
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

  if (shouldUseFirebaseAuth()) {
    try {
      const services = getFirebaseServices();
      await services.resetPassword(email);
      forgotErrorBox.style.display = 'none';
      modalKapat('forgotModal');
      alert('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
      return;
    } catch (error) {
      forgotErrorBox.textContent = 'Şifre sıfırlama işlemi yapılamadı. E-posta adresinizi kontrol edin.';
      forgotErrorBox.style.display = 'block';
      return;
    }
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

async function kayitOl() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const branch = document.getElementById('regBranch').value.trim();
  const pass = document.getElementById('regPass').value;
  const passConfirm = document.getElementById('regPassConfirm').value;
  const phone = document.getElementById('regPhone').value.trim();
  const honeypot = document.getElementById('regWebsite');
  const regErrorBox = document.getElementById('regErrorBox');

  if (honeypot && honeypot.value.trim()) {
    regErrorBox.textContent = "İşlem doğrulanamadı. Lütfen tekrar deneyin.";
    regErrorBox.style.display = "block";
    return;
  }

  if ((Date.now() - registerFormOpenedAt) < REGISTER_MIN_SUBMIT_MS) {
    regErrorBox.textContent = "Formu çok hızlı gönderdiniz. Lütfen bilgileri kontrol edip tekrar deneyin.";
    regErrorBox.style.display = "block";
    return;
  }

  if (!isValidRegisterName(name) || name.length > REGISTER_MAX_TEXT_LEN) {
    regErrorBox.textContent = "Lütfen geçerli bir Ad ve Soyad girin.";
    regErrorBox.style.display = "block";
    return;
  }

  if (!isValidRegisterEmail(email) || email.length > REGISTER_MAX_TEXT_LEN) {
    regErrorBox.textContent = "Lütfen geçerli bir e-posta adresi girin.";
    regErrorBox.style.display = "block";
    return;
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone || phoneDigits.length < 10 || phoneDigits.length > 15) {
    regErrorBox.textContent = "Lütfen en az 10 haneli geçerli bir telefon numarası girin.";
    regErrorBox.style.display = "block";
    return;
  }

  const normalizedPhone = phoneDigits;

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

  if (isSignUpSubmitting) return;
  isSignUpSubmitting = true;
  const submitBtn = getSignUpSubmitButton();
  setSubmitButtonLoading(submitBtn, true);

  try {
    regErrorBox.style.display = 'none';

    if (shouldUseFirebaseAuth()) {
      const services = getFirebaseServices();
      const session = await services.registerWithEmail({
        name: name,
        email: email,
        password: pass,
        phone: normalizedPhone,
        branch: branch
      });

      const userEmail = (session && session.email ? session.email : email).toLowerCase();
      currentUserEmail = userEmail;
      currentUserName = session && session.name ? session.name : name;
      currentUserBranch = session && session.branch ? session.branch : branch;

      localStorage.removeItem('koclukToken');
      sessionStorage.removeItem('koclukToken');
      localStorage.setItem('koclukUserEmail', userEmail);
      sessionStorage.removeItem('koclukUserEmail');

      loadSavedResourceSuggestions();
      await syncStudentStorageFromCloud();
      renderStoredOgrenciler();
      renderKokpitUserCard();
      updateUserCountLabel();

      const cardEmail = document.getElementById('cardEmail');
      const modalEmail = document.getElementById('modalEmail');
      if (cardEmail) cardEmail.value = userEmail;
      if (modalEmail) modalEmail.value = userEmail;

      alert('Kayıt başarılı! Panele yönlendiriliyorsunuz.');
      modalKapat('authModal');
      sayfaAcs('dashboardApp');
      return;
    }

    const res = await fetch(API_URL + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: pass, phone: normalizedPhone, branch })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Kayıt sırasında hata oluştu.');
    }

    alert('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
    tabDegistir('giris');
  } catch (error) {
    console.error('Kayıt akışı hatası:', {
      mode: shouldUseFirebaseAuth() ? 'firebase' : 'backend',
      code: error && error.code ? error.code : null,
      message: error && error.message ? error.message : String(error),
      error: error
    });

    regErrorBox.textContent = shouldUseFirebaseAuth()
      ? getFirebaseAuthErrorMessage(error, 'Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.')
      : (error && error.message ? error.message : 'Sunucuya bağlanılamıyor.');
    regErrorBox.style.display = 'block';
  } finally {
    setSubmitButtonLoading(submitBtn, false);
    isSignUpSubmitting = false;
  }
}

async function paneleGirisYap(nereden) {
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

  if (isSignInSubmitting) return;
  isSignInSubmitting = true;
  const submitBtn = getSignInSubmitButton(nereden);
  setSubmitButtonLoading(submitBtn, true);

  try {
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

    if (shouldUseFirebaseAuth()) {
      const services = getFirebaseServices();
      const session = await services.loginWithEmail({ email: eposta, password: sifre });

      const userEmail = (session && session.email ? session.email : eposta).toLowerCase();
      localStorage.removeItem('koclukToken');
      sessionStorage.removeItem('koclukToken');
      if (remember) {
        localStorage.setItem('koclukUserEmail', userEmail);
        sessionStorage.removeItem('koclukUserEmail');
      } else {
        sessionStorage.setItem('koclukUserEmail', userEmail);
        localStorage.removeItem('koclukUserEmail');
      }

      currentUserEmail = userEmail;
      currentUserName = session && session.name ? session.name : currentUserName;
      currentUserBranch = session && session.branch ? session.branch : currentUserBranch;
      loadSavedResourceSuggestions();
      await syncStudentStorageFromCloud();

      modalKapat('authModal');
      sayfaAcs('dashboardApp');
      renderStoredOgrenciler();
      updateUserCountLabel();
      renderKokpitUserCard();
      return;
    }

    const res = await fetch(API_URL + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: eposta, password: sifre })
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = {};
    }

    if (!res.ok || !data.token) {
      throw new Error(data.error || ('Giriş başarısız (HTTP ' + res.status + ').'));
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
    currentUserName = data.user && data.user.name ? data.user.name : currentUserName;
    currentUserBranch = data.user && data.user.branch ? data.user.branch : currentUserBranch;
    loadSavedResourceSuggestions();
    await syncStudentStorageFromCloud();

    modalKapat('authModal');
    sayfaAcs('dashboardApp');
    renderStoredOgrenciler();
    updateUserCountLabel();
    renderKokpitUserCard();
  } catch (error) {
    console.error('Giriş akışı hatası:', {
      source: nereden,
      mode: shouldUseFirebaseAuth() ? 'firebase' : 'backend',
      code: error && error.code ? error.code : null,
      message: error && error.message ? error.message : String(error),
      error: error
    });

    if (errorBox) {
      errorBox.textContent = shouldUseFirebaseAuth()
        ? getFirebaseAuthErrorMessage(error, 'Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.')
        : (error && error.message ? error.message : 'Sunucuya bağlanılamıyor.');
      errorBox.style.display = 'block';
    }
  } finally {
    setSubmitButtonLoading(submitBtn, false);
    isSignInSubmitting = false;
  }
}

// Otomatik giriş (remember me) işlevselliği
async function attemptAutoLogin() {
  if (shouldUseFirebaseAuth()) {
    try {
      const services = getFirebaseServices();
      const session = await services.getCurrentUserSession();
      if (session && session.email) {
        const email = session.email.toLowerCase();
        currentUserEmail = email;
        currentUserName = session.name || currentUserName;
        currentUserBranch = session.branch || currentUserBranch;
        loadSavedResourceSuggestions();
        await syncStudentStorageFromCloud();
        localStorage.setItem('koclukUserEmail', email);
        sessionStorage.removeItem('koclukUserEmail');

        sayfaAcs('dashboardApp', false);
        renderStoredOgrenciler();
        updateUserCountLabel();
        renderKokpitUserCard();
        return true;
      }
    } catch (error) {
      return false;
    }
  }

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
        currentUserName = data.user.name || currentUserName;
        currentUserBranch = data.user.branch || currentUserBranch;
        loadSavedResourceSuggestions();
        await syncStudentStorageFromCloud();
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
      renderKokpitUserCard();
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
  const muhasebeEl = document.getElementById('tabMuhasebe');
  if (muhasebeEl) muhasebeEl.style.display = 'none';
  document.getElementById('tabOgrenciDetay').style.display = 'none';
  document.getElementById('tabProgram').style.display = 'none';
  document.getElementById('tabKaynak').style.display = 'none';
  const uniteKonuEl = document.getElementById('tabUniteKonu');
  if (uniteKonuEl) uniteKonuEl.style.display = 'none';
  document.getElementById('tabBrans').style.display = 'none';
  const genelEl = document.getElementById('tabGenel');
  if (genelEl) genelEl.style.display = 'none';
  const kaynakIlerlemeEl = document.getElementById('tabKaynakIlerleme');
  if (kaynakIlerlemeEl) kaynakIlerlemeEl.style.display = 'none';
  const veliBilgiEl = document.getElementById('tabVeliBilgi');
  if (veliBilgiEl) veliBilgiEl.style.display = 'none';
  const cozulenSoruEl = document.getElementById('tabCozulenSoru');
  if (cozulenSoruEl) cozulenSoruEl.style.display = 'none';

  const markMenuActive = (menuId) => {
    const el = document.getElementById(menuId);
    if (el) el.classList.add('active');
  };

  const kaynakMenu = document.getElementById('menu-kaynak');
  if (kaynakMenu && sekmeAd !== 'kaynak') kaynakMenu.classList.remove('submenu-open');
  const uniteKonuMenu = document.getElementById('menu-unite-konu');
  if (uniteKonuMenu && sekmeAd !== 'unite-konu') uniteKonuMenu.classList.remove('submenu-open');

  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

  if (sekmeAd === 'kokpit') {
    document.getElementById('tabKokpit').style.display = 'block';
    markMenuActive('menu-kokpit');
  } else if (sekmeAd === 'ogrenci') {
    document.getElementById('tabOgrenci').style.display = 'block';
    markMenuActive('menu-ogrenci');
  } else if (sekmeAd === 'muhasebe') {
    if (muhasebeEl) muhasebeEl.style.display = 'block';
    markMenuActive('menu-muhasebe');
    renderMuhasebeStudentCards();
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
  } else if (sekmeAd === 'unite-konu') {
    if (uniteKonuEl) uniteKonuEl.style.display = 'block';
    markMenuActive('menu-unite-konu');
    initUniteKonuPanel();
  }

  closeMobileSidebar();
}

function toggleMobileSidebar() {
  const appLayout = document.querySelector('#dashboardApp .app-layout');
  const toggleButton = document.querySelector('.mobile-sidebar-toggle');
  if (!appLayout) return;

  const nextState = !appLayout.classList.contains('sidebar-open');
  appLayout.classList.toggle('sidebar-open', nextState);
  if (toggleButton) toggleButton.setAttribute('aria-expanded', String(nextState));
}

function closeMobileSidebar() {
  const appLayout = document.querySelector('#dashboardApp .app-layout');
  const toggleButton = document.querySelector('.mobile-sidebar-toggle');
  if (!appLayout) return;

  appLayout.classList.remove('sidebar-open');
  if (toggleButton) toggleButton.setAttribute('aria-expanded', 'false');
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

let bransTopicStats = {};

function getActiveStudentClassLevel() {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  return student && student.classLevel ? String(student.classLevel) : '8';
}

function updateBransUnitOptions() {
  const classLevel = getActiveStudentClassLevel();
  const lesson = document.getElementById('bransExamLesson')?.value || '';
  const unitSelect = document.getElementById('bransExamUnit');
  if (!unitSelect) return;

  const units = getUnitOptionsForLesson(classLevel, lesson);
  if (!lesson) {
    unitSelect.innerHTML = '<option value="">Önce ders seçin</option>';
    renderBransTopicRows();
    return;
  }

  if (!units.length) {
    unitSelect.innerHTML = '<option value="">Ünite listesi yok</option>';
    renderBransTopicRows();
    return;
  }

  unitSelect.innerHTML = '<option value="">Ünite seçin</option>';
  units.forEach((unit) => {
    const opt = document.createElement('option');
    opt.value = unit;
    opt.textContent = unit;
    unitSelect.appendChild(opt);
  });

  renderBransTopicRows();
}

function renderBransTopicRows() {
  const container = document.getElementById('bransTopicRows');
  if (!container) return;

  const classLevel = getActiveStudentClassLevel();
  const lesson = document.getElementById('bransExamLesson')?.value || '';
  const unit = document.getElementById('bransExamUnit')?.value || '';

  let topics = [];
  if (classLevel && lesson) {
    topics = getTopicOptionsForLesson(classLevel, lesson, unit).filter((t) => t && t !== 'Konu seçiniz');
  }

  if (!topics.length) {
    container.innerHTML = '<div class="topic-map-empty">Bu seçim için konu listesi yok.</div>';
    return;
  }

  container.innerHTML = topics.map((topic, idx) => {
    const safeTopic = topic.replace(/"/g, '&quot;');
    const safeUnit = unit.replace(/"/g, '&quot;');
    const key = `${unit}__${topic}`;
    const saved = bransTopicStats[key] || { wrong: 0, blank: 0 };
    return `<div class="topic-map-row">
      <div>${topic}</div>
      <input class="input-field topic-map-input" type="number" min="0" value="${saved.wrong}" data-topic="${safeTopic}" data-unit="${safeUnit}" id="topicWrong_${idx}" oninput="updateBransTopicCount(this, 'wrong')">
      <input class="input-field topic-map-input" type="number" min="0" value="${saved.blank}" data-topic="${safeTopic}" data-unit="${safeUnit}" id="topicBlank_${idx}" oninput="updateBransTopicCount(this, 'blank')">
    </div>`;
  }).join('');
}

function updateBransTopicCount(inputEl, field) {
  if (!inputEl) return;
  const unit = inputEl.dataset.unit || '';
  const topic = inputEl.dataset.topic || '';
  if (!unit || !topic) return;

  const key = `${unit}__${topic}`;
  const current = bransTopicStats[key] || { unit, topic, wrong: 0, blank: 0 };
  const val = Math.max(0, Number(inputEl.value) || 0);
  current[field] = val;

  if (current.wrong === 0 && current.blank === 0) {
    delete bransTopicStats[key];
  } else {
    bransTopicStats[key] = current;
  }
}

function collectBransTopicSelections() {
  const topicStats = Object.values(bransTopicStats).filter((t) => (Number(t.wrong) || 0) > 0 || (Number(t.blank) || 0) > 0);
  return { topicStats };
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

function getTodayTrDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
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
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText || '').trim());
  if (isoMatch) return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return dateText;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function pdfSafeText(value) {
  return String(value ?? '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c')
    .replace(/Â|â/g, 'a')
    .replace(/Î|î/g, 'i')
    .replace(/Û|û/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();
}

let pdfLogoDataUrlCache = null;

async function getPdfLogoDataUrl() {
  if (pdfLogoDataUrlCache) return pdfLogoDataUrlCache;
  try {
    const response = await fetch('icons/icon.png', { cache: 'no-store' });
    if (!response.ok) return null;
    const blob = await response.blob();
    pdfLogoDataUrlCache = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Logo okunamadi'));
      reader.readAsDataURL(blob);
    });
    return pdfLogoDataUrlCache;
  } catch (error) {
    return null;
  }
}

function normalizeFileName(value) {
  return String(value || 'rapor')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .slice(0, 60) || 'rapor';
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
    const meta = `${getClassDisplayLabel(item.classLevel)} · ${item.lesson || '-'} · ${item.unit || 'Ünite yok'} · ${formatExamDate(item.examDate)}`;
    const details = `Soru: ${item.questionCount} · D: ${item.correct} · Y: ${item.wrong} · B: ${item.blank}`;
    const topicSummary = item.topicStats && item.topicStats.length
      ? item.topicStats.map((t) => `${t.unit} / ${t.topic} (Y:${t.wrong}, B:${t.blank})`).join(' | ')
      : '-';
    return `
      <div class="exam-history-item">
        <div>
          <strong>${title}</strong>
          <div class="exam-history-meta">${meta}</div>
          <div class="exam-history-actions">
            <button type="button" class="exam-delete-btn exam-pdf-btn" onclick="indirBransExamPdf(${item.id})">PDF İndir</button>
            <button type="button" class="exam-delete-btn" onclick="deleteBransExam(${item.id})">Sil</button>
          </div>
        </div>
        <div class="exam-history-meta">${details}<br/>Konu Dağılımı: ${topicSummary}</div>
        <div class="exam-history-net">
          <div class="value">${Number(item.net || 0).toFixed(2)}</div>
          <div class="exam-history-meta">Net</div>
        </div>
      </div>
    `;
  }).join('');
}

async function indirBransExamPdf(recordId) {
  const records = getStoredBransExams();
  const item = records.find((r) => String(r.id) === String(recordId));
  if (!item) {
    alert('PDF için deneme kaydı bulunamadı.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
    return;
  }

  const student = getStoredOgrenciler().find((s) => s.id === activeStudentId);
  const studentName = student && student.name ? student.name : 'Ogrenci';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const darkBlue = [18, 47, 92];
  const softLine = [224, 232, 242];
  const logoDataUrl = await getPdfLogoDataUrl();

  let y = margin;
  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionTitle = (title) => {
    ensureSpace(30);
    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.roundedRect(margin, y, 170, 22, 10, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(pdfSafeText(title), margin + 12, y + 15);
    y += 30;
  };

  const drawTable = (columns, rows, options = {}) => {
    const headerHeight = options.headerHeight || 24;
    const rowMinHeight = options.rowMinHeight || 24;
    const fontSize = options.fontSize || 9;

    const wrapFriendlyText = (value) => String(value)
      .replace(/\//g, '/ ')
      .replace(/:/g, ': ')
      .replace(/-/g, '- ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const headerFontSize = options.headerFontSize || 10;
    const headerLineHeight = headerFontSize + 1;
    const wrappedHeaders = columns.map((col) => {
      const safeLabel = pdfSafeText(wrapFriendlyText(col.label || ''));
      return doc.splitTextToSize(safeLabel, Math.max(16, col.width - 8));
    });
    const maxHeaderLines = wrappedHeaders.reduce((max, lines) => Math.max(max, lines.length || 1), 1);
    const computedHeaderHeight = Math.max(headerHeight, (maxHeaderLines * headerLineHeight) + 8);
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

    ensureSpace(computedHeaderHeight + rowMinHeight + 6);

    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.setDrawColor(softLine[0], softLine[1], softLine[2]);
    doc.setLineWidth(1.1);
    doc.rect(margin, y, tableWidth, computedHeaderHeight, 'FD');

    let x = margin;
    columns.forEach((col) => {
      x += col.width;
      if (x < margin + tableWidth) {
        doc.line(x, y, x, y + computedHeaderHeight);
      }
    });

    x = margin;
    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.setDrawColor(softLine[0], softLine[1], softLine[2]);
    doc.setLineWidth(1.1);
    columns.forEach((col, colIndex) => {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerFontSize);
      const headerLines = wrappedHeaders[colIndex];
      const headerTextHeight = headerLines.length * headerLineHeight;
      const headerTop = y + Math.max(5, (computedHeaderHeight - headerTextHeight) / 2) + (headerLineHeight - 2);
      headerLines.forEach((line, lineIdx) => {
        doc.text(line, x + col.width / 2, headerTop + (lineIdx * headerLineHeight), { align: 'center' });
      });
      x += col.width;
    });
    y += computedHeaderHeight;

    rows.forEach((row) => {
      const wrappedCells = columns.map((col) => {
        const text = row[col.key] === undefined || row[col.key] === null ? '-' : String(row[col.key]);
        return doc.splitTextToSize(pdfSafeText(wrapFriendlyText(text)), Math.max(18, col.width - 10));
      });
      const maxLines = wrappedCells.reduce((max, lines) => Math.max(max, lines.length || 1), 1);
      const rowHeight = Math.max(rowMinHeight, maxLines * (fontSize + 2) + 8);

      ensureSpace(rowHeight + 2);

      let cellX = margin;
      columns.forEach((col, colIndex) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(softLine[0], softLine[1], softLine[2]);
        doc.setLineWidth(1.1);
        doc.rect(cellX, y, col.width, rowHeight, 'FD');

        const lines = wrappedCells[colIndex];
        const lineHeight = fontSize + 2;
        const textTop = y + 6;
        doc.setTextColor(20, 28, 45);
        doc.setFont('helvetica', col.bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        lines.forEach((line, lineIdx) => {
          doc.text(line, cellX + 5, textTop + lineIdx * lineHeight);
        });

        cellX += col.width;
      });

      y += rowHeight;
    });
  };

  doc.setDrawColor(255, 161, 38);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentWidth, 96, 12, 12, 'FD');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin + 12, y + 14, 92, 68, undefined, 'FAST');
    } catch (error) {
      doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('PARABOL KOCLUK', margin + 18, y + 48);
    }
  } else {
    doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PARABOL KOCLUK', margin + 18, y + 48);
  }

  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(pdfSafeText('BRANS DENEME KARNESI'), margin + 155, y + 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(pdfSafeText('Tek deneme raporu'), margin + 155, y + 63);
  doc.setDrawColor(softLine[0], softLine[1], softLine[2]);
  doc.setLineWidth(0.8);
  doc.line(margin + 155, y + 70, margin + 420, y + 70);

  const rightInfoX = pageWidth - 250;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.text('Ogrenci', rightInfoX, y + 30);
  doc.text('Rapor Tarihi', rightInfoX, y + 56);
  doc.setFont('helvetica', 'normal');
  doc.text(pdfSafeText(studentName), rightInfoX + 92, y + 30);
  doc.text(pdfSafeText(formatExamDate(item.examDate || new Date().toLocaleDateString('tr-TR'))), rightInfoX + 92, y + 56);

  y += 110;

  drawSectionTitle('1. DENEME OZETI');

  const summaryColumns = [
    { key: 'examName', label: 'DENEME', width: 125, bold: true },
    { key: 'classLevel', label: 'SINIF', width: 52, bold: false },
    { key: 'lesson', label: 'DERS', width: 80, bold: false },
    { key: 'unit', label: 'UNITE', width: 190, bold: false },
    { key: 'examDate', label: 'TARIH', width: 78, bold: false },
    { key: 'questionCount', label: 'SORU', width: 58, bold: false },
    { key: 'correct', label: 'DOGRU', width: 58, bold: false },
    { key: 'wrong', label: 'YANLIS', width: 58, bold: false },
    { key: 'blank', label: 'BOS', width: 50, bold: false },
    { key: 'net', label: 'NET', width: 64, bold: true }
  ];

  const summaryRows = [{
    examName: item.examName || `${item.lesson || 'Brans'} Denemesi`,
    classLevel: item.classLevel || '-',
    lesson: item.lesson || '-',
    unit: item.unit || '-',
    examDate: formatExamDate(item.examDate),
    questionCount: String(item.questionCount || 0),
    correct: String(item.correct || 0),
    wrong: String(item.wrong || 0),
    blank: String(item.blank || 0),
    net: Number(item.net || 0).toFixed(2)
  }];

  drawTable(summaryColumns, summaryRows, { headerHeight: 22, rowMinHeight: 42, fontSize: 9 });

  y += 14;
  drawSectionTitle('YANLIS VE BOS SORU DAGILIMI');

  const topicRowsSource = Array.isArray(item.topicStats) && item.topicStats.length
    ? item.topicStats
    : [{ unit: '-', topic: 'Konu girilmedi', wrong: item.wrong || 0, blank: item.blank || 0 }];

  const totalQuestion = Math.max(1, Number(item.questionCount || 0));
  let totalWrong = 0;
  let totalBlank = 0;

  const topicRows = topicRowsSource.map((topicItem) => {
    const wrong = Number(topicItem.wrong || 0);
    const blank = Number(topicItem.blank || 0);
    totalWrong += wrong;
    totalBlank += blank;
    const topicName = topicItem.unit && topicItem.unit !== '-'
      ? `${topicItem.unit} / ${topicItem.topic || '-'}`
      : (topicItem.topic || '-');

    return {
      topic: topicName,
      wrongCount: String(wrong),
      wrongRate: `%${((wrong / totalQuestion) * 100).toFixed(0)}`,
      blankCount: String(blank),
      blankRate: `%${((blank / totalQuestion) * 100).toFixed(0)}`,
      totalTracked: String(wrong + blank)
    };
  });

  topicRows.push({
    topic: 'TOPLAM',
    wrongCount: String(totalWrong),
    wrongRate: `%${((totalWrong / totalQuestion) * 100).toFixed(0)}`,
    blankCount: String(totalBlank),
    blankRate: `%${((totalBlank / totalQuestion) * 100).toFixed(0)}`,
    totalTracked: String(totalWrong + totalBlank)
  });

  const topicColumns = [
    { key: 'topic', label: 'KONU', width: 265, bold: false },
    { key: 'wrongCount', label: 'YANLIS SAYI', width: 100, bold: true },
    { key: 'wrongRate', label: 'YANLIS ORAN (%)', width: 110, bold: true },
    { key: 'blankCount', label: 'BOS SAYI', width: 100, bold: true },
    { key: 'blankRate', label: 'BOS ORAN (%)', width: 110, bold: true },
    { key: 'totalTracked', label: 'TOPLAM SORU', width: 128, bold: true }
  ];

  drawTable(topicColumns, topicRows, { headerHeight: 22, rowMinHeight: 30, fontSize: 9 });

  const safeStudent = normalizeFileName(studentName);
  const safeExam = normalizeFileName(item.examName || `${item.lesson || 'brans'}-deneme`);
  doc.save(`${safeStudent}_${safeExam}_karnesi.pdf`);
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
  doc.text(pdfSafeText('Brans Deneme Karnesi'), marginLeft, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(pdfSafeText(`Ogrenci: ${studentName}`), marginLeft, y);
  y += 16;
  doc.text(pdfSafeText(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`), marginLeft, y);
  y += 22;

  records.forEach((item, index) => {
    ensureSpace(120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(pdfSafeText(`${index + 1}. ${item.examName || (item.lesson || 'Brans') + ' Denemesi'}`), marginLeft, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(pdfSafeText(`Sinif: ${item.classLevel || '-'}`), marginLeft, y);
    y += 14;
    doc.text(pdfSafeText(`Ders: ${item.lesson || '-'}`), marginLeft, y);
    y += 14;
    doc.text(pdfSafeText(`Unite: ${item.unit || '-'}`), marginLeft, y);
    y += 14;
    doc.text(pdfSafeText(`Tarih: ${formatExamDate(item.examDate)}`), marginLeft, y);
    y += 14;

    const details = `Soru: ${item.questionCount || 0}   Dogru: ${item.correct || 0}   Yanlis: ${item.wrong || 0}   Bos: ${item.blank || 0}`;
    doc.text(pdfSafeText(details), marginLeft, y);
    y += 14;

    const topicSummary = item.topicStats && item.topicStats.length
      ? item.topicStats.map((t) => `${t.unit} / ${t.topic} (Y:${t.wrong}, B:${t.blank})`).join(' | ')
      : '-';
    const topicLines = doc.splitTextToSize(pdfSafeText(`Konu Dagilimi: ${topicSummary}`), 510);
    doc.text(topicLines, marginLeft, y);
    y += topicLines.length * 12 + 4;

    doc.setFont('helvetica', 'bold');
    doc.text(pdfSafeText(`Net: ${Number(item.net || 0).toFixed(2)}`), marginLeft, y);
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

  const classLevel = getActiveStudentClassLevel();
  const lesson = document.getElementById('bransExamLesson')?.value || '';
  const unit = document.getElementById('bransExamUnit')?.value || '';
  const examDate = document.getElementById('bransExamDate')?.value || '';
  const examName = document.getElementById('bransExamName')?.value.trim() || '';
  const questionCount = Number(document.getElementById('bransExamQuestionCount')?.value) || 0;
  const correct = Number(document.getElementById('bransExamCorrect')?.value) || 0;
  const wrong = Number(document.getElementById('bransExamWrong')?.value) || 0;
  const blank = Math.max(0, questionCount - correct - wrong);
  const topicSelections = collectBransTopicSelections();

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
    classLevel,
    lesson,
    unit,
    examDate,
    examName,
    questionCount,
    correct,
    wrong,
    blank,
    topicStats: topicSelections.topicStats,
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
  bransTopicStats = {};
  renderBransTopicRows();
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
            <button type="button" class="exam-delete-btn exam-pdf-btn" onclick="indirGenelExamPdf(${item.id})">PDF İndir</button>
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

async function indirGenelExamPdf(recordId) {
  const records = getStoredGenelExams();
  const item = records.find((r) => String(r.id) === String(recordId));
  if (!item) {
    alert('PDF için genel deneme kaydı bulunamadı.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
    return;
  }

  const student = getStoredOgrenciler().find((s) => s.id === activeStudentId);
  const studentName = student && student.name ? student.name : 'Ogrenci';
  const logoDataUrl = await getPdfLogoDataUrl();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  const darkBlue = [18, 47, 92];
  const orange = [229, 165, 62];
  const lineColor = [224, 232, 242];

  let y = margin;
  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const lessons = [
    { key: 'Mat', name: 'Matematik' },
    { key: 'Fen', name: 'Fen Bilimleri' },
    { key: 'Tur', name: 'Turkce' },
    { key: 'Ink', name: 'Inkilap Tarihi' },
    { key: 'Ing', name: 'Ingilizce' },
    { key: 'Din', name: 'Din Kulturu' }
  ];

  const lessonRows = lessons.map((lesson) => {
    const values = item.lessons && item.lessons[lesson.key] ? item.lessons[lesson.key] : {};
    const d = Number(values.d || 0);
    const yv = Number(values.y || 0);
    const b = Number(values.b || 0);
    const net = Number(values.net || 0);
    return {
      lesson: lesson.name,
      d,
      y: yv,
      b,
      net
    };
  });

  const totals = lessonRows.reduce((acc, row) => {
    acc.d += row.d;
    acc.y += row.y;
    acc.b += row.b;
    acc.net += row.net;
    return acc;
  }, { d: 0, y: 0, b: 0, net: 0 });

  ensureSpace(120);
  doc.setDrawColor(orange[0], orange[1], orange[2]);
  doc.setLineWidth(1.2);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentWidth, 92, 10, 10, 'FD');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin + 8, y + 10, 88, 68, undefined, 'FAST');
    } catch (error) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
      doc.text('PARABOL KOCLUK', margin + 14, y + 46);
    }
  }

  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(27);
  doc.text(pdfSafeText('GENEL DENEME KARNESI'), margin + 130, y + 42);
  doc.setDrawColor(orange[0], orange[1], orange[2]);
  doc.setLineWidth(1);
  doc.line(margin + 130, y + 55, margin + 370, y + 55);

  const infoX = pageWidth - 240;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('OGRENCI', infoX, y + 28);
  doc.text('RAPOR TARIHI', infoX, y + 56);
  doc.setFont('helvetica', 'normal');
  doc.text(pdfSafeText(studentName), infoX + 96, y + 28);
  doc.text(pdfSafeText(formatExamDate(item.examDate || new Date().toLocaleDateString('tr-TR'))), infoX + 96, y + 56);

  y += 106;

  ensureSpace(40);
  doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.roundedRect(margin, y, 220, 24, 10, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. DENEME BILGILERI', margin + 16, y + 16);
  y += 30;

  ensureSpace(56);
  doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.setLineWidth(1);
  doc.rect(margin, y, contentWidth, 26, 'FD');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(pdfSafeText(`1. ${item.examName || 'GENEL DENEME'}`), margin + (contentWidth / 2), y + 17, { align: 'center' });
  y += 26;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.rect(margin, y, contentWidth, 24, 'FD');
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pdfSafeText(`Tarih: ${formatExamDate(item.examDate)}`), margin + (contentWidth / 2), y + 16, { align: 'center' });
  y += 30;

  const tableColumns = [
    { key: 'lesson', label: 'DERS', width: Math.round(contentWidth * 0.22), align: 'left', bold: true },
    { key: 'd', label: 'DOGRU (D)', width: Math.round(contentWidth * 0.195), align: 'center', bold: true },
    { key: 'y', label: 'YANLIS (Y)', width: Math.round(contentWidth * 0.195), align: 'center', bold: true },
    { key: 'b', label: 'BOS (B)', width: Math.round(contentWidth * 0.195), align: 'center', bold: true },
    { key: 'net', label: 'NET', width: 0, align: 'center', bold: true }
  ];
  const assignedWidth = tableColumns.slice(0, 4).reduce((sum, c) => sum + c.width, 0);
  tableColumns[4].width = contentWidth - assignedWidth;

  const drawCellText = (text, x, cellWidth, baseY, cellHeight, align, color, bold = false) => {
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(11);
    const safe = pdfSafeText(String(text));
    const textY = baseY + (cellHeight / 2) + 4;
    if (align === 'center') {
      doc.text(safe, x + (cellWidth / 2), textY, { align: 'center' });
    } else if (align === 'right') {
      doc.text(safe, x + cellWidth - 8, textY, { align: 'right' });
    } else {
      doc.text(safe, x + 8, textY);
    }
  };

  const tableHeaderHeight = 24;
  ensureSpace(40 + ((lessonRows.length + 1) * 30));

  let x = margin;
  doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.setLineWidth(1);
  tableColumns.forEach((col) => {
    doc.rect(x, y, col.width, tableHeaderHeight, 'FD');
    drawCellText(col.label, x, col.width, y, tableHeaderHeight, 'center', [255, 255, 255], true);
    x += col.width;
  });
  y += tableHeaderHeight;

  lessonRows.forEach((row) => {
    const rowHeight = 30;
    x = margin;
    tableColumns.forEach((col) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
      doc.rect(x, y, col.width, rowHeight, 'FD');

      let value = row[col.key];
      if (col.key === 'net') value = Number(row.net || 0).toFixed(2);
      if (col.key === 'd' || col.key === 'y' || col.key === 'b') value = String(Number(value || 0));

      const valueColor = col.key === 'd'
        ? [24, 138, 52]
        : col.key === 'y'
          ? [199, 46, 46]
          : [18, 47, 92];

      drawCellText(value, x, col.width, y, rowHeight, col.align, valueColor, col.key !== 'b');
      x += col.width;
    });
    y += rowHeight;
  });

  const summaryHeight = 52;
  const summaryWidth = contentWidth / 5;
  y += 8;
  ensureSpace(summaryHeight + 6);

  for (let i = 0; i < 5; i += 1) {
    const cellX = margin + (i * summaryWidth);
    if (i === 0) {
      doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setTextColor(17, 24, 39);
    }
    doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.rect(cellX, y, summaryWidth, summaryHeight, 'FD');

    if (i === 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('GENEL TOPLAM', cellX + (summaryWidth / 2), y + 21, { align: 'center' });
      doc.text('RAPORU', cellX + (summaryWidth / 2), y + 38, { align: 'center' });
      continue;
    }

    const blockData = i === 1
      ? { title: 'TOPLAM DOGRU', value: totals.d, color: [24, 138, 52] }
      : i === 2
        ? { title: 'TOPLAM YANLIS', value: totals.y, color: [199, 46, 46] }
        : i === 3
          ? { title: 'TOPLAM BOS', value: totals.b, color: [107, 114, 128] }
          : { title: 'TOPLAM NET', value: Number(item.totalNet ?? totals.net).toFixed(2), color: darkBlue };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(blockData.title, cellX + (summaryWidth / 2), y + 18, { align: 'center' });
    doc.setFontSize(17);
    doc.setTextColor(blockData.color[0], blockData.color[1], blockData.color[2]);
    doc.text(String(blockData.value), cellX + (summaryWidth / 2), y + 41, { align: 'center' });
  }

  const safeStudent = normalizeFileName(studentName);
  const safeExam = normalizeFileName(item.examName || 'genel-deneme');
  doc.save(`${safeStudent}_${safeExam}_genel-karnesi.pdf`);
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
  doc.text(pdfSafeText('Genel Deneme Karnesi'), marginLeft, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(pdfSafeText(`Ogrenci: ${studentName}`), marginLeft, y);
  y += 16;
  doc.text(pdfSafeText(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`), marginLeft, y);
  y += 22;

  records.forEach((item, index) => {
    ensureSpace(130);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(pdfSafeText(`${index + 1}. ${item.examName || 'Genel Deneme'}`), marginLeft, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(pdfSafeText(`Tarih: ${formatExamDate(item.examDate)}`), marginLeft, y);
    y += 14;

    const breakdown = [
      `Mat: ${Number(item.lessons?.Mat?.net || 0).toFixed(2)}`,
      `Fen: ${Number(item.lessons?.Fen?.net || 0).toFixed(2)}`,
      `Tur: ${Number(item.lessons?.Tur?.net || 0).toFixed(2)}`,
      `Ink: ${Number(item.lessons?.Ink?.net || 0).toFixed(2)}`,
      `Ing: ${Number(item.lessons?.Ing?.net || 0).toFixed(2)}`,
      `Din: ${Number(item.lessons?.Din?.net || 0).toFixed(2)}`
    ].join('   |   ');

    const wrapped = doc.splitTextToSize(pdfSafeText(breakdown), 510);
    doc.text(wrapped, marginLeft, y);
    y += wrapped.length * 12 + 8;

    doc.setFont('helvetica', 'bold');
    doc.text(pdfSafeText(`Toplam Net: ${Number(item.totalNet || 0).toFixed(2)}`), marginLeft, y);
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

async function cikisYap() {
  if (shouldUseFirebaseAuth()) {
    try {
      const services = getFirebaseServices();
      await services.signOut();
    } catch (error) {
      console.warn('Firebase çıkış işlemi tamamlanamadı:', error);
    }
  }

  // Oturum kapatma sırasında token temizlenir
  localStorage.removeItem('koclukToken');
  sessionStorage.removeItem('koclukToken');
  localStorage.removeItem('koclukUserEmail');
  sessionStorage.removeItem('koclukUserEmail');
  currentUserEmail = null;
  currentUserName = null;
  currentUserBranch = null;
  sayfaAcs('promoPage');
}

function renderKokpitUserCard() {
  const nameEl = document.getElementById('kokpitWelcomeName');
  const emailEl = document.getElementById('kokpitWelcomeEmail');
  const branchEl = document.getElementById('kokpitWelcomeBranch');
  if (!nameEl || !emailEl || !branchEl) return;

  const name = currentUserName || 'Kullanıcı Adı';
  const email = currentUserEmail || 'E-posta yok';
  const branch = currentUserBranch || 'Branş seçilmedi';

  nameEl.textContent = name;
  emailEl.textContent = email;
  branchEl.textContent = branch;
  loadKokpitNotebookNotes();
  renderKokpitTodoDate();
  loadKokpitAgendaEvents();
  renderKokpitAgenda();
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
  const classLabel = getClassDisplayLabel(sinif);
  document.getElementById('kaynakClassTitle').textContent = `${classLabel} Kaynakları`;
  document.getElementById('kaynakClassDescription').textContent = `Burada sadece ${classLabel} için atanmış kaynak önerilerini görür ve yenilerini ekleyebilirsiniz.`;

  document.querySelectorAll('#menu-kaynak .submenu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sinif === sinif);
  });
  const menu = document.getElementById('menu-kaynak');
  if (menu) menu.classList.add('active');

  renderResourceSuggestions();
}

function toggleKaynakSubmenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('menu-kaynak');
  if (!menu) return;
  menu.classList.toggle('submenu-open');
}

let selectedUniteKonuSinif = '8';

function toggleUniteKonuSubmenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('menu-unite-konu');
  if (!menu) return;
  menu.classList.toggle('submenu-open');
}

function selectUniteKonuSinif(sinif, element) {
  sekmeAcs('unite-konu');
  selectedUniteKonuSinif = String(sinif || '8');

  document.querySelectorAll('#menu-unite-konu .submenu-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.sinif === selectedUniteKonuSinif);
  });

  const menu = document.getElementById('menu-unite-konu');
  if (menu) menu.classList.add('active');

  initUniteKonuPanel();
}

function initUniteKonuPanel() {
  const classTitleEl = document.getElementById('uniteKonuClassTitle');
  const classDescEl = document.getElementById('uniteKonuClassDescription');
  const classDisplayEl = document.getElementById('uniteKonuClassDisplay');
  const lessonEl = document.getElementById('uniteKonuLesson');
  if (!lessonEl) return;

  const classLabel = getClassDisplayLabel(selectedUniteKonuSinif);
  if (classTitleEl) classTitleEl.textContent = `${classLabel} Ünite / Konu Yönetimi`;
  if (classDescEl) classDescEl.textContent = `Bu alanda ${classLabel} için ders bazında ünite ve konu ekleyebilirsiniz. Eklenenler mevcut tüm seçim alanlarına entegre edilir.`;
  if (classDisplayEl) classDisplayEl.value = classLabel;

  const currentLesson = lessonEl.value || '';
  lessonEl.innerHTML = '<option value="">Ders seçin</option>';
  getLessonOptionsForClass(selectedUniteKonuSinif).forEach((lesson) => {
    const opt = document.createElement('option');
    opt.value = lesson;
    opt.textContent = lesson;
    lessonEl.appendChild(opt);
  });

  if (currentLesson && getLessonOptionsForClass(selectedUniteKonuSinif).includes(currentLesson)) {
    lessonEl.value = currentLesson;
  } else if (lessonEl.options.length > 1) {
    lessonEl.value = lessonEl.options[1].value;
  }

  onUniteKonuLessonChange();
}

function onUniteKonuLessonChange() {
  const lesson = document.getElementById('uniteKonuLesson')?.value || '';
  const unitSelectEl = document.getElementById('uniteKonuUnitSelect');
  if (!unitSelectEl) return;

  const previousUnit = unitSelectEl.value || '';
  const units = lesson ? getUnitOptionsForLesson(selectedUniteKonuSinif, lesson) : [];

  unitSelectEl.innerHTML = '<option value="">Ünite seçin (opsiyonel)</option>';
  units.forEach((unit) => {
    const opt = document.createElement('option');
    opt.value = unit;
    opt.textContent = unit;
    unitSelectEl.appendChild(opt);
  });

  if (previousUnit && units.includes(previousUnit)) {
    unitSelectEl.value = previousUnit;
  }

  renderUniteKonuUnitList();
  renderUniteKonuTopicList();
}

function onUniteKonuUnitSelectChange() {
  renderUniteKonuTopicList();
}

function addUniteKonuUnit() {
  const lesson = document.getElementById('uniteKonuLesson')?.value || '';
  const inputEl = document.getElementById('uniteKonuUnitInput');
  if (!inputEl) return;
  const unitName = inputEl.value.trim();

  if (!lesson) {
    alert('Önce ders seçin.');
    return;
  }
  if (!unitName) {
    alert('Ünite adı girin.');
    inputEl.focus();
    return;
  }

  updateCustomUnitTopicLessonData(selectedUniteKonuSinif, lesson, (lessonData) => {
    if (!lessonData.units.includes(unitName)) lessonData.units.push(unitName);
    if (!lessonData.topicsByUnit[unitName]) lessonData.topicsByUnit[unitName] = [];
  });

  inputEl.value = '';
  onUniteKonuLessonChange();
  renderUniteKonuTopicList();
}

function addUniteKonuTopic() {
  const lesson = document.getElementById('uniteKonuLesson')?.value || '';
  const unit = document.getElementById('uniteKonuUnitSelect')?.value || '';
  const inputEl = document.getElementById('uniteKonuTopicInput');
  if (!inputEl) return;
  const topicName = inputEl.value.trim();

  if (!lesson) {
    alert('Önce ders seçin.');
    return;
  }
  if (!topicName) {
    alert('Konu adı girin.');
    inputEl.focus();
    return;
  }

  updateCustomUnitTopicLessonData(selectedUniteKonuSinif, lesson, (lessonData) => {
    if (unit) {
      if (!lessonData.units.includes(unit)) lessonData.units.push(unit);
      if (!lessonData.topicsByUnit[unit]) lessonData.topicsByUnit[unit] = [];
      if (!lessonData.topicsByUnit[unit].includes(topicName)) lessonData.topicsByUnit[unit].push(topicName);
      return;
    }

    if (!lessonData.generalTopics.includes(topicName)) lessonData.generalTopics.push(topicName);
  });

  inputEl.value = '';
  renderUniteKonuTopicList();
}

function removeCustomUniteKonuUnit(unitName) {
  const lesson = document.getElementById('uniteKonuLesson')?.value || '';
  if (!lesson || !unitName) return;

  updateCustomUnitTopicLessonData(selectedUniteKonuSinif, lesson, (lessonData) => {
    const defaultUnits = (DEFAULT_UNITS_BY_CLASS[String(selectedUniteKonuSinif)] && DEFAULT_UNITS_BY_CLASS[String(selectedUniteKonuSinif)][lesson]) || [];
    const isSystemUnit = defaultUnits.includes(unitName);

    if (isSystemUnit && !lessonData.hiddenUnits.includes(unitName)) {
      lessonData.hiddenUnits.push(unitName);
    }

    lessonData.units = lessonData.units.filter((name) => name !== unitName);
    delete lessonData.topicsByUnit[unitName];
    delete lessonData.hiddenTopicsByUnit[unitName];
  });

  onUniteKonuLessonChange();
}

function removeCustomUniteKonuTopic(unitName, topicName) {
  const lesson = document.getElementById('uniteKonuLesson')?.value || '';
  if (!lesson || !topicName) return;

  updateCustomUnitTopicLessonData(selectedUniteKonuSinif, lesson, (lessonData) => {
    const defaultTopicsMap = DEFAULT_TOPICS_BY_CLASS[String(selectedUniteKonuSinif)] && DEFAULT_TOPICS_BY_CLASS[String(selectedUniteKonuSinif)][lesson];
    const isNested = defaultTopicsMap && typeof defaultTopicsMap === 'object' && !Array.isArray(defaultTopicsMap);

    if (unitName) {
      const topics = Array.isArray(lessonData.topicsByUnit[unitName]) ? lessonData.topicsByUnit[unitName] : [];
      lessonData.topicsByUnit[unitName] = topics.filter((name) => name !== topicName);

      const systemTopics = isNested ? (defaultTopicsMap[unitName] || []) : [];
      if (systemTopics.includes(topicName)) {
        if (!lessonData.hiddenTopicsByUnit[unitName]) lessonData.hiddenTopicsByUnit[unitName] = [];
        if (!lessonData.hiddenTopicsByUnit[unitName].includes(topicName)) {
          lessonData.hiddenTopicsByUnit[unitName].push(topicName);
        }
      }
      return;
    }

    lessonData.generalTopics = lessonData.generalTopics.filter((name) => name !== topicName);

    const systemTopics = Array.isArray(defaultTopicsMap) ? defaultTopicsMap : [];
    if (systemTopics.includes(topicName) && !lessonData.hiddenGeneralTopics.includes(topicName)) {
      lessonData.hiddenGeneralTopics.push(topicName);
    }
  });

  renderUniteKonuTopicList();
}

function renderUniteKonuUnitList() {
  const listEl = document.getElementById('uniteKonuUnitList');
  const lesson = document.getElementById('uniteKonuLesson')?.value || '';
  if (!listEl) return;

  if (!lesson) {
    listEl.innerHTML = '<div class="exam-history-empty">Önce ders seçin.</div>';
    return;
  }

  const units = getUnitOptionsForLesson(selectedUniteKonuSinif, lesson);
  const customLessonData = getCustomUnitTopicLessonData(selectedUniteKonuSinif, lesson);
  const customUnits = Array.isArray(customLessonData.units) ? customLessonData.units : [];

  if (!units.length) {
    listEl.innerHTML = '<div class="exam-history-empty">Henüz ünite yok.</div>';
    return;
  }

  listEl.innerHTML = units.map((unit) => {
    const sourceTag = customUnits.includes(unit) ? 'Eklenen' : 'Sistem';
    const removeBtn = `<button type="button" class="exam-delete-btn" onclick="removeCustomUniteKonuUnit(decodeURIComponent('${encodeURIComponent(unit)}'))">Sil</button>`;
    return `
      <div class="exam-history-item">
        <div>
          <strong>${escapeHtml(unit)}</strong>
          <div class="exam-history-meta">${sourceTag}</div>
        </div>
        <div class="exam-history-actions">${removeBtn}</div>
      </div>
    `;
  }).join('');
}

function renderUniteKonuTopicList() {
  const listEl = document.getElementById('uniteKonuTopicList');
  const lesson = document.getElementById('uniteKonuLesson')?.value || '';
  const unit = document.getElementById('uniteKonuUnitSelect')?.value || '';
  if (!listEl) return;

  if (!lesson) {
    listEl.innerHTML = '<div class="exam-history-empty">Önce ders seçin.</div>';
    return;
  }
  const customLessonData = getCustomUnitTopicLessonData(selectedUniteKonuSinif, lesson);
  const rows = [];

  if (unit) {
    const selectedTopics = getTopicOptionsForLesson(selectedUniteKonuSinif, lesson, unit).filter((name) => name && name !== 'Konu seçiniz');
    const customTopics = Array.isArray(customLessonData.topicsByUnit?.[unit]) ? customLessonData.topicsByUnit[unit] : [];
    selectedTopics.forEach((topic) => {
      rows.push({
        topic,
        unitName: unit,
        deletable: customTopics.includes(topic)
      });
    });
  } else {
    const units = getUnitOptionsForLesson(selectedUniteKonuSinif, lesson);

    if (units.length) {
      units.forEach((unitName) => {
        const unitTopics = getTopicOptionsForLesson(selectedUniteKonuSinif, lesson, unitName).filter((name) => name && name !== 'Konu seçiniz');
        const customTopics = Array.isArray(customLessonData.topicsByUnit?.[unitName]) ? customLessonData.topicsByUnit[unitName] : [];
        unitTopics.forEach((topic) => {
          rows.push({
            topic,
            unitName,
            deletable: customTopics.includes(topic)
          });
        });
      });
    }

    const generalTopics = Array.isArray(customLessonData.generalTopics) ? customLessonData.generalTopics : [];
    generalTopics.forEach((topic) => {
      rows.push({
        topic,
        unitName: '',
        deletable: true
      });
    });
  }

  const uniqueRows = [];
  const seen = new Set();
  rows.forEach((row) => {
    const key = `${row.unitName || 'GENEL'}|||${row.topic}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniqueRows.push(row);
  });

  if (!uniqueRows.length) {
    listEl.innerHTML = '<div class="exam-history-empty">Henüz konu yok.</div>';
    return;
  }

  listEl.innerHTML = uniqueRows.map((row) => {
    const removeBtn = `<button type="button" class="exam-delete-btn" onclick="removeCustomUniteKonuTopic(decodeURIComponent('${encodeURIComponent(row.unitName)}'), decodeURIComponent('${encodeURIComponent(row.topic)}'))">Sil</button>`;
    return `
      <div class="exam-history-item">
        <div>
          <strong>${escapeHtml(row.topic)}</strong>
          <div class="exam-history-meta">${row.unitName ? `Ünite: ${escapeHtml(row.unitName)}` : 'Genel konu'}${row.deletable ? ' · Eklenen' : ' · Sistem'}</div>
        </div>
        <div class="exam-history-actions">${removeBtn}</div>
      </div>
    `;
  }).join('');
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
  history.replaceState({ sayfaId: 'promoPage' }, "", "#promoPage");
  refreshRegisterSpamGuards();
  loadSavedResourceSuggestions();
  startUserCountAutoRefresh();
  loadKokpitNotebookNotes();
  renderKokpitTodoDate();
  attemptAutoLogin().then(auto => {
    if (!auto) {
      sayfaAcs('promoPage', false);
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

let kokpitTodoDateOffset = 0;
let kokpitNotebookNotes = {};
let kokpitAgendaWeekOffset = 0;
let kokpitAgendaEvents = {};
let kokpitAgendaActiveSlotKey = null;

function getKokpitNotebookStorageKey() {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail') || 'default';
  return `kokpit_notebook_${email}`;
}

function loadKokpitNotebookNotes() {
  const raw = localStorage.getItem(getKokpitNotebookStorageKey());
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    kokpitNotebookNotes = parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    kokpitNotebookNotes = {};
  }
}

function saveKokpitNotebookNotes() {
  localStorage.setItem(getKokpitNotebookStorageKey(), JSON.stringify(kokpitNotebookNotes));
}

function getKokpitActiveDate() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + kokpitTodoDateOffset);
  return base;
}

function getKokpitDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderKokpitTodoDate() {
  const dateEl = document.getElementById('kokpitTodoDate');
  const noteEl = document.getElementById('kokpitNotebookText');
  if (!dateEl) return;

  const base = getKokpitActiveDate();

  const text = base.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  });

  dateEl.textContent = text.replace(/(^|\s)\S/g, (t) => t.toUpperCase());

  if (noteEl) {
    const key = getKokpitDateKey(base);
    noteEl.value = String(kokpitNotebookNotes[key] || '');
  }
}

function changeKokpitTodoDate(step) {
  kokpitTodoDateOffset += Number(step) || 0;
  renderKokpitTodoDate();
}

function onKokpitNotebookInput() {
  const noteEl = document.getElementById('kokpitNotebookText');
  if (!noteEl) return;

  const key = getKokpitDateKey(getKokpitActiveDate());
  const value = noteEl.value || '';

  if (value.trim()) {
    kokpitNotebookNotes[key] = value;
  } else {
    delete kokpitNotebookNotes[key];
  }

  saveKokpitNotebookNotes();
}

function getKokpitAgendaStorageKey() {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail') || 'default';
  return `kokpit_agenda_${email}`;
}

function loadKokpitAgendaEvents() {
  const raw = localStorage.getItem(getKokpitAgendaStorageKey());
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    kokpitAgendaEvents = parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    kokpitAgendaEvents = {};
  }
}

function saveKokpitAgendaEvents() {
  localStorage.setItem(getKokpitAgendaStorageKey(), JSON.stringify(kokpitAgendaEvents));
}

function getKokpitAgendaWeekStart(offset = kokpitAgendaWeekOffset) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const mondayOffset = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - mondayOffset + ((Number(offset) || 0) * 7));
  return base;
}

function getKokpitAgendaWeekDates(offset = kokpitAgendaWeekOffset) {
  const start = getKokpitAgendaWeekStart(offset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getKokpitAgendaSlotKey(dateKey, hour) {
  return `${dateKey}_${String(hour).padStart(2, '0')}`;
}

function getKokpitAgendaTypeSlug(type) {
  const normalized = String(type || 'Diger')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '') || 'diger';
}

function getKokpitAgendaTypeClass(type) {
  return `type-${getKokpitAgendaTypeSlug(type)}`;
}

function formatKokpitAgendaWeekLabel(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const startText = startDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const endText = endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startText} - ${endText}`.replace(/\./g, '');
}

function formatKokpitAgendaDateTime(dateObj, hour, allDay = false) {
  const dateText = dateObj.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  }).replace(/(^|\s)\S/g, (t) => t.toUpperCase());
  const hourText = `${String(hour).padStart(2, '0')}:00`;
  return allDay ? `${dateText} • Tüm gün` : `${dateText} • ${hourText}`;
}

function formatKokpitAgendaSlotKeyLabel(dateKey, hour) {
  const parts = String(dateKey || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return `${dateKey} ${String(hour).padStart(2, '0')}:00`;
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  return formatKokpitAgendaDateTime(dateObj, hour, false);
}

function renderKokpitAgenda() {
  const gridEl = document.getElementById('kokpitAgendaGrid');
  const summaryEl = document.getElementById('kokpitAgendaSummary');
  const labelEl = document.getElementById('kokpitAgendaWeekLabel');
  if (!gridEl || !summaryEl || !labelEl) return;

  const weekDates = getKokpitAgendaWeekDates();
  const weekStart = weekDates[0];
  labelEl.textContent = formatKokpitAgendaWeekLabel(weekStart);

  const dateKeys = weekDates.map((dateObj) => getKokpitDateKey(dateObj));
  const weekEvents = dateKeys.reduce((count, dateKey) => {
    return count + Object.keys(kokpitAgendaEvents).filter((slotKey) => slotKey.startsWith(`${dateKey}_`) && kokpitAgendaEvents[slotKey]).length;
  }, 0);
  summaryEl.textContent = weekEvents > 0 ? `Bu hafta ${weekEvents} olay planlandı.` : 'Henüz planlanmış olay yok.';

  let html = '<div class="agenda-head-cell">Saat</div>';
  weekDates.forEach((dateObj) => {
    const dayLabel = dateObj.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' }).replace(/(^|\s)\S/g, (t) => t.toUpperCase());
    html += `<div class="agenda-head-cell">${dayLabel}</div>`;
  });

  for (let hour = 9; hour <= 23; hour += 1) {
    const hourLabel = `${String(hour).padStart(2, '0')}:00`;
    html += `<div class="agenda-hour-cell">${hourLabel}</div>`;

    weekDates.forEach((dateObj) => {
      const dateKey = getKokpitDateKey(dateObj);
      const slotKey = getKokpitAgendaSlotKey(dateKey, hour);
      const event = kokpitAgendaEvents[slotKey];
      const typeClass = event ? getKokpitAgendaTypeClass(event.type) : '';
      const eventTitle = event ? escapeHtml(event.title || event.type || 'Olay') : '<span class="agenda-slot-empty-mark">+</span>';
      const eventMeta = event ? `${escapeHtml(event.type || 'Olay')}${event.location ? ` • ${escapeHtml(event.location)}` : ''}` : '';
      html += `
        <button type="button" class="agenda-slot ${event ? 'has-event ' + typeClass : 'empty'}" onclick="openKokpitAgendaSlot('${dateKey}', ${hour})" aria-label="${escapeHtml(formatKokpitAgendaDateTime(dateObj, hour, false))}">
          <div class="agenda-slot-time">${hourLabel}</div>
          <div class="agenda-slot-title">${eventTitle}</div>
          ${event ? `<div class="agenda-slot-meta">${eventMeta}</div>` : ''}
        </button>
      `;
    });
  }

  gridEl.innerHTML = html;
}

function changeKokpitAgendaWeek(step) {
  kokpitAgendaWeekOffset += Number(step) || 0;
  renderKokpitAgenda();
}

function openKokpitAgendaSlot(dateKey, hour) {
  const slotKey = getKokpitAgendaSlotKey(dateKey, hour);
  const event = kokpitAgendaEvents[slotKey] || null;
  kokpitAgendaActiveSlotKey = slotKey;

  const parts = String(dateKey || '').split('-').map(Number);
  const dateObj = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
  const slotLabel = formatKokpitAgendaSlotKeyLabel(dateKey, hour);

  const slotLabelEl = document.getElementById('kokpitAgendaModalSlot');
  const dateTimeEl = document.getElementById('kokpitAgendaDateTime');
  const typeEl = document.getElementById('kokpitAgendaType');
  const titleEl = document.getElementById('kokpitAgendaTitle');
  const locationEl = document.getElementById('kokpitAgendaLocation');
  const noteEl = document.getElementById('kokpitAgendaNote');
  const allDayEl = document.getElementById('kokpitAgendaAllDay');
  const deleteBtn = document.getElementById('kokpitAgendaDeleteBtn');

  if (slotLabelEl) slotLabelEl.textContent = slotLabel;
  if (dateTimeEl) dateTimeEl.value = event ? formatKokpitAgendaDateTime(dateObj, hour, !!event.allDay) : formatKokpitAgendaDateTime(dateObj, hour, false);
  if (typeEl) {
    typeEl.value = event && event.type ? event.type : '';
    if (!event || !event.type) {
      typeEl.selectedIndex = 0;
    }
  }
  if (titleEl) titleEl.value = event && event.title ? event.title : '';
  if (locationEl) locationEl.value = event && event.location ? event.location : '';
  if (noteEl) noteEl.value = event && event.note ? event.note : '';
  if (allDayEl) allDayEl.checked = !!(event && event.allDay);
  if (deleteBtn) deleteBtn.style.display = event ? 'inline-flex' : 'none';

  modalAc('kokpitAgendaModal');
}

function saveKokpitAgendaEventFromModal() {
  if (!kokpitAgendaActiveSlotKey) {
    alert('Önce bir saat seçin.');
    return;
  }

  const typeEl = document.getElementById('kokpitAgendaType');
  const titleEl = document.getElementById('kokpitAgendaTitle');
  const locationEl = document.getElementById('kokpitAgendaLocation');
  const noteEl = document.getElementById('kokpitAgendaNote');
  const allDayEl = document.getElementById('kokpitAgendaAllDay');

  const slotParts = kokpitAgendaActiveSlotKey.split('_');
  const dateKey = slotParts.slice(0, 3).join('-');
  const hour = Number(slotParts[3] || 0);
  const type = typeEl ? typeEl.value : 'Toplantı';
  const title = titleEl ? titleEl.value.trim() : '';
  const location = locationEl ? locationEl.value.trim() : '';
  const note = noteEl ? noteEl.value.trim() : '';
  const allDay = !!(allDayEl && allDayEl.checked);

  if (!type) {
    alert('Lütfen olay türü seçin.');
    return;
  }

  kokpitAgendaEvents[kokpitAgendaActiveSlotKey] = {
    dateKey,
    hour,
    type,
    title: title || type,
    location,
    note,
    allDay,
    savedAt: Date.now()
  };

  saveKokpitAgendaEvents();
  renderKokpitAgenda();
  modalKapat('kokpitAgendaModal');
}

function deleteKokpitAgendaEvent() {
  if (!kokpitAgendaActiveSlotKey) return;

  delete kokpitAgendaEvents[kokpitAgendaActiveSlotKey];
  saveKokpitAgendaEvents();
  renderKokpitAgenda();
  modalKapat('kokpitAgendaModal');
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
  const classLevel = document.getElementById('ogrenciSinifInput')?.value || '8';
  if (!name) {
    alert('Öğrenci adı girin.');
    return;
  }

  const student = {
    id: Date.now(),
    name,
    email,
    phone,
    classLevel,
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
  const classInput = document.getElementById('ogrenciSinifInput');
  if (classInput) classInput.value = '8';
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
    genel: document.getElementById('studentInfoBtnGenel'),
    kaynak: document.getElementById('studentInfoBtnKaynak'),
    cozulen: document.getElementById('studentInfoBtnCozulen'),
    veli: document.getElementById('studentInfoBtnVeli')
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
  const kaynakIlerlemeEl = document.getElementById('tabKaynakIlerleme');
  const veliBilgiEl = document.getElementById('tabVeliBilgi');
  const cozulenSoruEl = document.getElementById('tabCozulenSoru');
  const noteEl = document.getElementById('studentInfoNote');

  if (!detailEl || !programEl || !bransEl || !genelEl || !kaynakIlerlemeEl || !veliBilgiEl || !cozulenSoruEl) return;

  detailEl.style.display = 'block';
  programEl.style.display = 'none';
  bransEl.style.display = 'none';
  genelEl.style.display = 'none';
  kaynakIlerlemeEl.style.display = 'none';
  veliBilgiEl.style.display = 'none';
  cozulenSoruEl.style.display = 'none';

  if (section === 'program') {
    programEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Program bölümü aşağıda açıldı. Buradan öğrenci için haftalık planı düzenleyebilirsiniz.';
  } else if (section === 'brans') {
    bransEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Branş denemeleri bölümü aşağıda açıldı. Öğrenciye özel deneme kayıtlarını buradan girebilirsiniz.';
  } else if (section === 'genel') {
    genelEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Genel denemeler bölümü aşağıda açıldı. Ders bazlı sonuçları girip kaydedebilirsiniz.';
  } else if (section === 'kaynak') {
    kaynakIlerlemeEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Kaynak ve konu ilerleme bölümü aşağıda açıldı. Ders ve üniteye göre konu takibi yapabilirsiniz.';
  } else if (section === 'veli') {
    veliBilgiEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Veli bilgisi bölümü aşağıda açıldı. Veli adı, telefonu ve e-posta bilgisini kaydedebilirsiniz.';
  } else if (section === 'cozulen') {
    cozulenSoruEl.style.display = 'block';
    if (noteEl) noteEl.textContent = 'Çözülen soru sayısı bölümü aşağıda açıldı. Ders, ünite, konu ve kaynağa göre giriş yapabilirsiniz.';
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
    const classPart = getClassDisplayLabel(student.classLevel);
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
  bransTopicStats = {};
  const classDisplayEl = document.getElementById('bransExamClassDisplay');
  if (classDisplayEl) {
    classDisplayEl.value = getClassDisplayLabel(student.classLevel || '8');
  }
  updateBransUnitOptions();
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

let kaynakIlerlemeState = {
  lesson: '',
  data: {},
  resourcePool: []
};

const KAYNAK_DURUM_OPTIONS = ['Konu Bitti', 'Çalışıyor', 'Konu Anlaşılmadı', 'Daha Sonra Yapılacak', 'Konuya Gelinmedi'];

function getKaynakIlerlemeStorageKey(lesson) {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail') || 'default';
  const studentKey = activeStudentId ? String(activeStudentId) : 'none';
  return `kaynak_ilerleme_${email}_${studentKey}_${lesson || 'none'}`;
}

function readKaynakIlerlemeData(lesson) {
  const key = getKaynakIlerlemeStorageKey(lesson);
  const raw = localStorage.getItem(key);
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') {
      return { data: {}, resourcePool: [] };
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'data') || Object.prototype.hasOwnProperty.call(parsed, 'resourcePool')) {
      return {
        data: parsed.data && typeof parsed.data === 'object' ? parsed.data : {},
        resourcePool: Array.isArray(parsed.resourcePool) ? parsed.resourcePool : []
      };
    }
    return { data: parsed, resourcePool: [] };
  } catch (e) {
    return { data: {}, resourcePool: [] };
  }
}

function writeKaynakIlerlemeData(lesson, payload) {
  const key = getKaynakIlerlemeStorageKey(lesson);
  localStorage.setItem(key, JSON.stringify({
    data: payload?.data || {},
    resourcePool: Array.isArray(payload?.resourcePool) ? payload.resourcePool : []
  }));
}

function saveKaynakIlerlemeState(showAlert = false) {
  if (!kaynakIlerlemeState.lesson) {
    if (showAlert) alert('Önce ders seçin.');
    return;
  }

  writeKaynakIlerlemeData(kaynakIlerlemeState.lesson, kaynakIlerlemeState);
  if (showAlert) alert('Kaynak/Konu ilerleme kaydı yapıldı.');
}

function kaynakTopicKey(unit, topic) {
  return `${unit || 'GENEL'}|||${topic || ''}`;
}

function parseKaynakTopicKey(topicKey) {
  const parts = String(topicKey || '').split('|||');
  return {
    unit: parts[0] || 'GENEL',
    topic: parts[1] || ''
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initKaynakIlerlemePanelForStudent(student) {
  const classLevel = student && student.classLevel ? String(student.classLevel) : '8';
  const classEl = document.getElementById('kaynakIlerlemeClass');
  const lessonEl = document.getElementById('kaynakIlerlemeLesson');

  if (classEl) classEl.value = getClassDisplayLabel(classLevel);
  if (!lessonEl) return;

  lessonEl.innerHTML = '<option value="">Ders seçin</option>';
  getLessonOptionsForClass(classLevel).forEach((lesson) => {
    const opt = document.createElement('option');
    opt.value = lesson;
    opt.textContent = lesson;
    lessonEl.appendChild(opt);
  });

  if (!lessonEl.value && lessonEl.options.length > 1) {
    lessonEl.value = lessonEl.options[1].value;
  }

  onKaynakLessonChange();
}

function onKaynakLessonChange() {
  saveKaynakIlerlemeState(false);

  const lessonEl = document.getElementById('kaynakIlerlemeLesson');
  if (!lessonEl) return;

  const lesson = lessonEl.value || '';

  if (!lesson) {
    kaynakIlerlemeState = { lesson: '', data: {}, resourcePool: [] };
    renderKaynakIlerlemeRows();
    return;
  }

  kaynakIlerlemeState.lesson = lesson;
  const stored = readKaynakIlerlemeData(lesson);
  kaynakIlerlemeState.data = stored.data;
  kaynakIlerlemeState.resourcePool = stored.resourcePool;
  renderKaynakIlerlemeRows();
}

function renderKaynakIlerlemeRows() {
  const container = document.getElementById('kaynakIlerlemeRows');
  const barEl = document.getElementById('kaynakIlerlemeBar');
  const metaLeft = document.getElementById('kaynakIlerlemeMetaLeft');
  const metaRight = document.getElementById('kaynakIlerlemeMetaRight');
  const lessonEl = document.getElementById('kaynakIlerlemeLesson');
  if (!container || !barEl || !metaLeft || !metaRight || !lessonEl) return;

  const lesson = lessonEl.value || '';
  const classLevel = getActiveStudentClassLevel();

  if (!lesson) {
    container.innerHTML = 'Ders seçildikten sonra konu listesi burada görünecek.';
    barEl.style.width = '0%';
    metaLeft.textContent = 'Tamamlanan: 0 / 0';
    metaRight.textContent = '%0';
    return;
  }

  if (kaynakIlerlemeState.lesson !== lesson) {
    saveKaynakIlerlemeState(false);
    kaynakIlerlemeState.lesson = lesson;
    const stored = readKaynakIlerlemeData(lesson);
    kaynakIlerlemeState.data = stored.data;
    kaynakIlerlemeState.resourcePool = stored.resourcePool;
  }

  renderKaynakGlobalResources(classLevel, lesson);

  const units = getUnitOptionsForLesson(classLevel, lesson);
  const unitList = units.length ? units : ['GENEL'];
  const availableResources = getResourceOptionsForClass(classLevel, lesson);

  const unitBlocks = unitList.map((unit) => {
    const unitTopics = getTopicOptionsForLesson(classLevel, lesson, unit === 'GENEL' ? '' : unit).filter((t) => t && t !== 'Konu seçiniz');
    if (!unitTopics.length) return '';

    const topicRows = unitTopics.map((topic) => {
      const topicKey = kaynakTopicKey(unit, topic);
      const entry = kaynakIlerlemeState.data[topicKey] || { status: 'Konuya Gelinmedi', doneResources: [] };
      if (!Array.isArray(entry.doneResources)) entry.doneResources = [];
      const finishedDate = entry.finishedDate ? formatExamDate(String(entry.finishedDate)) : '';
      const selectOptions = KAYNAK_DURUM_OPTIONS
        .map((opt) => `<option value="${escapeHtml(opt)}" ${entry.status === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`)
        .join('');
      const selectedResources = Array.isArray(kaynakIlerlemeState.resourcePool) ? kaynakIlerlemeState.resourcePool : [];
      const chipsHtml = selectedResources.length
        ? selectedResources.map((res) => {
            const isDone = entry.doneResources.includes(res) ? 'checked' : '';
            return `<label class="progress-resource-chip progress-resource-checkable"><input type="checkbox" data-topic-key="${escapeHtml(topicKey)}" data-resource="${escapeHtml(res)}" ${isDone} onchange="onKaynakResourceDoneToggle(this)"><span>${escapeHtml(res)}</span></label>`;
          }).join('')
        : '<span class="progress-resource-muted">Kaynak yok</span>';
      const rowPercent = getKaynakTopicPercent(entry, selectedResources.length);
      const rowColor = getProgressColor(rowPercent);

      return `
      <div class="progress-row">
        <div class="progress-topic">${escapeHtml(topic)}</div>
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${entry.status === 'Konu Bitti' ? `<input type="text" class="input-field" value="${escapeHtml(finishedDate)}" placeholder="GG.AA.YYYY" maxlength="10" oninput="formatDateInput(this)" data-topic-key="${escapeHtml(topicKey)}" onchange="onKaynakFinishedDateChange(this)" style="max-width:138px; margin-bottom:0; padding:8px 10px; font-size:0.78rem;">` : ''}
            <select class="input-field progress-status-select" data-topic-key="${escapeHtml(topicKey)}" onchange="onKaynakStatusChange(this)" style="margin-bottom:0;">${selectOptions}</select>
          </div>
        </div>
        <div class="progress-resource-cell">
          <div class="progress-resource-list">${chipsHtml}</div>
        </div>
        <div class="progress-percent-wrap">
          <div class="progress-percent-track"><div class="progress-percent-fill" style="width:${rowPercent}%; background:${rowColor};"></div></div>
          <div class="progress-percent-text">%${rowPercent}</div>
        </div>
      </div>
    `;
    }).join('');

    return `
    <div class="progress-unit-block">
      <div class="progress-unit-title">${escapeHtml(unit)}</div>
      ${topicRows}
    </div>
  `;
  }).filter(Boolean).join('');

  if (!unitBlocks) {
    container.innerHTML = 'Bu seçim için konu bulunamadı.';
    barEl.style.width = '0%';
    metaLeft.textContent = 'Tamamlanan: 0 / 0';
    metaRight.textContent = '%0';
    return;
  }

  container.innerHTML = unitBlocks;

  const allTopicKeys = unitList.flatMap((unit) => {
    return getTopicOptionsForLesson(classLevel, lesson, unit === 'GENEL' ? '' : unit)
      .filter((t) => t && t !== 'Konu seçiniz')
      .map((topic) => kaynakTopicKey(unit, topic));
  });
  updateKaynakProgressMetrics(allTopicKeys, Array.isArray(kaynakIlerlemeState.resourcePool) ? kaynakIlerlemeState.resourcePool.length : 0);
}

function onKaynakStatusChange(selectEl) {
  const topicKey = selectEl?.dataset?.topicKey || '';
  if (!topicKey) return;

  const current = kaynakIlerlemeState.data[topicKey] || { status: 'Konuya Gelinmedi', doneResources: [] };
  current.status = selectEl.value;
  if (!Array.isArray(current.doneResources)) current.doneResources = [];
  if (current.status === 'Konu Bitti' && !current.finishedDate) {
    current.finishedDate = getTodayTrDate();
  }

  kaynakIlerlemeState.data[topicKey] = current;
  saveKaynakIlerlemeState(false);
  renderKaynakIlerlemeRows();
}

function onKaynakFinishedDateChange(inputEl) {
  const topicKey = inputEl?.dataset?.topicKey || '';
  if (!topicKey) return;

  const current = kaynakIlerlemeState.data[topicKey] || { status: 'Konuya Gelinmedi', doneResources: [] };
  if (!Array.isArray(current.doneResources)) current.doneResources = [];
  const rawDate = String(inputEl.value || '').trim();
  current.finishedDate = rawDate ? formatExamDate(rawDate) : '';

  kaynakIlerlemeState.data[topicKey] = current;
  saveKaynakIlerlemeState(false);
}

function onKaynakResourceDoneToggle(checkEl) {
  const topicKey = checkEl?.dataset?.topicKey || '';
  const resource = checkEl?.dataset?.resource || '';
  if (!topicKey || !resource) return;

  const current = kaynakIlerlemeState.data[topicKey] || { status: 'Konuya Gelinmedi', doneResources: [] };
  if (!Array.isArray(current.doneResources)) current.doneResources = [];

  if (checkEl.checked) {
    if (!current.doneResources.includes(resource)) current.doneResources.push(resource);
  } else {
    current.doneResources = current.doneResources.filter((item) => item !== resource);
  }

  kaynakIlerlemeState.data[topicKey] = current;
  saveKaynakIlerlemeState(false);
  renderKaynakIlerlemeRows();
}

function renderKaynakGlobalResources(classLevel, lesson) {
  const selectEl = document.getElementById('kaynakIlerlemeResourceSelect');
  const selectedWrap = document.getElementById('kaynakIlerlemeSelectedResources');
  if (!selectEl || !selectedWrap) return;

  const options = getResourceOptionsForClass(classLevel, lesson);
  selectEl.innerHTML = options.length
    ? ['<option value="">Kaynak secin</option>']
      .concat(options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`))
      .join('')
    : '<option value="">Kaynak bulunamadi</option>';

  const selected = Array.isArray(kaynakIlerlemeState.resourcePool) ? kaynakIlerlemeState.resourcePool : [];
  selectedWrap.innerHTML = selected.length
    ? selected.map((name, idx) => `<span class="progress-resource-chip">${escapeHtml(name)} <button type="button" class="progress-resource-remove" data-index="${idx}" data-resource="${escapeHtml(name)}" onclick="removeGlobalKaynakResource(this)">x</button></span>`).join('')
    : '<span class="progress-resource-muted">Kaynak secilmedi</span>';
}

let kaynakSilmeState = {
  resource: '',
  index: -1
};

function onKaynakSilScopeChange() {
  const scopeEl = document.getElementById('kaynakSilScope');
  const unitWrap = document.getElementById('kaynakSilUnitWrap');
  const topicWrap = document.getElementById('kaynakSilTopicWrap');
  if (!scopeEl || !unitWrap || !topicWrap) return;

  const scope = scopeEl.value;
  unitWrap.style.display = scope === 'unit' || scope === 'topic' ? 'block' : 'none';
  topicWrap.style.display = scope === 'topic' ? 'block' : 'none';

  if (scope === 'unit' || scope === 'topic') {
    populateKaynakSilUnitOptions();
  }
  if (scope === 'topic') {
    populateKaynakSilTopicOptions();
  }
}

function populateKaynakSilUnitOptions() {
  const unitSelect = document.getElementById('kaynakSilUnitSelect');
  if (!unitSelect) return;
  const classLevel = getActiveStudentClassLevel();
  const lesson = kaynakIlerlemeState.lesson || '';
  const units = getUnitOptionsForLesson(classLevel, lesson);
  const unitList = units.length ? units : ['GENEL'];

  unitSelect.innerHTML = unitList
    .map((unit) => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`)
    .join('');
}

function populateKaynakSilTopicOptions() {
  const unitSelect = document.getElementById('kaynakSilUnitSelect');
  const topicSelect = document.getElementById('kaynakSilTopicSelect');
  if (!unitSelect || !topicSelect) return;

  const selectedUnit = unitSelect.value || '';
  const classLevel = getActiveStudentClassLevel();
  const lesson = kaynakIlerlemeState.lesson || '';
  const topics = getTopicOptionsForLesson(classLevel, lesson, selectedUnit === 'GENEL' ? '' : selectedUnit)
    .filter((topic) => topic && topic !== 'Konu seçiniz');

  topicSelect.innerHTML = topics.length
    ? topics.map((topic) => `<option value="${escapeHtml(kaynakTopicKey(selectedUnit, topic))}">${escapeHtml(topic)}</option>`).join('')
    : '<option value="">Konu bulunamadi</option>';
}

function openKaynakSilmeModal(resource, index) {
  const titleEl = document.getElementById('kaynakSilModalTitle');
  const scopeEl = document.getElementById('kaynakSilScope');
  if (!titleEl || !scopeEl) return;

  kaynakSilmeState.resource = resource || '';
  kaynakSilmeState.index = index;
  titleEl.textContent = `"${resource}" kaynagi nereden silinsin?`;
  scopeEl.value = 'all';
  onKaynakSilScopeChange();
  modalAc('kaynakSilModal');
}

function onKaynakSilUnitChange() {
  const scopeEl = document.getElementById('kaynakSilScope');
  if (scopeEl && scopeEl.value === 'topic') {
    populateKaynakSilTopicOptions();
  }
}

function confirmKaynakSilme() {
  const resource = kaynakSilmeState.resource;
  const index = Number(kaynakSilmeState.index);
  const scopeEl = document.getElementById('kaynakSilScope');
  const unitSelect = document.getElementById('kaynakSilUnitSelect');
  const topicSelect = document.getElementById('kaynakSilTopicSelect');
  if (!resource || Number.isNaN(index) || index < 0 || !scopeEl) return;

  const scope = scopeEl.value;

  if (scope === 'all') {
    if (Array.isArray(kaynakIlerlemeState.resourcePool) && index < kaynakIlerlemeState.resourcePool.length) {
      kaynakIlerlemeState.resourcePool.splice(index, 1);
    }
    Object.keys(kaynakIlerlemeState.data || {}).forEach((topicKey) => {
      const entry = kaynakIlerlemeState.data[topicKey];
      if (!entry || !Array.isArray(entry.doneResources)) return;
      entry.doneResources = entry.doneResources.filter((name) => name !== resource);
    });
  }

  if (scope === 'unit') {
    const selectedUnit = unitSelect ? unitSelect.value : '';
    Object.keys(kaynakIlerlemeState.data || {}).forEach((topicKey) => {
      const parsed = parseKaynakTopicKey(topicKey);
      if (parsed.unit !== selectedUnit) return;
      const entry = kaynakIlerlemeState.data[topicKey];
      if (!entry || !Array.isArray(entry.doneResources)) return;
      entry.doneResources = entry.doneResources.filter((name) => name !== resource);
    });
  }

  if (scope === 'topic') {
    const selectedTopicKey = topicSelect ? topicSelect.value : '';
    const entry = kaynakIlerlemeState.data[selectedTopicKey];
    if (entry && Array.isArray(entry.doneResources)) {
      entry.doneResources = entry.doneResources.filter((name) => name !== resource);
    }
  }

  modalKapat('kaynakSilModal');
  saveKaynakIlerlemeState(false);
  renderKaynakIlerlemeRows();
}

function addGlobalKaynakResource() {
  const selectEl = document.getElementById('kaynakIlerlemeResourceSelect');
  if (!selectEl) return;
  const resource = (selectEl.value || '').trim();
  if (!resource) return;

  if (!Array.isArray(kaynakIlerlemeState.resourcePool)) kaynakIlerlemeState.resourcePool = [];
  if (!kaynakIlerlemeState.resourcePool.includes(resource)) {
    kaynakIlerlemeState.resourcePool.push(resource);
  }

  selectEl.value = '';
  saveKaynakIlerlemeState(false);
  renderKaynakIlerlemeRows();
}

function removeGlobalKaynakResource(btnEl) {
  const index = Number(btnEl?.dataset?.index || -1);
  if (Number.isNaN(index) || index < 0) return;
  if (!Array.isArray(kaynakIlerlemeState.resourcePool)) kaynakIlerlemeState.resourcePool = [];

  const removed = kaynakIlerlemeState.resourcePool[index];
  if (!removed) return;
  openKaynakSilmeModal(removed, index);
}

function getKaynakTopicPercent(entry, totalResources) {
  if (totalResources > 0) {
    const doneCount = Array.isArray(entry?.doneResources)
      ? entry.doneResources.filter((name) => Array.isArray(kaynakIlerlemeState.resourcePool) && kaynakIlerlemeState.resourcePool.includes(name)).length
      : 0;
    return Math.round((doneCount / totalResources) * 100);
  }
  return entry?.status === 'Konu Bitti' ? 100 : entry?.status === 'Çalışıyor' ? 50 : 0;
}

function getProgressColor(percent) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const hue = 8 + Math.round((clamped / 100) * 112);
  return `hsl(${hue}, 78%, 45%)`;
}

function updateKaynakProgressMetrics(topicKeys, totalResources) {
  const barEl = document.getElementById('kaynakIlerlemeBar');
  const metaLeft = document.getElementById('kaynakIlerlemeMetaLeft');
  const metaRight = document.getElementById('kaynakIlerlemeMetaRight');
  if (!barEl || !metaLeft || !metaRight) return;

  const total = topicKeys.length;
  const percents = topicKeys.map((topicKey) => {
    const e = kaynakIlerlemeState.data[topicKey];
    return getKaynakTopicPercent(e || { status: 'Konuya Gelinmedi', doneResources: [] }, totalResources);
  });
  const completed = percents.filter((p) => p >= 100).length;
  const percent = total ? Math.round(percents.reduce((sum, p) => sum + p, 0) / total) : 0;
  barEl.style.width = `${percent}%`;
  barEl.style.background = getProgressColor(percent);
  metaLeft.textContent = `Tamamlanan: ${completed} / ${total}`;
  metaRight.textContent = `%${percent}`;
}

function openStudentKaynakIlerlemePage() {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  kaynakIlerlemeState = { lesson: '', data: {}, resourcePool: [] };
  setStudentDetailSection('kaynak');
  initKaynakIlerlemePanelForStudent(student);
}

function openStudentVeliPage() {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  setStudentDetailSection('veli');
  renderStudentParentInfo(student, 1);
  renderStudentParentInfo(student, 2);
  closeVeliEditMode(1);
  closeVeliEditMode(2);
}

function initCozulenSoruPanelForStudent(student) {
  const classLevel = student && student.classLevel ? String(student.classLevel) : '8';
  const classEl = document.getElementById('cozulenClassDisplay');
  const lessonEl = document.getElementById('cozulenLesson');
  if (classEl) classEl.value = getClassDisplayLabel(classLevel);
  if (!lessonEl) return;

  lessonEl.innerHTML = '<option value="">Ders seçin</option>';
  getLessonOptionsForClass(classLevel).forEach((lesson) => {
    const opt = document.createElement('option');
    opt.value = lesson;
    opt.textContent = lesson;
    lessonEl.appendChild(opt);
  });

  const unitEl = document.getElementById('cozulenUnit');
  const topicEl = document.getElementById('cozulenTopic');
  const sourceEl = document.getElementById('cozulenSource');
  if (unitEl) unitEl.innerHTML = '<option value="">Ünite seçin</option>';
  if (topicEl) topicEl.innerHTML = '<option value="">Konu seçin</option>';
  if (sourceEl) sourceEl.innerHTML = '<option value="">Kaynak seçin</option>';

  const qEl = document.getElementById('cozulenQuestion');
  const cEl = document.getElementById('cozulenCorrect');
  const wEl = document.getElementById('cozulenWrong');
  const bEl = document.getElementById('cozulenBlank');
  const dateEl = document.getElementById('cozulenDate');
  if (qEl) qEl.value = '';
  if (cEl) cEl.value = '';
  if (wEl) wEl.value = '';
  if (bEl) bEl.value = '';
  if (dateEl) dateEl.value = getTodayTrDate();
}

function onCozulenLessonChange() {
  const classLevel = getActiveStudentClassLevel();
  const lesson = document.getElementById('cozulenLesson')?.value || '';
  const unitEl = document.getElementById('cozulenUnit');
  const topicEl = document.getElementById('cozulenTopic');
  const sourceEl = document.getElementById('cozulenSource');
  if (!unitEl || !topicEl || !sourceEl) return;

  const units = getUnitOptionsForLesson(classLevel, lesson);
  if (!lesson) {
    unitEl.innerHTML = '<option value="">Ünite seçin</option>';
    topicEl.innerHTML = '<option value="">Konu seçin</option>';
    sourceEl.innerHTML = '<option value="">Kaynak seçin</option>';
    return;
  }

  if (units.length) {
    unitEl.innerHTML = '<option value="">Ünite seçin</option>';
    units.forEach((unit) => {
      const opt = document.createElement('option');
      opt.value = unit;
      opt.textContent = unit;
      unitEl.appendChild(opt);
    });
  } else {
    unitEl.innerHTML = '<option value="">Ünite yok</option>';
  }

  topicEl.innerHTML = '<option value="">Konu seçin</option>';

  const sources = getResourceOptionsForClass(classLevel, lesson);
  sourceEl.innerHTML = '<option value="">Kaynak seçin</option>';
  sources.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sourceEl.appendChild(opt);
  });

  if (!units.length) {
    const topics = getTopicOptionsForLesson(classLevel, lesson, '').filter((item) => item && item !== 'Konu seçiniz');
    topics.forEach((topic) => {
      const opt = document.createElement('option');
      opt.value = topic;
      opt.textContent = topic;
      topicEl.appendChild(opt);
    });
  }
}

function onCozulenUnitChange() {
  const classLevel = getActiveStudentClassLevel();
  const lesson = document.getElementById('cozulenLesson')?.value || '';
  const unit = document.getElementById('cozulenUnit')?.value || '';
  const topicEl = document.getElementById('cozulenTopic');
  if (!topicEl) return;

  topicEl.innerHTML = '<option value="">Konu seçin</option>';
  if (!lesson) return;

  const topics = getTopicOptionsForLesson(classLevel, lesson, unit).filter((item) => item && item !== 'Konu seçiniz');
  topics.forEach((topic) => {
    const opt = document.createElement('option');
    opt.value = topic;
    opt.textContent = topic;
    topicEl.appendChild(opt);
  });
}

function updateCozulenBlank() {
  const q = Number(document.getElementById('cozulenQuestion')?.value) || 0;
  const d = Number(document.getElementById('cozulenCorrect')?.value) || 0;
  const y = Number(document.getElementById('cozulenWrong')?.value) || 0;
  const b = Math.max(0, q - d - y);
  const blankEl = document.getElementById('cozulenBlank');
  if (blankEl) blankEl.value = String(b);
}

function renderCozulenSoruRecords() {
  const listEl = document.getElementById('cozulenSavedList');
  if (!listEl) return;

  const students = getStoredOgrenciler();
  const student = students.find((s) => s.id === activeStudentId);
  const records = student && Array.isArray(student.cozulenSoruRecords) ? student.cozulenSoruRecords : [];

  if (!records.length) {
    listEl.innerHTML = '<div class="exam-history-empty">Henüz kayıt yok.</div>';
    return;
  }

  listEl.innerHTML = records.slice().reverse().map((item) => {
    const summary = [
      `Soru: ${item.questionCount}`,
      `Doğru: ${item.correct}`,
      `Yanlış: ${item.wrong}`,
      `Boş: ${item.blank}`
    ].join(' • ');
    const solvedDate = item.date ? formatExamDate(item.date) : '-';

    return `
      <div class="exam-history-item">
        <div>
          <strong>${item.lesson || '-'}</strong>
          <div class="exam-history-meta">Tarih: ${solvedDate} • Ünite: ${item.unit || '-'} • Konu: ${item.topic || '-'} • Kaynak: ${item.source || '-'}</div>
        </div>
        <div class="exam-history-meta">${summary}</div>
        <div class="exam-history-actions">
          <button type="button" class="exam-delete-btn" onclick="deleteCozulenSoruRecord(${item.id})">Sil</button>
        </div>
      </div>
    `;
  }).join('');
}

function saveCozulenSoruRecord() {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const lesson = document.getElementById('cozulenLesson')?.value || '';
  const unit = document.getElementById('cozulenUnit')?.value || '';
  const topic = document.getElementById('cozulenTopic')?.value || '';
  const source = document.getElementById('cozulenSource')?.value || '';
  const date = formatExamDate(document.getElementById('cozulenDate')?.value || getTodayTrDate());
  const questionCount = Number(document.getElementById('cozulenQuestion')?.value) || 0;
  const correct = Number(document.getElementById('cozulenCorrect')?.value) || 0;
  const wrong = Number(document.getElementById('cozulenWrong')?.value) || 0;
  const blank = Math.max(0, questionCount - correct - wrong);

  if (!lesson || !topic || !source) {
    alert('Ders, konu ve kaynak seçin.');
    return;
  }

  if (!isValidTrDate(date)) {
    alert('Tarih GG.AA.YYYY formatında olmalı.');
    return;
  }

  const students = getStoredOgrenciler();
  const student = students.find((s) => s.id === activeStudentId);
  if (!student) {
    alert('Öğrenci bulunamadı.');
    return;
  }

  if (!Array.isArray(student.cozulenSoruRecords)) student.cozulenSoruRecords = [];

  student.cozulenSoruRecords.push({
    id: Date.now(),
    lesson,
    unit,
    topic,
    source,
    date,
    questionCount,
    correct,
    wrong,
    blank
  });

  setStoredOgrenciler(students);
  renderCozulenSoruRecords();
  alert('Çözülen soru kaydı eklendi.');
}

function deleteCozulenSoruRecord(recordId) {
  if (!activeStudentId) return;
  const students = getStoredOgrenciler();
  const student = students.find((s) => s.id === activeStudentId);
  if (!student || !Array.isArray(student.cozulenSoruRecords)) return;

  student.cozulenSoruRecords = student.cozulenSoruRecords.filter((item) => item.id !== Number(recordId));
  setStoredOgrenciler(students);
  renderCozulenSoruRecords();
}

function indirTumCozulenSorularPdf() {
  if (!activeStudentId) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  const students = getStoredOgrenciler();
  const student = students.find((s) => s.id === activeStudentId);
  const records = student && Array.isArray(student.cozulenSoruRecords) ? student.cozulenSoruRecords : [];

  if (!records.length) {
    alert('İndirilecek çözülen soru kaydı bulunamadı.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
    return;
  }

  const studentName = student && student.name ? student.name : 'Ogrenci';
  const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
  const marginLeft = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = 510;
  let y = 44;

  const ensureSpace = (needed = 80) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 44;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pdfSafeText('Cozulen Soru Raporu'), marginLeft, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(pdfSafeText(`Ogrenci: ${studentName}`), marginLeft, y);
  y += 16;
  doc.text(pdfSafeText(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`), marginLeft, y);
  y += 22;

  records.forEach((item, index) => {
    ensureSpace(120);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(pdfSafeText(`${index + 1}. Kayit`), marginLeft, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(pdfSafeText(`Tarih: ${formatExamDate(item.date || '')}`), marginLeft, y);
    y += 14;
    doc.text(pdfSafeText(`Ders: ${item.lesson || '-'}`), marginLeft, y);
    y += 14;
    doc.text(pdfSafeText(`Unite: ${item.unit || '-'}`), marginLeft, y);
    y += 14;
    doc.text(pdfSafeText(`Konu: ${item.topic || '-'}`), marginLeft, y);
    y += 14;
    doc.text(pdfSafeText(`Kaynak: ${item.source || '-'}`), marginLeft, y);
    y += 14;

    const summaryLine = `Soru: ${Number(item.questionCount || 0)}   Dogru: ${Number(item.correct || 0)}   Yanlis: ${Number(item.wrong || 0)}   Bos: ${Number(item.blank || 0)}`;
    const wrapped = doc.splitTextToSize(pdfSafeText(summaryLine), maxWidth);
    doc.text(wrapped, marginLeft, y);
    y += wrapped.length * 12 + 8;

    doc.setDrawColor(220, 226, 232);
    doc.line(marginLeft, y, 555, y);
    y += 14;
  });

  const safeName = studentName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  doc.save(`${safeName || 'ogrenci'}_cozulen_soru_raporu.pdf`);
}

function openStudentCozulenSoruPage() {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  setStudentDetailSection('cozulen');
  initCozulenSoruPanelForStudent(student);
  renderCozulenSoruRecords();
}

function getStudentParentList(student) {
  if (Array.isArray(student.parentInfos)) {
    const cloned = student.parentInfos.map((item) => ({
      name: item?.name || '',
      phone: item?.phone || '',
      email: item?.email || ''
    }));
    while (cloned.length < 2) cloned.push({ name: '', phone: '', email: '' });
    return cloned.slice(0, 2);
  }

  if (student.parentInfo && typeof student.parentInfo === 'object') {
    return [
      {
        name: student.parentInfo.name || '',
        phone: student.parentInfo.phone || '',
        email: student.parentInfo.email || ''
      },
      { name: '', phone: '', email: '' }
    ];
  }

  return [
    { name: '', phone: '', email: '' },
    { name: '', phone: '', email: '' }
  ];
}

function renderStudentParentInfo(student, slot = 1) {
  const safeSlot = slot === 2 ? 2 : 1;
  const parentList = getStudentParentList(student);
  const parent = parentList[safeSlot - 1] || {};
  const name = (parent.name || '').trim();
  const phone = (parent.phone || '').trim();
  const email = (parent.email || '').trim();

  const viewNameEl = document.getElementById(`veliViewName${safeSlot}`);
  const viewPhoneEl = document.getElementById(`veliViewPhone${safeSlot}`);
  const viewEmailEl = document.getElementById(`veliViewEmail${safeSlot}`);
  const avatarEl = document.getElementById(`veliAvatar${safeSlot}`);
  const nameEl = document.getElementById(`veliNameInput${safeSlot}`);
  const phoneEl = document.getElementById(`veliPhoneInput${safeSlot}`);
  const emailEl = document.getElementById(`veliEmailInput${safeSlot}`);

  if (viewNameEl) viewNameEl.textContent = name || `Veli ${safeSlot} adı girilmedi`;
  if (viewPhoneEl) {
    viewPhoneEl.textContent = phone || 'Bilgi girilmedi';
    viewPhoneEl.classList.toggle('veli-empty-value', !phone);
  }
  if (viewEmailEl) {
    viewEmailEl.textContent = email || 'Bilgi girilmedi';
    viewEmailEl.classList.toggle('veli-empty-value', !email);
  }

  if (avatarEl) {
    const initials = (name || 'Veli')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    avatarEl.textContent = initials || `V${safeSlot}`;
  }

  if (nameEl) nameEl.value = name;
  if (phoneEl) phoneEl.value = phone;
  if (emailEl) emailEl.value = email;
}

function openVeliEditMode(slot = 1) {
  const safeSlot = slot === 2 ? 2 : 1;
  const viewEl = document.getElementById(`veliInfoView${safeSlot}`);
  const editEl = document.getElementById(`veliInfoEdit${safeSlot}`);
  if (viewEl) viewEl.style.display = 'none';
  if (editEl) editEl.style.display = 'block';
}

function closeVeliEditMode(slot = 1) {
  const safeSlot = slot === 2 ? 2 : 1;
  const viewEl = document.getElementById(`veliInfoView${safeSlot}`);
  const editEl = document.getElementById(`veliInfoEdit${safeSlot}`);
  if (viewEl) viewEl.style.display = 'block';
  if (editEl) editEl.style.display = 'none';
}

function saveStudentParentInfo(slot = 1) {
  const safeSlot = slot === 2 ? 2 : 1;
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

  const name = (document.getElementById(`veliNameInput${safeSlot}`)?.value || '').trim();
  const phone = (document.getElementById(`veliPhoneInput${safeSlot}`)?.value || '').trim();
  const email = (document.getElementById(`veliEmailInput${safeSlot}`)?.value || '').trim();

  const parentList = getStudentParentList(student);
  parentList[safeSlot - 1] = { name, phone, email };
  student.parentInfos = parentList;
  student.parentInfo = parentList[0];

  setStoredOgrenciler(students);
  renderStudentParentInfo(student, safeSlot);
  closeVeliEditMode(safeSlot);
  alert(`Veli ${safeSlot} bilgisi kaydedildi.`);
}

function ogrenciProgramunaGit(card) {
  const studentId = card.dataset.id || card.dataset.studentId;
  openStudentInfoPage(studentId);
}

function formatCurrencyTry(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0
  }).format(value);
}

function ensureMuhasebeData(student) {
  if (!student.muhasebe || typeof student.muhasebe !== 'object') {
    student.muhasebe = { payments: [], lessons: [] };
  }
  if (!Array.isArray(student.muhasebe.payments)) student.muhasebe.payments = [];
  if (!Array.isArray(student.muhasebe.lessons)) student.muhasebe.lessons = [];
  return student.muhasebe;
}

function calculateMuhasebeTotals(student) {
  const muhasebe = ensureMuhasebeData(student);
  const total = muhasebe.payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const paid = muhasebe.payments.reduce((sum, item) => sum + (item.paid ? (Number(item.amount) || 0) : 0), 0);
  const pending = Math.max(0, total - paid);
  return { total, paid, pending };
}

let muhasebeAutoScrollToBottom = {
  payments: false,
  lessons: false
};

function renderMuhasebeStudentCards() {
  const container = document.getElementById('muhasebeStudentCards');
  if (!container) return;

  const students = getStoredOgrenciler();
  if (!students.length) {
    container.innerHTML = '<div class="muhasebe-empty">Henüz öğrenci yok.</div>';
    return;
  }

  container.innerHTML = students.map((student) => {
    const totals = calculateMuhasebeTotals(student);
    let statusClass = 'pending';
    let statusText = 'Ödeme yapmadı';

    if (totals.total > 0 && totals.pending === 0) {
      statusClass = 'paid';
      statusText = 'Ödemeler tamamlandı';
    } else if (totals.paid > 0) {
      statusClass = 'partial';
      statusText = 'Kısmi ödeme var';
    }

    const initials = String(student.name || 'Ö')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'Ö';

    return `
      <div class="muhasebe-student-card" onclick="openMuhasebeDetailModal(${student.id})">
        <div class="muhasebe-student-head">
          <div class="muhasebe-student-avatar">${escapeHtml(initials)}</div>
          <div>
            <div class="muhasebe-student-name">${escapeHtml(student.name || 'Öğrenci')}</div>
            <div class="muhasebe-student-meta">${escapeHtml(getClassDisplayLabel(student.classLevel || '-'))}</div>
          </div>
        </div>
        <div class="muhasebe-status-badge ${statusClass}">${statusText}</div>
        <div class="muhasebe-student-meta">Bekleyen: ${formatCurrencyTry(totals.pending)} • Ödendi: ${formatCurrencyTry(totals.paid)}</div>
      </div>
    `;
  }).join('');
}

function openMuhasebeDetailModal(studentId) {
  const students = getStoredOgrenciler();
  const student = students.find((s) => String(s.id) === String(studentId));
  if (!student) {
    alert('Öğrenci bulunamadı.');
    return;
  }

  activeMuhasebeStudentId = student.id;
  const monthEl = document.getElementById('muhasebeNewMonth');
  if (monthEl) monthEl.value = MUHASEBE_MONTHS[new Date().getMonth()];

  const paymentDateEl = document.getElementById('muhasebeNewDate');
  const lessonDateEl = document.getElementById('muhasebeLessonDate');
  if (paymentDateEl) paymentDateEl.value = getTodayTrDate();
  if (lessonDateEl) lessonDateEl.value = getTodayTrDate();

  modalAc('muhasebeDetailModal');
  renderMuhasebeDetailModal();
}

function closeMuhasebeDetailModal() {
  modalKapat('muhasebeDetailModal');
  activeMuhasebeStudentId = null;
}

function renderMuhasebeDetailModal() {
  if (!activeMuhasebeStudentId) return;

  const students = getStoredOgrenciler();
  const student = students.find((s) => s.id === activeMuhasebeStudentId);
  if (!student) return;

  const muhasebe = ensureMuhasebeData(student);
  const totals = calculateMuhasebeTotals(student);

  const titleEl = document.getElementById('muhasebeDetailStudentName');
  const metaEl = document.getElementById('muhasebeDetailStudentMeta');
  const pendingEl = document.getElementById('muhasebePendingAmount');
  const paidEl = document.getElementById('muhasebePaidAmount');
  const paymentListEl = document.getElementById('muhasebePaymentList');
  const lessonListEl = document.getElementById('muhasebeLessonList');

  if (titleEl) titleEl.textContent = student.name || 'Öğrenci';
  if (metaEl) metaEl.textContent = `${getClassDisplayLabel(student.classLevel || '-')} • Ödeme Takibi`;
  if (pendingEl) pendingEl.textContent = formatCurrencyTry(totals.pending);
  if (paidEl) paidEl.textContent = formatCurrencyTry(totals.paid);

  if (paymentListEl) {
    if (!muhasebe.payments.length) {
      paymentListEl.innerHTML = '<div class="muhasebe-empty">Henüz ödeme kaydı yok.</div>';
    } else {
      paymentListEl.innerHTML = muhasebe.payments.map((item) => {
        const paidText = item.paid ? `Ödendi${item.paidAt ? ` (${formatExamDate(item.paidAt)})` : ''}` : 'Bekliyor';
        const paymentDate = formatExamDate(item.date || item.dueDate || '');
        return `
          <div class="muhasebe-row">
            <div class="muhasebe-row-top">
              <div class="muhasebe-row-title">${escapeHtml(item.month || '-')} • ${formatCurrencyTry(item.amount)}</div>
              <div class="muhasebe-row-meta">${paidText}</div>
            </div>
            <div class="muhasebe-row-meta">Tarih: ${paymentDate || '-'} ${item.note ? `• ${escapeHtml(item.note)}` : ''}</div>
            <div class="muhasebe-row-actions">
              <button type="button" class="muhasebe-btn-paid" onclick="toggleMuhasebePaymentPaid(${item.id})">${item.paid ? 'Geri Al' : 'Ödendi'}</button>
              <button type="button" class="muhasebe-btn-delete" onclick="deleteMuhasebePaymentRecord(${item.id})">Sil</button>
            </div>
          </div>
        `;
      }).join('');
    }
    if (muhasebeAutoScrollToBottom.payments) {
      requestAnimationFrame(() => {
        paymentListEl.scrollTop = paymentListEl.scrollHeight;
      });
      muhasebeAutoScrollToBottom.payments = false;
    }
  }

  if (lessonListEl) {
    if (!muhasebe.lessons.length) {
      lessonListEl.innerHTML = '<div class="muhasebe-empty">Henüz ders kaydı yok.</div>';
    } else {
      lessonListEl.innerHTML = muhasebe.lessons.map((item) => `
        <div class="muhasebe-row">
          <div class="muhasebe-row-top">
            <div class="muhasebe-row-title">Ders Kaydı</div>
            <div class="muhasebe-row-meta">${formatExamDate(item.date || '')}</div>
          </div>
          <div class="muhasebe-row-meta">Süre: ${Number(item.duration || 0)} dk</div>
          <div class="muhasebe-row-actions">
            <button type="button" class="muhasebe-btn-delete" onclick="deleteMuhasebeLessonRecord(${item.id})">Sil</button>
          </div>
        </div>
      `).join('');
    }
    if (muhasebeAutoScrollToBottom.lessons) {
      requestAnimationFrame(() => {
        lessonListEl.scrollTop = lessonListEl.scrollHeight;
      });
      muhasebeAutoScrollToBottom.lessons = false;
    }
  }
}

function mutateMuhasebeStudentData(mutator) {
  if (!activeMuhasebeStudentId || typeof mutator !== 'function') return;

  const students = getStoredOgrenciler();
  const student = students.find((s) => s.id === activeMuhasebeStudentId);
  if (!student) return;

  const muhasebe = ensureMuhasebeData(student);
  mutator(muhasebe, student);
  setStoredOgrenciler(students);
  renderMuhasebeDetailModal();
  renderMuhasebeStudentCards();
}

function addMuhasebePaymentRecord() {
  const month = document.getElementById('muhasebeNewMonth')?.value || '';
  const amount = Number(document.getElementById('muhasebeNewAmount')?.value) || 0;
  const date = String(document.getElementById('muhasebeNewDate')?.value || '').trim();
  const note = String(document.getElementById('muhasebeNewNote')?.value || '').trim();

  if (!month || amount <= 0) {
    alert('Ay ve tutar zorunludur.');
    return;
  }
  if (!date || !isValidTrDate(date)) {
    alert('Tarih GG.AA.YYYY formatında olmalı.');
    return;
  }

  muhasebeAutoScrollToBottom.payments = true;
  mutateMuhasebeStudentData((muhasebe) => {
    muhasebe.payments.push({
      id: Date.now(),
      month,
      amount,
      date,
      note,
      paid: false,
      paidAt: ''
    });
  });

  const amountEl = document.getElementById('muhasebeNewAmount');
  const noteEl = document.getElementById('muhasebeNewNote');
  if (amountEl) amountEl.value = '';
  if (noteEl) noteEl.value = '';
}

function toggleMuhasebePaymentPaid(recordId) {
  mutateMuhasebeStudentData((muhasebe) => {
    const item = muhasebe.payments.find((p) => Number(p.id) === Number(recordId));
    if (!item) return;
    item.paid = !item.paid;
    item.paidAt = item.paid ? getTodayTrDate() : '';
  });
}

function deleteMuhasebePaymentRecord(recordId) {
  mutateMuhasebeStudentData((muhasebe) => {
    muhasebe.payments = muhasebe.payments.filter((p) => Number(p.id) !== Number(recordId));
  });
}

function addMuhasebeLessonRecord() {
  const date = String(document.getElementById('muhasebeLessonDate')?.value || '').trim();
  const duration = Number(document.getElementById('muhasebeLessonDuration')?.value) || 0;

  if (!date || !isValidTrDate(date)) {
    alert('Ders tarihi GG.AA.YYYY formatında olmalı.');
    return;
  }

  muhasebeAutoScrollToBottom.lessons = true;
  mutateMuhasebeStudentData((muhasebe) => {
    muhasebe.lessons.push({
      id: Date.now(),
      date,
      duration
    });
  });

  const durationEl = document.getElementById('muhasebeLessonDuration');
  if (durationEl) durationEl.value = '';
}

function deleteMuhasebeLessonRecord(recordId) {
  mutateMuhasebeStudentData((muhasebe) => {
    muhasebe.lessons = muhasebe.lessons.filter((l) => Number(l.id) !== Number(recordId));
  });
}

function indirMuhasebeDetayPdf() {
  if (!activeMuhasebeStudentId) {
    alert('Once bir ogrenci secin.');
    return;
  }

  const students = getStoredOgrenciler();
  const student = students.find((s) => s.id === activeMuhasebeStudentId);
  if (!student) {
    alert('Ogrenci bulunamadi.');
    return;
  }

  const muhasebe = ensureMuhasebeData(student);
  if (!muhasebe.payments.length && !muhasebe.lessons.length) {
    alert('PDF olusturmak icin odeme veya ders kaydi ekleyin.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF kutuphanesi yuklenemedi.');
    return;
  }

  const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 48;

  const pdfMoney = (value) => {
    const amount = Number(value) || 0;
    return `${amount.toLocaleString('tr-TR')} TL`;
  };

  const ensureSpace = (needed = 22) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLine = (text, fontSize = 10, indent = 0, gap = 15) => {
    ensureSpace(gap + 6);
    doc.setFontSize(fontSize);
    doc.text(pdfSafeText(String(text)), margin + indent, y);
    y += gap;
  };

  const normalizeFileName = (value) => String(value || 'ogrenci')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .slice(0, 40) || 'ogrenci';

  doc.setFont('helvetica', 'bold');
  writeLine('Muhasebe Ozeti', 16, 0, 22);
  doc.setFont('helvetica', 'normal');
  writeLine(`Ogrenci: ${student.name || '-'}`, 11);
  writeLine(`Sinif: ${student.classLevel || '-'}`, 11);
  writeLine(`Olusturma Tarihi: ${getTodayTrDate()}`, 11);
  y += 6;

  doc.setFont('helvetica', 'bold');
  writeLine('Eklenen Odemeler', 13, 0, 18);
  doc.setFont('helvetica', 'normal');
  if (!muhasebe.payments.length) {
    writeLine('Kayit yok.', 10, 8);
  } else {
    muhasebe.payments.forEach((item, index) => {
      const paymentDate = formatExamDate(item.date || item.dueDate || '') || '-';
      const paymentStatus = item.paid
        ? `Odendi${item.paidAt ? ` (${formatExamDate(item.paidAt)})` : ''}`
        : 'Bekliyor';
      const mainLine = `${index + 1}. ${item.month || '-'} | ${pdfMoney(item.amount)} | ${paymentDate} | ${paymentStatus}`;
      writeLine(mainLine, 10, 8);
      if (item.note) writeLine(`Aciklama: ${item.note}`, 9, 18, 13);
    });
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  writeLine('Yapilan Dersler', 13, 0, 18);
  doc.setFont('helvetica', 'normal');
  if (!muhasebe.lessons.length) {
    writeLine('Kayit yok.', 10, 8);
  } else {
    muhasebe.lessons.forEach((item, index) => {
      const lessonDate = formatExamDate(item.date || '') || '-';
      writeLine(`${index + 1}. Tarih: ${lessonDate} | Sure: ${Number(item.duration || 0)} dk`, 10, 8);
    });
  }

  const safeName = normalizeFileName(student.name);
  doc.save(`muhasebe-${safeName}.pdf`);
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
  const daySelectEl = document.getElementById('programTaskDaySelect');

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
      `;
      grid.appendChild(card);
    });
  }

  if (addTaskBtn) {
    addTaskBtn.onclick = () => {
      const selectedDay = daySelectEl && daySelectEl.value ? daySelectEl.value : 'pzt';
      openTaskModal(selectedDay);
    };
  }

  updateProgramCalendarHeader();
}

async function exportProgramPdf() {
  const student = getStoredOgrenciler().find(s => s.id === activeStudentId);
  if (!student) {
    alert('Önce bir öğrenci seçin.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = 18;
    const marginRight = 18;
    const marginTop = 14;
    const marginBottom = 14;
    const tableWidth = pdfWidth - marginLeft - marginRight;
    const dayWidth = 70;
    const lessonWidth = 120;
    const unitWidth = 140;
    const topicWidth = 210;
    const typeWidth = 120;
    const sourceWidth = tableWidth - dayWidth - lessonWidth - unitWidth - topicWidth - typeWidth;
    const weekStart = getWeekStartDate(programWeekOffset);
    const weekKey = getWeekStorageKey(programWeekOffset);
    const labels = getWeekDayLabels(weekStart);
    const dayKeys = ['pzt', 'sal', 'car', 'per', 'cum', 'cmt', 'paz'];
    const weekProgram = ensureStudentWeekProgram(student, weekKey);

    const topHeaderHeight = 78;
    const tableHeaderHeight = 24;
    const rowFontSize = 8;
    const headerFontSize = 10;
    const rowLineHeight = 10;
    const normalizeFileName = (value) => String(value || 'ogrenci')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .slice(0, 40) || 'ogrenci';

    const loadLogoDataUrl = async () => {
      try {
        const response = await fetch('icons/icon.png', { cache: 'no-store' });
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Logo okunamadi'));
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        return null;
      }
    };

    const logoDataUrl = await loadLogoDataUrl();

    const splitText = (text, width) => pdf.splitTextToSize(pdfSafeText(String(text || '')), Math.max(20, width - 8));
    const getRowHeight = (task) => {
      if (!task || typeof task !== 'object') return 18;
      const linesPerCell = [
        splitText(task.lesson || 'Ders', lessonWidth),
        splitText(task.unit || '-', unitWidth),
        splitText(task.topic || 'Konu girilmedi', topicWidth),
        splitText(task.type || 'Soru Çözümü', typeWidth),
        splitText(task.source || 'Kaynak yok', sourceWidth)
      ].map((lines) => Math.max(1, lines.length));
      return Math.max(18, (Math.max(...linesPerCell) * rowLineHeight) + 8);
    };

    const drawCell = (x, y, w, h, fillColor, strokeColor) => {
      pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
      pdf.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
      pdf.rect(x, y, w, h, 'FD');
    };

    const drawWrappedText = (text, x, y, width, height, options = {}) => {
      const lines = splitText(text, width);
      const fontSize = options.fontSize || rowFontSize;
      const color = options.color || [31, 41, 55];
      const align = options.align || 'left';
      const lineGap = options.lineGap || rowLineHeight;
      const startY = y + 5;
      const textHeight = lines.length * lineGap;
      let textY = startY + Math.max(0, (height - 10 - textHeight) / 2);

      pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(color[0], color[1], color[2]);
      lines.forEach((line) => {
        pdf.text(line, x + 4, textY, { align, baseline: 'top' });
        textY += lineGap;
      });
    };

    const drawPageHeader = () => {
      const boxX = marginLeft;
      const boxY = marginTop;
      const boxW = tableWidth;
      const boxH = topHeaderHeight;

      pdf.setDrawColor(255, 152, 0);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(boxX, boxY, boxW, boxH, 10, 10, 'FD');

      pdf.setFillColor(16, 32, 64);
      pdf.roundedRect(boxX + 8, boxY + 8, 62, 62, 10, 10, 'F');
      if (logoDataUrl) {
        try {
          pdf.addImage(logoDataUrl, 'PNG', boxX + 10, boxY + 10, 58, 58, undefined, 'FAST');
        } catch (error) {
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.text('PARABOL', boxX + 39, boxY + 31, { align: 'center' });
          pdf.setFontSize(9);
          pdf.text('KOCLUK', boxX + 39, boxY + 45, { align: 'center' });
        }
      } else {
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('PARABOL', boxX + 39, boxY + 31, { align: 'center' });
        pdf.setFontSize(9);
        pdf.text('KOCLUK', boxX + 39, boxY + 45, { align: 'center' });
      }

      pdf.setTextColor(16, 32, 64);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(pdfSafeText('LGS MATEMATIK'), boxX + 86, boxY + 20);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text(pdfSafeText('HAFTALIK CALISMA PROGRAMI'), boxX + 86, boxY + 40);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text(pdfSafeText('Bir gune birden fazla ders ve gorev alinabilir.'), boxX + 86, boxY + 56);

      const rightX = boxX + boxW - 250;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(16, 32, 64);
      pdf.text(pdfSafeText('Ogrenci:'), rightX, boxY + 24);
      pdf.text(pdfSafeText('Hafta:'), rightX, boxY + 42);
      pdf.setDrawColor(210, 217, 226);
      pdf.line(rightX + 46, boxY + 24, boxX + boxW - 16, boxY + 24);
      pdf.line(rightX + 46, boxY + 42, boxX + boxW - 16, boxY + 42);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(pdfSafeText(student.name || '-'), rightX + 52, boxY + 21);
      pdf.text(pdfSafeText(formatWeekRange(weekStart)), rightX + 52, boxY + 39);

      return boxY + boxH + 10;
    };

    const drawTableHeader = (startY) => {
      const headers = [
        { label: 'GÜN', width: dayWidth },
        { label: 'DERS', width: lessonWidth },
        { label: 'ÜNİTE', width: unitWidth },
        { label: 'KONU', width: topicWidth },
        { label: 'PROGRAM TİPİ', width: typeWidth },
        { label: 'KAYNAK', width: sourceWidth }
      ];

      let x = marginLeft;
      headers.forEach((header) => {
        pdf.setFillColor(16, 32, 64);
        pdf.setDrawColor(16, 32, 64);
        pdf.rect(x, startY, header.width, tableHeaderHeight, 'FD');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(headerFontSize);
        pdf.text(pdfSafeText(header.label), x + header.width / 2, startY + 15, { align: 'center' });
        x += header.width;
      });

      return startY + tableHeaderHeight;
    };

    let currentY = drawTableHeader(drawPageHeader());
    const bottomLimit = pdfHeight - marginBottom;
    const dayKeysOrder = ['pzt', 'sal', 'car', 'per', 'cum', 'cmt', 'paz'];

    const startNewPage = () => {
      pdf.addPage();
      currentY = drawTableHeader(drawPageHeader());
    };

    dayKeysOrder.forEach((dayKey, index) => {
      const dayTitle = labels[index] || dayKey.toUpperCase();
      const tasks = Array.isArray(weekProgram[dayKey]) && weekProgram[dayKey].length
        ? weekProgram[dayKey]
        : [{ empty: true }];

      let taskIndex = 0;
      while (taskIndex < tasks.length) {
        if (currentY > bottomLimit - 30) {
          startNewPage();
        }

        const chunk = [];
        let chunkHeight = 0;
        while (taskIndex < tasks.length) {
          const task = tasks[taskIndex];
          const rowHeight = task && !task.empty ? getRowHeight(task) : 18;
          if (currentY + chunkHeight + rowHeight > bottomLimit) {
            break;
          }
          chunk.push({ task, rowHeight });
          chunkHeight += rowHeight;
          taskIndex += 1;
        }

        if (!chunk.length) {
          startNewPage();
          continue;
        }

        const dayCellY = currentY;
        const dayCellHeight = chunkHeight;
        let rowY = currentY;

        drawCell(marginLeft, dayCellY, dayWidth, dayCellHeight, [247, 249, 251], [210, 217, 226]);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(31, 41, 55);
        pdf.text(pdfSafeText(dayTitle), marginLeft + dayWidth / 2, dayCellY + dayCellHeight / 2 + 3, { align: 'center', baseline: 'middle' });

        chunk.forEach(({ task, rowHeight }) => {
          const cellY = rowY;
          const cellX = marginLeft + dayWidth;
          const cells = [
            { width: lessonWidth, value: task && !task.empty ? (task.lesson || 'Ders') : '' },
            { width: unitWidth, value: task && !task.empty ? (task.unit || '-') : '' },
            { width: topicWidth, value: task && !task.empty ? (task.topic || 'Konu girilmedi') : '' },
            { width: typeWidth, value: task && !task.empty ? (task.type || 'Soru Çözümü') : '' },
            { width: sourceWidth, value: task && !task.empty ? (task.source || 'Kaynak yok') : '' }
          ];

          let x = cellX;
          cells.forEach((cell) => {
            drawCell(x, cellY, cell.width, rowHeight, [255, 255, 255], [210, 217, 226]);
            drawWrappedText(cell.value, x, cellY, cell.width, rowHeight, {
              fontSize: 8,
              color: [31, 41, 55],
              bold: cell.width === lessonWidth,
              lineGap: 9
            });
            x += cell.width;
          });

          rowY += rowHeight;
        });

        currentY += chunkHeight;
      }
    });

    const filename = `${normalizeFileName(student.name || 'ogrenci')}_Haftalik_Program.pdf`;
    pdf.save(filename);
  } catch (err) {
    console.error(err);
    alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
  }
}

let pendingTaskDayKey = 'pzt';

const DEFAULT_UNITS_BY_CLASS = {
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

const DEFAULT_TOPICS_BY_CLASS = {
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

let customUnitTopicCache = null;
let customUnitTopicCacheKey = '';

function getUnitTopicStorageKey() {
  const email = currentUserEmail || localStorage.getItem('koclukUserEmail') || sessionStorage.getItem('koclukUserEmail') || 'default';
  return `unit_topic_overrides_${email}`;
}

function readCustomUnitTopicData() {
  const storageKey = getUnitTopicStorageKey();
  if (customUnitTopicCache && typeof customUnitTopicCache === 'object' && customUnitTopicCacheKey === storageKey) {
    return customUnitTopicCache;
  }

  const raw = localStorage.getItem(storageKey);
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    customUnitTopicCache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    customUnitTopicCache = {};
  }

  customUnitTopicCacheKey = storageKey;

  return customUnitTopicCache;
}

function writeCustomUnitTopicData(data) {
  const safeData = data && typeof data === 'object' ? data : {};
  customUnitTopicCache = safeData;
  customUnitTopicCacheKey = getUnitTopicStorageKey();
  localStorage.setItem(customUnitTopicCacheKey, JSON.stringify(safeData));
}

function ensureUniqueList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item || '').trim()).filter(Boolean)));
}

function createEmptyCustomLessonData() {
  return {
    units: [],
    topicsByUnit: {},
    generalTopics: [],
    hiddenUnits: [],
    hiddenTopicsByUnit: {},
    hiddenGeneralTopics: []
  };
}

function normalizeCustomLessonData(raw) {
  const lessonData = createEmptyCustomLessonData();
  if (!raw || typeof raw !== 'object') return lessonData;

  lessonData.units = ensureUniqueList(raw.units);
  lessonData.generalTopics = ensureUniqueList(raw.generalTopics);
  lessonData.hiddenUnits = ensureUniqueList(raw.hiddenUnits);
  lessonData.hiddenGeneralTopics = ensureUniqueList(raw.hiddenGeneralTopics);

  const topicsByUnit = raw.topicsByUnit && typeof raw.topicsByUnit === 'object' ? raw.topicsByUnit : {};
  Object.keys(topicsByUnit).forEach((unitName) => {
    lessonData.topicsByUnit[unitName] = ensureUniqueList(topicsByUnit[unitName]);
  });

  const hiddenTopicsByUnit = raw.hiddenTopicsByUnit && typeof raw.hiddenTopicsByUnit === 'object' ? raw.hiddenTopicsByUnit : {};
  Object.keys(hiddenTopicsByUnit).forEach((unitName) => {
    lessonData.hiddenTopicsByUnit[unitName] = ensureUniqueList(hiddenTopicsByUnit[unitName]);
  });

  return lessonData;
}

function getCustomUnitTopicLessonData(classLevel, lesson) {
  const all = readCustomUnitTopicData();
  const classData = all[String(classLevel)] && typeof all[String(classLevel)] === 'object' ? all[String(classLevel)] : {};
  return normalizeCustomLessonData(classData[String(lesson)]);
}

function updateCustomUnitTopicLessonData(classLevel, lesson, updater) {
  if (!classLevel || !lesson || typeof updater !== 'function') return;

  const all = readCustomUnitTopicData();
  const classKey = String(classLevel);
  const lessonKey = String(lesson);

  if (!all[classKey] || typeof all[classKey] !== 'object') all[classKey] = {};

  const lessonData = normalizeCustomLessonData(all[classKey][lessonKey]);
  updater(lessonData);
  all[classKey][lessonKey] = normalizeCustomLessonData(lessonData);

  writeCustomUnitTopicData(all);
}

function getLessonOptionsForClass(classLevel) {
  const lessonsByClass = {
    '4': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Sosyal Bilgiler', 'İngilizce'],
    '5': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Sosyal Bilgiler', 'İngilizce'],
    '6': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    '7': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    '8': ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    '9': ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    '10': ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    '11': ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'],
    'YKS': ['Matematik', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe', 'Tarih', 'Coğrafya']
  };
  return lessonsByClass[normalizeClassLevel(classLevel)] || ['Matematik', 'Fen Bilimleri', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce'];
}

function getUnitOptionsForLesson(classLevel, lesson) {
  const defaultUnits = (DEFAULT_UNITS_BY_CLASS[String(classLevel)] && DEFAULT_UNITS_BY_CLASS[String(classLevel)][lesson]) || [];
  const customLessonData = getCustomUnitTopicLessonData(classLevel, lesson);
  const visibleDefaultUnits = defaultUnits.filter((unitName) => !customLessonData.hiddenUnits.includes(unitName));
  return ensureUniqueList([].concat(visibleDefaultUnits, customLessonData.units));
}

function getTopicOptionsForLesson(classLevel, lesson, unit) {
  const lessonTopics = DEFAULT_TOPICS_BY_CLASS[String(classLevel)] && DEFAULT_TOPICS_BY_CLASS[String(classLevel)][lesson];
  const customLessonData = getCustomUnitTopicLessonData(classLevel, lesson);

  let defaultTopics = [];
  const isNestedTopicMap = lessonTopics && typeof lessonTopics === 'object' && !Array.isArray(lessonTopics);

  if (isNestedTopicMap) {
    if (unit && !customLessonData.hiddenUnits.includes(unit)) {
      defaultTopics = lessonTopics[unit] || [];
    }
    const hiddenForUnit = Array.isArray(customLessonData.hiddenTopicsByUnit[unit]) ? customLessonData.hiddenTopicsByUnit[unit] : [];
    defaultTopics = defaultTopics.filter((topicName) => !hiddenForUnit.includes(topicName));
  } else if (Array.isArray(lessonTopics)) {
    defaultTopics = unit ? [] : lessonTopics;
    defaultTopics = defaultTopics.filter((topicName) => !customLessonData.hiddenGeneralTopics.includes(topicName));
  }

  const customTopics = unit
    ? (Array.isArray(customLessonData.topicsByUnit[unit]) ? customLessonData.topicsByUnit[unit] : [])
    : customLessonData.generalTopics;

  const merged = ensureUniqueList([].concat(defaultTopics, customTopics));

  if (isNestedTopicMap) {
    return merged;
  }

  return merged.length ? merged : ['Konu seçiniz'];
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

function readLocalStudentRecords() {
  const key = getUserStorageKey();
  const raw = localStorage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeLocalStudentRecords(students) {
  const key = getUserStorageKey();
  localStorage.setItem(key, JSON.stringify(students));
}

function normalizeStudentRecord(student) {
  const safeStudent = student && typeof student === 'object' ? { ...student } : {};
  if (safeStudent.id === undefined || safeStudent.id === null || safeStudent.id === '') {
    safeStudent.id = Date.now() + Math.floor(Math.random() * 1000);
  }
  if (!safeStudent.createdAt) {
    safeStudent.createdAt = safeStudent.updatedAt || Date.now();
  }
  if (!safeStudent.updatedAt) {
    safeStudent.updatedAt = Date.now();
  }
  return safeStudent;
}

function normalizeStudentRecords(students) {
  return Array.isArray(students) ? students.map(normalizeStudentRecord) : [];
}

function mergeStudentRecords(localStudents, remoteStudents) {
  const mergedMap = new Map();
  const addStudents = (list) => {
    list.forEach((student) => {
      const safeStudent = normalizeStudentRecord(student);
      const key = String(safeStudent.id);
      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, safeStudent);
        return;
      }
      const existingUpdatedAt = Number(existing.updatedAt) || 0;
      const incomingUpdatedAt = Number(safeStudent.updatedAt) || 0;
      if (incomingUpdatedAt >= existingUpdatedAt) {
        mergedMap.set(key, { ...existing, ...safeStudent });
      }
    });
  };

  addStudents(localStudents);
  addStudents(remoteStudents);
  return Array.from(mergedMap.values()).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

async function loadStudentRecordsFromCloud() {
  if (!shouldUseFirebaseAuth()) return null;
  const services = getFirebaseServices();
  if (!services || typeof services.loadStudentRecords !== 'function') return null;
  return await services.loadStudentRecords();
}

async function saveStudentRecordsToCloud(students) {
  if (!shouldUseFirebaseAuth()) return;
  const services = getFirebaseServices();
  if (!services || typeof services.saveStudentRecords !== 'function') return;
  await services.saveStudentRecords(normalizeStudentRecords(students));
}

async function syncStudentStorageFromCloud() {
  if (!shouldUseFirebaseAuth()) {
    studentStorageHydrated = true;
    return readLocalStudentRecords();
  }

  if (studentStorageHydratingPromise) {
    return studentStorageHydratingPromise;
  }

  studentStorageHydratingPromise = (async () => {
    const localStudents = readLocalStudentRecords();
    let remoteStudents = [];

    try {
      const cloudRecords = await loadStudentRecordsFromCloud();
      remoteStudents = normalizeStudentRecords(cloudRecords);
    } catch (error) {
      console.warn('Öğrenci verisi buluttan okunamadı:', error);
    }

    let mergedStudents = [];
    if (remoteStudents.length && localStudents.length) {
      mergedStudents = mergeStudentRecords(localStudents, remoteStudents);
    } else if (remoteStudents.length) {
      mergedStudents = remoteStudents;
    } else {
      mergedStudents = localStudents;
    }

    if (!remoteStudents.length && localStudents.length) {
      try {
        await saveStudentRecordsToCloud(localStudents);
      } catch (error) {
        console.warn('Yerel öğrenci verisi buluta aktarılamadı:', error);
      }
    }

    if (remoteStudents.length && !localStudents.length) {
      writeLocalStudentRecords(remoteStudents);
    } else if (mergedStudents.length) {
      writeLocalStudentRecords(mergedStudents);
    }

    studentStorageHydrated = true;
    return mergedStudents;
  })().finally(() => {
    studentStorageHydratingPromise = null;
  });

  return studentStorageHydratingPromise;
}

function getStoredOgrenciler() {
  return normalizeStudentRecords(readLocalStudentRecords());
}

function setStoredOgrenciler(students) {
  const normalizedStudents = normalizeStudentRecords(students);
  writeLocalStudentRecords(normalizedStudents);
  studentStorageHydrated = true;
  if (shouldUseFirebaseAuth()) {
    Promise.resolve(saveStudentRecordsToCloud(normalizedStudents)).catch(error => {
      console.warn('Öğrenci verisi buluta kaydedilemedi:', error);
    });
  }
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
      student.classLevel ? getClassDisplayLabel(student.classLevel) : 'Genel'
    ];

    card.innerHTML = `
      <button type="button" class="delete-student-btn" aria-label="Öğrenciyi sil" title="Öğrenciyi sil">🗑️</button>
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
    const deleteBtn = card.querySelector('.delete-student-btn');
    if (editBtn) {
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        openStudentEditModal(student.id);
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', e => {
        e.stopPropagation();
        deleteStudentFromCard(student.id);
      });
    }
    container.appendChild(card);
  });
}

function deleteStudentFromCard(studentId) {
  const students = getStoredOgrenciler();
  const student = students.find(s => s.id.toString() === studentId.toString());
  if (!student) {
    alert('Öğrenci bulunamadı.');
    return;
  }

  if (!confirm(`${student.name} adlı öğrenciyi silmek istiyor musunuz?`)) {
    return;
  }

  const updatedStudents = students.filter(s => s.id.toString() !== studentId.toString());
  setStoredOgrenciler(updatedStudents);

  if (activeStudentId && activeStudentId.toString() === studentId.toString()) {
    activeStudentId = null;
    ogrenciPanelKapat();
  }

  renderStoredOgrenciler();
  updateUserCountLabel();
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