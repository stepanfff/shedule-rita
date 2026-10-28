export const TIME_ZONE = 'Europe/Moscow';
export const TIMES = [['08:20','09:50'],['10:00','11:30'],['11:40','13:10'],['13:30','15:00'],['15:10','16:40']];
const titles = {
 philosophy:'Основы философии', law:'Правовое обеспечение профессиональной деятельности', accounting:'Основы бухгалтерского учёта', tax:'Налоги и налогообложение', sport:'Физическая культура', math:'Математика', safety:'Безопасность жизнедеятельности', psychology:'Психология общения', finance:'Основы финансовой грамотности', history:'История России', english:'Иностранный язык в профессиональной деятельности'
};
const teachers = {vol:'Волошина К. А.', lab:'Лабахау К. Д.', mir:'Мирьян А. Д.', gos:'Гостев Д. А.', kiz:'Кизявка К. И.', bel:'Белоус Ю. Н.', dzh:'Джазова Н. М.', rod:'Родченкова О. Н.', tru:'Труханович Д. С.', kis:'Кислицкая Н. А.', lich:'Личманова И. А.', english:'Белоусова О. А.'};
// day: Monday=1. week: 0 upper, 1 lower, null every week. Slot numbers match the photo.
const rows = [
 [1,1,0,'philosophy','Лекция','vol','120'],[1,1,1,'law','Лекция','lab','120'],
 [1,2,0,'accounting','Лекция','mir','906'],[1,2,1,'tax','Лекция','gos','120'],
 [2,1,null,'sport','Практика · спец. группа','kiz','Спортзал'],
 [2,2,0,'math','Практика','bel','408'],[2,2,1,'tax','Практика','dzh','717'],
 [2,3,0,'philosophy','Практика','lab','110'],[2,3,1,'math','Лекция','bel','120'],
 [2,4,0,'accounting','Практика','mir','110'],[2,4,1,'math','Практика','bel','408'],
 [2,5,1,'law','Практика','lab','809'],
 [3,1,0,'law','Лекция','lab','120'],[3,1,1,'safety','Практика','rod','110'],
 [3,2,0,'safety','Лекция','kiz','120'],[3,2,1,'psychology','Лекция','tru','219'],
 [3,3,0,'safety','Практика','rod','110'],[3,3,1,'accounting','Практика','mir','709'],
 [4,1,null,'sport','','','Спортзал'],
 [4,2,0,'tax','Практика','dzh','609'],[4,2,1,'safety','Практика','rod','716'],
 [4,3,null,'finance','Практика','kis','609'],
 [4,4,0,'psychology','Практика','tru','615'],[4,4,1,'philosophy','Практика','lab','220'],
 [5,1,1,'history','Практика','lich','110'],
 [5,2,0,'history','Практика','lich','609'],[5,2,1,'history','Лекция','lich','118'],
 [5,3,null,'finance','Лекция','kis','906'],
 [6,2,0,'law','Практика','lab','110'],
 [6,3,0,'english','Практика','english','408'],[6,3,1,'english','Практика','english','520'],
 [6,4,1,'psychology','Практика','tru','717']
];
export const LESSONS = rows.map(([day,slot,week,subject,type,teacher,room])=>({day,slot,week,subject,title:titles[subject],type,teacher:teachers[teacher]||'',room,start:TIMES[slot-1][0],end:TIMES[slot-1][1]}));
const DAY = 86400000;
export function dayNumber(key){return Date.parse(key+'T00:00:00Z')/DAY;}
export function addDays(key,n){return new Date((dayNumber(key)+n)*DAY).toISOString().slice(0,10);}
export function weekday(key){return new Date(key+'T12:00:00Z').getUTCDay()||7;}
export function monday(key){return addDays(key,1-weekday(key));}
export function weekType(key){const n=Math.floor((dayNumber(key)-dayNumber('2026-10-26'))/7);return ((n%2)+2)%2;}
export function localNow(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {key:`${parts.year}-${parts.month}-${parts.day}`,seconds:Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second),clock:`${parts.hour}:${parts.minute}`};
}
export function seconds(time){const [h,m]=time.split(':').map(Number);return h*3600+m*60;}
export function lessonsFor(key){const day=weekday(key),week=weekType(key);return LESSONS.filter(x=>x.day===day&&(x.week===null||x.week===week));}
export function dayState(key,now=new Date()){
 const local=localNow(now),lessons=lessonsFor(key),isToday=key===local.key;
 const current=isToday?lessons.find(x=>local.seconds>=seconds(x.start)&&local.seconds<seconds(x.end)):undefined;
 const next=isToday?lessons.find(x=>seconds(x.start)>local.seconds):undefined;
 return {local,lessons,isToday,current,next};
}
export function nextLesson(now=new Date()){
 const local=localNow(now);
 for(let i=0;i<15;i++){const key=addDays(local.key,i),lesson=lessonsFor(key).find(x=>i>0||seconds(x.start)>local.seconds);if(lesson)return {key,lesson,remaining:i*86400+seconds(lesson.start)-local.seconds};}
 return null;
}
export function countdown(value){const total=Math.max(0,Math.ceil(value));const h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;return h?`${h} ч ${String(m).padStart(2,'0')} мин ${String(s).padStart(2,'0')} с`:`${m} мин ${String(s).padStart(2,'0')} с`;}
