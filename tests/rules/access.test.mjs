import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,writeBatch,serverTimestamp,updateDoc,deleteDoc,getDocs,collection,query,orderBy,limit} from 'firebase/firestore';
import {normalizeQuestion} from '../../src/model.js';
let env;const root='Allen/app',p=uid=>`${root}/users/${uid}/records`;
const base=normalizeQuestion({date:'2026-10-21',question:'這題選甲',options:['甲','乙'],answer:0});
const summary=(uid,changes={})=>({ownerUid:uid,createdAt:serverTimestamp(),score:100,correct:1,total:1,bankLabel:'測試題庫',...changes});
const answer=(changes={})=>({questionIndex:1,question:'問題',questionEn:'',questionPinyin:'',isCorrect:true,userAnswer:'甲',userAnswerPinyin:'',correctAnswer:'甲',correctAnswerPinyin:'',explain:'',...changes});
const ctx=(uid,claims)=>env.authenticatedContext(uid,claims).firestore();
async function upload(db,id,{owner='a',bank={},question={},omitOwner=false}={}) {
 const b=writeBatch(db);if(!omitOwner)b.set(doc(db,`${root}/bankOwners/${id}`),{ownerUid:owner,createdAt:serverTimestamp()});
 b.set(doc(db,`${root}/banks/${id}`),{title:'共享題庫',questionCount:1,createdAt:serverTimestamp(),...bank});b.set(doc(db,`${root}/banks/${id}/questions/001`),{...base,...question});return b.commit();
}
async function submit(db,uid,id,record={},detail={}){const b=writeBatch(db);b.set(doc(db,`${p(uid)}/${id}`),summary(uid,record));b.set(doc(db,`${p(uid)}/${id}/answers/001`),answer(detail));return b.commit();}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-language-allen',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,`${root}/banks/seed`),{title:'共享',questionCount:1,createdAt:new Date('2026-01-01')});await setDoc(doc(db,`${root}/banks/seed/questions/001`),base);await setDoc(doc(db,`${p('a')}/old`),summary('a'));await setDoc(doc(db,`${p('a')}/old/answers/001`),answer());await setDoc(doc(db,`${root}/records/legacy`),{studentName:'legacy-private'});});});
test('unauthenticated clients are denied on every shared, private and legacy path',async()=>{
 const db=env.unauthenticatedContext().firestore();
 for(const path of [`${root}/banks/seed`,`${root}/banks/seed/questions/001`,`${p('a')}/old`,`${p('a')}/old/answers/001`,`${root}/records/legacy`])await assertFails(getDoc(doc(db,path)));
 await assertFails(getDocs(collection(db,`${root}/banks`)));await assertFails(upload(db,'public'));await assertFails(submit(db,'a','public'));
});
test('any anonymous visitor can upload a validated bank and others can use it',async()=>{
 const a=ctx('a'),b=ctx('b');await assertSucceeds(upload(a,'new'));
 await assertSucceeds(getDoc(doc(b,`${root}/banks/new`)));await assertSucceeds(getDoc(doc(b,`${root}/banks/new/questions/001`)));
 await assertSucceeds(getDoc(doc(a,`${root}/bankOwners/new`)));await assertFails(getDoc(doc(b,`${root}/bankOwners/new`)));await assertFails(getDocs(collection(b,`${root}/bankOwners`)));
});
test('bank ownership spoofing, missing ownership and writes to another bank are denied',async()=>{
 await assertFails(upload(ctx('b'),'spoof',{owner:'a'}));await assertFails(upload(ctx('a'),'orphan',{omitOwner:true}));
 await assertSucceeds(upload(ctx('a'),'mine'));
 await assertFails(setDoc(doc(ctx('b'),`${root}/banks/mine/questions/002`),{...base,position:2}));
 await assertFails(setDoc(doc(ctx('a'),`${root}/banks/mine/questions/003`),base));
 await assertFails(updateDoc(doc(ctx('a'),`${root}/bankOwners/mine`),{ownerUid:'b'}));
});
test('bank and every question field are validated at the rules layer',async()=>{
 const a=ctx('a');let n=0;
 for(const bank of [{title:''},{title:'x'.repeat(101)},{questionCount:101},{questionCount:'1'},{secret:'extra'}])await assertFails(upload(a,'bad'+n++,{bank}));
 for(const question of [{question:''},{question:'x'.repeat(4001)},{questionEn:42},{questionPinyin:'x'.repeat(4001)},{passage:'x'.repeat(10001)},{city:'x'.repeat(101)},{hint:'x'.repeat(2001)},{explain:'x'.repeat(4001)},{options:['a',{}]},{options:['a','x'.repeat(501)]},{optionsEn:['a']},{optionsPinyin:[1,2]},{answerIndexes:[2]},{answerIndexes:[0,0]},{acceptedAnswers:['x'.repeat(501)]},{shortAnswer:'unexpected'},{position:0},{type:'admin'},{secret:'extra'}])await assertFails(upload(a,'bad'+n++,{question}));
 const missing={...base};delete missing.question;
 const batch=writeBatch(a);batch.set(doc(a,`${root}/bankOwners/missing`),{ownerUid:'a',createdAt:serverTimestamp()});batch.set(doc(a,`${root}/banks/missing`),{title:'題庫',questionCount:1,createdAt:serverTimestamp()});batch.set(doc(a,`${root}/banks/missing/questions/001`),missing);await assertFails(batch.commit());
});
test('student records and details are private; there is no teacher bypass',async()=>{
 const a=ctx('a');await assertSucceeds(submit(a,'a','new'));await assertSucceeds(getDocs(collection(a,p('a'))));await assertSucceeds(getDoc(doc(a,`${p('a')}/new/answers/001`)));
 for(const b of [ctx('b'),ctx('teacher',{email:'timothy920611@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}})]){
  await assertFails(getDoc(doc(b,`${p('a')}/old`)));await assertFails(getDocs(collection(b,p('a'))));await assertFails(getDoc(doc(b,`${p('a')}/old/answers/001`)));await assertFails(submit(b,'a','stolen'));await assertFails(getDoc(doc(b,`${root}/records/legacy`)));
 }
});
test('records reject bad fields, oversized strings, timestamp spoof and score inconsistency',async()=>{
 let n=0;for(const record of [{ownerUid:'b'},{createdAt:new Date('2020-01-01')},{bankLabel:'x'.repeat(101)},{bankLabel:0},{total:101},{total:0},{score:0},{correct:-1},{score:'100'},{admin:true}])await assertFails(submit(ctx('a'),'a','bad'+n++,record));
 for(const detail of [{isCorrect:'true'},{questionIndex:2},{userAnswer:'x'.repeat(8001)},{questionEn:5},{extra:'x'}])await assertFails(submit(ctx('a'),'a','bad'+n++,{},detail));
 await assertFails(setDoc(doc(ctx('a'),`${p('a')}/missing`),{ownerUid:'a'}));
});
test('updates, deletes, delayed answer writes and orphaned details are denied',async()=>{
 const a=ctx('a');for(const path of [`${root}/banks/seed`,`${root}/banks/seed/questions/001`,`${p('a')}/old`,`${p('a')}/old/answers/001`]){await assertFails(updateDoc(doc(a,path),{ownerUid:'b'}));await assertFails(deleteDoc(doc(a,path)));}
 await assertFails(setDoc(doc(a,`${p('a')}/old/answers/002`),answer()));await assertFails(setDoc(doc(a,`${p('a')}/missing/answers/001`),answer()));
 await assertFails(setDoc(doc(a,'Outside/app'),{admin:true}));
});
test('Core queries allow shared banks and only the current UID history',async()=>{
 const a=ctx('a'),b=ctx('b');
 await assertSucceeds(getDocs(query(collection(b,`${root}/banks`),orderBy('createdAt','desc'),limit(100))));
 await assertSucceeds(getDocs(query(collection(b,`${root}/banks/seed/questions`),orderBy('position'),limit(100))));
 const result=await assertSucceeds(getDocs(query(collection(a,p('a')),orderBy('createdAt','desc'),limit(30))));assert.equal(result.docs.length,1);
 await assertFails(getDocs(collection(b,p('a'))));await assertFails(getDocs(collection(b,`${root}/records`)));
 await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),`${root}/banks`)));
});
test('the complete existing 66-question bank fits one validated atomic upload',async()=>{
 const {readdir}=await import('node:fs/promises');const {parseBank}=await import('../../src/model.js');let raw=[];
 for(const name of ['quiz_data.json',...(await readdir('quiz_data')).map(n=>'quiz_data/'+n)])raw.push(...JSON.parse(await readFile(name,'utf8')));
 const questions=parseBank(raw),db=ctx('a'),batch=writeBatch(db),id='all-66';
 batch.set(doc(db,`${root}/bankOwners/${id}`),{ownerUid:'a',createdAt:serverTimestamp()});batch.set(doc(db,`${root}/banks/${id}`),{title:'全部舊題',questionCount:questions.length,createdAt:serverTimestamp()});
 questions.forEach((q,i)=>batch.set(doc(db,`${root}/banks/${id}/questions/${i+1}`),q));await assertSucceeds(batch.commit());
 const data=await assertSucceeds(getDocs(collection(ctx('b'),`${root}/banks/${id}/questions`)));assert.equal(data.docs.length,66);
});
test('one original four-option question fits rules evaluation budget',async()=>{const q=normalizeQuestion(JSON.parse(await readFile('quiz_data.json','utf8'))[0]);await assertSucceeds(upload(ctx('a'),'original-one',{question:q}));});

test('four long multilingual options and answer indexes fit the validation budget',async()=>{const options=Array.from({length:4},(_,i)=>String(i)+'x'.repeat(498));const q=normalizeQuestion({date:'2026-10-21',question:'最大選項數',options,options_en:options,options_pinyin:options,answer:options.map((_,i)=>i)});await assertSucceeds(upload(ctx('a'),'max-options',{question:q}));});
