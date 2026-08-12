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
    useFirestoreForms: true,
    // true ise ogrenci/veli kodlari backend custom token akisiyla uretilir.
    useCustomTokenStudentAccess: true,
    // custom token backendi ulasilamazsa eski e-posta tabanli olusturmaya geri don.
    allowLegacyStudentAccessFallback: false
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
    async loginWithAccessCode() {
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
    },
    async getCoachUserCount() {
      return null;
    },
    async loadWorkspaceSettings() {
      return null;
    },
    async saveWorkspaceSettings() {
      return null;
    },
    async publishStudentProgram() {
      throw new Error("Firebase hazir degil");
    },
    async publishParentResources() {
      throw new Error("Firebase hazir degil");
    },
    async publishParentReport() {
      throw new Error("Firebase hazir degil");
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
  const studentRecordFingerprints = new Map();

  if (!db) {
    console.warn("Firebase Firestore SDK yuklenemedi. Profil kaydi ve formlar calismayabilir.");
  }

  function resolveApiBaseUrl() {
    const defaultProductionApiUrl = "https://parabol-kocluk-api.onrender.com";
    const runtimeOverride = String(window.__KOCLUK_API_BASE_URL__ || localStorage.getItem("koclukApiBaseUrl") || "").trim();
    if (runtimeOverride) return runtimeOverride.replace(/\/$/, "");

    const loc = window.location;
    const isLocalhost = loc.hostname === "localhost" || loc.hostname === "127.0.0.1";

    if (loc.protocol === "file:") {
      return "http://localhost:3000";
    }

    if (isLocalhost && loc.port && loc.port !== "3000") {
      return `${loc.protocol}//${loc.hostname}:3000`;
    }

    if (!isLocalhost && loc.protocol !== "file:") {
      return defaultProductionApiUrl;
    }

    return loc.origin;
  }

  const API_BASE_URL = resolveApiBaseUrl();

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

  function resolveProfileCreatedAtIso(profile) {
    if (!profile || typeof profile !== "object") return "";
    if (profile.createdAtIso) return String(profile.createdAtIso);
    if (profile.createdAt && typeof profile.createdAt.toDate === "function") {
      return profile.createdAt.toDate().toISOString();
    }
    return "";
  }

  function hasProfileUnlimitedAccess(profile, role) {
    if (!profile || typeof profile !== "object") return false;
    if (profile.unlimitedAccess === true) return true;
    if (profile.isAdmin === true) return true;
    return role === "admin" || role === "owner";
  }

  function resolveProfileDemoFlag(profile) {
    if (!profile || typeof profile !== "object") return false;
    if (typeof profile.isDemoAccount === "boolean") return profile.isDemoAccount;
    if (typeof profile.isDemo === "boolean") return profile.isDemo;
    if (typeof profile.demo === "boolean") return profile.demo;
    if (typeof profile.isExploreDemo === "boolean") return profile.isExploreDemo;
    return false;
  }

  function isExplorePlanValue(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "explore" || normalized === "kesfet";
  }

  function resolveProfileEmail(profile, fallback = "") {
    if (!profile || typeof profile !== "object") return String(fallback || "");
    const direct = String(profile.email || "").trim();
    if (direct) return direct;

    const loginCode = String(profile.loginCode || "").trim();
    if (loginCode) {
      return normalizeLoginIdentifier(loginCode);
    }

    return String(fallback || "");
  }

  function getStudentCollection(uid) {
    return db.collection("users").doc(uid).collection("students");
  }

  function getStudentDocumentId(student) {
    const explicitDocId = String((student && student.__docId) || "").trim();
    if (explicitDocId) return explicitDocId;
    return encodeURIComponent(String(student && student.id));
  }

  function sanitizeStudentRecordForSave(student) {
    if (!student || typeof student !== "object") return student;
    const { __docId, ...rest } = student;
    return rest;
  }

  function getStudentFingerprint(student) {
    return JSON.stringify(student);
  }

  function replaceStudentRecordCache(students) {
    studentRecordFingerprints.clear();
    students.forEach((student) => {
      studentRecordFingerprints.set(String(student.id), getStudentFingerprint(student));
    });
  }

  async function commitStudentOperations(operations) {
    const batchSize = 450;
    for (let index = 0; index < operations.length; index += batchSize) {
      const batch = db.batch();
      operations.slice(index, index + batchSize).forEach((operation) => {
        if (operation.type === "delete") {
          batch.delete(operation.ref);
        } else {
          batch.set(operation.ref, operation.student);
        }
      });
      await withTimeout(
        batch.commit(),
        10000,
        "app/student-save-timeout",
        "Öğrenci verisi kaydedilirken zaman aşımı oluştu."
      );
    }
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

  async function requestBackendJson(path, options) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      const backendError = new Error(data && data.error ? data.error : `İstek başarısız (HTTP ${response.status}).`);
      backendError.status = response.status;
      throw backendError;
    }

    return data;
  }

  async function provisionStudentAccountsWithCustomToken(payload) {
    const teacherUser = await getAuthenticatedUser();
    if (!teacherUser) {
      const error = new Error("Ogretmen oturumu bulunamadi.");
      error.code = "app/teacher-session-missing";
      throw error;
    }

    const idToken = await teacherUser.getIdToken();
    return requestBackendJson("/api/student-access/provision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify(payload || {})
    });
  }

  async function getAuthenticatedUser() {
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
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
      plan: "explore",
      isDemoAccount: true,
      studentLimit: 1,
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
    if (integrationSettings.useCustomTokenStudentAccess) {
      try {
        return await provisionStudentAccountsWithCustomToken(payload);
      } catch (customTokenError) {
        if (!integrationSettings.allowLegacyStudentAccessFallback) {
          throw customTokenError;
        }
        console.warn("Custom token ogrenci/veli kod olusturma basarisiz, legacy akis denenecek:", customTokenError);
      }
    }

    const teacherUser = await getAuthenticatedUser();
    if (!teacherUser) {
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
    const isStudentOrParent = role === "student" || role === "parent";
    const requiresVerification = !isStudentOrParent;

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

    const resolvedPlan = (profile && profile.plan) || (isStudentOrParent ? "" : "explore");
    const resolvedStudentLimit = profile && typeof profile.studentLimit === "number"
      ? profile.studentLimit
      : (isExplorePlanValue(resolvedPlan) ? 1 : null);
    const isDemoAccount = resolveProfileDemoFlag(profile);

    return {
      uid: credential.user.uid,
      email: resolveProfileEmail(profile, credential.user.email || email),
      name: (profile && (profile.displayName || profile.name)) || credential.user.displayName || "Kullanici",
      branch: (profile && profile.branch) || "",
      role,
      plan: resolvedPlan,
      studentLimit: resolvedStudentLimit,
      createdAtIso: resolveProfileCreatedAtIso(profile),
      isUnlimitedAccess: hasProfileUnlimitedAccess(profile, role),
      linkedStudentIds: (profile && profile.linkedStudentIds) || [],
      isDemoAccount,
    };
  };

  services.loginWithAccessCode = async function loginWithAccessCode(payload) {
    const code = String(payload && payload.code || "").trim().toUpperCase();
    if (!code) {
      throw new Error("Giriş kodu gerekli.");
    }

    const exchange = await requestBackendJson("/api/student-access/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    if (!exchange || !exchange.token) {
      throw new Error("Kod doğrulanamadı.");
    }

    const credential = await withTimeout(
      auth.signInWithCustomToken(exchange.token),
      20000,
      "app/auth-signin-timeout",
      "Kod ile giriş zaman aşımına uğradı."
    );

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

    const role = (profile && profile.role) || (exchange && exchange.role) || "";
    return {
      uid: credential.user.uid,
      email: resolveProfileEmail(profile, credential.user.email || ""),
      name: (profile && (profile.displayName || profile.name)) || credential.user.displayName || "Kullanici",
      branch: (profile && profile.branch) || "",
      role,
      linkedStudentIds: (profile && profile.linkedStudentIds) || (exchange && exchange.profile && exchange.profile.linkedStudentIds) || [],
      classLevel: (profile && profile.classLevel) || (exchange && exchange.profile && exchange.profile.classLevel) || ""
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
    const role = profile && profile.role ? String(profile.role) : "";
    const isStudentOrParent = role === "student" || role === "parent";
    const resolvedPlan = (profile && profile.plan) || (isStudentOrParent ? "" : "explore");
    const resolvedStudentLimit = profile && typeof profile.studentLimit === "number"
      ? profile.studentLimit
      : (isExplorePlanValue(resolvedPlan) ? 1 : null);
    const isDemoAccount = resolveProfileDemoFlag(profile);

    return {
      uid: user.uid,
      email: resolveProfileEmail(profile, user.email || ""),
      name: (profile && (profile.displayName || profile.name)) || user.displayName || "Kullanici",
      branch: (profile && profile.branch) || "",
      plan: resolvedPlan,
      studentLimit: resolvedStudentLimit,
      createdAtIso: resolveProfileCreatedAtIso(profile),
      isUnlimitedAccess: hasProfileUnlimitedAccess(profile, role),
      isDemoAccount
    };
  };

  services.loadStudentRecords = async function loadStudentRecords() {
    const user = auth.currentUser;
    if (!user || !db) return [];

    const studentsSnapshot = await withTimeout(
      getStudentCollection(user.uid).get(),
      10000,
      "app/student-load-timeout",
      "Öğrenci verisi okunurken zaman aşımı oluştu."
    );

    if (!studentsSnapshot.empty) {
      const students = studentsSnapshot.docs.map((doc) => {
        const data = doc.data() || {};
        const fallbackUid = decodeURIComponent(String(doc.id || "")).trim();
        return {
          ...data,
          __docId: doc.id,
          uid: String(data.uid || fallbackUid)
        };
      });
      replaceStudentRecordCache(students);
      return students;
    }

    const profile = await getProfileByUid(user.uid);
    const legacyStudents = profile && Array.isArray(profile.students) ? profile.students : [];
    if (!legacyStudents.length) {
      replaceStudentRecordCache([]);
      return [];
    }

    await services.saveStudentRecords(legacyStudents);
    await db.collection("users").doc(user.uid).set(
      {
        students: fieldValue.delete(),
        studentsMigratedAtIso: new Date().toISOString(),
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return legacyStudents;
  };

  services.saveStudentRecords = async function saveStudentRecords(students) {
    const user = auth.currentUser;
    if (!user || !db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    const safeStudents = Array.isArray(students) ? students : [];
    const nextFingerprints = new Map();
    const operations = [];

    safeStudents.forEach((student) => {
      const studentId = String(student && student.id);
      const sanitizedStudent = sanitizeStudentRecordForSave(student);
      const fingerprint = getStudentFingerprint(student);
      nextFingerprints.set(studentId, fingerprint);
      if (studentRecordFingerprints.get(studentId) !== fingerprint) {
        operations.push({
          type: "set",
          ref: getStudentCollection(user.uid).doc(getStudentDocumentId(student)),
          student: sanitizedStudent
        });
      }
    });

    studentRecordFingerprints.forEach((_, studentId) => {
      if (!nextFingerprints.has(studentId)) {
        operations.push({
          type: "delete",
          ref: getStudentCollection(user.uid).doc(encodeURIComponent(studentId))
        });
      }
    });

    await commitStudentOperations(operations);
    studentRecordFingerprints.clear();
    nextFingerprints.forEach((fingerprint, studentId) => {
      studentRecordFingerprints.set(studentId, fingerprint);
    });

    await withTimeout(
      db.collection("users").doc(user.uid).set(
        {
          studentsUpdatedAtIso: new Date().toISOString(),
          updatedAt: fieldValue.serverTimestamp()
        },
        { merge: true }
      ),
      5000,
      "app/firestore-timeout",
      "Öğrenci güncelleme bilgisi kaydedilirken zaman aşımı oluştu."
    );

    return safeStudents;
  };

  services.publishStudentProgram = async function publishStudentProgram(payload) {
    const user = auth.currentUser;
    if (!user || !db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    const studentUid = String(payload && payload.studentUid || "").trim();
    const parentUid = String(payload && payload.parentUid || "").trim();
    const program = payload && payload.program && typeof payload.program === "object" ? payload.program : null;
    if (!studentUid || !parentUid || !program) {
      throw new Error("Öğrenci, veli ve program bilgisi gerekli.");
    }

    const sharedProgram = {
      studentId: String(payload.studentId || "").trim(),
      studentName: String(payload.studentName || "").trim(),
      classLevel: String(payload.classLevel || "").trim(),
      program,
      publishedAtIso: new Date().toISOString(),
      publishedByUid: user.uid
    };

    const batch = db.batch();
    batch.set(db.collection("users").doc(studentUid), {
      sharedProgram,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(db.collection("users").doc(parentUid), {
      sharedProgram,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    await withTimeout(
      batch.commit(),
      10000,
      "app/program-publish-timeout",
      "Program öğrenci ve veliye gönderilirken zaman aşımı oluştu."
    );

    return sharedProgram;
  };

  services.publishParentResources = async function publishParentResources(payload) {
    const user = auth.currentUser;
    if (!user || !db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    const parentUid = String(payload && payload.parentUid || "").trim();
    const resources = Array.isArray(payload && payload.resources) ? payload.resources : null;
    if (!parentUid || !resources) {
      throw new Error("Veli ve kaynak bilgisi gerekli.");
    }

    const sharedResources = {
      studentId: String(payload.studentId || "").trim(),
      studentName: String(payload.studentName || "").trim(),
      classLevel: String(payload.classLevel || "").trim(),
      resources,
      publishedAtIso: new Date().toISOString(),
      publishedByUid: user.uid
    };

    await withTimeout(
      db.collection("users").doc(parentUid).set({
        sharedResources,
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true }),
      10000,
      "app/resources-publish-timeout",
      "Kaynaklar veliye gönderilirken zaman aşımı oluştu."
    );

    return sharedResources;
  };

  services.publishParentReport = async function publishParentReport(payload) {
    const user = auth.currentUser;
    if (!user || !db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    const parentUid = String(payload && payload.parentUid || "").trim();
    const report = payload && payload.report && typeof payload.report === "object" ? payload.report : null;
    if (!parentUid || !report) {
      throw new Error("Veli ve rapor bilgisi gerekli.");
    }

    const sharedReport = {
      studentId: String(payload.studentId || "").trim(),
      studentName: String(payload.studentName || "").trim(),
      classLevel: String(payload.classLevel || "").trim(),
      report,
      publishedAtIso: new Date().toISOString(),
      publishedByUid: user.uid
    };

    await withTimeout(
      db.collection("users").doc(parentUid).set({
        sharedReport,
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true }),
      10000,
      "app/report-publish-timeout",
      "Rapor veliye gönderilirken zaman aşımı oluştu."
    );

    return sharedReport;
  };

  services.getCoachUserCount = async function getCoachUserCount() {
    if (!db) return null;

    const roleValues = ["coach", "teacher"];

    const countByRole = async (roleValue) => {
      const roleQuery = db.collection("users").where("role", "==", roleValue);

      // Some compat SDK versions do not support aggregation count().
      if (typeof roleQuery.count === "function") {
        const snapshot = await withTimeout(
          roleQuery.count().get(),
          10000,
          "app/user-count-timeout",
          "Kullanıcı sayısı okunurken zaman aşımı oluştu."
        );
        const data = snapshot.data();
        return typeof data.count === "number" ? data.count : 0;
      }

      const snapshot = await withTimeout(
        roleQuery.get(),
        10000,
        "app/user-count-timeout",
        "Kullanıcı sayısı okunurken zaman aşımı oluştu."
      );
      return typeof snapshot.size === "number" ? snapshot.size : 0;
    };

    const counts = await Promise.all(roleValues.map((roleValue) => countByRole(roleValue)));
    return counts.reduce((sum, value) => sum + (Number(value) || 0), 0);
  };

  services.loadWorkspaceSettings = async function loadWorkspaceSettings() {
    const user = auth.currentUser;
    if (!user || !db) return null;

    const profile = await withTimeout(
      getProfileByUid(user.uid),
      10000,
      "app/workspace-load-timeout",
      "Çalışma alanı ayarları okunurken zaman aşımı oluştu."
    );
    return profile && profile.workspaceSettings && typeof profile.workspaceSettings === "object"
      ? profile.workspaceSettings
      : null;
  };

  services.saveWorkspaceSettings = async function saveWorkspaceSettings(settings) {
    const user = auth.currentUser;
    if (!user || !db || !fieldValue) {
      const missingDbError = new Error("Firestore kullanima hazir degil.");
      missingDbError.code = "app/firestore-unavailable";
      throw missingDbError;
    }

    const safeSettings = settings && typeof settings === "object" ? settings : {};
    await withTimeout(
      db.collection("users").doc(user.uid).set(
        {
          workspaceSettings: safeSettings,
          workspaceSettingsUpdatedAtIso: new Date().toISOString(),
          updatedAt: fieldValue.serverTimestamp()
        },
        { merge: true }
      ),
      10000,
      "app/workspace-save-timeout",
      "Çalışma alanı ayarları kaydedilirken zaman aşımı oluştu."
    );
    return safeSettings;
  };

  services.isReady = true;
  window.firebaseServices = services;
})();
