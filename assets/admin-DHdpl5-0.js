import{e as s,l as f,i as b}from"./firebase-DT7rrWm5.js";import{m as h}from"./auth-ui-C2NU881W.js";let r=[],i="date";async function u(){d("loadingView"),a("errorView"),a("emptyView"),a("mainView");try{const t=await f(!0);if(!b())return;r=t,a("loadingView"),g()}catch(t){x(t.message)}}function g(){if(r.length===0){d("emptyView");return}const t=r.map(e=>e.score??0);document.getElementById("statTotal").textContent=r.length,document.getElementById("statAvg").textContent=Math.round(t.reduce((e,o)=>e+o,0)/t.length),document.getElementById("statHigh").textContent=Math.max(...t),document.getElementById("statLow").textContent=Math.min(...t),m(),d("mainView")}function y(t){i=t,document.querySelectorAll(".sort-btn").forEach(e=>{e.className="sort-btn text-xs font-bold px-4 py-1.5 rounded-full border transition-all bg-white text-slate-500 border-slate-200 hover:border-indigo-300"}),document.getElementById(`sort${t.charAt(0).toUpperCase()+t.slice(1)}`).className="sort-btn text-xs font-bold px-4 py-1.5 rounded-full border transition-all bg-indigo-600 text-white border-indigo-600",m()}function m(){const t=[...r].sort((e,o)=>i==="date"?new Date(o.date)-new Date(e.date):i==="score"?(o.score??0)-(e.score??0):i==="name"?(e.studentName||"").localeCompare(o.studentName||"","zh-TW"):0);document.getElementById("recordList").innerHTML=t.map((e,o)=>{const l=new Date(e.date),c=isNaN(l.getTime())?e.date:l.toLocaleString("zh-TW",{hour12:!1}),n=e.score??0,p=n>=80?"text-emerald-600":n>=60?"text-amber-500":"text-rose-500",w=e.range==="all"?"所有單元":e.range||"—";return`
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 fade-in flex items-center justify-between gap-4">
                        <div class="flex items-center gap-4 min-w-0">
                            <div class="text-3xl shrink-0">${n===100?"🏆":n>=80?"🎉":n>=60?"👍":"💪"}</div>
                            <div class="min-w-0">
                                <p class="font-black text-slate-800 text-base truncate">${s(e.studentName||"（未填姓名）")}</p>
                                <p class="text-xs text-slate-400 mt-0.5">${s(c)}　範圍：${s(w)}</p>
                                <p class="text-xs text-slate-400">答對 ${e.correct??"?"} / ${e.total??"?"} 題</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                            <div class="text-right">
                                <span class="text-4xl font-black ${p}">${n}</span>
                                <span class="text-slate-300 font-bold text-lg"> 分</span>
                            </div>
                            ${Array.isArray(e.reviewItems)&&e.reviewItems.length>0?`<button onclick='openModal(${o})' class="text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all whitespace-nowrap">📋 考卷</button>`:""}
                        </div>
                    </div>
                `}).join(""),window._sortedRecords=t}function $(t){const e=window._sortedRecords[t];if(!e)return;const o=new Date(e.date),l=isNaN(o.getTime())?e.date:o.toLocaleString("zh-TW",{hour12:!1}),c=e.score??0;document.getElementById("modalTitle").textContent=`${e.studentName||"未知"} 的考卷`,document.getElementById("modalMeta").textContent=`${s(l)}　${c} 分 (${e.correct}/${e.total})　範圍：${e.range==="all"?"所有單元":e.range}`,document.getElementById("modalBody").innerHTML=e.reviewItems.map(n=>`
                <div class="border ${n.isCorrect?"border-emerald-200 bg-emerald-50/30":"border-rose-200 bg-rose-50/30"} rounded-2xl p-4">
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <p class="font-bold text-slate-800 text-sm leading-snug">第 ${s(n.questionIndex)} 題：${s(n.question)}</p>
                        <span class="shrink-0 text-xs font-bold ${n.isCorrect?"text-emerald-600":"text-rose-600"}">${n.isCorrect?"✅":"❌"}</span>
                    </div>
                    ${n.questionPinyin?`<p class="text-indigo-500 text-xs mb-2">${s(n.questionPinyin)}</p>`:""}
                    <p class="text-sm text-slate-600">
                        作答：<span class="font-bold ${n.isCorrect?"text-emerald-600":"text-rose-600"}">${s(n.userAnswer||"（未作答）")}</span>
                        ${n.userAnswerPinyin?`<span class="text-indigo-400 text-xs ml-1">${s(n.userAnswerPinyin)}</span>`:""}
                    </p>
                    ${n.isCorrect?"":`
                    <p class="text-sm text-slate-600 mt-1">
                        正解：<span class="font-bold text-emerald-600">${s(n.correctAnswer)}</span>
                        ${n.correctAnswerPinyin?`<span class="text-indigo-400 text-xs ml-1">${s(n.correctAnswerPinyin)}</span>`:""}
                    </p>`}
                    ${n.explain?`
                    <p class="text-sm text-slate-600 mt-1">
                        解釋：<span class="font-bold text-indigo-600">${s(n.explain)}</span>
                    </p>`:""}
                </div>
            `).join(""),document.getElementById("modal").classList.remove("hidden")}function v(t){t.target===document.getElementById("modal")&&document.getElementById("modal").classList.add("hidden")}function d(t){document.getElementById(t).classList.remove("hidden")}function a(t){document.getElementById(t).classList.add("hidden")}function x(t){a("loadingView"),document.getElementById("errorMsg").textContent=t,d("errorView")}h(t=>{r=[],a("mainView"),a("emptyView"),document.getElementById("recordList").replaceChildren(),document.getElementById("modal").classList.add("hidden"),document.getElementById("modalBody").replaceChildren(),t?u():x("請先使用老師 Google 帳號登入")});Object.assign(window,{loadRecords:u,renderDashboard:g,sortRecords:y,renderList:m,openModal:$,closeModal:v,show:d,hide:a,showError:x});
