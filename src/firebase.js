import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, linkWithPopup, linkWithRedirect,
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
 * Tries popup first (faster UX). Falls back to redirect if popup is blocked.
 * If the current session is anonymous, upgrades it to Google to preserve orders.
 */
export async function signInWithGoogle() {
  const current = auth.currentUser;
  try {
    if (current && current.isAnonymous) {
      // Upgrade anonymous → Google, preserving UID and all Firestore docs
      const result = await linkWithPopup(current, googleProvider);
      return result.user;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (err) {
    // Popup blocked or closed — fall back to redirect
    if (
      err.code === "auth/popup-blocked" ||
      err.code === "auth/popup-closed-by-user" ||
      err.code === "auth/cancelled-popup-request"
    ) {
      // Use redirect as fallback
      if (current && current.isAnonymous) {
        await linkWithRedirect(current, googleProvider);
      } else {
        await signInWithRedirect(auth, googleProvider);
      }
      return null; // page will redirect, result handled on return
    }
    // Google account already exists as a separate account — just sign in
    if (
      err.code === "auth/credential-already-in-use" ||
      err.code === "auth/email-already-in-use"
    ) {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
    throw err;
  }
}

/**
 * Handle redirect result on page load (called once in the app root).
 * Returns the user if returning from a Google redirect sign-in, null otherwise.
 */
export async function handleGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (err) {
    console.error("Redirect result error:", err);
    return null;
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
