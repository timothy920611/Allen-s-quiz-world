// Official modular Firebase Web SDK; no npm imports or server runtime in the browser.
export {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
export {getAuth,signInAnonymously,connectAuthEmulator} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
export {getFirestore,doc,collection,getDoc,writeBatch,serverTimestamp,connectFirestoreEmulator,getDocs,query,orderBy,limit} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore-lite.js';
