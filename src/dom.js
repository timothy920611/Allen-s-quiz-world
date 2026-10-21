// All dynamic content is text; no HTML parsing sink is used anywhere in the app.
export function el(tag,{text,className,attrs={},children=[]}={}) {
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=String(text);
  if(className)node.className=className;
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  node.append(...children);return node;
}
export function renderReview(target,items,{showEnglish=true}={}) {
  target.replaceChildren();
  for(const item of items) {
    const card=el('article',{className:`review-card ${item.isCorrect?'correct':'incorrect'}`});
    card.append(el('h3',{text:`第 ${item.questionIndex} 題：${item.question}`}),el('p',{text:item.isCorrect?'✓ 答對':'✕ 答錯',className:'result-label'}));
    if(showEnglish&&item.questionEn)card.append(el('p',{text:item.questionEn,className:'english'}));
    if(item.questionPinyin)card.append(el('p',{text:item.questionPinyin,className:'pinyin'}));
    card.append(el('p',{text:`你的答案：${item.userAnswer}`}));
    if(item.userAnswerPinyin)card.append(el('p',{text:item.userAnswerPinyin,className:'pinyin'}));
    card.append(el('p',{text:`正確答案：${item.correctAnswer}`}));
    if(item.correctAnswerPinyin)card.append(el('p',{text:item.correctAnswerPinyin,className:'pinyin'}));
    if(item.explain)card.append(el('p',{text:`解釋：${item.explain}`}));
    target.append(card);
  }
}
export function formatDate(value) {
  const date=value?.toDate?value.toDate():new Date(value?.seconds?value.seconds*1000:value);
  return Number.isNaN(date.getTime())?'日期未知':date.toLocaleString('zh-TW',{hour12:false});
}
