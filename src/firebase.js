import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDH4agaD9PKzeYF1D5e01ynG_ceD8ngi8A",
  authDomain: "miora-by-layal.firebaseapp.com",
  projectId: "miora-by-layal",
  storageBucket: "miora-by-layal.firebasestorage.app",
  messagingSenderId: "724055924758",
  appId: "1:724055924758:web:14eb46935fdcb0e5929537",
  measurementId: "G-2QGQ3CQGTL",
};

export const ADMIN_EMAIL = "mioraphotosjo@gmail.com";

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

/**
 * Ensures every visitor has a Firebase Auth session.
 * - If they're already signed in (anonymously, or as the admin), the callback fires immediately.
 * - Otherwise, signs them in anonymously so their payment submissions can be tagged with a stable uid
 *   and they can read back their own orders, without requiring a real account/login.
 * Returns an unsubscribe function.
 */
export function ensureAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      signInAnonymously(auth).catch((err) => {
        console.error("Anonymous sign-in failed:", err);
      });
    }
  });
}
