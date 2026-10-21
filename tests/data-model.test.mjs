import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {validateQuestions,escapeHtml,recordToDocument,documentToRecord} from '../app/src/data-model.js';
test('all existing question banks survive migration without schema changes',async()=>{
  const paths=['quiz_data.json',...(await readdir('quiz_data')).map(p=>'quiz_data/'+p)];
  let count=0;
  for (const path of paths) {const questions=JSON.parse(await readFile(path,'utf8'));assert.equal(validateQuestions(questions),questions);count+=questions.length;}
  assert.equal(count,66);
});
test('historical score and review details round trip exactly',async()=>{
  for (const path of await readdir('records')) {
    const data=JSON.parse(await readFile('records/'+path,'utf8'));
    const {ownerUid,createdAt,id,...rest}=documentToRecord(recordToDocument(data,'legacy','timestamp'),path);
    assert.deepEqual(rest,data);
  }
});
test('reject corrupt upload and out-of-bounds answer index',()=>{
  assert.throws(()=>validateQuestions([]));
  assert.throws(()=>validateQuestions([{question:'a',date:'2026-01-01',options:['a','b'],answer:5}]));
});
test('HTML rendering escapes user answers and dataset text',()=>{assert.equal(escapeHtml('<img onerror="x">&'), '&lt;img onerror=&quot;x&quot;&gt;&amp;');});
