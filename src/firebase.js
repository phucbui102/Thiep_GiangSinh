import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#create-project-and-register-app
const firebaseConfig = {
    apiKey: "AIzaSyD7ITtvrFdlxe0Q0CFC2N_du5bIRxYKu-8",
    authDomain: "thiepgiangsinh-860b7.firebaseapp.com",
    projectId: "thiepgiangsinh-860b7",
    storageBucket: "thiepgiangsinh-860b7.firebasestorage.app",
    messagingSenderId: "832232063208",
    appId: "1:832232063208:web:81d8ce8e25c42648cf495d",
    measurementId: "G-ME0KHXNR63"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
