import {initializeApp} from 'firebase/app';
import {getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, connectAuthEmulator} from 'firebase/auth';
import {getFirestore, doc, setDoc, getDoc, collection, serverTimestamp, connectFirestoreEmulator} from 'firebase/firestore/lite';
import {execute, field} from 'firebase/firestore/lite/pipelines';
import {firebaseConfig,DATABASE_ID,ROOT_PATH,TEACHER_EMAIL} from './firebase-config.js';
import {validateQuestions, recordToDocument, documentToRecord} from './data-model.js';
const app = initializeApp(import.meta.env.VITE_USE_EMULATORS === 'true' ? {...firebaseConfig,projectId:'demo-language-allen'} : firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app,import.meta.env.VITE_USE_EMULATORS === 'true' ? '(default)' : DATABASE_ID);
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth,'http://127.0.0.1:9099');
  connectFirestoreEmulator(db,'127.0.0.1',8080);
}
export const authReady = auth.authStateReady();
export function isTeacher(user=auth.currentUser) {return !!user && user.emailVerified && user.email === TEACHER_EMAIL;}
export async function ensureUser() {
  await authReady;
  return auth.currentUser || (await signInAnonymously(auth)).user;
}
export async function loginTeacher() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  await signInWithPopup(auth,provider);
  if (!isTeacher()) throw new Error('此帳號沒有老師權限，請使用指定的老師帳號登入。');
}
export async function logoutTeacher() {await signOut(auth); await ensureUser();}
export {onAuthStateChanged};
export async function loadQuestions() {
  // Enterprise queries use pipelines; the full bank is needed for local quiz randomization.
  const snapshot = await execute(db.pipeline().collection(`${ROOT_PATH}/quiz_data`).sort(field('source').ascending()));
  return snapshot.results.flatMap(r => JSON.parse(r.data().questionsJson));
}
export async function uploadQuestions(questions, source) {
  if (!isTeacher()) throw new Error('請先登入老師帳號');
  validateQuestions(questions);
  const ref = doc(collection(db,`${ROOT_PATH}/quiz_data`));
  await setDoc(ref,{source,questionsJson:JSON.stringify(questions),questionCount:questions.length,uploadedAt:serverTimestamp()});
  return ref.id;
}
export async function saveRecord(record) {
  const user = await ensureUser();
  record.id ||= crypto.randomUUID();
  const ref = doc(db,`${ROOT_PATH}/records`,record.id);
  // A successful retry must not create a second record or alter the immutable timestamp.
  const existing = await getDoc(ref);
  if (!existing.exists()) await setDoc(ref,recordToDocument(record,user.uid,serverTimestamp()));
  return record.id;
}
export async function loadRecords(teacher=false) {
  const user = await ensureUser();
  if (teacher && !isTeacher(user)) throw new Error('請使用老師 Google 帳號登入後查看成績');
  let pipeline = db.pipeline().collection(`${ROOT_PATH}/records`);
  if (!teacher) pipeline = pipeline.where(field('ownerUid').equal(user.uid));
  const snapshot = await execute(pipeline.sort(field('date').descending()));
  return snapshot.results.map(r=>documentToRecord(r.data(),r.id));
}
export async function loadRecord(id) {
  await ensureUser();
  const snapshot = await getDoc(doc(db,`${ROOT_PATH}/records`,id));
  if (!snapshot.exists()) throw new Error('找不到這份考卷');
  return documentToRecord(snapshot.data(),snapshot.id);
}
