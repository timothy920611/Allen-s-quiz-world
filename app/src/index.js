import {loadQuestions,uploadQuestions,saveRecord,loadRecords as loadCloudRecords} from './firebase.js';
import {mountAuthUI} from './auth-ui.js';
import {escapeHtml} from './data-model.js';
mountAuthUI();


        let questionBank = [];
        let currentQuiz = [];
        let userAnswers = {};
        let selectedRange = 'all';
        let isAdmin = false;
        let studentName = '';
        let showEnglish = false;
        const QUIZ_HISTORY_KEY = 'allen_quiz_history_v1';

        window.onload = async () => {
            await fetchQuizData();
            renderQuizHistory();
            try {
                const cloud = await loadCloudRecords();
                const merged = new Map(getQuizHistory().map(r=>[r.id || r.date+'|'+r.studentName,r]));
                for (const r of cloud) merged.set(r.id,r);
                localStorage.setItem(QUIZ_HISTORY_KEY,JSON.stringify([...merged.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30)));
                renderQuizHistory();
            } catch { /* Local history remains available when cloud access fails. */ }
        };

        // ── 題庫載入 ────────────────────────────────────────────
        async function fetchQuizData() {
            try {
                questionBank = await fetchAllQuizData();
                if (!Array.isArray(questionBank) || questionBank.length === 0) throw new Error();
                updateDateDropdown();
                document.getElementById('startBtn').disabled = false;
            } catch {
                showStatus("雲端題庫連線失敗，請檢查網路或切換老師模式上傳", "error");
            }
        }

        async function fetchAllQuizData() { return loadQuestions(); }

        function updateDateDropdown() {
            const select = document.getElementById('dateSelect');
            const dates = [...new Set(questionBank.map(q => q.date))].filter(Boolean).sort().reverse();
            select.innerHTML = `<option value="all">所有單元隨機 (All Units Mixed)</option>`;
            dates.forEach(d => {
                const count = questionBank.filter(q => q.date === d).length;
                select.innerHTML += `<option value="${escapeHtml(d)}">${escapeHtml(d)} — ${count} 題</option>`;
            });
        }

        // ── 老師模式 ────────────────────────────────────────────
        function toggleAdminMode() {
            isAdmin = !isAdmin;
            document.getElementById('admin-panel').classList.toggle('hidden-section');
            document.getElementById('toggleText').textContent = isAdmin ? "關閉老師模式" : "切換至老師模式";
            document.getElementById('toggleIcon').textContent = isAdmin ? "🔓" : "🔒";
        }

        async function uploadToFirebase() {
            const file = document.getElementById('fileInput').files[0];
            if (!file) return showStatus('請先選擇 JSON 題庫檔案', 'error');
            try {
                if (file.size > 700000) throw new Error('題庫超過 700KB，請拆分檔案');
                showStatus('正在上傳題庫至 Firebase…', 'info');
                await uploadQuestions(JSON.parse(await file.text()),file.name);
                await fetchQuizData();
                document.getElementById('fileInput').value='';
                showStatus('✅ 題庫已上傳，舊題庫保留。','success');
            } catch (e) {showStatus('上傳失敗：'+e.message,'error');}
        }

        // ── 產生考卷 ────────────────────────────────────────────
        function generateQuiz() {
            const nameVal = document.getElementById('studentNameInput').value.trim();
            if (!nameVal || nameVal.length > 100) {
                showStatus("請輸入 1–100 字的姓名或學號再開始測驗", "error");
                document.getElementById('studentNameInput').focus();
                return;
            }
            studentName = nameVal;
            showEnglish = document.getElementById('showEnglishToggle').checked;

            const date = document.getElementById('dateSelect').value;
            selectedRange = date || 'all';
            const countVal = document.querySelector('input[name="count"]:checked').value;
            const selectedTypes = getSelectedTypes();
            if (selectedTypes.length === 0) return showStatus("請至少勾選一種題型", "error");

            let pool = (date === 'all' || !date) ? questionBank : questionBank.filter(q => q.date === date);
            pool = pool.filter(q => selectedTypes.includes(q.type || 'multiple_choice'));
            if (!pool || pool.length === 0) return showStatus("選定範圍內無題目", "error");

            userAnswers = {};
            pool = [...pool].sort(() => Math.random() - 0.5);
            const num = countVal === 'all' ? pool.length : Math.min(parseInt(countVal), pool.length);
            currentQuiz = pool.slice(0, num).map(normalizeQuestion).map(shuffleQuestionOptions);

            renderQuiz();
            document.getElementById('section-settings').classList.add('hidden-section');
            document.getElementById('section-quiz').classList.remove('hidden-section');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function renderQuiz() {
            const container = document.getElementById('quizContainer');
            container.innerHTML = '';
            currentQuiz.forEach((q, idx) => {
                const card = document.createElement('div');
                card.className = "bg-white p-6 md:p-10 rounded-[2rem] shadow-lg border border-slate-100 fade-in";
                const qType = q.type || 'multiple_choice';
                const readingBlock = qType === 'reading_comprehension' && q.passage
                    ? `<div class="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-4 text-slate-700 text-sm leading-relaxed">
                        <p>${escapeHtml(q.passage)}</p>
                        ${showEnglish && q.passage_en ? `<p class="english mt-2">${escapeHtml(q.passage_en)}</p>` : ''}
                        ${q.passage_pinyin ? `<p class="pinyin mt-2">${escapeHtml(q.passage_pinyin)}</p>` : ''}
                      </div>` : '';
                const answerBlock = qType === 'short_answer'
                    ? `<input type="text" oninput="setShortAnswer(${idx}, this.value)" placeholder="請輸入答案..."
                        class="w-full p-4 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all bg-slate-50 font-medium text-slate-700" />`
                    : `<div class="grid grid-cols-1 gap-4">
                        ${q.options.map((opt, i) => `
                            <label onclick="selectOption(${idx}, ${i})" class="group flex items-center gap-5 p-5 md:p-6 border-2 border-slate-50 rounded-3xl cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/50 transition-all option-card-${idx}">
                                <div class="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-indigo-400 radio-circle-${idx} shrink-0">
                                    <div class="w-3.5 h-3.5 rounded-full bg-indigo-600 scale-0 transition-transform radio-dot-${idx}"></div>
                                </div>
                                <div class="flex flex-col flex-1">
                                    <span class="font-bold text-xl text-slate-700">${escapeHtml(opt)}</span>
                                    ${showEnglish && q.options_en ? `<span class="english text-sm mt-1">${escapeHtml(q.options_en[i] || '')}</span>` : ''}
                                    ${q.options_pinyin ? `<span class="pinyin text-sm mt-1">${escapeHtml(q.options_pinyin[i] || '')}</span>` : ''}
                                </div>
                            </label>
                        `).join('')}
                    </div>`;
                card.innerHTML = `
                    <div class="mb-8">
                        <div class="flex items-center gap-3 mb-3 flex-wrap">
                            <span class="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Question ${idx + 1}</span>
                            ${q.city ? `<span class="bg-sky-100 text-sky-700 text-[10px] font-black px-3 py-1 rounded-full tracking-widest">CITY · ${escapeHtml(q.city)}</span>` : ''}
                        </div>
                        ${readingBlock}
                        <h3 class="text-2xl md:text-3xl text-slate-800 font-black mb-2 leading-snug">${escapeHtml(q.question)}</h3>
                        ${showEnglish && q.question_en ? `<div class="english mb-2">${escapeHtml(q.question_en)}</div>` : ''}
                        ${q.question_pinyin ? `<div class="pinyin text-lg mb-1">${escapeHtml(q.question_pinyin)}</div>` : ''}
                    </div>
                    ${answerBlock}
                    <div class="mt-5">
                        <button type="button" onclick="toggleHint(${idx})" class="text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-4 py-2 rounded-2xl transition-all">
                            💡 顯示 / 隱藏提示 (Hint)
                        </button>
                        <div id="hint-${idx}" class="hidden-section mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm leading-relaxed">
                            ${escapeHtml(q.hint ? q.hint : '這一題目前沒有提供提示。')}
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function getSelectedTypes() {
            return [...document.querySelectorAll('.type-checkbox:checked')].map(el => el.value);
        }

        function selectAllTypes() {
            document.querySelectorAll('.type-checkbox').forEach(el => el.checked = true);
        }

        function toggleHint(qIdx) {
            document.getElementById(`hint-${qIdx}`)?.classList.toggle('hidden-section');
        }

        function isMultiSelectQuestion(question) {
            return normalizeAnswerIndexes(question).length > 1;
        }

        function hasAnsweredQuestion(question, answerValue) {
            if ((question.type || 'multiple_choice') === 'short_answer') return String(answerValue || '').trim() !== '';
            if (isMultiSelectQuestion(question)) return Array.isArray(answerValue) && answerValue.length > 0;
            return Number.isInteger(answerValue);
        }

        function selectOption(qIdx, optIdx) {
            const question = currentQuiz[qIdx];
            const isMulti = isMultiSelectQuestion(question);
            if (isMulti) {
                const selected = Array.isArray(userAnswers[qIdx]) ? [...userAnswers[qIdx]] : [];
                const pos = selected.indexOf(optIdx);
                if (pos >= 0) selected.splice(pos, 1);
                else selected.push(optIdx);
                userAnswers[qIdx] = selected;
            } else {
                userAnswers[qIdx] = optIdx;
            }
            document.querySelectorAll(`.option-card-${qIdx}`).forEach((c, i) => {
                const dot = c.querySelector(`.radio-dot-${qIdx}`);
                const circle = c.querySelector(`.radio-circle-${qIdx}`);
                const selected = isMulti
                    ? Array.isArray(userAnswers[qIdx]) && userAnswers[qIdx].includes(i)
                    : i === optIdx;
                if (selected) {
                    c.classList.add('border-indigo-600', 'bg-indigo-50');
                    dot.classList.replace('scale-0', 'scale-100');
                    circle.classList.replace('border-slate-200', 'border-indigo-600');
                } else {
                    c.classList.remove('border-indigo-600', 'bg-indigo-50');
                    dot.classList.replace('scale-100', 'scale-0');
                    circle.classList.replace('border-indigo-600', 'border-slate-200');
                }
            });
        }


        function normalizeQuestion(question) {
            const q = { ...question };
            const qType = q.type || 'multiple_choice';
            if (qType === 'true_false') {
                q.options = ['是', '否'];
                q.options_en = ['True', 'False'];
                if (typeof q.answer_boolean === 'boolean') q.answer = q.answer_boolean ? 0 : 1;
            }
            return q;
        }

        function setShortAnswer(qIdx, value) { userAnswers[qIdx] = (value || '').trim(); }

        function normalizeAnswerIndexes(q) {
            if (!q || !Array.isArray(q.options)) return [];
            const candidates = [];
            if (Number.isInteger(q.answer)) candidates.push(q.answer);
            if (Array.isArray(q.answer)) candidates.push(...q.answer);
            if (Array.isArray(q.multi_answers)) candidates.push(...q.multi_answers);
            return [...new Set(candidates.filter(i => Number.isInteger(i) && i >= 0 && i < q.options.length))];
        }

        function shuffleQuestionOptions(question) {
            if (!question || !Array.isArray(question.options) || question.options.length <= 1) {
                return question;
            }

            const optionIndexes = question.options.map((_, idx) => idx);
            optionIndexes.sort(() => Math.random() - 0.5);

            const oldToNewIndex = {};
            optionIndexes.forEach((oldIdx, newIdx) => {
                oldToNewIndex[oldIdx] = newIdx;
            });

            const shuffledQuestion = { ...question };
            shuffledQuestion.options = optionIndexes.map(i => question.options[i]);

            if (Array.isArray(question.options_pinyin)) {
                shuffledQuestion.options_pinyin = optionIndexes.map(i => question.options_pinyin[i] || '');
            }

            if (Number.isInteger(question.answer)) {
                shuffledQuestion.answer = oldToNewIndex[question.answer];
            } else if (Array.isArray(question.answer)) {
                shuffledQuestion.answer = question.answer
                    .filter(i => Number.isInteger(i) && oldToNewIndex[i] !== undefined)
                    .map(i => oldToNewIndex[i]);
            }

            if (Array.isArray(question.multi_answers)) {
                shuffledQuestion.multi_answers = question.multi_answers
                    .filter(i => Number.isInteger(i) && oldToNewIndex[i] !== undefined)
                    .map(i => oldToNewIndex[i]);
            }

            return shuffledQuestion;
        }

        // ── 交卷 ────────────────────────────────────────────────
        async function submitQuiz() {
            const total = currentQuiz.length;
            const answeredCount = currentQuiz.filter((q, idx) => hasAnsweredQuestion(q, userAnswers[idx])).length;
            if (answeredCount < total) return showStatus("請完成所有題目後再交卷", "error");

            let correct = 0;
            const reviewItems = currentQuiz.map((q, idx) => {
                const userChoice = userAnswers[idx];
                const qType = q.type || 'multiple_choice';
                let isCorrect = false;
                let correctAnswer = '（未提供）';
                let correctAnswerPinyin = '';
                let userAnswer = '（未作答）';
                let userAnswerPinyin = '';

                if (qType === 'short_answer') {
                    const accepted = [q.short_answer, ...(Array.isArray(q.accepted_answers) ? q.accepted_answers : [])]
                        .filter(Boolean).map(v => String(v).trim().toLowerCase());
                    const userValue = String(userChoice || '').trim();
                    isCorrect = accepted.includes(userValue.toLowerCase());
                    correctAnswer = q.short_answer || '（未提供）';
                    userAnswer = userValue || '（未作答）';
                } else {
                    const correctIndexes = normalizeAnswerIndexes(q);
                    if (isMultiSelectQuestion(q)) {
                        const userChoices = Array.isArray(userChoice) ? [...new Set(userChoice)] : [];
                        const sortedUser = userChoices.slice().sort((a, b) => a - b);
                        const sortedCorrect = correctIndexes.slice().sort((a, b) => a - b);
                        isCorrect = sortedUser.length === sortedCorrect.length && sortedUser.every((v, i) => v === sortedCorrect[i]);
                        userAnswer = userChoices.map(i => q.options?.[i]).filter(Boolean).join(' / ') || '（未作答）';
                        userAnswerPinyin = userChoices.map(i => q.options_pinyin?.[i] || '').filter(Boolean).join(' / ');
                    } else {
                        isCorrect = correctIndexes.includes(userChoice);
                        userAnswer = q.options?.[userChoice] || '（未作答）';
                        userAnswerPinyin = q.options_pinyin?.[userChoice] || '';
                    }
                    const correctAnswerList = correctIndexes.map(i => q.options[i]).filter(Boolean);
                    const correctPinyinList = correctIndexes.map(i => q.options_pinyin?.[i] || '').filter(Boolean);
                    correctAnswer = correctAnswerList.length > 0 ? correctAnswerList.join(' / ') : (q.short_answer || '（未提供）');
                    correctAnswerPinyin = correctPinyinList.join(' / ');
                }
                if (isCorrect) correct++;
                return {
                    questionIndex: idx + 1,
                    question: q.question,
                    questionPinyin: q.question_pinyin || '',
                    questionEn: q.question_en || '',
                    isCorrect,
                    correctAnswer,
                    correctAnswerPinyin,
                    userAnswer,
                    userAnswerPinyin,
                    explain: typeof q.explain === 'string' ? q.explain : ''
                };
            });

            const score = Math.round((correct / total) * 100);
            document.getElementById('scoreDisplay').textContent = score;
            document.getElementById('section-quiz').classList.add('hidden-section');
            document.getElementById('section-result').classList.remove('hidden-section');

            const txt = document.getElementById('resultText');
            const emoji = document.getElementById('resultEmoji');
            if (score === 100) { txt.textContent = "太厲害了！滿分！"; emoji.textContent = "🏆"; }
            else if (score >= 80) { txt.textContent = "很棒的成績，快要全對了！"; emoji.textContent = "🎉"; }
            else if (score >= 60) { txt.textContent = "表現不錯，及格了！"; emoji.textContent = "👍"; }
            else { txt.textContent = "再加油，多練習幾次會更好！"; emoji.textContent = "💪"; }

            renderAnswerReview(reviewItems);

            const record = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                studentName,
                score,
                correct,
                total,
                range: selectedRange || 'all',
                reviewItems
            };

            saveQuizHistory(record);
            renderQuizHistory();
            await uploadRecordToFirebase(record);

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ── 上傳單份考卷到 records/ ──────────────────────────────
        async function uploadRecordToFirebase(record) {
            const statusEl = document.getElementById('uploadStatus');
            statusEl.classList.remove('hidden-section');
            statusEl.className = "mb-6 text-sm font-bold px-4 py-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200";
            statusEl.textContent = "⏳ 正在上傳成績到 Firebase...";

            try {
                await saveRecord(record);

                statusEl.className = "mb-6 text-sm font-bold px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200";
                statusEl.textContent = "✅ 成績已同步到雲端！老師可在後台查看。";
            } catch (err) {
                statusEl.className = "mb-6 text-sm font-bold px-4 py-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200";
                statusEl.textContent = `⚠️ 雲端同步失敗（${err.message}），成績已儲存在本機。`;
            }
        }

        // ── 考卷檢討 ────────────────────────────────────────────
        function renderAnswerReview(reviewItems) {
            const section = document.getElementById('reviewSection');
            section.classList.remove('hidden-section');
            section.className = "text-left mb-10 bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-8";
            section.innerHTML = `
                <h3 class="text-xl md:text-2xl font-black text-slate-800 mb-4">整份考卷檢討（含答對與答錯）</h3>
                <div class="space-y-4">
                    ${reviewItems.map(item => `
                        <div class="bg-white border ${item.isCorrect ? 'border-emerald-200' : 'border-rose-200'} rounded-2xl p-4 md:p-5">
                            <p class="text-slate-800 font-bold mb-2">第 ${escapeHtml(item.questionIndex)} 題：${escapeHtml(item.question)}</p>
                            ${showEnglish && item.questionEn ? `<p class="english mb-2">${escapeHtml(item.questionEn)}</p>` : ''}
                            ${item.questionPinyin ? `<p class="pinyin mb-2">${escapeHtml(item.questionPinyin)}</p>` : ''}
                            <p class="text-sm font-bold mb-2 ${item.isCorrect ? 'text-emerald-600' : 'text-rose-600'}">
                                ${item.isCorrect ? '✅ 答對' : '❌ 答錯'}
                            </p>
                            <p class="text-slate-600">
                                你的答案：<span class="font-bold ${item.isCorrect ? 'text-emerald-600' : 'text-rose-600'}">${escapeHtml(item.userAnswer)}</span>
                                ${item.userAnswerPinyin ? `<span class="pinyin ml-2">${escapeHtml(item.userAnswerPinyin)}</span>` : ''}
                            </p>
                            <p class="text-slate-600">
                                正確答案：<span class="font-bold text-emerald-600">${escapeHtml(item.correctAnswer)}</span>
                                ${item.correctAnswerPinyin ? `<span class="pinyin ml-2">${escapeHtml(item.correctAnswerPinyin)}</span>` : ''}
                            </p>
                            ${!item.isCorrect && item.explain ? `
                            <p class="text-slate-600">
                                解釋：<span class="font-bold text-indigo-600">${escapeHtml(item.explain)}</span>
                            </p>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // ── 狀態提示 ────────────────────────────────────────────
        function showStatus(msg, type) {
            const el = document.getElementById('statusMsg');
            el.textContent = msg;
            el.className = `mb-6 p-4 rounded-2xl text-center font-bold shadow-lg border block fade-in`;
            if (type === 'error') el.classList.add('bg-rose-50', 'text-rose-600', 'border-rose-200');
            else if (type === 'success') el.classList.add('bg-emerald-50', 'text-emerald-600', 'border-emerald-200');
            else el.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-200');
            setTimeout(() => {
                el.classList.add('opacity-0');
                setTimeout(() => el.classList.replace('block', 'hidden-section'), 500);
            }, 4000);
        }

        // ── 本機歷史紀錄 ────────────────────────────────────────
        function getQuizHistory() {
            try {
                const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch { return []; }
        }

        function saveQuizHistory(record) {
            const history = getQuizHistory();
            history.unshift(record);
            try { localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(history.slice(0, 30))); } catch { showStatus('本機空間不足，正在嘗試雲端同步。','info'); }
        }

        function renderQuizHistory() {
            const panel = document.getElementById('historyPanel');
            const list = document.getElementById('historyList');
            const history = getQuizHistory();
            if (history.length === 0) { panel.classList.add('hidden-section'); list.innerHTML = ''; return; }
            panel.classList.remove('hidden-section');
            list.innerHTML = history.map((item, idx) => {
                const dt = new Date(item.date);
                const dateText = isNaN(dt.getTime()) ? item.date : dt.toLocaleString('zh-TW', { hour12: false });
                const rangeText = item.range === 'all' ? '所有單元' : item.range;
                const hasDetail = Array.isArray(item.reviewItems) && item.reviewItems.length > 0;
                return `
                    <div class="bg-white border border-slate-200 rounded-2xl p-3">
                        <div class="flex items-center justify-between gap-2">
                            <div>
                                <p class="font-bold text-slate-700">#${history.length - idx}｜${item.studentName ? escapeHtml(item.studentName) + '・' : ''}${item.score} 分 (${item.correct}/${item.total})</p>
                                <p class="text-xs text-slate-500">日期：${escapeHtml(dateText)}</p>
                                <p class="text-xs text-slate-500">範圍：${escapeHtml(rangeText)}</p>
                            </div>
                            ${hasDetail ? `<a href="see_quiz.html?idx=${idx}${item.id ? '&id='+encodeURIComponent(item.id) : ''}" target="_blank" class="shrink-0 text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all whitespace-nowrap">📋 查看考卷</a>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function clearQuizHistory() {
            localStorage.removeItem(QUIZ_HISTORY_KEY);
            renderQuizHistory();
            showStatus("已清除本機測驗紀錄", "success");
        }

Object.assign(window, {fetchQuizData, fetchAllQuizData, updateDateDropdown, toggleAdminMode, uploadToFirebase, generateQuiz, renderQuiz, getSelectedTypes, selectAllTypes, toggleHint, isMultiSelectQuestion, hasAnsweredQuestion, selectOption, normalizeQuestion, setShortAnswer, normalizeAnswerIndexes, shuffleQuestionOptions, submitQuiz, uploadRecordToFirebase, renderAnswerReview, showStatus, getQuizHistory, saveQuizHistory, renderQuizHistory, clearQuizHistory});
