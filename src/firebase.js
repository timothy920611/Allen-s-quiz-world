import {initializeApp,getAuth,signInAnonymously,connectAuthEmulator,getFirestore,doc,collection,getDoc,writeBatch,serverTimestamp,connectFirestoreEmulator,getDocs,query,orderBy,limit} from './sdk.js';
import {firebaseConfig,DATABASE_ID,ROOT_PATH,APP_CHECK} from './firebase-config.js';
import {parseBank} from './model.js';
export const emulatorMode=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('emulator')==='1';
export const app=initializeApp(emulatorMode?{...firebaseConfig,projectId:'demo-language-allen'}:firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app,emulatorMode?'(default)':DATABASE_ID);
if(emulatorMode) {connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);}
const appCheckReady=(async()=>{
  if(!APP_CHECK.siteKey||emulatorMode)return;
  const {initializeAppCheck,ReCaptchaV3Provider,ReCaptchaEnterpriseProvider}=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-check.js');
  const provider=APP_CHECK.provider==='enterprise'?new ReCaptchaEnterpriseProvider(APP_CHECK.siteKey):new ReCaptchaV3Provider(APP_CHECK.siteKey);
  initializeAppCheck(app,{provider,isTokenAutoRefreshEnabled:true});
})();
let identityPromise;
export function ensureUser() {
  identityPromise??=(async()=>{await appCheckReady;await auth.authStateReady();return auth.currentUser||(await signInAnonymously(auth)).user;})().catch(e=>{identityPromise=undefined;throw e;});
  return identityPromise;
}
const docs=snapshot=>snapshot.docs.map(result=>({...result.data(),id:result.id}));
export async function listBanks() {
  await ensureUser();
  return docs(await getDocs(query(collection(db,`${ROOT_PATH}/banks`),orderBy('createdAt','desc'),limit(100))));
}
export async function loadQuestions(bankId) {
  await ensureUser();
  const snapshot=await getDocs(query(collection(db,`${ROOT_PATH}/banks/${bankId}/questions`),orderBy('position'),limit(100)));
  return snapshot.docs.map(result=>result.data());
}
export async function uploadBank(raw,title) {
  const user=await ensureUser(),questions=parseBank(raw);
  title=String(title).trim();if(!title||title.length>100)throw new Error('題庫名稱需為 1–100 字');
  const bank=doc(collection(db,`${ROOT_PATH}/banks`));const batch=writeBatch(db);
  batch.set(doc(db,`${ROOT_PATH}/bankOwners`,bank.id),{ownerUid:user.uid,createdAt:serverTimestamp()});
  batch.set(bank,{title,questionCount:questions.length,createdAt:serverTimestamp()});
  questions.forEach((q,i)=>batch.set(doc(db,`${ROOT_PATH}/banks/${bank.id}/questions`,String(i+1).padStart(3,'0')),q));
  await batch.commit();return bank.id;
}
export async function saveRecord(record) {
  const user=await ensureUser();record.id??=crypto.randomUUID();
  const path=`${ROOT_PATH}/users/${user.uid}/records/${record.id}`;
  const prior=await getDoc(doc(db,path));if(prior.exists())return record.id;
  const batch=writeBatch(db);
  batch.set(doc(db,path),{ownerUid:user.uid,createdAt:serverTimestamp(),score:record.score,correct:record.correct,total:record.total,bankLabel:String(record.bankLabel).slice(0,100)});
  record.reviewItems.forEach((answer,i)=>batch.set(doc(db,`${path}/answers`,String(i+1).padStart(3,'0')),answer));
  await batch.commit();return record.id;
}
export async function loadRecords() {
  const user=await ensureUser();
  return docs(await getDocs(query(collection(db,`${ROOT_PATH}/users/${user.uid}/records`),orderBy('createdAt','desc'),limit(30))));
}
export async function loadRecord(id) {
  const user=await ensureUser(),path=`${ROOT_PATH}/users/${user.uid}/records/${id}`;
  const summary=await getDoc(doc(db,path));if(!summary.exists())throw new Error('這個瀏覽器的匿名身分無法讀取此紀錄');
  const answers=await getDocs(query(collection(db,`${path}/answers`),orderBy('questionIndex'),limit(100)));
  return {...summary.data(),id,reviewItems:answers.docs.map(r=>r.data())};
}
export function localHistoryKey(uid) {return `allen_private_history_v3:${uid}`;}
