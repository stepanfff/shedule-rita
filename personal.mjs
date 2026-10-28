import {lessonsFor,localNow,seconds,addDays} from './model.mjs';
export const STORAGE_KEY='my-pairs-personal-v1';
export const emptyData=()=>({version:1,changes:{},notes:{}});
export const occurrenceId=(date,lesson)=>`${date}/${lesson.slot}/${lesson.subject}`;
export function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'2000-01-01'||s>'2100-12-31')return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
const validTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function originalOccurrence(id){
 if(typeof id!=='string')return null;
 const [date,slot,subject,...extra]=id.split('/');if(extra.length||!validDate(date))return null;
 const lesson=lessonsFor(date).find(x=>String(x.slot)===slot&&x.subject===subject);
 return lesson?{...lesson,id,date,originDate:date,originStart:lesson.start,originEnd:lesson.end,originRoom:lesson.room}:null;
}
export function normalizeData(value){
 if(!value||typeof value!=='object'||value.version!==1)throw new Error('Не удалось прочитать сохранённые данные. Они не перезаписаны.');
 const out=emptyData();
 for(const [id,n] of Object.entries(value.notes||{})){
  if(!originalOccurrence(id)||!n||typeof n!=='object')continue;
  const note=typeof n.note==='string'?n.note.slice(0,4000):'',homework=typeof n.homework==='string'?n.homework.slice(0,4000):'';
  if(note||homework)out.notes[id]={note,homework,done:Boolean(homework&&n.done)};
 }
 for(const [id,c] of Object.entries(value.changes||{})){
  if(!originalOccurrence(id)||!c||typeof c!=='object')continue;
  const change={};if(c.cancelled===true)change.cancelled=true;
  const m=c.move;
  if(m&&validDate(m.date)&&validTime(m.start)&&validTime(m.end)&&seconds(m.end)>seconds(m.start)&&typeof m.room==='string'&&m.room.trim())change.move={date:m.date,start:m.start,end:m.end,room:m.room.trim().slice(0,60)};
  if(Object.keys(change).length)out.changes[id]=change;
 }
 return out;
}
export function readData(storage){const raw=storage.getItem(STORAGE_KEY);return raw===null?emptyData():normalizeData(JSON.parse(raw));}
export function writeData(storage,data){const normalized=normalizeData(data);storage.setItem(STORAGE_KEY,JSON.stringify(normalized));return normalized;}
export function occurrence(id,data){const base=originalOccurrence(id);if(!base)return null;const c=data.changes[id]||{};return {...base,...c.move,moved:Boolean(c.move),cancelled:Boolean(c.cancelled),history:false};}
export function occurrencesFor(date,data,{includeHistory=false}={}){
 const list=lessonsFor(date).map(x=>{
  const id=occurrenceId(date,x),item=occurrence(id,data);
  return item.date===date?item:{...originalOccurrence(id),moved:true,history:true,cancelled:item.cancelled,destination:item.date,destinationStart:item.start};
 });
 for(const [id,c] of Object.entries(data.changes))if(c.move?.date===date){const x=occurrence(id,data);if(x&&x.originDate!==date)list.push(x);}
 return list.filter(x=>includeHistory||(!x.cancelled&&!x.history)).sort((a,b)=>seconds(a.start)-seconds(b.start)||a.id.localeCompare(b.id));
}
export function personalDayState(date,data,now=new Date()){
 const local=localNow(now),lessons=occurrencesFor(date,data),isToday=date===local.key;
 const current=isToday?lessons.find(x=>local.seconds>=seconds(x.start)&&local.seconds<seconds(x.end)):undefined;
 const next=isToday?lessons.find(x=>seconds(x.start)>local.seconds):undefined;
 return {local,lessons,isToday,current,next};
}
export function personalNextLesson(data,now=new Date()){
 const local=localNow(now);
 for(let i=0;i<=366;i++){const key=addDays(local.key,i),lesson=occurrencesFor(key,data).find(x=>i>0||seconds(x.start)>local.seconds);if(lesson)return {key,lesson,remaining:i*86400+seconds(lesson.start)-local.seconds};}
 return null;
}
export function withNotes(data,id,n){
 if(!originalOccurrence(id))throw new Error('Эта пара не найдена в расписании.');
 const next=normalizeData(data),note=String(n.note||'').trim().slice(0,4000),homework=String(n.homework||'').trim().slice(0,4000);
 if(note||homework)next.notes[id]={note,homework,done:Boolean(homework&&n.done)};else delete next.notes[id];
 return next;
}
export function withChange(data,id,action,move){
 const base=originalOccurrence(id);if(!base)throw new Error('Эта пара не найдена в расписании.');
 const next=normalizeData(data);
 if(action==='cancel')next.changes[id]={...next.changes[id],cancelled:true};
 else if(action==='restore')delete next.changes[id];
 else if(action==='move'){
  if(!move||!validDate(move.date))throw new Error('Выбери корректную дату с 2000 по 2100 год.');
  if(!validTime(move.start)||!validTime(move.end))throw new Error('Укажи время начала и окончания.');
  if(seconds(move.end)<=seconds(move.start))throw new Error('Окончание должно быть позже начала в тот же день.');
  const room=String(move.room||'').trim();if(!room||room.length>60)throw new Error('Укажи кабинет (до 60 символов).');
  if(move.date===base.date&&move.start===base.start&&move.end===base.end&&room===base.room)delete next.changes[id];
  else next.changes[id]={move:{date:move.date,start:move.start,end:move.end,room}};
 }else throw new Error('Неизвестное действие.');
 if(action!=='cancel'){
  const changed=occurrence(id,next);
  const conflict=occurrencesFor(changed.date,next).find(x=>x.id!==id&&seconds(x.start)<seconds(changed.end)&&seconds(x.end)>seconds(changed.start));
  if(conflict)throw new Error(`Пересечение с парой «${conflict.title}» (${conflict.start}–${conflict.end}). Выбери другое время или сначала отмени эту пару.`);
 }
 return next;
}
