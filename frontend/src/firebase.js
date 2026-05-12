// Firebase initialization. The values below are public (the apiKey is a
// browser-restricted key) and safe to commit. Real access control lives in
// firestore.rules: anyone can read /games/{gameId}; only the backend
// service account (which bypasses rules) can write.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
	apiKey: 'AIzaSyA9WhhixSPSDVQaE0o6hKpZ_isCdBr7Zsw',
	authDomain: 'up-and-down-the-river-449922.firebaseapp.com',
	projectId: 'up-and-down-the-river-449922',
	storageBucket: 'up-and-down-the-river-449922.firebasestorage.app',
	messagingSenderId: '755936114859',
	appId: '1:755936114859:web:35f38759b5d5b469c15fee',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
