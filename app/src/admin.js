import {loadRecords as loadCloudRecords,isTeacher} from './firebase.js';
import {mountAuthUI} from './auth-ui.js';
import {escapeHtml} from './data-model.js';


        let allRecords = [];
        let sortKey = 'date';

        async function loadRecords() {
            show('loadingView');
            hide('errorView'); hide('emptyView'); hide('mainView');

            try {
                const records = await loadCloudRecords(true);
                if (!isTeacher()) return;
                allRecords = records;
                hide('loadingView');
                renderDashboard();
            } catch (err) {
                showError(err.message);
            }
        }

        function renderDashboard() {
            if (allRecords.length === 0) { show('emptyView'); return; }

            // 統計
            const scores = allRecords.map(r => r.score ?? 0);
            document.getElementById('statTotal').textContent = allRecords.length;
            document.getElementById('statAvg').textContent = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
            document.getElementById('statHigh').textContent = Math.max(...scores);
            document.getElementById('statLow').textContent = Math.min(...scores);

            renderList();
            show('mainView');
        }

        function sortRecords(key) {
            sortKey = key;
            document.querySelectorAll('.sort-btn').forEach(btn => {
                btn.className = "sort-btn text-xs font-bold px-4 py-1.5 rounded-full border transition-all bg-white text-slate-500 border-slate-200 hover:border-indigo-300";
            });
            document.getElementById(`sort${key.charAt(0).toUpperCase()+key.slice(1)}`).className =
                "sort-btn text-xs font-bold px-4 py-1.5 rounded-full border transition-all bg-indigo-600 text-white border-indigo-600";
            renderList();
        }

        function renderList() {
            const sorted = [...allRecords].sort((a, b) => {
                if (sortKey === 'date') return new Date(b.date) - new Date(a.date);
                if (sortKey === 'score') return (b.score ?? 0) - (a.score ?? 0);
                if (sortKey === 'name') return (a.studentName || '').localeCompare(b.studentName || '', 'zh-TW');
                return 0;
            });

            document.getElementById('recordList').innerHTML = sorted.map((record, idx) => {
                const dt = new Date(record.date);
                const dateText = isNaN(dt.getTime()) ? record.date : dt.toLocaleString('zh-TW', { hour12: false });
                const score = record.score ?? 0;
                const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-500' : 'text-rose-500';
                const rangeTxt = record.range === 'all' ? '所有單元' : (record.range || '—');
                const emoji = score === 100 ? '🏆' : score >= 80 ? '🎉' : score >= 60 ? '👍' : '💪';

                return `
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 fade-in flex items-center justify-between gap-4">
                        <div class="flex items-center gap-4 min-w-0">
                            <div class="text-3xl shrink-0">${emoji}</div>
                            <div class="min-w-0">
                                <p class="font-black text-slate-800 text-base truncate">${escapeHtml(record.studentName || '（未填姓名）')}</p>
                                <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(dateText)}　範圍：${escapeHtml(rangeTxt)}</p>
                                <p class="text-xs text-slate-400">答對 ${record.correct ?? '?'} / ${record.total ?? '?'} 題</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                            <div class="text-right">
                                <span class="text-4xl font-black ${scoreColor}">${score}</span>
                                <span class="text-slate-300 font-bold text-lg"> 分</span>
                            </div>
                            ${Array.isArray(record.reviewItems) && record.reviewItems.length > 0
                                ? `<button onclick='openModal(${idx})' class="text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all whitespace-nowrap">📋 考卷</button>`
                                : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // 儲存當前排序順序供 modal 使用
            window._sortedRecords = sorted;
        }

        function openModal(idx) {
            const record = window._sortedRecords[idx];
            if (!record) return;

            const dt = new Date(record.date);
            const dateText = isNaN(dt.getTime()) ? record.date : dt.toLocaleString('zh-TW', { hour12: false });
            const score = record.score ?? 0;

            document.getElementById('modalTitle').textContent = `${record.studentName || '未知'} 的考卷`;
            document.getElementById('modalMeta').textContent = `${escapeHtml(dateText)}　${score} 分 (${record.correct}/${record.total})　範圍：${record.range === 'all' ? '所有單元' : record.range}`;

            document.getElementById('modalBody').innerHTML = record.reviewItems.map(item => `
                <div class="border ${item.isCorrect ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/30'} rounded-2xl p-4">
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <p class="font-bold text-slate-800 text-sm leading-snug">第 ${escapeHtml(item.questionIndex)} 題：${escapeHtml(item.question)}</p>
                        <span class="shrink-0 text-xs font-bold ${item.isCorrect ? 'text-emerald-600' : 'text-rose-600'}">${item.isCorrect ? '✅' : '❌'}</span>
                    </div>
                    ${item.questionPinyin ? `<p class="text-indigo-500 text-xs mb-2">${escapeHtml(item.questionPinyin)}</p>` : ''}
                    <p class="text-sm text-slate-600">
                        作答：<span class="font-bold ${item.isCorrect ? 'text-emerald-600' : 'text-rose-600'}">${escapeHtml(item.userAnswer || '（未作答）')}</span>
                        ${item.userAnswerPinyin ? `<span class="text-indigo-400 text-xs ml-1">${escapeHtml(item.userAnswerPinyin)}</span>` : ''}
                    </p>
                    ${!item.isCorrect ? `
                    <p class="text-sm text-slate-600 mt-1">
                        正解：<span class="font-bold text-emerald-600">${escapeHtml(item.correctAnswer)}</span>
                        ${item.correctAnswerPinyin ? `<span class="text-indigo-400 text-xs ml-1">${escapeHtml(item.correctAnswerPinyin)}</span>` : ''}
                    </p>` : ''}
                    ${item.explain ? `
                    <p class="text-sm text-slate-600 mt-1">
                        解釋：<span class="font-bold text-indigo-600">${escapeHtml(item.explain)}</span>
                    </p>` : ''}
                </div>
            `).join('');

            document.getElementById('modal').classList.remove('hidden');
        }

        function closeModal(e) {
            if (e.target === document.getElementById('modal')) {
                document.getElementById('modal').classList.add('hidden');
            }
        }

        function show(id) { document.getElementById(id).classList.remove('hidden'); }
        function hide(id) { document.getElementById(id).classList.add('hidden'); }

        function showError(msg) {
            hide('loadingView');
            document.getElementById('errorMsg').textContent = msg;
            show('errorView');
        }

        mountAuthUI(teacher=>{
            allRecords=[];
            hide('mainView'); hide('emptyView');
            document.getElementById('recordList').replaceChildren();
            document.getElementById('modal').classList.add('hidden');
            document.getElementById('modalBody').replaceChildren();
            if (teacher) loadRecords();
            else showError('請先使用老師 Google 帳號登入');
        });

Object.assign(window, {loadRecords, renderDashboard, sortRecords, renderList, openModal, closeModal, show, hide, showError});
