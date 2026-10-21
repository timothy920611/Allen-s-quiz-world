export const MAX_QUESTIONS = 100;
const types=['multiple_choice','true_false','short_answer','reading_comprehension'];
function text(value,max,label) {
  if(value!=null&&typeof value!=='string')throw new Error(`${label}必須是文字`);
  const result=value??'';
  if(result.length>max)throw new Error(`${label}超過 ${max} 字上限`);
  return result;
}
function strings(value,maxCount,maxLength,label) {
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>maxCount||value.some(v=>typeof v!=='string'||v.length>maxLength))throw new Error(`${label}格式或長度錯誤`);
  return [...value];
}
export function normalizeQuestion(q,position=1) {
  if(!q||typeof q!=='object'||Array.isArray(q))throw new Error('每一題必須是物件');
  const type=q.type||'multiple_choice';if(!types.includes(type))throw new Error('不支援的題型');
  const question=text(q.question,4000,'題目');if(!question.trim())throw new Error('題目不可空白');
  const date=text(q.date,10,'單元日期');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('date 需為 YYYY-MM-DD');
  let options=strings(q.options,4,500,'選項');
  let optionsEn=strings(q.options_en??q.optionsEn,4,500,'英文選項');
  let optionsPinyin=strings(q.options_pinyin??q.optionsPinyin,4,500,'拼音選項');
  let indexes=[...new Set([...(Array.isArray(q.answerIndexes)?q.answerIndexes:[]),...(Number.isInteger(q.answer)?[q.answer]:Array.isArray(q.answer)?q.answer:[]),...(Array.isArray(q.multi_answers)?q.multi_answers:[])])];
  if(type==='true_false'&&typeof q.answer_boolean==='boolean') {options=['是','否'];optionsEn=['True','False'];optionsPinyin=['shì','fǒu'];indexes=[q.answer_boolean?0:1];}
  let shortAnswer=text(q.short_answer??q.shortAnswer,500,'簡答答案');
  let acceptedAnswers=strings(q.accepted_answers??q.acceptedAnswers,10,500,'可接受答案');
  if(type==='short_answer') {
    if(!shortAnswer.trim())throw new Error('簡答題需有 short_answer');
    options=[];optionsEn=[];optionsPinyin=[];indexes=[];
  } else {
    if(options.length<2||indexes.length<1||indexes.some(i=>!Number.isInteger(i)||i<0||i>=options.length))throw new Error('選項或答案索引無效');
    if(type==='true_false'&&(options.length!==2||indexes.length!==1))throw new Error('是非題需要兩個選項及一個答案');
    shortAnswer='';acceptedAnswers=[];
  }
  const align=list=>options.map((_,i)=>list[i]||'');
  return {position,date,type,question,questionEn:text(q.question_en??q.questionEn,4000,'英文題目'),questionPinyin:text(q.question_pinyin??q.questionPinyin,4000,'拼音'),city:text(q.city,100,'城市'),passage:text(q.passage,10000,'文章'),passageEn:text(q.passage_en??q.passageEn,10000,'英文文章'),passagePinyin:text(q.passage_pinyin??q.passagePinyin,10000,'文章拼音'),options,optionsEn:align(optionsEn),optionsPinyin:align(optionsPinyin),answerIndexes:indexes,shortAnswer,acceptedAnswers,hint:text(q.hint,2000,'提示'),explain:text(q.explain,4000,'解釋')};
}
export function parseBank(value) {
  if(!Array.isArray(value)||value.length<1||value.length>MAX_QUESTIONS)throw new Error(`每份題庫需有 1–${MAX_QUESTIONS} 題`);
  const normalized=value.map((q,i)=>normalizeQuestion(q,i+1));
  if(new TextEncoder().encode(JSON.stringify(normalized)).length>2000000)throw new Error('題庫超過 2MB，請拆分檔案');
  return normalized;
}
export function shuffle(items,random=Math.random) {
  const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
export function shuffleOptions(question) {
  if(!question.options.length)return {...question};
  const order=shuffle(question.options.map((_,i)=>i));
  return {...question,options:order.map(i=>question.options[i]),optionsEn:order.map(i=>question.optionsEn[i]),optionsPinyin:order.map(i=>question.optionsPinyin[i]),answerIndexes:question.answerIndexes.map(i=>order.indexOf(i))};
}
export function hasAnswer(q,answer) {return q.type==='short_answer'?typeof answer==='string'&&answer.trim().length>0:Array.isArray(answer)&&answer.length>0;}
export function grade(questions,answers) {
  if(!questions.length||questions.some((q,i)=>!hasAnswer(q,answers[i])))throw new Error('請完成所有題目再交卷');
  const reviewItems=questions.map((q,i)=>{
    const chosen=answers[i];let isCorrect,userAnswer,userAnswerPinyin='',correctAnswer,correctAnswerPinyin='';
    if(q.type==='short_answer') {
      userAnswer=String(chosen).trim();correctAnswer=q.shortAnswer;
      isCorrect=[q.shortAnswer,...q.acceptedAnswers].some(a=>a.trim().toLocaleLowerCase()===userAnswer.toLocaleLowerCase());
    } else {
      const sorted=[...new Set(chosen)].sort((a,b)=>a-b),expected=[...q.answerIndexes].sort((a,b)=>a-b);
      isCorrect=sorted.length===expected.length&&sorted.every((v,n)=>v===expected[n]);
      userAnswer=sorted.map(n=>q.options[n]).join(' / ');userAnswerPinyin=sorted.map(n=>q.optionsPinyin[n]).filter(Boolean).join(' / ');
      correctAnswer=q.answerIndexes.map(n=>q.options[n]).join(' / ');correctAnswerPinyin=q.answerIndexes.map(n=>q.optionsPinyin[n]).filter(Boolean).join(' / ');
    }
    return {questionIndex:i+1,question:q.question,questionEn:q.questionEn,questionPinyin:q.questionPinyin,isCorrect,userAnswer,userAnswerPinyin,correctAnswer,correctAnswerPinyin,explain:q.explain};
  });
  const correct=reviewItems.filter(r=>r.isCorrect).length;
  return {score:Math.round(correct/questions.length*100),correct,total:questions.length,reviewItems};
}
