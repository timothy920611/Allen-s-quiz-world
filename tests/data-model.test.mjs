import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {parseBank,normalizeQuestion,grade,shuffleOptions} from '../src/model.js';
const base={date:'2026-10-21',question:'問題',options:['甲','乙'],answer:0};
test('preserves all 66 original questions and every legacy question type',async()=>{
 let total=0;
 for(const path of ['quiz_data.json',...(await readdir('quiz_data')).map(x=>'quiz_data/'+x)]){const original=JSON.parse(await readFile(path,'utf8'));const normalized=parseBank(original);assert.equal(normalized.length,original.length);for(let i=0;i<original.length;i++)assert.equal(normalized[i].question,original[i].question);total+=normalized.length;}
 assert.equal(total,66);
});
test('grades multiple answers, short answers and true/false correctly',()=>{
 const questions=parseBank([base,{...base,answer:[0,1]},{date:base.date,question:'簡答',type:'short_answer',short_answer:'decision',accepted_answers:['a decision']},{date:base.date,question:'是非',type:'true_false',answer_boolean:false}]);
 const result=grade(questions,[[0],[1,0],' A Decision ',[1]]);assert.equal(result.score,100);assert.equal(result.reviewItems.length,4);
 assert.throws(()=>grade(questions,[[0],[],null,[1]]));
});
test('shuffling keeps answers aligned across language variants',()=>{
 const q=normalizeQuestion({...base,options_en:['A','B'],options_pinyin:['jiǎ','yǐ']});
 for(let i=0;i<20;i++){const s=shuffleOptions(q);const correct=s.answerIndexes[0];assert.equal(s.options[correct],'甲');assert.equal(s.optionsEn[correct],'A');assert.equal(s.optionsPinyin[correct],'jiǎ');}
});
test('rejects invalid, oversized and unsupported uploads; strips unrelated fields',()=>{
 for(const bad of [[],Array(101).fill(base),[{...base,question:''}],[{...base,answer:5}],[{...base,type:'admin'}],[{...base,options:['a',{}]}],[{...base,hint:'x'.repeat(2001)}]])assert.throws(()=>parseBank(bad));
 const q=normalizeQuestion({...base,serviceAccount:'private',ownerUid:'other'});assert.equal(q.serviceAccount,undefined);assert.equal(q.ownerUid,undefined);
});
test('front-end has no HTML injection sinks, inline handlers, roles or bundled SDK imports',async()=>{
 for(const name of await readdir('src')){const source=await readFile('src/'+name,'utf8');assert.doesNotMatch(source,/\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write\s*\(|\beval\s*\(/,name);assert.doesNotMatch(source,/signInWithPopup|GoogleAuthProvider|TEACHER_EMAIL|from ['"]firebase\//,name);}
 for(const name of ['index.html','see_quiz.html'])assert.doesNotMatch(await readFile(name,'utf8'),/\son\w+=/i);
 const sdk=await readFile('src/sdk.js','utf8');assert.match(sdk,/https:\/\/www\.gstatic\.com\/firebasejs\/13\.0\.0\/firebase-auth\.js/);
});
