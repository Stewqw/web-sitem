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
  const rtdb = window.firebase.database ? window.firebase.database(app) : null;

  const fieldValue = window.firebase.firestore ? window.firebase.firestore.FieldValue : null;

  if (!rtdb) {
    console.warn("Firebase Realtime Database SDK yuklenemedi. Kayit profil yazimi eksik calisabilir.");
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
    if (rtdb) {
      try {
        const snapshot = await rtdb.ref("users/" + uid).get();
        if (snapshot.exists()) {
          return snapshot.val();
        }
      } catch (error) {
        console.warn("Realtime Database profil okuma hatasi:", error);
      }
    }

    if (db) {
      const doc = await db.collection("users").doc(uid).get();
      return doc.exists ? doc.data() : null;
    }

    return null;
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

    const nowIso = new Date().toISOString();
    const profilePayload = {
      uid: credential.user.uid,
      name: displayName,
      email: email,
      phone: payload.phone || "",
      branch: payload.branch || "",
      role: "coach",
      createdAtIso: nowIso,
      updatedAtIso: nowIso
    };

    if (rtdb) {
      try {
        await withTimeout(
          rtdb.ref("users/" + credential.user.uid).set(profilePayload),
          12000,
          "app/realtime-db-timeout",
          "Profil verisi kaydedilirken zaman aşımı oluştu."
        );
      } catch (error) {
        console.error("Realtime Database profil yazma hatası:", error);
      }
    } else {
      console.warn("Realtime Database kullanima hazir degil; profil yazimi atlandi.");
    }

    if (db && fieldValue) {
      try {
        await withTimeout(
          db.collection("users").doc(credential.user.uid).set(
            {
              ...profilePayload,
              createdAt: fieldValue.serverTimestamp(),
              updatedAt: fieldValue.serverTimestamp()
            },
            { merge: true }
          ),
          12000,
          "app/firestore-timeout",
          "Firestore profil kaydi zaman aşımına uğradı."
        );
      } catch (error) {
        console.warn("Firestore profil yazimi atlandi:", error);
      }
    }

    return {
      uid: credential.user.uid,
      email: email,
      name: displayName,
      branch: payload.branch || ""
    };
  };

  services.loginWithEmail = async function loginWithEmail(payload) {
    const email = String(payload.email || "").trim().toLowerCase();
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

    return {
      uid: credential.user.uid,
      email: credential.user.email || email,
      name: (profile && profile.name) || credential.user.displayName || "Kullanici",
      branch: (profile && profile.branch) || ""
    };
  };

  services.resetPassword = async function resetPassword(email) {
    await auth.sendPasswordResetEmail(String(email || "").trim().toLowerCase());
  };

  services.saveLandingApplication = async function saveLandingApplication(payload) {
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
    const user = auth.currentUser;
    if (!user) return null;
    const profile = await getProfileByUid(user.uid);

    return {
      uid: user.uid,
      email: user.email || "",
      name: (profile && profile.name) || user.displayName || "Kullanici",
      branch: (profile && profile.branch) || ""
    };
  };

  services.isReady = true;
  window.firebaseServices = services;
})();
