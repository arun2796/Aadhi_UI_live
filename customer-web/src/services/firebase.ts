import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

// Firebase web config for project "aadhi-crackers".
// NOTE: the Google provider must be enabled under
// Firebase Console → Authentication → Sign-in method, and the app's domain
// (localhost during development) must be listed in Authorized domains.
const firebaseConfig = {
  apiKey: 'AIzaSyCO9QlHgVyFpDS0EkR-ZjsByIUlZX6A1hg',
  authDomain: 'aadhi-crackers.firebaseapp.com',
  projectId: 'aadhi-crackers',
  storageBucket: 'aadhi-crackers.firebasestorage.app',
  messagingSenderId: '455828664357',
  appId: '1:455828664357:web:993137cee2c276f63e4fcc',
  measurementId: 'G-NQH4FV7C97'
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Analytics is strictly optional — load it dynamically, only where supported,
// and never let it break the app (e.g. unsupported browsers, blocked scripts).
if (typeof window !== 'undefined') {
  import('firebase/analytics')
    .then(({ isSupported, getAnalytics }) =>
      isSupported().then((supported) => {
        if (supported) getAnalytics(app);
      })
    )
    .catch(() => {
      /* analytics unavailable — ignore */
    });
}

export interface GoogleSignInResult {
  idToken: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  phoneNumber?: string;
}

/** Error code carried on friendly sign-in errors so callers can tell a user
 *  cancellation apart from a real failure. */
const CANCELLED_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

/** True when the user simply closed/dismissed the Google popup. */
export const isSignInCancelled = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (error as any).cancelled === true);

const toFriendlyError = (error: any): Error => {
  const code: string = error?.code || '';
  let message = 'Google sign-in failed. Please try again.';
  let cancelled = false;

  if (CANCELLED_CODES.includes(code)) {
    message = 'Sign-in was cancelled';
    cancelled = true;
  } else if (code === 'auth/popup-blocked') {
    message = 'Popup was blocked — allow popups and try again';
  } else if (code === 'auth/unauthorized-domain') {
    message = 'This domain is not authorized in Firebase';
  }

  const friendly = new Error(message) as Error & { code?: string; cancelled?: boolean };
  friendly.code = code;
  friendly.cancelled = cancelled;
  return friendly;
};

/**
 * Opens the Google sign-in popup and returns the Firebase ID token plus
 * basic profile fields, shaped for AuthContext.loginWithFirebase().
 * Throws an Error with a friendly message on failure; use isSignInCancelled()
 * to detect the user closing the popup.
 */
export const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return {
      idToken,
      email: result.user.email || undefined,
      displayName: result.user.displayName || undefined,
      photoUrl: result.user.photoURL || undefined,
      phoneNumber: result.user.phoneNumber || undefined
    };
  } catch (error: any) {
    console.error('Google sign-in error:', error?.code || error);
    throw toFriendlyError(error);
  }
};

/** Back-compat alias (older components import this name). */
export const signInWithGooglePopup = signInWithGoogle;

/** Signs out of Firebase (non-blocking; app auth state lives in AuthContext). */
export const signOutFirebase = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch {
    // non-blocking
  }
};

export { app, auth, googleProvider };
