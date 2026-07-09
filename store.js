/* RENMAD Dispatch Center — shared data store.
   Cloud mode: per-entity tables in Supabase (dc_events / dc_people / dc_substages /
   dc_tasks) with row-level security, audit trail, soft deletes and realtime sync.
   Local mode (no Supabase URL): browser localStorage with seeded demo data. */
const STORE_VERSION = 17;
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TOPICS={'Renewables / AI':'#FF4A00','Storage':'#E84830','Biomethane':'#4C3079','Hydrogen':'#3E8C28','Data Centers':'#29ACE3','Investment':'#185FA5'};
const COUNTRIES={Spain:'ES',Poland:'PL',Italy:'IT',Mexico:'MX',Chile:'CL',Brazil:'BR','Dominican Rep.':'DO',Other:''};
const CRIT={research:[3,7],prep:[4,17],marketing:[16,27]};
const ROLES=['Lead','PM','Sales','Marketing','Logistics','Admin','HR'];
/* access tiers (permission level, separate from job role): member = own lane; manager = stage/release; admin = everything */
const ACCESS=['member','manager','admin'];
const ACCESS_LABEL={member:'Member',manager:'Manager',admin:'Admin (full)'};
const STATUS=['To do','In progress','Done'];
/* finance result bands: invoiced / STRETCH target. <b0 = Under, <b1 = On target, >=b1 = Stretch.
   Derived from the S1 2026 Calculation sheet (all 2026 rows reproduce). */
const FIN_BANDS={2025:[0.75,1],default:[0.8,1]};
function finResult(f){if(f.invoiced==null||f.invoiced===''||!f.stretch)return null;
  const b=FIN_BANDS[f.year]||FIN_BANDS.default,r=f.invoiced/f.stretch;
  return r<b[0]?{label:'Under',color:'#D32230'}:r<b[1]?{label:'On target',color:'#3E8C28'}:{label:'Stretch',color:'#FF4A00'};}
function finMargin(f){return (+f.invoiced||0)-(+f.spex||0);}
function finFmt(n){if(n==null||n===''||isNaN(+n))return '—';return new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(+n)+' €';}
const MKT_TYPES={Content:'#B9D3F0',Product:'#BFE0A0',Sales:'#F3C49B',Webinar:'#C9B3E8'};  // marketing week / webinar types
const POST_PM=1, POST_SALES=2;
/* lanes (top→bottom) + stages as week RANGES (s=start, e=end, in weeks before event; W0=0, negative=after).
   Pastel palette so it never clashes with the bright brand orange. */
const LANES=['project','marketing','sales','logistics'];
const LANE_LABEL={project:'PM / Project',marketing:'Marketing',sales:'Sales (SPX)',logistics:'Logistics'};
const RED='#ee2233';        // bright red — notable dates / milestones (must not be missed)
const ALERTCOL='#C9B3E8';   // pastel purple — sales alert weeks
/* each stage has a default duration d (weeks) + phase (pre-event / event-week / post-event).
   Lanes lay out contiguous, ending at W0; durations are editable per event (ev.dur). */
const STAGES={
 project:[{key:'research',name:'Research',color:'#CFE2F6',d:6,phase:'pre'},{key:'prep',name:'Prep',color:'#A9CBEE',d:6,phase:'pre'},{key:'scaling',name:'Scaling',color:'#7FB0E0',d:18,phase:'pre'}],
 marketing:[{key:'prelaunch',name:'Pre-launch',color:'#FFE3CC',d:4,phase:'pre'},{key:'onmarket',name:'On market',color:'#FFC9A3',d:18,phase:'pre'},{key:'recordings',name:'Recordings',color:'#F7B179',d:3,phase:'post'}],
 sales:[{key:'prospecting',name:'Prospecting',color:'#DDEFC9',d:12,phase:'pre'},{key:'outreach',name:'Outreach',color:'#BFE0A0',d:10,phase:'pre'},{key:'closing',name:'Closing',color:'#9CCF77',d:8,phase:'pre'}],
 logistics:[
  {key:'sourcing',name:'Venue',color:'#FBF1C4',d:4,phase:'pre'},
  {key:'contracting',name:'Contract',color:'#F8E9A6',d:3,phase:'pre'},
  {key:'supplier',name:'Suppliers',color:'#F5E08A',d:11,phase:'pre'},
  {key:'mktcoord',name:'Materials',color:'#F2D86E',d:4,phase:'pre'},
  {key:'travel',name:'Travel',color:'#EFD15C',d:1,phase:'pre'},
  {key:'venueops',name:'Venue ops',color:'#ECCA46',d:5,phase:'pre'},
  {key:'prep',name:'Prep',color:'#E8C232',d:2,phase:'pre'},
  {key:'delivery',name:'Event',color:'#111111',d:1,phase:'event'},
  {key:'closing',name:'Closing',color:'#E0B520',d:2,phase:'post'},
 ],
};
const ALERT_DEFS=[{key:'LD',name:'Launch Discount',off:16,optional:true},{key:'SE',name:'Super Early',off:12},{key:'EB',name:'Early Bird',off:8},{key:'LC',name:'Last Chance',off:4,ext:true}];
function stageColor(lane,key){const s=(STAGES[lane]||[]).find(s=>s.key===key);return s?s.color:'#b4b2a9';}
function stageName(lane,key){const s=(STAGES[lane]||[]).find(s=>s.key===key);return s?s.name:key;}
function stageDef(lane,key){return (STAGES[lane]||[]).find(s=>s.key===key);}
/* shared timeline layout — both overview & event page call this, so they always mirror */
function laneTotalPre(ev,lane){return STAGES[lane].filter(s=>s.phase==='pre').reduce((a,s)=>a+(ev.dur[lane][s.key]||s.d),0);}
function preExtent(ev){let m=0;LANES.forEach(l=>m=Math.max(m,laneTotalPre(ev,l)));return Math.max(m,ev.milestones.goNoGo,ev.milestones.launch,ev.alerts.LD.off,ev.alerts.SE.off,ev.alerts.EB.off,ev.alerts.LC.off);}
function layLane(ev,lane,evIdx){
  const sts=STAGES[lane],dur=ev.dur[lane];const bars=[];
  const pre=sts.filter(s=>s.phase==='pre');let cur=evIdx-pre.reduce((a,s)=>a+(dur[s.key]||s.d),0);
  pre.forEach(s=>{const d=dur[s.key]||s.d;bars.push({s,x:cur,w:d});cur+=d;});
  const evs=sts.find(s=>s.phase==='event');if(evs){bars.push({s:evs,x:evIdx,w:(dur[evs.key]||evs.d)});}
  let c2=evIdx+(evs?(dur[evs.key]||evs.d):1);
  sts.filter(s=>s.phase==='post').forEach(s=>{const d=dur[s.key]||s.d;bars.push({s,x:c2,w:d});c2+=d;});
  return bars;
}
const WEEKW_STD=55; // reference week-width used only to size default substage spans (page-independent)
function evIndex(ev){const start=addDays(monday(ymd(ev.date)),-(preExtent(ev)+2)*7);return Math.round((+monday(ymd(ev.date))-+start)/(7*86400000));}
/* ensure every substage has a week + span default (so ALL pages — event, person — can place tasks in time) */
function ensureSubDefaults(){let dirty=false;
  DB.events.forEach(ev=>{const evIdx=evIndex(ev);
    LANES.forEach(lane=>{const bars=layLane(ev,lane,evIdx);const subs=DB.substages.filter(s=>s.eventId==ev.id&&s.lane===lane);
      const byStage={};subs.forEach(s=>{(byStage[s.stage]=byStage[s.stage]||[]).push(s);});
      Object.keys(byStage).forEach(k=>{const bar=bars.find(b=>b.s.key===k);if(!bar)return;const list=byStage[k];
        list.forEach((s,i)=>{if(s.week==null){const col=Math.round(bar.x+(i+0.5)*bar.w/list.length-0.5);s.week=evIdx-col;dirty=true;}});});
      const arr=subs.map(s=>({s,c:evIdx-s.week})).sort((a,b)=>a.c-b.c);
      arr.forEach((o,i)=>{if(o.s.span==null){const nextC=(i+1<arr.length)?arr[i+1].c:(evIdx+1);const gap=Math.max(1,nextC-o.c);const need=Math.max(1,Math.ceil(((o.s.name||'').length*6.6+34)/WEEKW_STD));o.s.span=Math.min(need,gap);dirty=true;}});
    });
  });
  if(dirty&&(!USE_SUPABASE||DB.canManage()))DB.save(); // members never push layout defaults (server would refuse)
}
/* absolute Monday date a task sits on: explicit deadline wins, else its substage's week before the event */
function taskDate(t){const ev=DB.event(t.eventId);if(!ev)return monday(new Date());
  if(t.deadline){return monday(ymd(t.deadline));}
  const sub=DB.substages.find(s=>s.id==t.substageId);const wk=(sub&&sub.week!=null)?sub.week:0;
  return addDays(monday(ymd(ev.date)),-wk*7);}

/* ---- date helpers ---- */
function ymd(s){const p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function monday(d){const x=new Date(d);const o=(x.getDay()+6)%7;x.setDate(x.getDate()-o);x.setHours(0,0,0,0);return x;}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function toISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtD(d){return d.getDate()+' '+MON[d.getMonth()];}
function dateRange(ev){const s=ymd(ev.date);return ev.days>1?(fmtD(s)+'–'+fmtD(addDays(s,ev.days-1))+' '+s.getFullYear()):(fmtD(s)+' '+s.getFullYear());}

/* ---- holidays / capacity ---- */
const HOL={
 ES:[['01-01','New Year'],['01-06','Reyes'],['05-01','Labour Day'],['08-15','Assumption'],['10-12','Nat. Day'],['11-01','All Saints'],['12-06','Constitution'],['12-08','Immaculate'],['12-25','Christmas']],
 PL:[['01-01','New Year'],['01-06','Epiphany'],['05-01','Labour'],['05-03','Constitution'],['08-15','Assumption'],['11-01','All Saints'],['11-11','Independence'],['12-25','Christmas'],['12-26','2nd day']],
 IT:[['01-01','New Year'],['01-06','Epiphany'],['04-25','Liberation'],['05-01','Labour'],['06-02','Republic'],['08-15','Ferragosto'],['11-01','All Saints'],['12-08','Immaculate'],['12-25','Christmas'],['12-26','S. Stefano']],
 MX:[['01-01','New Year'],['02-02','Constitution'],['03-16','Juárez'],['05-01','Labour'],['09-16','Independence'],['11-16','Revolution'],['12-25','Christmas']],
 CL:[['01-01','New Year'],['05-01','Labour'],['05-21','Navy Day'],['06-20','Indigenous'],['06-29','St Peter & Paul'],['07-16','V. del Carmen'],['08-15','Assumption'],['09-18','Independence'],['09-19','Army Day'],['10-12','Two Worlds'],['11-01','All Saints'],['12-08','Immaculate'],['12-25','Christmas']],
 BR:[['01-01','New Year'],['04-21','Tiradentes'],['05-01','Labour'],['09-07','Independence'],['10-12','Aparecida'],['11-02','Finados'],['11-15','Republic'],['11-20','Black Awareness'],['12-25','Christmas']],
 DO:[['01-01','New Year'],['01-06','Reyes'],['01-21','Altagracia'],['01-26','Duarte'],['02-27','Independence'],['05-01','Labour'],['08-16','Restoration'],['09-24','Mercedes'],['11-06','Constitution'],['12-25','Christmas']]
};
const MOV={ES:[[-2,'Good Friday']],PL:[[1,'Easter Mon'],[60,'Corpus Christi']],IT:[[1,'Easter Mon']],MX:[],CL:[[-2,'Good Friday'],[-1,'Holy Sat']],BR:[[-48,'Carnival'],[-47,'Carnival'],[-2,'Good Friday'],[60,'Corpus Christi']],DO:[[-2,'Good Friday'],[60,'Corpus Christi']]};
function easter(Y){const a=Y%19,b=Math.floor(Y/100),c=Y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(Y,mo-1,da);}
function capacity(mon){const sun=addDays(mon,6);
  if(+mon===+monday(easter(mon.getFullYear()))||+mon===+monday(easter(sun.getFullYear())))return{w:0,why:'Holy Week — skipped'};
  let aug=false,jul=false,xmas=false;for(let i=0;i<7;i++){const d=addDays(mon,i),m=d.getMonth(),da=d.getDate();if(m===7)aug=true;if(m===6)jul=true;if((m===11&&da>=22)||(m===0&&da<=6))xmas=true;}
  if(aug)return{w:1/3,why:'August ×⅓'};if(xmas)return{w:1/3,why:'Christmas ×⅓'};if(jul)return{w:0.5,why:'July ×½'};return{w:1,why:''};}
function bankHols(mon,cc){const out=[],fixed=HOL[cc]||[],mov=MOV[cc]||[],sun=addDays(mon,6),days=[];for(let i=0;i<7;i++)days.push(addDays(mon,i));
  [mon.getFullYear(),sun.getFullYear()].forEach(y=>{const es=easter(y);
    fixed.forEach(([k,n])=>{const p=k.split('-').map(Number),hd=new Date(y,p[0]-1,p[1]);days.forEach(d=>{if(+d===+hd)out.push([n,d]);});});
    mov.forEach(([off,n])=>{const hd=addDays(es,off);hd.setHours(0,0,0,0);days.forEach(d=>{if(+d===+hd)out.push([n,d]);});});});return out;}

/* ---- HR: Madrid labour calendar + working-hours engine + holiday chain ---- */
/* "Calendario laboral oficial de Madrid" (capital): 12 national/regional + 2 local.
   Fixed dates that fall on a SUNDAY are shifted to Monday (the usual decree);
   verify against the BOCM each year and correct via MAD_OVR if needed. */
const MAD_FIX=[['01-01','Año Nuevo'],['01-06','Reyes'],['05-01','Fiesta del Trabajo'],['05-02','Comunidad de Madrid'],['05-15','San Isidro'],['08-15','Asunción'],['10-12','Fiesta Nacional'],['11-01','Todos los Santos'],['11-09','La Almudena'],['12-06','Constitución'],['12-08','Inmaculada'],['12-25','Navidad']];
const MAD_OVR={}; // per-year corrections from the official BOCM calendar, e.g. {2027:{'2027-05-17':'San Isidro (traslado)'}}
const _madCache={};
function madridHolidays(y){
  if(_madCache[y])return _madCache[y];
  const out={};
  MAD_FIX.forEach(([md,n])=>{let d=new Date(y,+md.slice(0,2)-1,+md.slice(3));
    if(d.getDay()===0){d=addDays(d,1);n+=' (traslado)';}
    out[toISO(d)]=n;});
  const e=easter(y);
  out[toISO(addDays(e,-3))]='Jueves Santo';
  out[toISO(addDays(e,-2))]='Viernes Santo';
  Object.assign(out,MAD_OVR[y]||{});
  return _madCache[y]=out;
}
function madHol(iso){return madridHolidays(+iso.slice(0,4))[iso]||null;}
/* Legal working pattern: Mon–Thu 8 h + Fri 5.5 h (= 37.5); July & August 7 h every day (= 35).
   Flexible working is allowed — this pattern is what a DAY is worth (holidays, absences). */
function hoursPerDay(d){const m=d.getMonth();if(m===6||m===7)return 7;return d.getDay()===5?5.5:8;}
function workingDaysBetween(fromISO,toISO_){
  let n=0;for(let d=ymd(fromISO);toISO(d)<=toISO_;d=addDays(d,1)){
    if(d.getDay()===0||d.getDay()===6)continue;
    if(madHol(toISO(d)))continue;n++;}
  return n;
}
/* leave & holiday types.
   OFF = person is away → no clock-in / no hour allocation expected.
   LEAVE = the HR-managed absences (sick/maternity/paternity) — don't spend the
   23-day holiday allowance. 'adjust' = a signed balance change (carry-over / borrow). */
const OFF_TYPES=['vacation','sick','maternity','paternity'];
const LEAVE_TYPES=['sick','maternity','paternity'];
const TYPE_LABEL={vacation:'Holiday',remote:'Remote working',sick:'Sick leave',maternity:'Maternity leave',paternity:'Paternity leave',adjust:'Balance adjustment'};
const TYPE_EMOJI={vacation:'🌴',remote:'🏠',sick:'🤒',maternity:'👶',paternity:'👶',adjust:'±'};
function personDaysOfTypes(personId,fromISO,toISO_,types){ // approved working days of given types in a range
  const out=[];
  DB.holidays.filter(h=>h.personId==personId&&h.status==='approved'&&types.includes(h.type||'vacation')).forEach(h=>{
    for(let d=ymd(h.dateFrom);toISO(d)<=h.dateTo;d=addDays(d,1)){
      const iso=toISO(d);
      if(iso<fromISO||iso>toISO_)continue;
      if(d.getDay()===0||d.getDay()===6||madHol(iso))continue;
      out.push(iso);}});
  return out;
}
function personVacDays(personId,fromISO,toISO_){return personDaysOfTypes(personId,fromISO,toISO_,['vacation']);}
function personLeaveDays(personId,fromISO,toISO_){return personDaysOfTypes(personId,fromISO,toISO_,LEAVE_TYPES);}
function personOffDays(personId,fromISO,toISO_){return personDaysOfTypes(personId,fromISO,toISO_,OFF_TYPES);}
/* is the person on an approved absence today (or on date)? → {type,label,emoji,until} or null */
function currentLeave(personId,onISO){
  const day=onISO||toISO(new Date());
  const h=DB.holidays.find(x=>x.personId==personId&&x.status==='approved'&&OFF_TYPES.includes(x.type||'vacation')&&x.dateFrom<=day&&x.dateTo>=day);
  if(!h)return null;
  return {type:h.type||'vacation',label:TYPE_LABEL[h.type||'vacation'],emoji:TYPE_EMOJI[h.type||'vacation'],until:h.dateTo};
}
/* holiday balance for a year: allowance (23) + carry-over/borrow adjustments − vacation used */
const HOL_DEADLINE_MD='02-28'; // carry-over must be enjoyed before end of February
function holAllowance(p){return (p&&p.holidayDays!=null)?+p.holidayDays:23;}
function holUsed(personId,year){return DB.holidays.filter(h=>h.personId==personId&&h.status==='approved'&&(h.type||'vacation')==='vacation'&&(h.dateFrom||'').slice(0,4)===String(year)).reduce((a,h)=>a+(+h.workDays||0),0);}
function holAdjust(personId,year){return DB.holidays.filter(h=>h.personId==personId&&h.status==='approved'&&h.type==='adjust'&&(h.dateFrom||'').slice(0,4)===String(year)).reduce((a,h)=>a+(+h.workDays||0),0);}
function holRemaining(personId,year){const p=DB.person(personId);return holAllowance(p)+holAdjust(personId,year)-holUsed(personId,year);}
function holDeadlineText(year){return 'enjoy them before 28 Feb '+(year+1);}
function weekWorkInfo(mondayISO,personId){ // required hours + auto Festivos/Vacaciones/Leave for one week
  const mon=ymd(mondayISO);let required=0,fest=0,festNames=[],vac=0,leave=0;
  const friISO=toISO(addDays(mon,4));
  const vacDays=personId!=null?personVacDays(personId,mondayISO,friISO):[];
  const leaveDays=personId!=null?personLeaveDays(personId,mondayISO,friISO):[];
  for(let i=0;i<5;i++){const d=addDays(mon,i),iso=toISO(d),h=hoursPerDay(d);
    required+=h;
    const hol=madHol(iso);
    if(hol){fest+=h;festNames.push(iso.slice(5)+' '+hol);}
    else if(vacDays.includes(iso))vac+=h;
    else if(leaveDays.includes(iso))leave+=h;
  }
  return {required,fest,festNames,vac,leave,toAllocate:Math.max(0,required-fest-vac-leave)};
}
const HR_START='2026-07-06'; // first week the timesheet is mandatory (module go-live)
function tsFor(personId,weekISO){return DB.timesheets.find(t=>t.personId==personId&&t.week===weekISO);}
function tsManualSum(t){return t?Object.values(t.hours||{}).reduce((a,v)=>a+(+v||0),0):0;}
function tsComplete(personId,weekISO){
  const w=weekWorkInfo(weekISO,personId);
  if(w.toAllocate<=0)return true; // all-holiday/vacation week: nothing to fill
  return Math.abs(tsManualSum(tsFor(personId,weekISO))-w.toAllocate)<0.01;
}
function missingWeeks(personId){
  const out=[],cur=toISO(monday(new Date()));
  for(let m=ymd(HR_START);toISO(m)<cur;m=addDays(m,7)){
    const iso=toISO(m);
    if(!tsComplete(personId,iso))out.push(iso);}
  return out;
}
/* holiday approval chain: team manager → Belén → HR */
function isBelenP(p){return !!p&&(p.email||'').toLowerCase()==='belen.gallego@ata.email';}
function holManager(p){ // first approver; managers/admins skip straight to Belén
  if(!p||p.access==='manager'||p.access==='admin')return null;
  const mgr=DB.people.find(x=>x.access==='manager'&&x.role===p.role&&x.id!=p.id);
  if(mgr)return mgr;
  return DB.people.find(x=>x.access==='admin'&&!isBelenP(x)&&x.id!=p.id)||null; // PM/Admin roles → Carlos
}
function holChain(p){
  const c=[],m=holManager(p);
  if(m&&!isBelenP(m))c.push({key:'manager',who:m});
  const belen=DB.people.find(isBelenP);
  if(belen&&belen.id!=p.id)c.push({key:'belen',who:belen});
  c.push({key:'hr',who:null});
  return c;
}
function holStageLabel(req){
  const p=DB.person(req.personId);
  if(req.status==='manager'){const m=holManager(p);return 'waiting for '+(m?m.name:'manager');}
  if(req.status==='belen')return 'waiting for Belén';
  if(req.status==='hr')return 'waiting for HR';
  return req.status;
}
function holActsOnMe(req){ // is it MY turn to decide this request?
  const me=DB.currentUser;if(!me||req.personId==me.id)return false;
  const p=DB.person(req.personId);if(!p)return false;
  if(req.status==='manager'){const m=holManager(p);return !!(m&&m.id==me.id)||isBelenP(me);}
  if(req.status==='belen')return isBelenP(me);
  if(req.status==='hr')return !!me.hr||isBelenP(me); // HR (rrhh + Jesús) are the approvers; Belén can always act too
  return false;
}
function holNextStatus(req){
  const chain=holChain(DB.person(req.personId)).map(s=>s.key);
  const i=chain.indexOf(req.status);
  return (i<0||i===chain.length-1)?'approved':chain[i+1];
}
function myPendingApprovals(){return DB.hrReady()?DB.holidays.filter(holActsOnMe).length:0;}
/* remote working: up to 4 weeks (20 working days) per person per year */
const REMOTE_MAX_DAYS=20;
function remoteDaysUsed(personId,year){
  return DB.holidays.filter(h=>h.personId==personId&&h.type==='remote'&&h.status!=='denied'&&(h.dateFrom||'').slice(0,4)===String(year))
    .reduce((a,h)=>a+(+h.workDays||0),0);
}
/* team visibility: admins & HR see everyone; managers see THEIR team; members see their team */
function hrVisiblePeople(){
  const me=DB.currentUser;if(!me)return [];
  const all=DB.people.slice().sort((a,b)=>a.role===b.role?a.name.localeCompare(b.name):a.role.localeCompare(b.role));
  if(DB.isAdmin()||DB.isHR())return all;
  return all.filter(p=>p.role===me.role);
}
/* ---- time clock (registro horario) helpers ---- */
const TC_START='2026-07-13'; // first day punching is expected (module go-live Monday)
function tcRows(personId,day){return DB.timeclock.filter(r=>r.personId==personId&&r.day===day);}
function tcEffective(personId,day){ // amended entries stop counting; 'void' amendments count nothing
  const rows=tcRows(personId,day);
  const amended={};rows.forEach(r=>{if(r.amends!=null)amended[r.amends]=true;});
  return rows.filter(r=>!amended[r.id]&&r.kind!=='void').sort((a,b)=>(a.time||'').localeCompare(b.time||''));
}
function tcMinutes(t){const p=(t||'0:0').split(':');return (+p[0])*60+(+p[1])+(p[2]?(+p[2])/60:0);} // tolerates HH:MM or HH:MM:SS
function tcSecondsOf(t){const p=(t||'0:0:0').split(':');return (+p[0])*3600+(+p[1])*60+(+(p[2]||0));}
function nowHMS(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');}
function fmtHMS(s){s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return h+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');}
function tcDayInfo(personId,day){ // pair in→out; open pair counts to "now" if today
  const es=tcEffective(personId,day);
  let total=0,openSince=null;
  es.forEach(e=>{
    if(e.kind==='in'){if(openSince==null)openSince=tcMinutes(e.time);}
    else if(e.kind==='out'&&openSince!=null){total+=Math.max(0,tcMinutes(e.time)-openSince);openSince=null;}
  });
  const today=toISO(new Date());
  if(openSince!=null&&day===today){const now=new Date();total+=Math.max(0,now.getHours()*60+now.getMinutes()-openSince);}
  return {entries:es,total,open:openSince!=null};
}
/* live worked seconds (for the constantly-counting clock) — open session ticks to real now */
function tcLiveSeconds(personId,day){
  const es=tcEffective(personId,day);let total=0,openSince=null;
  es.forEach(e=>{
    if(e.kind==='in'){if(openSince==null)openSince=tcSecondsOf(e.time);}
    else if(e.kind==='out'&&openSince!=null){total+=Math.max(0,tcSecondsOf(e.time)-openSince);openSince=null;}
  });
  const today=toISO(new Date());
  if(openSince!=null&&day===today){const now=new Date();total+=Math.max(0,now.getHours()*3600+now.getMinutes()*60+now.getSeconds()-openSince);}
  return {seconds:total,open:openSince!=null};
}
/* seconds clocked in WITHOUT a break since the last clock-in (resets on any clock-out) */
function tcContinuousSeconds(personId){
  if(!DB.tcReady())return 0;
  const es=tcEffective(personId,toISO(new Date()));let openAt=null;
  es.forEach(e=>{if(e.kind==='in'){if(openAt==null)openAt=tcSecondsOf(e.time);}else if(e.kind==='out')openAt=null;});
  if(openAt==null)return 0;const now=new Date();return Math.max(0,now.getHours()*3600+now.getMinutes()*60+now.getSeconds()-openAt);
}
/* gentle "time for a break?" nudge after a long unbroken stretch (like a car's fatigue alert).
   Not mandatory — fully dismissible; re-appears after a snooze if they keep going. */
const BREAK_AFTER_H=5, BREAK_SNOOZE_MIN=60;
let _breakSnoozeUntil=0,_breakTimer=null;
function breakReminderTick(){
  if(!DB.currentUser||!DB.tcReady())return;
  const cont=tcContinuousSeconds(DB.currentUser.id),el=document.getElementById('breakToast');
  if(cont>=BREAK_AFTER_H*3600 && Date.now()>_breakSnoozeUntil){ if(!el)showBreakToast(cont); }
  else if(el&&cont<60){el.remove();} // they clocked out — clear it
}
function showBreakToast(cont){
  const h=Math.floor(cont/3600),m=Math.floor((cont%3600)/60);
  const d=document.createElement('div');d.id='breakToast';
  d.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9998;background:#2B2B2B;color:#fff;border-radius:12px;padding:14px 16px;max-width:320px;box-shadow:0 8px 30px rgba(0,0,0,.28);font-family:Segoe UI,system-ui,sans-serif;font-size:13px';
  d.innerHTML='<div style="font-weight:700;margin-bottom:4px">🚗☕ Time for a break?</div>'+
    '<div style="color:#e6e4df;margin-bottom:10px">You’ve been clocked in for '+h+' h '+String(m).padStart(2,'0')+' without a break. Stopping for lunch or a rest? Remember to clock back in when you’re back.</div>'+
    '<div style="display:flex;gap:8px"><button id="bt_out" style="background:#FF4A00;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-weight:600;cursor:pointer;font:inherit">Clock out for a break</button>'+
    '<button id="bt_dismiss" style="background:none;color:#cfcdc7;border:1px solid #55534e;border-radius:8px;padding:7px 12px;cursor:pointer;font:inherit">Not yet</button></div>';
  document.body.appendChild(d);
  document.getElementById('bt_out').onclick=()=>{
    const me=DB.currentUser;
    DB.timeclock.push({id:DB.newId(),personId:me.id,day:toISO(new Date()),time:nowHMS(),kind:'out',manual:false,amends:null,reason:null,note:null,reportId:null});
    DB.save();d.remove();_breakSnoozeUntil=0;window.dispatchEvent(new Event('dc-remote'));
  };
  document.getElementById('bt_dismiss').onclick=()=>{_breakSnoozeUntil=Date.now()+BREAK_SNOOZE_MIN*60000;d.remove();};
}
function tcExpectedDay(personId,iso){ // 0 on weekends, bank holidays and any approved leave (holiday/sick/maternity/paternity)
  const d=ymd(iso);
  if(d.getDay()===0||d.getDay()===6||madHol(iso))return 0;
  if(personOffDays(personId,iso,iso).length)return 0;
  return hoursPerDay(d);
}
function tcMissingDays(personId){ // expected days with no punches at all (since go-live, before today)
  const out=[],today=toISO(new Date());
  for(let d=ymd(TC_START);toISO(d)<today;d=addDays(d,1)){
    const iso=toISO(d);
    if(tcExpectedDay(personId,iso)<=0)continue;
    if(!tcEffective(personId,iso).length)out.push(iso);
  }
  return out.slice(-15);
}
function openReports(){return DB.tcreports.filter(r=>r.status!=='resolved');}
/* weekly overtime: hours clocked vs the hours ALLOWED that week (37.5, or 35 in Jul/Aug,
   less bank holidays). Daily distribution is flexible — only the WEEKLY total matters. */
function tcWeekOvertime(personId,mondayISO){
  const w=weekWorkInfo(mondayISO,personId);
  const allowed=Math.max(0,w.required-w.fest); // bank holidays lower the week; vacation not subtracted
  const mon=ymd(mondayISO);let sec=0;
  for(let i=0;i<7;i++)sec+=tcLiveSeconds(personId,toISO(addDays(mon,i))).seconds;
  const workedH=sec/3600;
  return {allowed,workedH,over:workedH-allowed};
}
function tcOvertimeWeeks(personId){ // weeks (this + recent) where clocked hours exceed the allowance
  const out=[],curMon=monday(new Date());
  for(let m=monday(ymd(TC_START));toISO(m)<=toISO(curMon);m=addDays(m,7)){
    const o=tcWeekOvertime(personId,toISO(m));
    if(o.over>0.5)out.push({week:toISO(m),over:o.over,worked:o.workedH,allowed:o.allowed});
  }
  return out.slice(-8);
}
/* in-app alarm badges on the nav (email digests can be added later via an Edge Function) */
function decorateNav(){
  if(!DB.hrReady()||!DB.currentUser)return;
  let n=myPendingApprovals()+missingWeeks(DB.currentUser.id).length;
  if(DB.tcReady()){
    n+=tcMissingDays(DB.currentUser.id).length;
    if(DB.isHRAdmin())n+=openReports().length;
  }
  const pill='<span title="Things need your attention: approvals, missing hours/punches or correction reports" style="background:#D32230;color:#fff;border-radius:9px;font-size:10px;font-weight:700;padding:1px 6px;vertical-align:1px">'+n+'</span>';
  ['nav-hr','nav-home'].forEach(id=>{const el=document.getElementById(id);if(el&&n>0)el.innerHTML+=' '+pill;});
}

/* ---- seed ---- */
const SEED_EVENTS=[
 {id:1,name:'E053 RENMAD Invest',topic:'Investment',pm:'Belén Gallego',lead:'',sales:'Sheetal Shamdasani',city:'Madrid',country:'Spain',date:'2027-01-26',days:2,prov:true},
 {id:2,name:'E056 RENMAD Biomethane',topic:'Biomethane',pm:'Jesús Rodriguez',lead:'',sales:'Ian Casares',city:'Toledo',country:'Spain',date:'2027-02-11',days:2,prov:true},
 {id:3,name:'E057 RENMAD Storage',topic:'Storage',pm:'Cristina Galán',lead:'',sales:'Ian Casares',city:'Seville',country:'Spain',date:'2027-03-25',days:2,prov:true},
 {id:4,name:'E058 RENMAD Storage Italia',topic:'Storage',pm:'Elena Spinelli',lead:'',sales:'Sheetal Shamdasani',city:'Rome',country:'Italy',date:'2027-04-07',days:2,prov:true},
 {id:5,name:'E052 RENMAD UsefulAI',topic:'Renewables / AI',pm:'Belén Gallego',lead:'Cintia Hernández',sales:'Ian Casares',city:'Madrid',country:'Spain',date:'2027-06-02',days:2,prov:true},
 {id:6,name:'E055 RENMAD Data Centers',topic:'Data Centers',pm:'Andrea Renieblas',lead:'',sales:'Sheetal Shamdasani',city:'Madrid',country:'Spain',date:'2027-07-08',days:2,prov:true},
];
const SEED_PEOPLE=[
 /* Management (leads + manager access) */
 {id:1,name:'Belén Gallego',role:'Lead',access:'admin',email:'belen.gallego@ata.email',finance:true}, // overall admin incl. finance
 {id:2,name:'Carlos Márquez',role:'Lead',access:'admin',email:'carlos.marquez@ata.email'},      // Lead PM side & overall; manages the other managers
 {id:3,name:'Araceli Giner',role:'Marketing',access:'manager',email:'araceli.giner@ata.email'}, // Lead of marketing side
 {id:4,name:'Cintia Hernández',role:'Sales',access:'manager',email:'cintia.hernandez@ata.email'},  // Lead of sales side
 {id:5,name:'Valeria Vargas',role:'Logistics',access:'manager',email:'valeria.vargas@ata.email'},// Lead of logistics side
 /* Sales */
 {id:6,name:'Ian Casares',role:'Sales',access:'member',email:'ian.casares@ata.email'},
 {id:7,name:'Sheetal Shamdasani',role:'Sales',access:'member',email:'sheetal.shamdasani@ata.email'},
 /* PM */
 {id:8,name:'Jesús Rodriguez',role:'PM',access:'member',email:'jesus.rgonzalez@ata.email'},       // PM & Lead (email is the exception)
 {id:9,name:'Cristina Galán',role:'PM',access:'member',email:'cristina.galan@ata.email'},        // PM & Lead
 {id:10,name:'Andrea Renieblas',role:'PM',access:'member',email:'andrea.renieblas@ata.email'},
 {id:11,name:'Ewa Paryz',role:'PM',access:'member',email:'ewa.paryz@ata.email'},
 {id:12,name:'Elena Spinelli',role:'PM',access:'member',email:'elena.spinelli@ata.email'},
 {id:13,name:'Francesca Ravera',role:'PM',access:'member',email:'francesca.ravera@ata.email'},  // PM assistant
 /* Marketing */
 {id:14,name:'Valeria García',role:'Marketing',access:'member',email:'valeria.garcia@ata.email'},// Marketing & media partners & LinkedIn ads
 {id:15,name:'Maria Mendicute',role:'Marketing',access:'member',email:'maria.mendicute@ata.email'},// Marketing, webinars & social media
 /* Logistics */
 {id:16,name:'Julian Uribe',role:'Logistics',access:'member',email:'julian.uribe@ata.email'},
 /* Administration */
 {id:17,name:'Jesús Jiménez',role:'Admin',access:'member',email:'jesus.jimenez@ata.email',finance:true}, // Accounting — the finance editor
 /* Human Resources — the final holiday approver (Belén + Jesús can also act) */
 {id:18,name:'Recursos Humanos',role:'HR',access:'member',email:'rrhh@ata.email',hr:true}, // HR access only; primary final approver
];
function buildSeed(){
  const events=JSON.parse(JSON.stringify(SEED_EVENTS));
  const people=JSON.parse(JSON.stringify(SEED_PEOPLE));
  const byName=n=>{const p=people.find(p=>p.name===n);return p?p.id:null;};
  const subs=[],tasks=[];let sid=1,tid=1;
  const PLAN={
    project:{research:['Speaker research'],prep:['Agenda build'],scaling:['Onsite scale-up','Next-edition prep']},
    marketing:{prelaunch:['Content & assets'],onmarket:['Email campaign','Webinars'],recordings:['Publish recordings','Next-year landing']},
    sales:{prospecting:['Target list'],outreach:['Send proposals'],closing:['Negotiate & close']},
    logistics:{sourcing:['Venue search','Hotel comparison'],contracting:['Negotiate & sign','Payment schedule'],supplier:['Find suppliers','Confirm suppliers'],mktcoord:['Materials kick-off','Produce materials'],travel:['Staff travel & hotel'],venueops:['Ops comms & floorplan','Follow-up meetings'],prep:['Run of show','Logistics checklist'],delivery:['Event execution'],closing:['Invoices & reconciliation']},
  };
  events.forEach(ev=>{
    // editable, free-floating: milestones, sales alert weeks, marketing markers
    ev.milestones={goNoGo:24, launch:18};
    ev.alerts={LD:{off:16,on:true},SE:{off:12,on:true},EB:{off:8,on:true},LC:{off:4,on:true}};
    ev.markers={lhConnect:17, lhBrochure:17, pmMtg1:17, pmMtg2:9};
    ev.dur={};LANES.forEach(l=>{ev.dur[l]={};STAGES[l].forEach(s=>ev.dur[l][s.key]=s.d);});
    ev.team=[];const add=(n,r)=>{const id=byName(n);if(id&&!ev.team.find(t=>t.personId===id))ev.team.push({personId:id,role:r});};
    add(ev.pm,'PM');if(ev.lead)add(ev.lead,'Lead');add(ev.sales,'Sales');
    add(ev.mkt||'Maria Mendicute','Marketing');   // default marketing owner per event (provisional)
    add(ev.log||'Julian Uribe','Logistics');      // default logistics owner per event (provisional)
    Object.keys(PLAN).forEach(lane=>Object.keys(PLAN[lane]).forEach(stage=>{
      PLAN[lane][stage].forEach((nm,i)=>{const sub={id:sid++,eventId:ev.id,lane,stage,name:nm,order:i};subs.push(sub);
        const who=lane==='sales'?byName(ev.sales):lane==='logistics'?byName(ev.log||'Julian Uribe'):lane==='marketing'?byName(ev.mkt||'Maria Mendicute'):byName(ev.pm);
        tasks.push({id:tid++,eventId:ev.id,lane,stage,substageId:sub.id,title:nm,assignee:who,deadline:'',status:'To do'});});
    }));
  });
  /* finance seed mirrors the real "S1 2026 Calculation" sheet (local/demo mode only) */
  const finance=[
   {id:1,eventId:null,name:'Invest',edition:1,year:2026,semester:1,city:'Madrid','when':'27 Jan',pm:'Carlos',sales:'Sheetal',target:60000,stretch:75000,invoiced:79405.71,spex:37000,notes:''},
   {id:2,eventId:null,name:'Biometano',edition:3,year:2026,semester:1,city:'Toledo','when':'11-12 Feb',pm:'Jesús R',sales:'Iker',target:250000,stretch:280000,invoiced:249285.5,spex:90494,notes:''},
   {id:3,eventId:null,name:'Data Centres',edition:2,year:2026,semester:1,city:'Zaragoza','when':'18-19 Feb',pm:'Andrea',sales:'Sheetal',target:130000,stretch:150000,invoiced:179077.9,spex:66640,notes:''},
   {id:4,eventId:null,name:'Storage Polska',edition:2,year:2026,semester:1,city:'Warsaw','when':'25-26 Feb',pm:'Ewa',sales:'Iker',target:85000,stretch:115000,invoiced:58380,spex:29190,notes:''},
   {id:5,eventId:null,name:'Almacenamiento',edition:7,year:2026,semester:1,city:'Sevilla','when':'17-18 March',pm:'Ian',sales:'Tomás',target:700000,stretch:775000,invoiced:733108.69,spex:458810,notes:''},
   {id:6,eventId:null,name:'Storage Italia',edition:3,year:2026,semester:2,city:'Bolonia','when':'15-16 April',pm:'Elena',sales:'Tomás',target:440000,stretch:500000,invoiced:385426.24,spex:254875,notes:''},
   {id:7,eventId:null,name:'IA',edition:1,year:2026,semester:2,city:'Madrid','when':'2-3 June',pm:'Belén',sales:'Ian',target:90000,stretch:120000,invoiced:24036,spex:5000,notes:''},
   {id:8,eventId:null,name:'Invest Italia',edition:1,year:2026,semester:2,city:'Milan','when':'1 July',pm:'Carlos',sales:'Sheetal',target:60000,stretch:75000,invoiced:null,spex:15500,notes:''},
   {id:9,eventId:null,name:'Chile',edition:4,year:2026,semester:2,city:'Santiago','when':'29-30 July',pm:'Cristina',sales:'Tomás',target:120000,stretch:150000,invoiced:null,spex:6045,notes:''},
   {id:10,eventId:null,name:'DC Italia',edition:2,year:2026,semester:2,city:'Milan','when':'11-12 Nov',pm:'Elena',sales:'Sheetal',target:110000,stretch:130000,invoiced:null,spex:19275,notes:''},
   {id:11,eventId:null,name:'H2',edition:5,year:2026,semester:2,city:'Zaragoza','when':'18-19 Nov',pm:'Andrea',sales:'Sheetal',target:250000,stretch:290000,invoiced:null,spex:33671.5,notes:''},
  ];
  /* HR seed: the 16 hour-allocation projects (mirrors dispatch_hr.sql) */
  const projects=[
   {id:1,label:'00. Festivos',code:null,kind:'festivos',sort:0,active:true},
   {id:2,label:'01. Webinars',code:null,kind:null,sort:1,active:true},
   {id:3,label:'02. Hidrógeno 26',code:'70315',kind:null,sort:2,active:true},
   {id:4,label:'02. Chile 26',code:'70316',kind:null,sort:3,active:true},
   {id:5,label:'02. México 27',code:'70317',kind:null,sort:4,active:true},
   {id:6,label:'02. UsefulAI 26',code:'70318',kind:null,sort:5,active:true},
   {id:7,label:'02. Invest Italia 26',code:'70319',kind:null,sort:6,active:true},
   {id:8,label:'02. Datacenters Italia 26',code:'70320',kind:null,sort:7,active:true},
   {id:9,label:'02. Biometano 27',code:'70321',kind:null,sort:8,active:true},
   {id:10,label:'02. Almacenamiento 27',code:'70322',kind:null,sort:9,active:true},
   {id:11,label:'02. Storage Italia 27',code:'70323',kind:null,sort:10,active:true},
   {id:12,label:'03. RePower Horizon Europe',code:'70281',kind:null,sort:11,active:true},
   {id:13,label:'04. Vacaciones',code:null,kind:'vacaciones',sort:12,active:true},
   {id:14,label:'04. General',code:null,kind:null,sort:13,active:true},
   {id:15,label:'05. Desarrollo/Comercial',code:null,kind:null,sort:14,active:true},
   {id:16,label:'06. ATA Renewables',code:null,kind:null,sort:15,active:true},
  ];
  people.find(p=>p.name==='Jesús Jiménez').hr=true; // local demo mirrors the SQL seed
  return {v:STORE_VERSION,events,people,substages:subs,tasks,finance,weekly:[],projects,holidays:[],timesheets:[],timeclock:[],tcreports:[],nextEvent:7,nextPerson:19,nextSub:sid,nextTask:tid};
}

/* ---- Supabase config: if URL set => shared cloud database + login; else local browser storage ---- */
const SUPABASE_URL='https://dxgvbufsifgowwfggvmr.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3ZidWZzaWZnb3d3Zmdndm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODM1OTUsImV4cCI6MjA5ODA1OTU5NX0.EDMWWjMuDM0jS0d0SwzdhuW_ZnHP0T0kqwL3xc6Cw-w';
const USE_SUPABASE=!!SUPABASE_URL;
let sb=null,_saveTimer=null,_syncing=false,_pendingSync=false,_remoteTimer=null,_lastId=0;

/* per-entity tables; column whitelists = exactly what the app owns.
   Server-managed fields (updated_at/by, doneAt/By, deleted) are never pushed. */
const TABLES={events:'dc_events',people:'dc_people',substages:'dc_substages',tasks:'dc_tasks',finance:'dc_finance',weekly:'dc_weekly',projects:'dc_projects',holidays:'dc_holidays',timesheets:'dc_timesheets',timeclock:'dc_timeclock',tcreports:'dc_tcreports'};
const COLS={
  events:['id','name','topic','pm','lead','sales','city','country','date','days','prov','milestones','alerts','dur','team','markers'],
  people:['id','name','role','access','email','finance','hr','holidayDays','photo','phone'],
  substages:['id','eventId','lane','stage','name','order','week','span','type'],
  tasks:['id','eventId','lane','stage','substageId','title','assignee','deadline','status'],
  finance:['id','eventId','name','edition','year','semester','city','when','pm','sales','target','stretch','invoiced','spex','notes'],
  weekly:['id','eventCode','name','year','date','week','topicLeads','eventLeads','sponsorsN','sponsorsEur','spxAcc','delegatesN','ticketsEur','ticketsAcc','telesalesN','telesalesEur','grabacionesEur','siteVisitsEur','totalEur','soFarEur','target','stretch'],
  projects:['id','label','code','kind','sort','active'],
  holidays:['id','personId','dateFrom','dateTo','workDays','note','status','log','type','replaces'],
  timesheets:['id','personId','week','hours'],
  timeclock:['id','personId','day','time','kind','manual','amends','reason','note','reportId'], // hash/created_* are server-set
  tcreports:['id','personId','day','entryId','thread','status'],
};
let _finReady=false,_weeklyReady=false,_hrReady=false,_tcReady=false; // optional tables (tolerant: app works without them)
function pickRow(r,key){const o={};COLS[key].forEach(c=>{o[c]=(r[c]===undefined?null:r[c]);});return o;}
let _shadow=null; // last-synced picture, per table, id -> JSON string of picked row
function snapshot(){_shadow={};Object.keys(TABLES).forEach(k=>{_shadow[k]={};(DB.data[k]||[]).forEach(r=>{_shadow[k][r.id]=JSON.stringify(pickRow(r,k));});});}

const DB={
  data:null,
  async load(){
    if(USE_SUPABASE){
      const keys=['events','people','substages','tasks'];
      const res=await Promise.all(keys.map(k=>sb.from(TABLES[k]).select('*').eq('deleted',false).order('id')));
      const bad=res.find(r=>r.error);
      if(bad)throw new Error(bad.error.message+' — if the dc_* tables are missing, run dispatch_upgrade.sql in the Supabase SQL editor first.');
      this.data={};keys.forEach((k,i)=>{this.data[k]=res[i].data||[];});
      /* finance is tolerant: the app runs fine before dispatch_finance.sql exists */
      this.data.finance=[];_finReady=false;
      try{const fr=await sb.from('dc_finance').select('*').eq('deleted',false).order('id');
        if(fr.error)throw fr.error;this.data.finance=fr.data||[];_finReady=true;
      }catch(e){console.warn('finance module not ready:',e.message||e);}
      /* weekly pacing data (dashboard): tolerant + paged (Supabase caps selects at 1000 rows) */
      this.data.weekly=[];_weeklyReady=false;
      try{
        let from=0,page=1000;
        for(;;){const wr=await sb.from('dc_weekly').select('*').eq('deleted',false).order('id').range(from,from+page-1);
          if(wr.error)throw wr.error;
          this.data.weekly.push.apply(this.data.weekly,wr.data||[]);
          if(!wr.data||wr.data.length<page)break;from+=page;}
        _weeklyReady=true;
      }catch(e){this.data.weekly=[];console.warn('weekly module not ready:',e.message||e);}
      /* HR module (projects + holidays + timesheets): tolerant too */
      this.data.projects=[];this.data.holidays=[];this.data.timesheets=[];_hrReady=false;
      try{
        const [pr,ho,ts]=await Promise.all([
          sb.from('dc_projects').select('*').eq('deleted',false).order('sort'),
          sb.from('dc_holidays').select('*').eq('deleted',false).order('id'),
          sb.from('dc_timesheets').select('*').eq('deleted',false).order('id')]);
        if(pr.error)throw pr.error;if(ho.error)throw ho.error;if(ts.error)throw ts.error;
        this.data.projects=pr.data||[];this.data.holidays=ho.data||[];this.data.timesheets=ts.data||[];
        _hrReady=true;
      }catch(e){console.warn('HR module not ready:',e.message||e);}
      /* time clock (registro horario): append-only + no "deleted" column → own paged load */
      this.data.timeclock=[];this.data.tcreports=[];_tcReady=false;
      try{
        let from=0,page=1000;
        for(;;){const tr=await sb.from('dc_timeclock').select('*').order('id').range(from,from+page-1);
          if(tr.error)throw tr.error;
          this.data.timeclock.push.apply(this.data.timeclock,tr.data||[]);
          if(!tr.data||tr.data.length<page)break;from+=page;}
        const rp=await sb.from('dc_tcreports').select('*').eq('deleted',false).order('id');
        if(rp.error)throw rp.error;this.data.tcreports=rp.data||[];
        _tcReady=true;
      }catch(e){console.warn('time clock module not ready:',e.message||e);}
      if(!this.data.people.length){
        let em='';try{const {data}=await sb.auth.getUser();em=(data&&data.user&&data.user.email)||'';}catch(e){}
        throw new Error('No data is visible for your login'+(em?' ('+em+')':'')+'. Either your email is not in the personnel roster yet — ask Belén to add it (exactly as you log in) — or, if this is everyone, dispatch_upgrade.sql has not been run in Supabase.');
      }
      snapshot();
      subscribeRealtime();
      return this.data;
    }
    try{this.data=JSON.parse(localStorage.getItem('dispatchStore'));}catch(e){this.data=null;}
    if(!this.data||this.data.v!==STORE_VERSION){this.data=buildSeed();localStorage.setItem('dispatchStore',JSON.stringify(this.data));}
    return this.data;
  },
  save(){if(USE_SUPABASE){clearTimeout(_saveTimer);_saveTimer=setTimeout(()=>this.syncNow(),700);}else localStorage.setItem('dispatchStore',JSON.stringify(this.data));},
  /* diff vs the last-synced picture and write ONLY the touched rows:
     new rows -> insert, changed rows -> per-row update, vanished rows -> soft delete.
     Two people editing different rows no longer overwrite each other. */
  async syncNow(){
    if(!USE_SUPABASE||!sb)return;
    if(_syncing){_pendingSync=true;return;}
    _syncing=true;
    try{
      for(const k of Object.keys(TABLES)){
        if(k==='finance'&&!_finReady)continue; // finance table not created yet
        if(k==='weekly'&&!_weeklyReady)continue; // weekly table not created yet
        if((k==='projects'||k==='holidays'||k==='timesheets')&&!_hrReady)continue; // HR tables not created yet
        if((k==='timeclock'||k==='tcreports')&&!_tcReady)continue; // time clock tables not created yet
        const tbl=TABLES[k],seen={},inserts=[],updates=[],dels=[];
        (this.data[k]||[]).forEach(r=>{
          const p=pickRow(r,k),s=JSON.stringify(p);seen[r.id]=true;
          if(!(r.id in _shadow[k]))inserts.push(p);
          else if(_shadow[k][r.id]!==s)updates.push(p);
        });
        Object.keys(_shadow[k]).forEach(id=>{if(!seen[id])dels.push(id);});
        if(k==='timeclock'){updates.length=0;dels.length=0;} // registro horario: APPEND-ONLY, never update/delete
        if(inserts.length){const {error}=await sb.from(tbl).insert(inserts);if(error)throw error;}
        for(const p of updates){const {error}=await sb.from(tbl).update(p).eq('id',p.id);if(error)throw error;}
        if(dels.length){const {error}=await sb.from(tbl).update({deleted:true}).in('id',dels);if(error)throw error;}
      }
      snapshot();
    }catch(e){
      console.error('sync failed',e);
      alert('That change could not be saved ('+(e.message||e)+').\nUsually this means your access level does not allow it. The page will reload to stay in sync.');
      location.reload();return;
    }finally{_syncing=false;}
    if(_pendingSync){_pendingSync=false;this.syncNow();}
  },
  newId(){let id=Date.now()*10+Math.floor(Math.random()*10);if(id<=_lastId)id=_lastId+1;_lastId=id;return id;},
  async logout(){if(sb)await sb.auth.signOut();location.reload();},
  reset(){if(!USE_SUPABASE)localStorage.removeItem('dispatchStore');},
  get events(){return this.data.events;},get people(){return this.data.people;},
  get substages(){return this.data.substages;},get tasks(){return this.data.tasks;},
  event(id){return this.data.events.find(e=>e.id==id);},
  person(id){return this.data.people.find(p=>p.id==id);},
  personName(id){const p=this.person(id);return p?p.name:'—';},
  subsFor(eventId,lane,stage){return this.data.substages.filter(s=>s.eventId==eventId&&s.lane===lane&&s.stage===stage).sort((a,b)=>a.order-b.order);},
  tasksForSub(subId){return this.data.tasks.filter(t=>t.substageId==subId);},
  tasksFor(eventId){return this.data.tasks.filter(t=>t.eventId==eventId);},
  tasksOf(personId){return this.data.tasks.filter(t=>t.assignee==personId);},
  currentUser:null,
  get finance(){return this.data.finance||[];},
  financeFor(eventId){return (this.data.finance||[]).find(f=>f.eventId==eventId);},
  /* finance figures: whole roster reads; ONLY people with the finance tick write
     (Belén + Jesús). Admin tier alone no longer grants it — Carlos = events only. */
  canFinance(){return !!(this.currentUser&&this.currentUser.finance);},
  financeReady(){return !USE_SUPABASE||_finReady;},
  get weekly(){return this.data.weekly||[];},
  weeklyReady(){return !USE_SUPABASE||_weeklyReady;},
  get projects(){return this.data.projects||[];},
  get holidays(){return this.data.holidays||[];},
  get timesheets(){return this.data.timesheets||[];},
  hrReady(){return !USE_SUPABASE||_hrReady;},
  isHR(){return !!(this.currentUser&&this.currentUser.hr);},
  get timeclock(){return this.data.timeclock||[];},
  get tcreports(){return this.data.tcreports||[];},
  tcReady(){return !USE_SUPABASE||_tcReady;},
  /* HR admin = Belén + the HR tick (Jesús). Deliberately NOT every events admin. */
  isHRAdmin(){const u=this.currentUser;return !!(u&&(u.hr||(u.email||'').toLowerCase()==='belen.gallego@ata.email'));},
  isAdmin(){return !!(this.currentUser&&this.currentUser.access==='admin');},
  canManage(){return !!(this.currentUser&&(this.currentUser.access==='admin'||this.currentUser.access==='manager'));},
  /* who may CREATE / retire the hour-allocation project numbers: Belén, Carlos and
     Jesús (accounting). Mirrors dc_can_finance() in SQL = admin OR finance flag, so
     the client shows the panel to exactly whom the server-side RLS will let write. */
  canManageProjects(){const u=this.currentUser;return !!(u&&(u.access==='admin'||u.finance));},
  /* admins & managers set any status; members set the status of their OWN tasks
     (all of this is also enforced server-side by row-level security) */
  canEditStatus(t){if(this.canManage())return true;return !!(t&&this.currentUser&&t.assignee==this.currentUser.id);},
};
function personByEmail(email){if(!email)return null;email=(''+email).toLowerCase();return DB.people.find(p=>(p.email||'').toLowerCase()===email)||null;}

/* ---- realtime: colleagues' edits appear without reloading ---- */
function subscribeRealtime(){
  try{
    const ch=sb.channel('dc-sync');
    Object.keys(TABLES).forEach(k=>{
      if(k==='finance'&&!_finReady)return;
      if(k==='weekly')return; // bulk table, no realtime — dashboard reloads on demand
      if((k==='projects'||k==='holidays'||k==='timesheets')&&!_hrReady)return;
      if(k==='timesheets')return; // own-row edits, no realtime needed
      if(k==='timeclock')return; // append-only, reloaded on demand
      if(k==='tcreports'&&!_tcReady)return;
      ch.on('postgres_changes',{event:'*',schema:'public',table:TABLES[k]},payload=>applyRemote(k,payload.new));
    });
    ch.subscribe();
  }catch(e){console.warn('realtime unavailable',e);}
}
function applyRemote(key,row){
  if(!row||!DB.data||!_shadow)return;
  const arr=DB.data[key],i=arr.findIndex(r=>r.id==row.id);
  const p=pickRow(row,key),s=JSON.stringify(p);
  if(row.deleted){
    if(i>=0){arr.splice(i,1);delete _shadow[key][row.id];scheduleRemoteRender();}
    else delete _shadow[key][row.id];
    return;
  }
  if(i>=0){
    const localS=JSON.stringify(pickRow(arr[i],key));
    if(localS===s){_shadow[key][row.id]=s;return;}          // echo of our own write
    if(localS!==_shadow[key][row.id])return;                 // we have unsaved edits on this row — ours wins locally
    Object.assign(arr[i],p);                                 // in place: pages hold references to these objects
  }else{
    arr.push(p);
  }
  _shadow[key][row.id]=s;
  scheduleRemoteRender();
}
function scheduleRemoteRender(){clearTimeout(_remoteTimer);_remoteTimer=setTimeout(()=>window.dispatchEvent(new Event('dc-remote')),250);}

function injectSB(){return new Promise(res=>{if(window.supabase)return res();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=res;document.head.appendChild(s);});}
/* resilience: pages restored from the back/forward cache re-initialise cleanly */
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
async function boot(renderFn){
  if(USE_SUPABASE){
    await injectSB();
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    /* resilience: if the session dies (token expiry, sign-out in another tab), re-init to the login instead of a broken page */
    sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')location.reload();});
    const {data:{session}}=await sb.auth.getSession();
    if(!session)await showLogin();
  }
  try{await DB.load();}catch(e){document.body.innerHTML='<div style="font-family:Segoe UI,sans-serif;padding:40px;color:#A32D2D;max-width:560px">Could not load data: '+(e.message||e)
    +'<br><br><button onclick="location.reload()" style="font:inherit;padding:8px 16px;background:#FF4A00;color:#fff;border:none;border-radius:8px;cursor:pointer">Try again</button></div>';return;}
  if(USE_SUPABASE&&sb){
    try{const {data}=await sb.auth.getUser();const em=data&&data.user&&data.user.email;DB.currentUser=personByEmail(em);
      const w=document.getElementById('whoami');if(w&&em)w.textContent=em+(DB.currentUser?'':' (not in roster)')+' · ';
      if(em&&!DB.currentUser)rosterBanner(em);
    }catch(e){}
  }
  else{const p=new URLSearchParams(location.search).get('as')||localStorage.getItem('dispatchAs');DB.currentUser=p?DB.person(+p):(DB.people.find(x=>x.access==='admin')||null);} // local test: ?as=<personId> to simulate a user
  ensureSubDefaults();
  renderFn();
  try{decorateNav();}catch(e){} // alarm badges on the nav (holiday approvals / missing hours)
  try{if(_breakTimer)clearInterval(_breakTimer);breakReminderTick();_breakTimer=setInterval(breakReminderTick,60000);}catch(e){} // break nudge on any page
}
function rosterBanner(em){
  const b=document.createElement('div');
  b.style.cssText='background:#FFF3E8;border-bottom:1px solid #F3C49B;color:#8a4a12;font:13px Segoe UI,sans-serif;padding:8px 16px';
  b.textContent='Your login ('+em+') is not in the personnel roster yet, so the board is read-only for you — ask Belén to add you on the Personnel page.';
  document.body.prepend(b);
}
function showLogin(){return new Promise(resolve=>{
  const ov=document.createElement('div');ov.id='loginov';
  ov.style.cssText='position:fixed;inset:0;background:#f3f2ee;z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,system-ui,sans-serif';
  ov.innerHTML='<div style="background:#fff;border:1px solid #e3e1da;border-radius:14px;padding:26px 28px;width:330px;box-shadow:0 10px 40px rgba(0,0,0,.08)">'
    +'<div style="font-size:20px;font-weight:700;color:#2B2B2B">RENMAD <span style="color:#FF4A00">Dispatch Center</span></div>'
    +'<div style="font-size:12px;color:#7c7c78;margin:2px 0 6px;font-style:italic">where the magic gets orchestrated</div>'
    +'<div style="font-size:11px;color:#a9a79f;margin:0 0 14px">Accounts are created by Bel&eacute;n &mdash; ask her if you need one or forgot your password.</div>'
    +'<input id="lg_e" type="email" placeholder="email" autocomplete="username" style="width:100%;padding:9px 10px;border:1px solid #e3e1da;border-radius:8px;margin-bottom:8px;font:inherit;box-sizing:border-box">'
    +'<input id="lg_p" type="password" placeholder="password" autocomplete="current-password" style="width:100%;padding:9px 10px;border:1px solid #e3e1da;border-radius:8px;margin-bottom:10px;font:inherit;box-sizing:border-box">'
    +'<button id="lg_b" style="width:100%;padding:10px;background:#FF4A00;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font:inherit">Log in</button>'
    +'<div id="lg_err" style="color:#A32D2D;font-size:12px;margin-top:8px;min-height:14px"></div></div>';
  document.body.appendChild(ov);
  const go=async()=>{const {error}=await sb.auth.signInWithPassword({email:document.getElementById('lg_e').value.trim(),password:document.getElementById('lg_p').value});if(error){document.getElementById('lg_err').textContent=error.message;}else{ov.remove();resolve();}};
  document.getElementById('lg_b').onclick=go;
  document.getElementById('lg_p').addEventListener('keydown',e=>{if(e.key==='Enter')go();});
  document.getElementById('lg_e').focus();
});}

/* ---- shared UI ---- */
/* ===== Team tools registry (shared by tools.html grid + tool.html embed shell) =====
   id     = slug used in tool.html?id=<id>
   url    = external app; '' = not deployed yet (shows "coming soon", not embeddable)
   embed  = false when the app refuses to run inside a frame → always opens in a new tab
   mgrOnly= only managers & up (admins + managers) may see / open it */
const DISPATCH_TOOLS=[
  {id:'agenda',   name:'Agenda Builder',    desc:'Bilingual event agendas with branded Word & PDF export.', url:'https://bg-ata.github.io/RENMAD-generator/agenda_app/', accent:'#3E8C28', ini:'AB', dcAuth:true},
  {id:'proposal', name:'Proposal Builder',  desc:'Sponsorship decks per event, salesperson, colour and client logo.', url:'https://proposal-builder-37epkukjuzdm86witcne7r.streamlit.app/', accent:'#E84830', ini:'PB', dcAuth:true},
  {id:'images',   name:'Image Generator',   desc:'Webinar & event images, logo walls and title slides.', url:'https://renmad-generator-xpaky2vg6fctshxczlhy3b.streamlit.app/', accent:'#4C3079', ini:'IG', dcAuth:true},
  {id:'webinar',  name:'Webinar Reports',   desc:'Two CSVs + stats in, branded PPTX report out (Reports tab).', url:'https://renmad-generator-xpaky2vg6fctshxczlhy3b.streamlit.app/', accent:'#29ACE3', ini:'WR', dcAuth:true},
  {id:'dashboard',name:'Proposals Dashboard',desc:'Money on the table — overview, trends, salespeople, clients.', url:'https://proposal-dashboard.streamlit.app/', accent:'#2B2B2B', ini:'PD', dcAuth:true, mgrOnly:true},
  {id:'bessboss', name:'BESS BOSS',         desc:'The renewables minigrid game — learn the grid, top the leaderboard.', url:'https://bg-ata.github.io/GridShero/', accent:'#FF4A00', ini:'BB', game:true},
];
function toolById(id){return DISPATCH_TOOLS.find(t=>t.id===id)||null;}
/* the URL to load inside the iframe: Streamlit apps need ?embed=true to drop their chrome.
   Tools flagged dcAuth get the current Supabase access token appended as dc_token —
   the app validates it server-side, so it only opens for logged-in dispatch users. */
function toolEmbedUrl(t,token){
  if(!t||!t.url)return '';
  let u=t.url;
  const add=q=>{u+=(u.includes('?')?'&':'?')+q;};
  if(/streamlit\.app/i.test(u))add('embed=true');
  if(t.dcAuth&&token)add('dc_token='+encodeURIComponent(token));
  return u;
}
/* current Supabase access token (for dcAuth tool embeds); '' in local mode */
async function dcToken(){
  if(!USE_SUPABASE||!sb)return '';
  try{const {data:{session}}=await sb.auth.getSession();return (session&&session.access_token)||'';}
  catch(e){return '';}
}
function navBar(active){
  return '<div class="nav"><a href="home.html" id="nav-home" style="white-space:nowrap" class="'+(active==='home'?'on':'')+'">🧭 Overview</a>'+
         '<a href="gantt.html" style="white-space:nowrap" class="'+(active==='overview'?'on':'')+'">📅 Events</a>'+
         '<a href="people.html" style="white-space:nowrap" class="'+(active==='people'?'on':'')+'">👥 Team</a>'+
         '<a href="dashboard.html" style="white-space:nowrap" class="'+(active==='dashboard'?'on':'')+'">💶 Money</a>'+
         '<a href="impact.html" style="white-space:nowrap" class="'+(active==='impact'?'on':'')+'">📣 Impact</a>'+
         '<a href="hr.html" id="nav-hr" style="white-space:nowrap" class="'+(active==='hr'?'on':'')+'">🌴 HR</a>'+
         '<a href="tools.html" style="white-space:nowrap" class="'+(active==='tools'?'on':'')+'">🧰 Tools</a>'+
         '<span class="brandlet">RENMAD <b>Dispatch Center</b>'+
         (USE_SUPABASE?' &nbsp;·&nbsp; <a href="#" onclick="DB.logout();return false" style="color:#7c7c78;text-decoration:none">log out</a>':'')+'</span></div>';
}
function changePasswordUI(){
  if(!sb){alert('Login required.');return;}
  const ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,system-ui,sans-serif';
  ov.innerHTML='<div style="background:#fff;border-radius:14px;padding:24px 26px;width:330px">'
   +'<div style="font-size:16px;font-weight:700;margin-bottom:3px">Change your password</div>'
   +'<div style="font-size:12px;color:#7c7c78;margin-bottom:14px" id="cp_who"></div>'
   +'<input id="cp1" type="password" placeholder="new password (min 6)" style="width:100%;padding:9px 10px;border:1px solid #e3e1da;border-radius:8px;margin-bottom:8px;font:inherit;box-sizing:border-box">'
   +'<input id="cp2" type="password" placeholder="repeat new password" style="width:100%;padding:9px 10px;border:1px solid #e3e1da;border-radius:8px;margin-bottom:10px;font:inherit;box-sizing:border-box">'
   +'<div style="display:flex;gap:8px"><button id="cp_s" style="flex:1;padding:9px;background:#FF4A00;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font:inherit">Save</button>'
   +'<button id="cp_x" style="padding:9px 14px;border:1px solid #e3e1da;background:#fff;border-radius:8px;cursor:pointer;font:inherit">Cancel</button></div>'
   +'<div id="cp_m" style="font-size:12px;margin-top:8px;min-height:14px"></div></div>';
  document.body.appendChild(ov);
  sb.auth.getUser().then(({data})=>{const w=document.getElementById('cp_who');if(w&&data&&data.user)w.textContent=data.user.email;});
  document.getElementById('cp_x').onclick=()=>ov.remove();
  document.getElementById('cp_s').onclick=async()=>{
    const a=document.getElementById('cp1').value,b=document.getElementById('cp2').value,m=document.getElementById('cp_m');
    if(a.length<6){m.style.color='#A32D2D';m.textContent='At least 6 characters.';return;}
    if(a!==b){m.style.color='#A32D2D';m.textContent='Passwords do not match.';return;}
    const {error}=await sb.auth.updateUser({password:a});
    if(error){m.style.color='#A32D2D';m.textContent=error.message;}else{m.style.color='#1D9E75';m.textContent='Password updated.';setTimeout(()=>ov.remove(),1200);}
  };
}
function loadXLSX(cb){if(window.XLSX)return cb();const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=cb;document.head.appendChild(s);}
/* shrink an uploaded image to a small square JPEG data-URL (keeps dc_people rows tiny) */
function resizeImage(file,cb,size){size=size||160;const rd=new FileReader();
  rd.onload=e=>{const img=new Image();img.onload=()=>{
    const s=Math.min(img.width,img.height),cv=document.createElement('canvas');cv.width=cv.height=size;
    const cx=cv.getContext('2d');cx.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);
    cb(cv.toDataURL('image/jpeg',0.82));};img.onerror=()=>cb(null);img.src=e.target.result;};
  rd.onerror=()=>cb(null);rd.readAsDataURL(file);}
/* avatar HTML: the photo, or a coloured initials circle */
function avatarHtml(p,px){px=px||34;const init=(p.name||'?').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const pal=['#FF4A00','#185FA5','#3E8C28','#4C3079','#29ACE3','#C77800','#D32230','#0E7C6B'];
  const col=pal[(p.id||0)%pal.length];
  if(p.photo)return '<span style="display:inline-block;width:'+px+'px;height:'+px+'px;border-radius:50%;background-image:url('+p.photo+');background-size:cover;background-position:center;vertical-align:middle;flex:0 0 auto"></span>';
  return '<span style="display:inline-flex;width:'+px+'px;height:'+px+'px;border-radius:50%;background:'+col+';color:#fff;font-weight:700;font-size:'+Math.round(px*0.4)+'px;align-items:center;justify-content:center;vertical-align:middle;flex:0 0 auto">'+init+'</span>';}
function exportXLSX(filename,sheets){loadXLSX(()=>{const wb=XLSX.utils.book_new();sheets.forEach(s=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s.rows),s.name.slice(0,31)));XLSX.writeFile(wb,filename);});}
