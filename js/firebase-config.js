// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDOKxjdqE1476uR9zB9lug-sYMFbGwGihk",
  authDomain: "zevanic-erp.firebaseapp.com",
  projectId: "zevanic-erp",
  storageBucket: "zevanic-erp.firebasestorage.app",
  messagingSenderId: "543775962833",
  appId: "1:543775962833:web:4dbec84b555d813bfaf7f0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
