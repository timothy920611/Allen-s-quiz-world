import{g as v,e as n}from"./firebase-DT7rrWm5.js";const w="allen_quiz_history_v1";function c(){try{const s=localStorage.getItem(w),o=s?JSON.parse(s):[];return Array.isArray(o)?o:[]}catch{return[]}}async function p(){const s=new URLSearchParams(location.search),o=parseInt(s.get("idx"),10),l=c();let t;try{t=s.get("id")?await v(s.get("id")):l[o]}catch{t=l.find(e=>e.id===s.get("id"))}if(!t){document.getElementById("errorView").classList.remove("hidden");return}const i=t.reviewItems;if(!Array.isArray(i)||i.length===0){document.getElementById("errorView").classList.remove("hidden");return}const a=t.score??0,g=a===100?"🏆":a>=80?"🎉":a>=60?"👍":"💪";document.getElementById("headerEmoji").textContent=g,document.getElementById("scoreVal").textContent=a,document.getElementById("correctVal").textContent=t.correct??"—",document.getElementById("totalVal").textContent=t.total??i.length;const d=new Date(t.date);document.getElementById("dateVal").textContent=isNaN(d.getTime())?t.date:d.toLocaleString("zh-TW",{hour12:!1}),document.getElementById("rangeVal").textContent=t.range==="all"?"所有單元":t.range||"—";const m=document.getElementById("itemList");m.innerHTML=i.map((e,x)=>{const r=e.isCorrect,u=r?"border-emerald-200":"border-rose-200",y=r?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-600",b=r?"✅ 答對":"❌ 答錯",f="text-emerald-600",h=r?"text-emerald-600":"text-rose-600";return`
                    <div class="print-card bg-white border ${u} rounded-2xl p-5 md:p-6 fade-in">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div class="flex-1">
                                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">Question ${n(e.questionIndex??x+1)}</span>
                                <h3 class="text-xl font-black text-slate-800 mt-1 leading-snug">${n(e.question??"")}</h3>
                                ${e.questionPinyin?`<div class="pinyin mt-1">${n(e.questionPinyin)}</div>`:""}
                            </div>
                            <span class="shrink-0 text-xs font-bold px-3 py-1 rounded-full ${y}">${b}</span>
                        </div>

                        <div class="border-t border-slate-100 pt-3 space-y-2 text-sm">
                            <div class="flex items-baseline gap-2">
                                <span class="text-slate-400 font-bold shrink-0">你的答案</span>
                                <span class="font-bold ${h}">${n(e.userAnswer??"（未作答）")}</span>
                                ${e.userAnswerPinyin?`<span class="pinyin">${n(e.userAnswerPinyin)}</span>`:""}
                            </div>
                            ${r?"":`
                            <div class="flex items-baseline gap-2">
                                <span class="text-slate-400 font-bold shrink-0">正確答案</span>
                                <span class="font-bold ${f}">${n(e.correctAnswer??"—")}</span>
                                ${e.correctAnswerPinyin?`<span class="pinyin">${n(e.correctAnswerPinyin)}</span>`:""}
                            </div>
                            ${e.explain?`
                            <div class="flex items-baseline gap-2">
                                <span class="text-slate-400 font-bold shrink-0">解釋</span>
                                <span class="font-bold text-indigo-600">${n(e.explain)}</span>
                            </div>`:""}`}
                        </div>
                    </div>
                `}).join(""),document.getElementById("quizView").classList.remove("hidden"),document.title=`考卷紀錄 · ${a} 分`}p();Object.assign(window,{getHistory:c,init:p});
