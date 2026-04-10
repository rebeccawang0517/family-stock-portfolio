        import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
        import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
        import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, onSnapshot, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

        const firebaseConfig = {
            apiKey: "AIzaSyAt8QWDrmdYxnIsjEWX6DJ5tHXnDPDSwdM",
            authDomain: "rebecca-financial-platform.firebaseapp.com",
            projectId: "rebecca-financial-platform",
            storageBucket: "rebecca-financial-platform.firebasestorage.app",
            messagingSenderId: "335938745651",
            appId: "1:335938745651:web:2c090e33a72db1a5adfa46"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const provider = new GoogleAuthProvider();

        window.loginWithGoogle = async () => {
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                alert('登入失敗：' + error.message);
            }
        };

        window.firebaseApp = { auth, db, provider };
        // 供非 module 的 script 使用 Firebase Firestore
        window._fbDoc = doc;
        window._fbGetDoc = getDoc;
        window._fbSetDoc = setDoc;
