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

    const credential = await auth.createUserWithEmailAndPassword(email, password);
    if (displayName) {
      await credential.user.updateProfile({ displayName: displayName });
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

    if (!rtdb) {
      const missingDbError = new Error("Realtime Database kullanima hazir degil.");
      missingDbError.code = "app/realtime-db-unavailable";
      throw missingDbError;
    }

    await rtdb.ref("users/" + credential.user.uid).set(profilePayload);

    if (db && fieldValue) {
      try {
        await db.collection("users").doc(credential.user.uid).set(
          {
            ...profilePayload,
            createdAt: fieldValue.serverTimestamp(),
            updatedAt: fieldValue.serverTimestamp()
          },
          { merge: true }
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
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const profile = await getProfileByUid(credential.user.uid);

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
