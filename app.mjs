import {localNow,addDays,monday,weekType,seconds,countdown} from './model.mjs';
import {STORAGE_KEY,emptyData,readData,writeData,validDate,occurrence,occurrencesFor,personalDayState,personalNextLesson,withNotes,withChange} from './personal.mjs?v=2';
const $=id=>document.getElementById(id);
let selected=localNow().key,followToday=true,renderKey='',revision=0,editingId=null,data=emptyData(),feedbackTimeout;
const fmt=(key,opts)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',...opts}).format(new Date(key+'T12:00:00Z'));
const short=key=>fmt(key,{day:'numeric',month:'short'});
const esc=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const pairCount=n=>`${n} ${n===1?'пара':n<5?'пары':'пар'}`;
const roomLabel=x=>x.room==='Спортзал'?'спортзал':'ауд. '+x.room;
function reloadData(){try{data=readData(window.localStorage);$('storage-error').hidden=true;}catch{data=emptyData();$('storage-error').textContent='Личные данные сейчас недоступны. Показано исходное расписание. Попробуй перезагрузить страницу.';$('storage-error').hidden=false;}revision++;renderKey='';}
function select(key){if(!validDate(key))return;selected=key;followToday=key===localNow().key;renderKey='';render();}
function notify(message){clearTimeout(feedbackTimeout);$('feedback').textContent=message;feedbackTimeout=setTimeout(()=>$('feedback').textContent='',4500);}
function persist(transform,message){
 try{const latest=readData(window.localStorage);let candidate;try{candidate=transform(latest);}catch(e){showError(e.message);return false;}data=writeData(window.localStorage,candidate);$('storage-error').hidden=true;revision++;renderKey='';render();notify(message);return true;}
 catch{showError('Не удалось сохранить данные в браузере. Изменения не сохранены. Проверь доступ к хранилищу и свободное место.');return false;}
}
function showError(message){if($('lesson-editor').open){$('editor-error').textContent=message;$('editor-error').hidden=false;}else{$('storage-error').textContent=message;$('storage-error').hidden=false;}}
function render(now=new Date()){
 const local=localNow(now);if(followToday)selected=local.key;
 const state=personalDayState(selected,data,now),{lessons,current,next,isToday}=state;
 const key=[selected,local.key,current?.id,next?.id,revision].join('|');$('clock').textContent=local.clock;
 if(key===renderKey){tick(state,now);return;}renderKey=key;
 $('selected-date').textContent=fmt(selected,{weekday:'long',day:'numeric',month:'long'});$('date-input').value=selected;
 const w=weekType(selected),start=monday(selected);$('week-label').textContent=w?'Нижняя неделя':'Верхняя неделя';$('week-label').className=w?'lower':'';$('week-range').textContent=`${short(start)} — ${short(addDays(start,6))}`;
 $('days').innerHTML=Array.from({length:7},(_,i)=>{const date=addDays(start,i),active=date===selected;return `<button type="button" class="day ${active?'selected':''} ${date===local.key?'is-today':''} ${i>4?'weekend':''}" data-date="${date}" aria-label="${esc(fmt(date,{weekday:'long',day:'numeric',month:'long'}))}" aria-pressed="${active}"><span>${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'][i]}</span><strong>${Number(date.slice(-2))}</strong></button>`;}).join('');
 const visible=occurrencesFor(selected,data,{includeHistory:true});let previous;
 const cards=visible.map(x=>{
  const inactive=x.cancelled||x.history,active=!inactive&&current?.id===x.id,upcoming=!inactive&&next?.id===x.id,past=!inactive&&isToday&&local.seconds>=seconds(x.end),phase=x.week===null?'fixed':x.week===1?'lower':'upper',n=data.notes[x.id]||{};
  const gap=!inactive&&previous?(seconds(x.start)-seconds(previous.end))/60:0;if(!inactive)previous=x;
  const changeText=x.history?`Перенесена на ${short(x.destination)}, ${x.destinationStart}${x.cancelled?' · отменена':''}`:x.cancelled?'Пара отменена':x.moved?`Перенесена с ${short(x.originDate)}, ${x.originStart}`:'';
  const status=x.history?'Перенесена':x.cancelled?'Отменена':past?'Завершена':active?'Идёт сейчас':x.type.split(' · ')[0];
  return `${gap>30?`<div class="gap">Окно · ${Math.round(gap)} минут</div>`:''}<article class="lesson ${phase} ${active?'current':''} ${past?'past':''} ${inactive?'inactive':''}" ${active?'aria-label="Текущая пара"':''}>
  <div class="lesson-top"><div class="badges"><span class="badge">${x.moved&&!x.history?'Перенос':x.slot+'-я пара'}</span><span class="badge kind">${esc(status)}</span></div><span class="phase ${phase}">${x.week===null?'Каждую неделю':x.week===1?'Нижняя':'Верхняя'}</span></div>
  <h2>${esc(x.title)}</h2><p class="teacher">${esc([x.teacher,x.type].filter(Boolean).join(' · '))||'Преподаватель в расписании не указан'}</p>
  ${changeText?`<p class="change-label">${esc(changeText)}</p>`:''}
  <div class="lesson-bottom"><div class="lesson-time"><span aria-hidden="true">◷</span> ${x.start}–${x.end}</div><div class="room ${x.room==='Спортзал'?'gym':''}">${x.room==='Спортзал'?'':'<small>Ауд.</small>'}<strong>${esc(x.room)}</strong></div></div>
  ${active?'<div class="meter" role="progressbar" aria-label="Прошло времени пары" aria-valuemin="0" aria-valuemax="100"><div id="progress"></div></div><div class="timer-row"><span>До конца пары</span><strong class="timer" id="current-timer"></strong></div>':''}
  ${upcoming?'<div class="next-timer"><span>До начала пары</span><strong class="timer" id="next-timer"></strong></div>':''}
  ${n.note?`<div class="note-preview"><span>ЗАМЕТКА</span><p>${esc(n.note)}</p></div>`:''}
  ${n.homework?`<div class="homework-preview ${n.done?'done':''}"><label><input type="checkbox" data-done="${esc(x.id)}" ${n.done?'checked':''} aria-label="Домашка выполнена: ${esc(x.title)}"><span><small>ДОМАШКА${n.done?' · ГОТОВО':''}</small><span class="homework-text">${esc(n.homework)}</span></span></label></div>`:''}
  <div class="card-actions"><button type="button" data-notes="${esc(x.id)}">${n.note||n.homework?'Заметки и домашка':'＋ Заметки и ДЗ'}</button><button type="button" data-change="${esc(x.id)}">Изменить</button>${x.history?`<button type="button" data-go="${x.destination}">К новой дате →</button>`:''}</div>
  </article>`;
 }).join('');
 const empty=!lessons.length?`<div class="empty"><div class="empty-symbol" aria-hidden="true">☀</div><h2>${visible.length?'Свободный день':'День без пар'}</h2><p>${visible.length?'Все пары на этот день отменены или перенесены.':'По расписанию занятий нет. Можно выдохнуть.'}</p><button id="next-study">Ближайший учебный день</button></div>`:'';
 $('lessons').innerHTML=empty+cards;
 const lastEnd=lessons.length?lessons.reduce((end,x)=>seconds(x.end)>seconds(end)?x.end:end,lessons[0].end):'';
 $('day-summary').textContent=lessons.length?`${isToday?'Сегодня':short(selected)} · ${pairCount(lessons.length)} · до ${lastEnd}`:'';
 $('next-study')?.addEventListener('click',()=>{for(let i=1;i<=366;i++){const date=addDays(selected,i);if(occurrencesFor(date,data).length){select(date);break;}}});
 tick(state,now);
}
function tick(state,now){
 const {local,current,next,isToday,lessons}=state;let title,sub,time='',rest=false;
 if(!isToday){title=selected<local.key?'Расписание прошедшего дня':'План на выбранный день';sub=lessons.length?`${pairCount(lessons.length)} · первая в ${lessons[0].start}`:'Занятий нет';rest=true;}
 else if(current){title=current.moved?'Сейчас перенесённая пара':`Сейчас ${current.slot}-я пара`;sub=next?`Дальше: ${next.start} · ${roomLabel(next)}`:'После этой пары на сегодня всё';time='До конца '+countdown(seconds(current.end)-local.seconds);}
 else if(next){title=lessons.some(x=>local.seconds>=seconds(x.end))?'Перемена':'До первой пары';sub=`${next.title} · ${roomLabel(next)}`;time=countdown(seconds(next.start)-local.seconds);}
 else{rest=true;title=lessons.length?'На сегодня всё':'Сегодня без пар';const following=personalNextLesson(data,now);sub=following?`Следующая: ${short(following.key)}, ${following.lesson.start} · ${roomLabel(following.lesson)}`:'Можно отдыхать';if(following)time='До начала '+countdown(following.remaining);}
 const html=`<span class="status-dot ${rest?'rest':''}" aria-hidden="true"></span><div class="status-copy"><p class="status-title">${esc(title)}</p><p class="status-sub">${esc(sub)}</p></div>${time?`<span class="status-time">${esc(time)}</span>`:''}`;if($('status').innerHTML!==html)$('status').innerHTML=html;
 if(current){$('current-timer').textContent=countdown(seconds(current.end)-local.seconds);const pct=(local.seconds-seconds(current.start))/(seconds(current.end)-seconds(current.start))*100;$('progress').style.width=pct+'%';$('progress').parentElement.setAttribute('aria-valuenow',Math.round(pct));}
 if(next)$('next-timer').textContent=countdown(seconds(next.start)-local.seconds);
}
function openEditor(id,mode){
 const x=occurrence(id,data);if(!x)return;editingId=id;
 $('editor-title').textContent=x.title;$('editor-kicker').textContent=mode==='notes'?'ЗАМЕТКИ И ДОМАШКА':'ОТМЕНА И ПЕРЕНОС';
 $('editor-date').textContent=`${fmt(x.date,{day:'numeric',month:'long',year:'numeric'})} · ${x.start}–${x.end} · ${roomLabel(x)}${x.cancelled?' · отменена':''}`;
 $('editor-error').hidden=true;$('notes-form').hidden=mode!=='notes';$('change-panel').hidden=mode!=='change';
 const n=data.notes[id]||{};$('note-input').value=n.note||'';$('homework-input').value=n.homework||'';$('homework-done').checked=Boolean(n.done);updateDoneField();
 $('move-date').value=x.date;$('move-start').value=x.start;$('move-end').value=x.end;$('move-room').value=x.room;
 $('cancel-lesson').hidden=x.cancelled;$('restore-lesson').hidden=!data.changes[id];$('lesson-editor').showModal();
}
function closeEditor(){$('lesson-editor').close();editingId=null;}
function updateDoneField(){$('homework-done').disabled=!$('homework-input').value.trim();if($('homework-done').disabled)$('homework-done').checked=false;}
$('close-editor').addEventListener('click',closeEditor);$('lesson-editor').addEventListener('close',()=>{editingId=null;});$('homework-input').addEventListener('input',updateDoneField);
$('notes-form').addEventListener('submit',e=>{e.preventDefault();const id=editingId,n={note:$('note-input').value,homework:$('homework-input').value,done:$('homework-done').checked};if(persist(latest=>withNotes(latest,id,n),'Заметки сохранены'))closeEditor();});
$('move-form').addEventListener('submit',e=>{e.preventDefault();const id=editingId,move={date:$('move-date').value,start:$('move-start').value,end:$('move-end').value,room:$('move-room').value};if(persist(latest=>withChange(latest,id,'move',move),'Перенос сохранён')){closeEditor();select(move.date);}});
$('cancel-lesson').addEventListener('click',()=>{const id=editingId;if(persist(latest=>withChange(latest,id,'cancel'),'Пара отменена. Таймер обновлён.'))closeEditor();});
$('restore-lesson').addEventListener('click',()=>{const id=editingId,origin=occurrence(id,data)?.originDate;if(persist(latest=>withChange(latest,id,'restore'),'Пара возвращена по расписанию')){closeEditor();select(origin);}});
$('lessons').addEventListener('click',e=>{const note=e.target.closest('[data-notes]'),change=e.target.closest('[data-change]'),go=e.target.closest('[data-go]');if(note)openEditor(note.dataset.notes,'notes');else if(change)openEditor(change.dataset.change,'change');else if(go)select(go.dataset.go);});
$('lessons').addEventListener('change',e=>{const id=e.target.dataset.done;if(!id)return;const done=e.target.checked;if(!persist(latest=>withNotes(latest,id,{...latest.notes[id],done}),done?'Домашка выполнена':'Домашка снова в работе'))e.target.checked=!done;});
$('today').addEventListener('click',()=>select(localNow().key));$('prev-week').addEventListener('click',()=>select(addDays(selected,-7)));$('next-week').addEventListener('click',()=>select(addDays(selected,7)));$('date-input').addEventListener('change',e=>select(e.target.value));
$('days').addEventListener('click',e=>{const day=e.target.closest('[data-date]');if(day)select(day.dataset.date);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){reloadData();render();}});
window.addEventListener('pageshow',()=>{reloadData();render();});window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===null){reloadData();render();}});
reloadData();render();setInterval(()=>render(),1000);
