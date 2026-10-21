// Run only after provisioning and deploying rules: npm run migrate -- --write
// Credentials remain in the Firebase CLI/ADC; no tokens are read from old HTML.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateQuestions,recordToDocument} from '../app/src/data-model.js';
const projectId='language-timothy920611',databaseId='allen';
const root=`projects/${projectId}/databases/${databaseId}/documents`;
const digest=text=>createHash('sha256').update(text).digest('hex');
const idFor=path=>digest(path).slice(0,32);
const fields=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,typeof v==='number'?{integerValue:String(v)}:{stringValue:v}]));
const entries=[];
for (const path of ['quiz_data.json',...(await readdir('quiz_data')).filter(x=>x.endsWith('.json')).sort().map(x=>'quiz_data/'+x)]) {
 const content=await readFile(path,'utf8');const questions=validateQuestions(JSON.parse(content));
 entries.push({path,collection:'quiz_data',id:idFor(path),hash:digest(content),document:{fields:{...fields({source:path,questionCount:questions.length,questionsJson:JSON.stringify(questions)}),uploadedAt:{timestampValue:'2026-10-21T00:00:00.000Z'}}}});
}
for (const file of (await readdir('records')).filter(x=>x.endsWith('.json')).sort()) {
 const path='records/'+file,content=await readFile(path,'utf8'),record=JSON.parse(content);
 entries.push({path,collection:'records',id:idFor(path),hash:digest(content),document:{fields:{...fields(recordToDocument(record,'legacy',record.date)),createdAt:{timestampValue:record.date}}}});
}
const example=await readFile('example.json','utf8');
entries.push({path:'example.json',collection:'examples',id:'example',hash:digest(example),document:{fields:fields({source:'example.json',questionsJson:example})}});
const report={projectId,databaseId,rootPath:'Allen/app',datasets:entries.filter(e=>e.collection==='quiz_data').length,questions:entries.filter(e=>e.collection==='quiz_data').reduce((n,e)=>n+Number(e.document.fields.questionCount.integerValue),0),records:entries.filter(e=>e.collection==='records').length,files:entries.map(({path,id,hash,collection})=>({path,id,sha256:hash,collection}))};
if (!process.argv.includes('--write')) {console.log(JSON.stringify(report,null,2));process.exit(0);}
const client=new Client({name:'allen-data-migration',version:'1.0.0'});
const transport=new StdioClientTransport({command:'npx',env:Object.fromEntries(Object.entries(process.env).filter(([,v])=>typeof v==='string')),args:['-y','firebase-tools@latest','mcp','--dir',process.cwd(),'--only','core,firestore']});
await client.connect(transport);
async function call(name,args) {
 const result=await client.callTool({name,arguments:args});
 if (result.isError) throw new Error(result.content?.map(c=>c.text||'').join('\n'));
 return result.structuredContent;
}
async function createAndVerify(parent,collectionId,documentId,document) {
 const name=`${parent}/${collectionId}/${documentId}`;
 try {await call('firestore_add_document',{parent,collectionId,documentId,document});}
 catch(e) {if (!/already exists|ALREADY_EXISTS|409/i.test(e.message)) throw e;}
 const result=await call('firestore_get_document',{name});
 for(const [key,value] of Object.entries(document.fields)) {
  // Firestore normalizes timestamp precision, compare instants for timestamp fields.
  const actual=result.fields?.[key];
  const matches=value.timestampValue ? Date.parse(actual?.timestampValue)===Date.parse(value.timestampValue) : JSON.stringify(actual)===JSON.stringify(value);
  if (!matches) throw new Error(`Verification failed: ${name} field ${key}`);
 }
}
try {
 const database=await call('firestore_get_database',{name:`projects/${projectId}/databases/${databaseId}`});
 if(database.databaseEdition!=='ENTERPRISE'||database.firestoreDataAccessMode!=='DATA_ACCESS_MODE_ENABLED')throw new Error('Expected Enterprise database with Firestore data access enabled');
 await createAndVerify(root,'Allen','app',{fields:fields({name:'Allen',migrationSource:'timothy920611/Allen-s-quiz-world'})});
 for(const entry of entries){await createAndVerify(`${root}/Allen/app`,entry.collection,entry.id,entry.document);console.log('Verified '+entry.path);}
 report.verifiedAt=new Date().toISOString();
 await writeFile('migration-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(`Verified ${report.questions} questions and ${report.records} records in Allen/app.`);
} finally {await client.close();}
