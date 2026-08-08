(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAnLmvL1pXi5UiuD-ojA_ICxrOCjpkI55I",
    authDomain: "parabol-kocluk.firebaseapp.com",
    projectId: "parabol-kocluk",
    storageBucket: "parabol-kocluk.firebasestorage.app",
    messagingSenderId: "252912880544",
    appId: "1:252912880544:web:5b87683ab2191bac18b2c5",
    measurementId: "G-RC8PYC03W7"
  };

  const integrationSettings = {
    // true yaparsan kayit/giris/sifre sifirlama formlari Firebase Auth kullanir.
    useFirebaseAuth: true,
    // true ise anasayfa basvuru formu Firestore'a kaydedilir.
    useFirestoreForms: true
  };

  const isPlaceholder = (value) => String(value || "").startsWith("YOUR_");
  const hasValidConfig =
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    !isPlaceholder(firebaseConfig.apiKey) &&
    !isPlaceholder(firebaseConfig.authDomain) &&
    !isPlaceholder(firebaseConfig.projectId) &&
    !isPlaceholder(firebaseConfig.appId);

  const services = {
    settings: integrationSettings,
    isReady: false,
    isEnabled() {
      return this.isReady;
    },
    async registerWithEmail() {
      throw new Error("Firebase hazir degil");
    },
    async loginWithEmail() {
      throw new Error("Firebase hazir degil");
    },
    async resetPassword() {
      throw new Error("Firebase hazir degil");
    },
    async saveLandingApplication() {
      throw new Error("Firebase hazir degil");
    },
    async signOut() {
      return;
    },
    async getCurrentUserSession() {
      return null;
    }
  };

  if (!window.firebase || !window.firebase.initializeApp) {
    console.warn("Firebase SDK yuklenemedi. firebase-init.js once firebase compat scriptlerini bekler.");
    window.firebaseServices = services;
    return;
  }

  if (!hasValidConfig) {
    console.warn("Firebase config alanlarini doldurun. Integrasyon pasif durumda.");
    window.firebaseServices = services;
    return;
  }

  const app = window.firebase.apps.length
    ? window.firebase.app()
    : window.firebase.initializeApp(firebaseConfig);
  const auth = window.firebase.auth(app);
  const db = window.firebase.firestore ? window.firebase.firestore(app) : null;

  const fieldValue = window.firebase.firestore ? window.firebase.firestore.FieldValue : null;

  if (!db) {
    console.warn("Firebase Firestore SDK yuklenemedi. Profil kaydi ve formlar calismayabilir.");
  }

  function withTimeout(promise, timeoutMs, timeoutCode, timeoutMessage) {
    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => {
        const err = new Error(timeoutMessage || "Firebase istegi zaman asimina ugradi.");
        err.code = timeoutCode || "app/request-timeout";
        reject(err);
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timerId);
    });
  }

  async function getProfileByUid(uid) {
    if (db) {
      const doc = await db.collection("users").doc(uid).get();
      return doc.exists ? doc.data() : null;
    }

    return null;
  }

  const generatedLoginDomain = "parabol.kocluk";
  const generatedLoginChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function normalizeLoginIdentifier(value) {
    const rawValue = String(value || "").trim().toLowerCase();
    if (!rawValue) return "";
    if (rawValue.includes("@")) return rawValue;
    return `${rawValue}@${generatedLoginDomain}`;
  }

  function generateLoginCode(prefix) {
    const randomValues = new Uint8Array(6);
    window.crypto.getRandomValues(randomValues);
    const suffix = Array.from(randomValues, (value) => generatedLoginChars[value % generatedLoginChars.length]).join("");
    return `${prefix}-${suffix}`;
  }

  async function createFirebaseAuthAccount({
    loginCode,
    displayName,
    role,
    linkedStudentIds,
    studentId,
    branch,
    classLevel,
  }) {
    const email = normalizeLoginIdentifier(loginCode);
    const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;

    const response = await fetch(signUpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: loginCode,
        returnSecureToken: true,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || "Firebase kullanici olusturulamadi.");
      error.code = data?.error?.message || "app/firebase-account-create-failed";
      throw error;
    }

    if (!db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    const profilePayload = {
      uid: data.localId,
      email,
      loginCode,
      displayName,
      role,
      linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : [],
      studentId: studentId || "",
      branch: branch || "",
      classLevel: classLevel || "",
      emailVerified: false,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };

    await withTimeout(
      db.collection("users").doc(data.localId).set(
        {
          ...profilePayload,
          createdAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
      5000,
      "app/firestore-timeout",
      "Profil verisi kaydedilirken zaman aşımı oluştu."
    );

    return {
      uid: data.localId,
      email,
      loginCode,
      displayName,
      role,
      linkedStudentIds: profilePayload.linkedStudentIds,
      studentId: profilePayload.studentId,
      branch: profilePayload.branch,
      classLevel: profilePayload.classLevel,
    };
  }

  services.registerWithEmail = async function registerWithEmail(payload) {
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const displayName = String(payload.name || "").trim();

    const credential = await withTimeout(
      auth.createUserWithEmailAndPassword(email, password),
      20000,
      "app/auth-create-timeout",
      "Kayıt işlemi zaman aşımına uğradı."
    );
    if (displayName) {
      await withTimeout(
        credential.user.updateProfile({ displayName: displayName }),
        12000,
        "app/profile-update-timeout",
        "Profil güncellemesi zaman aşımına uğradı."
      );
    }

    await withTimeout(
      credential.user.sendEmailVerification(),
      12000,
      "app/email-verification-send-failed",
      "Doğrulama e-postası gönderilirken zaman aşımı oluştu."
    );

    const nowIso = new Date().toISOString();
    const profilePayload = {
      uid: credential.user.uid,
      name: displayName,
      email: email,
      phone: payload.phone || "",
      branch: payload.branch || "",
      role: "coach",
      students: [],
      createdAtIso: nowIso,
      updatedAtIso: nowIso
    };

    if (!db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    await withTimeout(
      db.collection("users").doc(credential.user.uid).set(
        {
          ...profilePayload,
          emailVerified: false,
          createdAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp()
        },
        { merge: true }
      ),
      5000,
      "app/firestore-timeout",
      "Profil verisi kaydedilirken zaman aşımı oluştu."
    );

    await auth.signOut();

    return {
      uid: credential.user.uid,
      email: email,
      name: displayName,
      branch: payload.branch || "",
      requiresEmailVerification: true
    };
  };

  services.provisionStudentAccounts = async function provisionStudentAccounts(payload) {
    if (!auth.currentUser) {
      const error = new Error("Ogretmen oturumu bulunamadi.");
      error.code = "app/teacher-session-missing";
      throw error;
    }

    const studentName = String(payload.studentName || "").trim();
    if (!studentName) {
      throw new Error("Ogrenci adi gerekli.");
    }

    const studentId = String(payload.studentId || "").trim();
    const branch = String(payload.branch || "").trim();
    const classLevel = String(payload.classLevel || "").trim();
    const parentDisplayName = String(payload.parentDisplayName || `${studentName} Velisi`).trim();

    const studentLoginCode = generateLoginCode("OG");
    const parentLoginCode = generateLoginCode("VL");
    const studentPassword = generatePassword();
    const parentPassword = generatePassword();

    const studentAccount = await createFirebaseAuthAccount({
      loginCode: studentLoginCode,
      displayName: studentName,
      role: "student",
      linkedStudentIds: [studentId],
      studentId,
      branch,
      classLevel,
    });

    const parentAccount = await createFirebaseAuthAccount({
      loginCode: parentLoginCode,
      displayName: parentDisplayName,
      role: "parent",
      linkedStudentIds: [studentAccount.uid],
      studentId: studentAccount.uid,
      branch,
      classLevel,
    });

    await withTimeout(
      db.collection("users").doc(studentAccount.uid).set(
        {
          linkedStudentIds: [studentAccount.uid],
          parentUid: parentAccount.uid,
          updatedAt: fieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
      5000,
      "app/firestore-timeout",
      "Ogrenci profili guncellenemedi."
    );

    return {
      student: studentAccount,
      parent: parentAccount,
    };
  };

  services.loginWithEmail = async function loginWithEmail(payload) {
    const email = normalizeLoginIdentifier(payload.email || payload.loginCode || "");
    const password = String(payload.password || "");
    const credential = await withTimeout(
      auth.signInWithEmailAndPassword(email, password),
      20000,
      "app/auth-signin-timeout",
      "Giriş işlemi zaman aşımına uğradı."
    );

    if (!credential.user.emailVerified) {
      try {
        await withTimeout(
          credential.user.sendEmailVerification(),
          12000,
          "app/email-verification-send-failed",
          "Doğrulama e-postası tekrar gönderilemedi."
        );
      } catch (error) {
        console.warn("Doğrulama e-postası yeniden gönderilemedi:", error);
      }

      await auth.signOut();
      const err = new Error("E-posta adresinizi doğrulamadan giriş yapamazsınız.");
      err.code = "app/email-not-verified";
      throw err;
    }

    let profile = null;
    try {
      profile = await withTimeout(
        getProfileByUid(credential.user.uid),
        10000,
        "app/profile-read-timeout",
        "Kullanıcı profili okunurken zaman aşımı oluştu."
      );
    } catch (error) {
      console.warn("Profil okuma zamanında tamamlanamadı:", error);
    }

    const role = profile && profile.role ? String(profile.role) : "";
    const requiresVerification = role !== "student" && role !== "parent";

    if (requiresVerification && !credential.user.emailVerified) {
      try {
        await withTimeout(
          credential.user.sendEmailVerification(),
          12000,
          "app/email-verification-send-failed",
          "Doğrulama e-postası tekrar gönderilemedi."
        );
      } catch (error) {
        console.warn("Doğrulama e-postası yeniden gönderilemedi:", error);
      }

      await auth.signOut();
      const err = new Error("E-posta adresinizi doğrulamadan giriş yapamazsınız.");
      err.code = "app/email-not-verified";
      throw err;
    }

    return {
      uid: credential.user.uid,
      email: credential.user.email || email,
      name: (profile && (profile.displayName || profile.name)) || credential.user.displayName || "Kullanici",
      branch: (profile && profile.branch) || "",
      role,
      linkedStudentIds: (profile && profile.linkedStudentIds) || [],
    };
  };

  services.resetPassword = async function resetPassword(email) {
    await auth.sendPasswordResetEmail(String(email || "").trim().toLowerCase());
  };

  services.saveLandingApplication = async function saveLandingApplication(payload) {
    if (!db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    await db.collection("landingApplications").add({
      name: payload.name || "",
      email: payload.email || "",
      phone: payload.phone || "",
      level: payload.level || "",
      note: payload.note || "",
      source: "landing-form",
      createdAt: fieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString()
    });
  };

  services.signOut = async function signOutFirebase() {
    await auth.signOut();
  };

  services.getCurrentUserSession = async function getCurrentUserSession() {
    // auth.currentUser is null until Firebase restores the session asynchronously;
    // onAuthStateChanged waits for that initialization before resolving.
    const user = await new Promise(resolve => {
      const unsubscribe = auth.onAuthStateChanged(u => {
        unsubscribe();
        resolve(u);
      });
    });

    if (!user) return null;

    if (!user.emailVerified) {
      await auth.signOut();
      return null;
    }

    const profile = await getProfileByUid(user.uid);

    return {
      uid: user.uid,
      email: user.email || "",
      name: (profile && profile.name) || user.displayName || "Kullanici",
      branch: (profile && profile.branch) || ""
    };
  };

  services.loadStudentRecords = async function loadStudentRecords() {
    const user = auth.currentUser;
    if (!user || !db) return [];

    const profile = await getProfileByUid(user.uid);
    const students = profile && Array.isArray(profile.students) ? profile.students : [];
    return students;
  };

  services.saveStudentRecords = async function saveStudentRecords(students) {
    const user = auth.currentUser;
    if (!user || !db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    const safeStudents = Array.isArray(students) ? students : [];
    await withTimeout(
      db.collection("users").doc(user.uid).set(
        {
          students: safeStudents,
          studentsUpdatedAtIso: new Date().toISOString(),
          updatedAt: fieldValue.serverTimestamp()
        },
        { merge: true }
      ),
      5000,
      "app/firestore-timeout",
      "Öğrenci verisi kaydedilirken zaman aşımı oluştu."
    );

    return safeStudents;
  };

  services.isReady = true;
  window.firebaseServices = services;
})();
