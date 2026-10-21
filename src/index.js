import {ensureUser,listBanks,loadQuestions,uploadBank,saveRecord,loadRecords,localHistoryKey,emulatorMode} from './firebase.js';
import {shuffle,shuffleOptions,grade,hasAnswer} from './model.js';
import {el,renderReview,formatDate} from './dom.js';
const $=id=>document.getElementById(id);
let bankQuestions=[],quiz=[],answers=[],currentRecord,uid='',bankLabel='',showEnglish=false,bankLoad=0;
function status(message,kind='') {$('status').textContent=message;$('status').className=`notice ${kind}`;}
function readLocal() {try{const records=JSON.parse(localStorage.getItem(localHistoryKey(uid))||'[]');return Array.isArray(records)?records:[];}catch{return [];}}
function writeLocal(records) {try{localStorage.setItem(localHistoryKey(uid),JSON.stringify(records.slice(0,30)));}catch{/* Cloud sync still runs if local storage is unavailable. */}}
function cacheRecord(record) {writeLocal([record,...readLocal().filter(r=>r.id!==record.id)]);}
async function refreshBanks(selected='') {
  const request=++bankLoad;$('refresh').disabled=true;$('start').disabled=true;$('bank').disabled=true;status('正在載入共享題庫…');
  try {
    uid=(await ensureUser()).uid;$('upload-button').disabled=false;
    const banks=await listBanks();if(request!==bankLoad)return;
    $('bank').replaceChildren(...banks.map(b=>el('option',{text:`${b.title}（${b.questionCount} 題）`,attrs:{value:b.id}})));
    if(!banks.length){status('還沒有題庫。歡迎上傳第一份共享題庫。');return;}
    $('bank').value=banks.some(b=>b.id===selected)?selected:banks.some(b=>b.id==='original-66-v3')?'original-66-v3':banks[0].id;
    $('bank').disabled=false;await selectBank();
  } catch(e){status(`連線失敗：${e.message}。請按重新整理重試。`,'error');}
  finally{$('refresh').disabled=false;}
}
async function selectBank() {
  const id=$('bank').value;bankQuestions=[];$('start').disabled=true;status('正在載入題目…');
  try {
    const questions=await loadQuestions(id);if(id!==$('bank').value)return;
    bankQuestions=questions;
    bankLabel=$('bank').selectedOptions[0]?.textContent.replace(/（\d+ 題）$/,'')||'共享題庫';
    const dates=[...new Set(questions.map(q=>q.date))].sort().reverse();
    $('unit').replaceChildren(el('option',{text:'所有單元隨機',attrs:{value:'all'}}),...dates.map(d=>el('option',{text:`${d} — ${questions.filter(q=>q.date===d).length} 題`,attrs:{value:d}})));
    if(!questions.length)throw new Error('此題庫沒有可用題目，請選擇其他題庫');
    $('start').disabled=false;status(`已載入 ${questions.length} 題。上傳的共享題庫可供所有訪客使用。`,'success');
  }catch(e){status(e.message,'error');}
}
function renderQuestions() {
  $('questions').replaceChildren();
  quiz.forEach((q,index)=>{
    const card=el('fieldset',{className:'question-card'});
    card.append(el('legend',{text:`第 ${index+1} 題：${q.question}`}));
    if(q.city)card.append(el('p',{text:`城市：${q.city}`,className:'question-number'}));
    if(q.passage)card.append(el('p',{text:q.passage,className:'passage'}));
    if(showEnglish&&q.passageEn)card.append(el('p',{text:q.passageEn,className:'english'}));
    if(q.passagePinyin)card.append(el('p',{text:q.passagePinyin,className:'pinyin'}));
    if(showEnglish&&q.questionEn)card.append(el('p',{text:q.questionEn,className:'english'}));
    if(q.questionPinyin)card.append(el('p',{text:q.questionPinyin,className:'pinyin'}));
    if(q.type==='short_answer') {
      const input=el('input',{attrs:{type:'text',maxlength:'500',id:`answer-${index}`,required:'',autocomplete:'off'}});
      card.append(el('label',{text:'請輸入答案',attrs:{for:input.id}}),input);
      input.addEventListener('input',()=>{answers[index]=input.value;});
    }else {
      const multi=q.answerIndexes.length>1;if(multi)card.append(el('p',{text:'這題可複選，請選出所有正確答案。',className:'muted'}));
      q.options.forEach((option,n)=>{
        const input=el('input',{attrs:{type:multi?'checkbox':'radio',name:`question-${index}`,value:n}});
        const lines=el('span',{children:[el('span',{text:option})]});
        if(showEnglish&&q.optionsEn[n])lines.append(el('p',{text:q.optionsEn[n],className:'english'}));
        if(q.optionsPinyin[n])lines.append(el('p',{text:q.optionsPinyin[n],className:'pinyin'}));
        card.append(el('label',{className:'option',children:[input,lines]}));
        input.addEventListener('change',()=>{answers[index]=[...card.querySelectorAll('input:checked')].map(node=>Number(node.value));});
      });
    }
    card.append(el('details',{children:[el('summary',{text:'💡 提示'}),el('p',{text:q.hint||'這題目前沒有提示。'})]}));
    $('questions').append(card);
  });
}
$('quiz-settings').addEventListener('submit',event=>{
  event.preventDefault();const types=[...document.querySelectorAll('input[name=type]:checked')].map(n=>n.value);
  const pool=bankQuestions.filter(q=>types.includes(q.type)&&($('unit').value==='all'||q.date===$('unit').value));
  if(!pool.length)return status('這個範圍沒有符合條件的題目，請調整題型或單元。','error');
  const count=document.querySelector('input[name=count]:checked').value;
  quiz=shuffle(pool).slice(0,count==='all'?100:Number(count)).map(shuffleOptions);answers=[];showEnglish=$('show-english').checked;
  renderQuestions();$('settings').hidden=true;$('result').hidden=true;$('quiz').hidden=false;$('submit-quiz').disabled=false;
  $('quiz-title').focus();status(`本次練習共 ${quiz.length} 題。`);
});
async function syncRecord() {
  $('retry-sync').hidden=true;$('sync-status').textContent='正在儲存私人作答紀錄…';
  try{await saveRecord(currentRecord);currentRecord.synced=true;cacheRecord(currentRecord);$('sync-status').textContent='✓ 作答紀錄已儲存，只有這個瀏覽器的匿名身分能讀取。';}
  catch(e){$('sync-status').textContent=`尚未同步：${e.message}。保留此頁可重試；本機空間可用時也會留存副本。`;$('retry-sync').hidden=false;}
  await refreshHistory();
}
$('quiz-form').addEventListener('submit',async event=>{
  event.preventDefault();if($('submit-quiz').disabled)return;
  const missing=quiz.findIndex((q,i)=>!hasAnswer(q,answers[i]));
  if(missing>=0){status(`請先完成第 ${missing+1} 題。`,'error');$('questions').children[missing].querySelector('input')?.focus();return;}
  $('submit-quiz').disabled=true;
  currentRecord={id:crypto.randomUUID(),...grade(quiz,answers),bankLabel,createdAt:new Date().toISOString(),synced:false};cacheRecord(currentRecord);
  $('quiz').hidden=true;$('result').hidden=false;$('score').textContent=`${currentRecord.score} / 100`;
  $('result-message').textContent=currentRecord.score===100?'🏆 太厲害了，滿分！':`答對 ${currentRecord.correct} / ${currentRecord.total} 題，再多練習幾次會更熟悉。`;
  renderReview($('review'),currentRecord.reviewItems,{showEnglish});$('result-title').focus();await syncRecord();
});
async function refreshHistory() {
  $('refresh-history').disabled=true;$('history-status').textContent='正在讀取私人紀錄…';
  let records=readLocal();
  try{const cloud=await loadRecords();const merged=new Map(records.map(r=>[r.id,r]));for(const r of cloud)merged.set(r.id,{...merged.get(r.id),...r,synced:true});records=[...merged.values()].sort((a,b)=>new Date(formatSort(b.createdAt))-new Date(formatSort(a.createdAt))).slice(0,30);writeLocal(records);$('history-status').textContent=records.length?'':'目前還沒有作答紀錄。';}
  catch{$('history-status').textContent=records.length?'暫時無法取得雲端紀錄，以下為本機副本。':'暫時無法讀取紀錄，可稍後重新整理。';}
  $('history-list').replaceChildren(...records.map(r=>{
    const params=new URLSearchParams({id:r.id});if(emulatorMode)params.set('emulator','1');
    return el('article',{className:'history-item',children:[el('div',{children:[el('p',{text:`${r.score} 分（${r.correct}/${r.total}）`,className:'score-small'}),el('p',{text:r.bankLabel}),el('p',{text:formatDate(r.createdAt),className:'muted'})]}),el('a',{text:'查看考卷',attrs:{href:`./see_quiz.html?${params}`}})]});}));
  $('refresh-history').disabled=false;
}
function formatSort(value){return value?.toDate?value.toDate():value?.seconds?new Date(value.seconds*1000):value;}
$('upload-form').addEventListener('submit',async event=>{
  event.preventDefault();const file=$('file').files[0];if(!file)return;
  if(file.size>2000000)return status('檔案超過 2MB，請拆分後再上傳。','error');
  $('upload-button').disabled=true;status('正在上傳共享題庫，請保留此頁…');
  try{const bankId=await uploadBank(JSON.parse(await file.text()),$('bank-title').value);$('upload-form').reset();await refreshBanks(bankId);status('✓ 題庫已分享！所有訪客重新整理後即可使用。','success');}
  catch(e){status(`上傳失敗：${e.message}`,'error');}
  finally{$('upload-button').disabled=false;}
});
document.querySelector('nav a[href="#upload"]').addEventListener('click',()=>{$('upload').open=true;});
$('refresh').addEventListener('click',()=>refreshBanks($('bank').value));$('bank').addEventListener('change',selectBank);
$('refresh-history').addEventListener('click',refreshHistory);$('retry-sync').addEventListener('click',syncRecord);
$('restart').addEventListener('click',()=>{$('result').hidden=true;$('settings').hidden=false;$('start').focus();});
(async()=>{try{const user=await ensureUser();uid=user.uid;$('upload-button').disabled=false;await Promise.all([refreshBanks(),refreshHistory()]);}catch(e){status(`無法連線：${e.message}。請確認網路後重新整理。`,'error');}})();
