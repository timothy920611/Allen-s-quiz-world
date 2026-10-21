import {loadRecord} from './firebase.js';
import {escapeHtml} from './data-model.js';

        const QUIZ_HISTORY_KEY = 'allen_quiz_history_v1';

        function getHistory() {
            try {
                const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }

        async function init() {
            const params = new URLSearchParams(location.search);
            const idx = parseInt(params.get('idx'), 10);
            const history = getHistory();

            let record;
            try { record = params.get('id') ? await loadRecord(params.get('id')) : history[idx]; }
            catch { record = history.find(r => r.id === params.get('id')); }
            if (!record) {
                document.getElementById('errorView').classList.remove('hidden');
                return;
            }


            const items = record.reviewItems;

            if (!Array.isArray(items) || items.length === 0) {
                document.getElementById('errorView').classList.remove('hidden');
                return;
            }

            // 填入標題卡資訊
            const score = record.score ?? 0;
            const emoji = score === 100 ? '🏆' : score >= 80 ? '🎉' : score >= 60 ? '👍' : '💪';
            document.getElementById('headerEmoji').textContent = emoji;
            document.getElementById('scoreVal').textContent = score;
            document.getElementById('correctVal').textContent = record.correct ?? '—';
            document.getElementById('totalVal').textContent = record.total ?? items.length;

            const dt = new Date(record.date);
            document.getElementById('dateVal').textContent = isNaN(dt.getTime())
                ? record.date
                : dt.toLocaleString('zh-TW', { hour12: false });
            document.getElementById('rangeVal').textContent =
                record.range === 'all' ? '所有單元' : (record.range || '—');

            // 渲染每一題
            const list = document.getElementById('itemList');
            list.innerHTML = items.map((item, i) => {
                const correct = item.isCorrect;
                const borderColor = correct ? 'border-emerald-200' : 'border-rose-200';
                const badgeBg = correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600';
                const badgeText = correct ? '✅ 答對' : '❌ 答錯';
                const correctColor = 'text-emerald-600';
                const userColor = correct ? 'text-emerald-600' : 'text-rose-600';

                return `
                    <div class="print-card bg-white border ${borderColor} rounded-2xl p-5 md:p-6 fade-in">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div class="flex-1">
                                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">Question ${escapeHtml(item.questionIndex ?? (i + 1))}</span>
                                <h3 class="text-xl font-black text-slate-800 mt-1 leading-snug">${escapeHtml(item.question ?? '')}</h3>
                                ${item.questionPinyin ? `<div class="pinyin mt-1">${escapeHtml(item.questionPinyin)}</div>` : ''}
                            </div>
                            <span class="shrink-0 text-xs font-bold px-3 py-1 rounded-full ${badgeBg}">${badgeText}</span>
                        </div>

                        <div class="border-t border-slate-100 pt-3 space-y-2 text-sm">
                            <div class="flex items-baseline gap-2">
                                <span class="text-slate-400 font-bold shrink-0">你的答案</span>
                                <span class="font-bold ${userColor}">${escapeHtml(item.userAnswer ?? '（未作答）')}</span>
                                ${item.userAnswerPinyin ? `<span class="pinyin">${escapeHtml(item.userAnswerPinyin)}</span>` : ''}
                            </div>
                            ${!correct ? `
                            <div class="flex items-baseline gap-2">
                                <span class="text-slate-400 font-bold shrink-0">正確答案</span>
                                <span class="font-bold ${correctColor}">${escapeHtml(item.correctAnswer ?? '—')}</span>
                                ${item.correctAnswerPinyin ? `<span class="pinyin">${escapeHtml(item.correctAnswerPinyin)}</span>` : ''}
                            </div>
                            ${item.explain ? `
                            <div class="flex items-baseline gap-2">
                                <span class="text-slate-400 font-bold shrink-0">解釋</span>
                                <span class="font-bold text-indigo-600">${escapeHtml(item.explain)}</span>
                            </div>` : ''}` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('quizView').classList.remove('hidden');
            document.title = `考卷紀錄 · ${score} 分`;
        }

        init();

Object.assign(window, {getHistory, init});
