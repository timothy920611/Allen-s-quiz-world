import {ensureUser,loadRecord,localHistoryKey,emulatorMode} from './firebase.js';
import {renderReview,formatDate} from './dom.js';
const $=id=>document.getElementById(id);if(emulatorMode)$('home').href='./index.html?emulator=1';
$('print').addEventListener('click',()=>window.print());
(async()=>{
  try {
    const id=new URLSearchParams(location.search).get('id');if(!id||!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new Error('請從「我的作答紀錄」開啟考卷');
    const user=await ensureUser();let record;
    try{record=await loadRecord(id);}catch(error){let local=[];try{local=JSON.parse(localStorage.getItem(localHistoryKey(user.uid))||'[]');}catch{}record=local.find(r=>r.id===id&&Array.isArray(r.reviewItems));if(!record)throw error;$('status').textContent='暫時顯示本機副本。';}
    if(!Array.isArray(record.reviewItems))throw new Error('此紀錄沒有作答明細');
    if($('status').textContent!=='暫時顯示本機副本。')$('status').textContent='此紀錄僅供這個瀏覽器的匿名身分讀取。';
    $('score').textContent=`${record.score} / 100`;$('meta').textContent=`${record.bankLabel}・${formatDate(record.createdAt)}・答對 ${record.correct}/${record.total}`;
    renderReview($('review'),record.reviewItems);$('print').hidden=false;
  }catch(e){$('status').textContent=e.message;}
})();
