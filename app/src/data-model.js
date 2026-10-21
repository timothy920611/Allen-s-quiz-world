export function validateQuestions(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) throw new Error('題庫需包含 1–500 題');
  for (const q of value) {
    if (!q || typeof q !== 'object' || typeof q.question !== 'string' || !q.question.trim()) throw new Error('每題必須有 question 文字');
    if (q.question.length > 10000 || typeof q.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) throw new Error('題目文字過長或日期格式錯誤');
    const type = q.type || 'multiple_choice';
    if (!['multiple_choice','true_false','short_answer','reading_comprehension'].includes(type)) throw new Error(`不支援題型：${type}`);
    if (type === 'short_answer') {
      if (typeof q.short_answer !== 'string' || !q.short_answer.trim()) throw new Error('簡答題必須有 short_answer');
    } else if (type === 'true_false' && typeof q.answer_boolean === 'boolean') {
      // The existing renderer generates true/false options from answer_boolean.
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 20 || q.options.some(x => typeof x !== 'string')) throw new Error('選項格式錯誤');
      const answers = Array.isArray(q.multi_answers) && q.multi_answers.length ? q.multi_answers : Array.isArray(q.answer) ? q.answer : [q.answer];
      if (!answers.length || answers.some(x => !Number.isInteger(x) || x < 0 || x >= q.options.length)) throw new Error('答案必須是有效選項索引');
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > 700000) throw new Error('題庫超過 700KB，請拆分檔案');
  return value;
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function recordToDocument(record, ownerUid, createdAt) {
  const reviewJson = JSON.stringify(record.reviewItems);
  if (reviewJson.length > 150000) throw new Error('考卷明細過大');
  return {ownerUid,createdAt,date:record.date,studentName:record.studentName,score:record.score,correct:record.correct,total:record.total,range:record.range,reviewJson};
}
export function documentToRecord(data, id) {
  const {reviewJson, ...record} = data;
  return {...record,id,reviewItems:JSON.parse(reviewJson)};
}
