import {localNow,addDays,monday,weekType,weekday,dayState,nextLesson,seconds,countdown,lessonsFor} from './model.mjs';
const $=id=>document.getElementById(id);
let selected=localNow().key,followToday=true,renderKey='';
const fmt=(key,opts)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',...opts}).format(new Date(key+'T12:00:00Z'));
const short=key=>fmt(key,{day:'numeric',month:'short'}).replace(' г.','');
const esc=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const pairCount=n=>`${n} ${n===1?'пара':n<5?'пары':'пар'}`;
function select(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!Number.isFinite(Date.parse(key+'T12:00:00Z')))return;selected=key;followToday=key===localNow().key;renderKey='';render();}
function render(now=new Date()){
 const local=localNow(now);if(followToday)selected=local.key;
 const state=dayState(selected,now),{lessons,current,next,isToday}=state;
 const key=[selected,local.key,current?.slot,next?.slot].join('|');
 $('clock').textContent=local.clock;
 if(key===renderKey){tick(state,now);return;}renderKey=key;
 $('selected-date').textContent=fmt(selected,{weekday:'long',day:'numeric',month:'long'});
 $('date-input').value=selected;
 const w=weekType(selected),start=monday(selected);
 $('week-label').textContent=w?'Нижняя неделя':'Верхняя неделя';$('week-label').className=w?'lower':'';
 $('week-range').textContent=`${short(start)} — ${short(addDays(start,6))}`;
 $('days').innerHTML=Array.from({length:7},(_,i)=>{const day=addDays(start,i),active=day===selected;return `<button type="button" class="day ${active?'selected':''} ${day===local.key?'is-today':''} ${i>4?'weekend':''}" data-date="${day}" aria-label="${esc(fmt(day,{weekday:'long',day:'numeric',month:'long'}))}" aria-pressed="${active}"><span>${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'][i]}</span><strong>${Number(day.slice(-2))}</strong></button>`;}).join('');
 $('lessons').innerHTML=lessons.length?lessons.map((x,i)=>{
  const active=current===x,upcoming=next===x,past=isToday&&local.seconds>=seconds(x.end),phase=x.week===null?'fixed':x.week===1?'lower':'upper';
  const previous=lessons[i-1],gap=previous?(seconds(x.start)-seconds(previous.end))/60:0;
  return `${gap>30?`<div class="gap">Окно · ${gap} минут</div>`:''}<article class="lesson ${phase} ${active?'current':''} ${past?'past':''}" ${active?'aria-label="Текущая пара"':''}>
   <div class="lesson-top"><div class="badges"><span class="badge">${x.slot}-я пара</span>${past?'<span class="past-label">Завершена</span>':`<span class="badge kind">${active?'Идёт сейчас':esc(x.type.split(' · ')[0])}</span>`}</div><span class="phase ${phase}">${x.week===null?'Каждую неделю':x.week===1?'Нижняя':'Верхняя'}</span></div>
   <h2>${esc(x.title)}</h2><p class="teacher">${esc([x.teacher,x.type].filter(Boolean).join(' · '))||'Преподаватель в расписании не указан'}</p>
   <div class="lesson-bottom"><div class="lesson-time"><span aria-hidden="true">◷</span> ${x.start}–${x.end}</div><div class="room ${x.room==='Спортзал'?'gym':''}">${x.room==='Спортзал'?'':'<small>Ауд.</small>'}<strong>${esc(x.room)}</strong></div></div>
   ${active?'<div class="meter" role="progressbar" aria-label="Прошло времени пары" aria-valuemin="0" aria-valuemax="100"><div id="progress"></div></div><div class="timer-row"><span>До конца пары</span><strong class="timer" id="current-timer"></strong></div>':''}
   ${upcoming?'<div class="next-timer"><span>До начала пары</span><strong class="timer" id="next-timer"></strong></div>':''}
  </article>`;
 }).join(''):`<div class="empty"><div class="empty-symbol" aria-hidden="true">☀</div><h2>День без пар</h2><p>По расписанию на этот день<br>занятий нет. Можно выдохнуть.</p><button id="next-study">Ближайший учебный день</button></div>`;
 $('day-summary').textContent=lessons.length?`${isToday?'Сегодня':short(selected)} · ${pairCount(lessons.length)} · ${selected<local.key?'окончание':'до'} ${lessons.at(-1).end}`:'';
 $('next-study')?.addEventListener('click',()=>{for(let i=1;i<=14;i++){const day=addDays(selected,i);if(lessonsFor(day).length){select(day);break;}}});
 tick(state,now);
}
function tick(state,now){
 const {local,current,next,isToday,lessons}=state;
 let title,sub,time='',rest=false;
 if(!isToday){title=selected<local.key?'Расписание прошедшего дня':'План на выбранный день';sub=lessons.length?`${pairCount(lessons.length)} · первая в ${lessons[0].start}`:'Занятий нет';rest=true;}
 else if(current){title=`Сейчас ${current.slot}-я пара`;sub=next?`Дальше: ${next.start} · ${next.room==='Спортзал'?'спортзал':'ауд. '+next.room}`:'После этой пары на сегодня всё';time='До конца '+countdown(seconds(current.end)-local.seconds);}
 else if(next){const started=lessons.some(x=>local.seconds>=seconds(x.end));title=started?'Перемена':'До первой пары';sub=`${next.title} · ${next.room==='Спортзал'?'спортзал':'ауд. '+next.room}`;time=countdown(seconds(next.start)-local.seconds);}
 else{rest=true;title=lessons.length?'На сегодня всё':'Сегодня без пар';const following=nextLesson(now);sub=following?`Следующая: ${short(following.key)}, ${following.lesson.start} · ${following.lesson.room==='Спортзал'?'спортзал':'ауд. '+following.lesson.room}`:'Можно отдыхать';if(following)time='До начала '+countdown(following.remaining);}
 const statusHTML=`<span class="status-dot ${rest?'rest':''}" aria-hidden="true"></span><div class="status-copy"><p class="status-title">${esc(title)}</p><p class="status-sub">${esc(sub)}</p></div>${time?`<span class="status-time">${esc(time)}</span>`:''}`;
 if($('status').innerHTML!==statusHTML)$('status').innerHTML=statusHTML;
 if(current){$('current-timer').textContent=countdown(seconds(current.end)-local.seconds);const pct=(local.seconds-seconds(current.start))/(seconds(current.end)-seconds(current.start))*100;$('progress').style.width=pct+'%';$('progress').parentElement.setAttribute('aria-valuenow',Math.round(pct));}
 if(next)$('next-timer').textContent=countdown(seconds(next.start)-local.seconds);
}
$('today').addEventListener('click',()=>select(localNow().key));
$('prev-week').addEventListener('click',()=>select(addDays(selected,-7)));
$('next-week').addEventListener('click',()=>select(addDays(selected,7)));
$('date-input').addEventListener('change',e=>select(e.target.value));
$('days').addEventListener('click',e=>{const day=e.target.closest('[data-date]');if(day)select(day.dataset.date);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
window.addEventListener('pageshow',()=>render());
render();setInterval(()=>render(),1000);
