import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAMSFEXW1MpYke8d7qBX4ZUkrZLpS5PU9s',
  authDomain: 'alpahandsign.firebaseapp.com',
  projectId: 'alpahandsign',
  storageBucket: 'alpahandsign.firebasestorage.app',
  messagingSenderId: '418710338339',
  appId: '1:418710338339:web:048bb2c7c714ec287aea96',
  measurementId: 'G-T36RECNG89'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);

export async function initializeFirebaseAnalytics() {
  if (typeof window === 'undefined') {
    return null;
  }

  const supported = await analyticsSupported().catch(() => false);
  if (!supported) {
    return null;
  }

  return getAnalytics(firebaseApp);
}

export default firebaseApp;
