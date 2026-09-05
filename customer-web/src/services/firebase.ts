import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  Auth,
  UserCredential
} from 'firebase/auth';

const metaEnv = (import.meta as any).env || {};

// Firebase configuration with environment variable fallbacks
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || 'AIzaSyAadhiCrackersProductionKeyMock99',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || 'aadhi-crackers.firebaseapp.com',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || 'aadhi-crackers',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || 'aadhi-crackers.appspot.com',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '102938475612',
  appId: metaEnv.VITE_FIREBASE_APP_ID || '1:102938475612:web:aadhi9900aabbccddeeff'
};

let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
} catch (error) {
  console.warn('Firebase initialization warning:', error);
}

export interface FirebaseSignInResult {
  idToken: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  phoneNumber?: string;
  userCredential?: UserCredential;
}

/**
 * Triggers Firebase Google Sign-In popup and extracts the Firebase ID Token
 */
export const signInWithGooglePopup = async (): Promise<FirebaseSignInResult> => {
  if (!auth || !googleProvider) {
    throw new Error('Firebase Auth is not initialized');
  }

  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const idToken = await userCredential.user.getIdToken(true);

    return {
      idToken,
      email: userCredential.user.email || '',
      displayName: userCredential.user.displayName || '',
      photoUrl: userCredential.user.photoURL || undefined,
      phoneNumber: userCredential.user.phoneNumber || undefined,
      userCredential
    };
  } catch (error: any) {
    // Check for popup closed by user or cancelled
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in popup was closed before completing authentication.');
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site.');
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized in Firebase Console. Please add localhost to Authorized Domains.');
    }
    throw error;
  }
};

export const signOutFirebase = async (): Promise<void> => {
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch {
      // non-blocking
    }
  }
};

export { auth, googleProvider };
