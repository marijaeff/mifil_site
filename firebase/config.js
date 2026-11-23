
export const firebaseConfig = {
  apiKey: "AIzaSyCcQyWsZ8IRb04tiEg-OuYDytao_7MoxZw",
  authDomain: "mifil-website.firebaseapp.com",
  projectId: "mifil-website",
  storageBucket: "mifil-website.firebasestorage.app",
  messagingSenderId: "313361403226",
  appId: "1:313361403226:web:1f362ef0e107804728f763",
  measurementId: "G-KC3FZ97CS7"
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.appId &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain &&
    !Object.values(firebaseConfig).some((value) => String(value).includes('REPLACE_WITH_'))
  );
}
