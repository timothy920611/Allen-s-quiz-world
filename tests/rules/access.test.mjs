import {test,after,before,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,getDocs,collection,query,where,serverTimestamp} from 'firebase/firestore';
let env;
const projectId='demo-language-allen';
const teacherClaims={email:'timothy920611@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}};
const record=(uid,overrides={})=>({ownerUid:uid,createdAt:serverTimestamp(),date:'2026-10-21T00:00:00.000Z',studentName:'學生',score:80,correct:4,total:5,range:'all',reviewJson:'[]',...overrides});
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'Allen/app'),{name:'Allen'});await setDoc(doc(db,'Allen/app/quiz_data/bank'),{questionsJson:'[]'});await setDoc(doc(db,'Allen/app/records/a'),record('a'));});
});
const dbFor=(uid,claims)=>env.authenticatedContext(uid,claims).firestore();
test('public quiz read succeeds; public and other-user record read/list fail',async()=>{
 const publicDb=env.unauthenticatedContext().firestore();
 await assertSucceeds(getDoc(doc(publicDb,'Allen/app/quiz_data/bank')));
 await assertFails(getDoc(doc(publicDb,'Allen/app/records/a')));
 await assertFails(getDocs(collection(publicDb,'Allen/app/records')));
 await assertFails(getDoc(doc(dbFor('b'),'Allen/app/records/a')));
 await assertFails(getDocs(collection(dbFor('b'),'Allen/app/records')));
});
test('student creates own record, reads it and uses owner-filtered history query',async()=>{
 const db=dbFor('b');await assertSucceeds(setDoc(doc(db,'Allen/app/records/b'),record('b')));
 await assertSucceeds(getDoc(doc(db,'Allen/app/records/b')));
 await assertSucceeds(getDocs(query(collection(db,'Allen/app/records'),where('ownerUid','==','b'))));
 await assertSucceeds(getDoc(doc(db,'Allen/app/records/new-id')));
});
test('teacher reads all; unverified or wrong-provider email cannot escalate',async()=>{
 await assertSucceeds(getDocs(collection(dbFor('teacher',teacherClaims),'Allen/app/records')));
 for (const claims of [{...teacherClaims,email_verified:false},{...teacherClaims,firebase:{sign_in_provider:'password'}},{...teacherClaims,email:'other@example.com'}]) await assertFails(getDocs(collection(dbFor('x',claims),'Allen/app/records')));
});
test('ownership spoof, malformed fields, extra fields, size and timestamp attacks fail',async()=>{
 const db=dbFor('b');
 for (const overrides of [{ownerUid:'a'},{score:'100'},{score:101},{correct:6},{total:0},{studentName:'x'.repeat(101)},{reviewJson:'x'.repeat(150001)},{admin:true},{createdAt:new Date('2020-01-01')},{range:null}]) await assertFails(setDoc(doc(db,'Allen/app/records/attack'),record('b',overrides)));
 const missing=record('b');delete missing.studentName;await assertFails(setDoc(doc(db,'Allen/app/records/attack'),missing));
});
test('immutable records reject edits, ownership changes and deletes',async()=>{
 const db=dbFor('a');const ref=doc(db,'Allen/app/records/a');
 for(const updates of [{score:100},{ownerUid:'b'},{createdAt:serverTimestamp()},{reviewJson:'x'.repeat(150001)}]) await assertFails(updateDoc(ref,updates));
 await assertFails(deleteDoc(ref));
});
test('teacher-only bounded dataset upload and Allen scope',async()=>{
 const data={source:'test.json',questionsJson:'[]',questionCount:2,uploadedAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(dbFor('t',teacherClaims),'Allen/app/quiz_data/new'),data));
 await assertFails(setDoc(doc(dbFor('b'),'Allen/app/quiz_data/new2'),data));
 await assertFails(setDoc(doc(dbFor('t',teacherClaims),'Allen/app/quiz_data/bad'),{...data,extra:true}));
 await assertFails(setDoc(doc(dbFor('b'),'Other/app/records/b'),record('b')));
 await assertFails(setDoc(doc(dbFor('b'),'Allen/app'),{admin:true}));
 await assertFails(getDoc(doc(dbFor('b'),'Allen/app/examples/sample')));
});
test('Enterprise pipelines enforce the exact app queries and reject unconstrained access',async()=>{
 const {execute,field}=await import('firebase/firestore/pipelines');
 const publicDb=env.unauthenticatedContext().firestore()._delegate;
 await assertSucceeds(execute(publicDb.pipeline().collection('Allen/app/quiz_data').sort(field('source').ascending())));
 const db=dbFor('a')._delegate;
 const results=await assertSucceeds(execute(db.pipeline().collection('Allen/app/records').where(field('ownerUid').equal('a')).sort(field('date').descending())));
 assert.equal(results.results.length,1);
 await assertFails(execute(dbFor('b')._delegate.pipeline().collection('Allen/app/records')));
 await assertSucceeds(execute(dbFor('t',teacherClaims)._delegate.pipeline().collection('Allen/app/records').sort(field('date').descending())));
});
