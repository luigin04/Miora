import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  GoogleAuthProvider, signInWithPopup,
  linkWithPopup, linkWithCredential, OAuthProvider,
} from "firebase/auth";

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
export const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google.
 * If the current user is anonymous, upgrade (link) their session to Google
 * so any orders they placed anonymously are preserved under the same UID.
 * If already signed in with Google or another account, just sign in normally.
 */
export async function signInWithGoogle() {
  const current = auth.currentUser;
  try {
    if (current && current.isAnonymous) {
      // Upgrade anonymous → Google, preserving the UID and all Firestore docs
      await linkWithPopup(current, googleProvider);
      return auth.currentUser;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (err) {
    // If the Google account already exists separately, just sign in with it
    if (err.code === "auth/credential-already-in-use" ||
        err.code === "auth/email-already-in-use") {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
    throw err;
  }
}

/**
 * Ensures every visitor has a Firebase Auth session.
 * Signs in anonymously if not already signed in.
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
