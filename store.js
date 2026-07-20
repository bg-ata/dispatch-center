/* RENMAD Dispatch Center — shared data store.
   Cloud mode: per-entity tables in Supabase (dc_events / dc_people / dc_substages /
   dc_tasks) with row-level security, audit trail, soft deletes and realtime sync.
   Local mode (no Supabase URL): browser localStorage with seeded demo data. */
const STORE_VERSION = 21;
/* the team's home is dispatch.renmad.com — anyone landing on the old GitHub Pages
   address is bounced there, keeping the exact page + parameters (?id=…). The one
   exception: unsent clock punches queued on this device stay on the OLD origin's
   storage, so we let those flush first and redirect on the next visit instead. */
try{
  if(location.hostname==='bg-ata.github.io'){
    let pend=[];try{pend=JSON.parse(localStorage.getItem('dcPendingPunches'))||[];}catch(e){}
    if(!pend.length){
      const p=location.pathname.replace(/^\/dispatch-center\/?/,'/');
      location.replace('https://dispatch.renmad.com'+(p==='/'?'/':p)+location.search+location.hash);
    }
  }
}catch(e){}
/* escape any user-entered text before it goes into innerHTML — a task title,
   holiday note, report message etc. containing < > & " ' must render as text,
   never as markup (stops a "<img onerror=…>" in a title running for everyone). */
function esc(s){return (s==null?'':''+s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* ---- shared head bits: PWA manifest/icons + the mobile stylesheet ----
   Injected from here so every page gets them without touching 12 <head>s.
   Desktop is untouched: everything phone-specific lives behind @media(max-width:680px).
   No service worker ON PURPOSE — the ?v= cache-busting must never be bypassed. */
(function(){
  try{
    const h=document.head;
    const l=document.createElement('link');l.rel='manifest';l.href='manifest.webmanifest';h.appendChild(l);
    const tc=document.createElement('meta');tc.name='theme-color';tc.content='#FF4A00';h.appendChild(tc);
    const ai=document.createElement('link');ai.rel='apple-touch-icon';ai.href='icons/icon-180.png?v=2';h.appendChild(ai);
    const st=document.createElement('style');st.id='dcSharedCss';st.textContent=
      '.navburger{display:none}'+
      '.navlinks{display:contents}'+
      '#dcNav{flex-wrap:wrap}'+
      '@media(max-width:680px){'+
        'body{overflow-x:hidden}'+
        '.app{padding:10px 10px 96px !important}'+
        '.nav{position:relative}'+
        '.navburger{display:block;border:1px solid #e3e1da;background:#fff;border-radius:8px;font:600 14px "Segoe UI",system-ui,sans-serif;padding:9px 14px;cursor:pointer;color:#2B2B2B}'+
        '.navlinks{display:none;position:absolute;top:44px;left:0;right:0;z-index:80;background:#fff;border:1px solid #e3e1da;border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.2);padding:6px;flex-direction:column}'+
        '.nav.open .navlinks{display:flex}'+
        '.navlinks a{display:block;padding:13px 14px !important;font-size:15px !important;border-bottom:1px solid #f2f0ea;border-radius:8px}'+
        '.navlinks a:last-child{border-bottom:none}'+
        '.nav .brandlet{font-size:11px !important}'+
        '.btn{min-height:42px}'+
        'input,select,textarea{font-size:16px !important}'+ /* stops the iPhone zoom-on-focus */
        '.panel{overflow-x:auto}'+ /* wide admin tables scroll inside their own box */
      '}'+
      /* ---- mini calendar: what days is this person actually asking for? ---- */
      '.mcw{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0 2px}'+
      '.mc{font:11px "Segoe UI",system-ui,sans-serif}'+
      '.mc .mcm{font-weight:700;color:#2B2B2B;margin-bottom:3px;font-size:11px}'+
      '.mc table{border-collapse:separate;border-spacing:2px}'+
      '.mc th{font-size:9.5px;color:#9AA0A8;font-weight:600;width:20px;padding:0}'+
      '.mc td{width:20px;height:19px;text-align:center;border-radius:4px;color:#5b5b5b;background:#f6f5f1}'+
      '.mc td.o{background:#fff;color:#c8c6c0}'+                        /* other month */
      '.mc td.we{background:#efeee9;color:#b3b0a8}'+                    /* weekend */
      '.mc td.bh{background:#e6e4dd;color:#8a8780;font-weight:700}'+    /* bank holiday */
      '.mc td.req{background:#FF4A00;color:#fff;font-weight:800}'+      /* asked for */
      '.mc td.oth{background:#ffd9c9;color:#8a3a12;font-weight:700}'+   /* their other holidays */
      '.mc td.gap{background:#fff;color:#2B2B2B;font-weight:800;box-shadow:inset 0 0 0 1.5px #E84830}'+ /* stranded office day */
      '.mclg{font-size:10.5px;color:#9AA0A8;display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}'+
      '.mclg i{font-style:normal;display:inline-flex;align-items:center;gap:4px}'+
      '.mclg b{display:inline-block;width:9px;height:9px;border-radius:2px}';
    h.appendChild(st);
  }catch(e){}
})();
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
/* Projects split: kind 'renmad' (default, the events machine: milestones + discount
   weeks + all 4 lanes) vs 'external' (one-off/various jobs: only the timelines the
   job needs — ev.lanes = subset of LANES; null/empty = all). */
function evKind(ev){return ev&&ev.kind==='external'?'external':'renmad';}
function evLanes(ev){const ls=ev&&ev.lanes;return (Array.isArray(ls)&&ls.length)?LANES.filter(l=>ls.indexOf(l)>=0):LANES.slice();}
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
function preExtent(ev){let m=0;evLanes(ev).forEach(l=>m=Math.max(m,laneTotalPre(ev,l)));
  if(evKind(ev)==='external')return Math.max(m,4); // external: no milestone/discount machinery — runway = its own lanes
  return Math.max(m,ev.milestones.goNoGo,ev.milestones.launch,ev.alerts.LD.off,ev.alerts.SE.off,ev.alerts.EB.off,ev.alerts.LC.off);}
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
    evLanes(ev).forEach(lane=>{const bars=layLane(ev,lane,evIdx);const subs=DB.substages.filter(s=>s.eventId==ev.id&&s.lane===lane);
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
/* ---- human dates ----
   People read "Thursday 30 Jul 26", not "2026-07-30". Everything a human decides on
   (holiday requests, approvals, balances) goes through these; ISO stays the storage format. */
const DOW=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function dowOf(d){return DOW[(d.getDay()+6)%7];}            // Monday-first
function yy(d){return String(d.getFullYear()).slice(2);}
function fmtHuman(iso){if(!iso)return '—';const d=ymd(iso);return dowOf(d)+' '+d.getDate()+' '+MON[d.getMonth()]+' '+yy(d);}
function fmtHumanShort(iso){if(!iso)return '—';const d=ymd(iso);return dowOf(d).slice(0,3)+' '+d.getDate()+' '+MON[d.getMonth()]+' '+yy(d);}
/* a range in the fewest words that stay unambiguous:
   one day      -> "Thursday 30 Jul 26"
   same month   -> "Mon 13 – Fri 24 Jul 26"
   spans months -> "Mon 28 Dec 26 – Fri 8 Jan 27"   (year on both — it's the Xmas spill) */
function fmtHumanRange(from,to){
  if(!from)return '—';
  if(!to||from===to)return fmtHuman(from);
  const a=ymd(from),b=ymd(to);
  if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth())
    return dowOf(a).slice(0,3)+' '+a.getDate()+' – '+dowOf(b).slice(0,3)+' '+b.getDate()+' '+MON[b.getMonth()]+' '+yy(b);
  return fmtHumanShort(from)+' – '+fmtHumanShort(to);
}

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
/* Days the COMPANY gives everybody on top of the official calendar. They behave exactly
   like a bank holiday: they cost nobody a holiday day, nothing is expected on the clock,
   and the allocation auto-fills them as Festivos. Christmas Eve and New Year's Eve are
   given every year (skipped automatically when they fall at a weekend). */
const COMPANY_DAYS=[['12-24','Nochebuena (día de empresa)'],['12-31','Nochevieja (día de empresa)']];
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
  /* company days: no traslado — if it lands on a weekend it is simply already free */
  COMPANY_DAYS.forEach(([md,n])=>{
    const d=new Date(y,+md.slice(0,2)-1,+md.slice(3));
    if(d.getDay()===0||d.getDay()===6)return;
    if(!out[toISO(d)])out[toISO(d)]=n;   // never mask a real bank holiday
  });
  Object.assign(out,MAD_OVR[y]||{});
  return _madCache[y]=out;
}
/* is this one of the company's own gift days (vs the official calendar)? */
function isCompanyDay(iso){
  const md=(iso||'').slice(5);
  return COMPANY_DAYS.some(([m])=>m===md)&&!!madHol(iso);
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
const TYPE_LABEL={vacation:'Holiday',remote:'Office day',sick:'Sick leave',maternity:'Maternity leave',paternity:'Paternity leave',adjust:'Balance adjustment'};
const TYPE_EMOJI={vacation:'🌴',remote:'🏢',sick:'🤒',maternity:'👶',paternity:'👶',adjust:'±'};
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
/* ---- "at an event" (away from the office) ---- */
/* is the person at an event on this date? → the away-record, or null */
function atEventNow(personId,onISO){
  const day=onISO||toISO(new Date());
  return DB.eventaway.find(e=>e.personId==personId&&(e.dateFrom||'')<=day&&(e.dateTo||'')>=day)||null;
}
/* one combined "where is this person right now" for the Team status + attendance board.
   priority: leave/holiday > at an event > clock state. Returns
   {key,label,emoji,color,detail}. keys: leave|holiday|remote|event|working|pause|out|off|unknown */
function personStatusNow(p){
  const id=p.id, today=toISO(new Date());
  const lv=currentLeave(id);
  if(lv){const isHol=lv.type==='vacation';
    return {key:isHol?'holiday':'leave',label:isHol?'Holiday':lv.label,emoji:lv.emoji,
            color:isHol?'#3E8C28':'#C77800',detail:'until '+fmtHumanShort(lv.until),private:!isHol};}
  const rem=DB.holidays.find(x=>x.personId==id&&x.status==='approved'&&x.type==='remote'&&x.dateFrom<=today&&x.dateTo>=today);
  const ev=atEventNow(id);
  /* punches are only visible to the person themselves and HR-admins (RLS) —
     don't infer "not clocked in" for others when we simply can't see their clock */
  const canSeeClock=DB.isHRAdmin()||!!(DB.currentUser&&DB.currentUser.id===id);
  const info=(DB.tcReady()&&canSeeClock)?tcDayInfo(id,today):null;
  const clockBit=info?(info.open?'clocked in':(info.entries.length?'on a break':'not clocked in')):'';
  if(ev)return {key:'event',label:'At an event',emoji:'📣',color:'#185FA5',detail:(ev.title||'event')+(clockBit?' · '+clockBit:'')};
  if(rem)return {key:'remote',label:'Remote',emoji:'🏠',color:'#29ACE3',detail:clockBit};
  if(info){
    if(info.open)return {key:'working',label:'Working',emoji:'🟢',color:'#3E8C28',detail:''};
    if(info.entries.length){
      /* clocked out: if they've already done their required hours for the day (or the
         day had no requirement), they're DONE — not "on a break". A break is only a
         clock-out while still short of the day's hours. */
      const exp=tcExpectedDay(id,today), workedH=(info.total||0)/60;
      if(exp<=0||workedH>=exp)return {key:'done',label:'Done for the day',emoji:'✅',color:'#5A8C4E',detail:''};
      return {key:'pause',label:'On a break',emoji:'⏸️',color:'#C77800',detail:''};
    }
    if(tcExpectedDay(id,today)>0)return {key:'out',label:'Not clocked in',emoji:'⚪',color:'#9AA0A8',detail:''};
    return {key:'off',label:'Off today',emoji:'—',color:'#9AA0A8',detail:''};
  }
  return {key:'unknown',label:'Available',emoji:'●',color:'#3E8C28',detail:''};
}
/* ---- the holiday YEAR ----
   The policy: 23 days a year, and whatever is left may spill over into the next year
   until 28 February. So days enjoyed on 2–8 Jan are "last year's days" — the count they
   belong to is NOT the calendar year they fall in. Every balance question therefore asks
   holYearOf(row), never dateFrom.slice(0,4).
     • Jan/Feb  -> charged to the PREVIOUS year (the spill window)
     • Mar–Dec  -> charged to their own year
     • chargeYear on the row overrides both (HR can reassign: someone genuinely spending
       next year's allowance in January, or days borrowed in advance)
   'adjust' rows are the exception: HR stamps them on 1 Jan of the year they apply to, so
   they always mean that calendar year. */
/* The first holiday year the system tracks. Records start 2026-01-01, so the Jan/Feb
   spill rule must not reach back past it: without this floor, the team's real Jan/Feb
   2026 days (45 of them) fell into a "2025" year nobody can see and every 2026 balance
   inflated — Cintia 0→5, Carlos 4→9… (Belén caught it live, 15 Jul 2026). In the first
   tracked year the allowance simply covers Jan 2026 through Feb 2027. */
const HOL_YEAR_MIN=2026;
const HOL_SPILL_END_MD='02-28';   // last day of the spill window
const HOL_DEADLINE_MD='02-28';    // (kept: carry-over must be enjoyed before end of February)
function holYearOf(h){
  if(!h)return null;
  if(h.chargeYear!=null&&h.chargeYear!=='')return +h.chargeYear;
  const iso=h.dateFrom||'';if(iso.length<7)return null;
  const y=+iso.slice(0,4),m=+iso.slice(5,7);
  if(h.type==='adjust')return y;                 // stamped on 1 Jan of the year it belongs to
  return m<=2?Math.max(y-1,HOL_YEAR_MIN):y;      // Jan & Feb belong to last year's count (never before the first tracked year)
}
/* the charge year a NEW request would default to (shown in the form so nobody is surprised) */
function holYearOfDate(iso){const m=+(iso||'').slice(5,7);const y=+(iso||'').slice(0,4);return m<=2?Math.max(y-1,HOL_YEAR_MIN):y;}
function inSpillWindow(iso){const m=+(iso||'').slice(5,7);return m<=2;}
/* A range that starts inside the spill window (Jan/Feb) and ends outside it straddles two
   holiday years — e.g. 27 Feb to 2 Mar is one day of last year's and one of this year's.
   The whole row is charged by its start date, which is right far more often than not, but
   it is a judgement call, so say so rather than quietly deciding. HR can split the row or
   set chargeYear. Only Feb->Mar matters: a Dec->Jan range is entirely one year's anyway. */
function holStraddles(h){
  if(!h||h.type==='adjust'||!h.dateFrom||!h.dateTo)return false;
  if(h.chargeYear!=null&&h.chargeYear!=='')return false;   // HR has already ruled on it
  return inSpillWindow(h.dateFrom)&&!inSpillWindow(h.dateTo)
    &&h.dateFrom.slice(0,4)===h.dateTo.slice(0,4);
}
/* Pro-rated holiday allowance from a start date (Belén's ask 15 Jul: "depending when
   somebody starts working I need to calculate how many days they are due — automatically,
   and let me correct it"). Spanish practice: the annual allowance accrues by calendar
   days employed in the year. This produces a SUGGESTION shown in the Personnel modal —
   the stored, editable holidayDays remains the single source of truth for all balances. */
const HOL_BASE_ALLOWANCE=23;
function holSuggestedAllowance(startDate,year){
  const y=+(year||new Date().getFullYear());
  const from=new Date(y,0,1),to=new Date(y,11,31);
  const s=startDate?ymd(startDate):null;
  if(s&&s>to)return 0;                                 // starts after this year ends
  const eff=(s&&s>from)?s:from;
  const days=Math.round((to-eff)/86400000)+1;
  const total=Math.round((to-from)/86400000)+1;
  return Math.round(HOL_BASE_ALLOWANCE*days/total*2)/2; // half-day precision
}
/* Belén is outside the allowance policy — her days are recorded and shown on the calendar,
   but no allowance, carry-over or 28-Feb maths applies to her. */
function holExempt(p){return isBelenP(p);}
function holAllowance(p){return (p&&p.holidayDays!=null)?+p.holidayDays:23;}
function holRowsFor(personId,year,type){
  return DB.holidays.filter(h=>h.personId==personId&&h.status==='approved'&&
    ((type==='adjust')?h.type==='adjust':(h.type||'vacation')==='vacation')&&
    holYearOf(h)===year);
}
function holUsed(personId,year){return holRowsFor(personId,year).reduce((a,h)=>a+(+h.workDays||0),0);}
function holAdjust(personId,year){return holRowsFor(personId,year,'adjust').reduce((a,h)=>a+(+h.workDays||0),0);}
function holRemaining(personId,year){const p=DB.person(personId);return holAllowance(p)+holAdjust(personId,year)-holUsed(personId,year);}
/* The Maria lesson (15 Jul 2026): a balance the reader cannot re-derive gets disputed.
   So split the count into days already TAKEN and days BOOKED ahead (approved but still
   in the future — including next-January bookings, which charge back to this year), and
   print the whole sum wherever a balance appears. Nobody should ever have to ask where
   a number came from again. */
function holBreakdown(personId,year){
  const today=toISO(new Date());let taken=0,booked=0;
  holRowsFor(personId,year).forEach(h=>{if((h.dateFrom||'')>today)booked+=(+h.workDays||0);else taken+=(+h.workDays||0);});
  const p=DB.person(personId),allow=holAllowance(p),adj=holAdjust(personId,year);
  return {allow:allow,adj:adj,taken:taken,booked:booked,rem:allow+adj-taken-booked};
}
function holFormulaHtml(personId,year){
  const b=holBreakdown(personId,year);
  return b.allow+(b.adj?' '+(b.adj>0?'+':'−')+Math.abs(b.adj)+' carry':'')
    +(b.taken?' − '+b.taken+' taken':'')
    +(b.booked?' − '+b.booked+' booked':'')
    +' = <b>'+b.rem+'</b>';
}
function holDeadlineText(year){return 'enjoy them before 28 Feb '+(year+1);}
/* ---- mini calendar ----
   A range of ISO dates tells you nothing about what it LOOKS like. This draws the month(s)
   a request touches so an approver can see the shape at a glance: the days asked for, the
   person's other time off around them, bank holidays, and — the point of the exercise —
   any lonely office days stranded between two holiday blocks.
   Returns HTML; needs no wiring. */
function holMiniCal(dateFrom,dateTo,opts){
  opts=opts||{};
  const personId=opts.personId,exclId=opts.excludeId;
  if(!dateFrom||!dateTo)return '';
  /* the person's OTHER time off (approved or still in the chain), so gaps become visible */
  const others=personId==null?[]:DB.holidays.filter(h=>h.personId==personId&&h.id!=exclId&&
    (h.type||'vacation')!=='adjust'&&h.status!=='denied'&&h.status!=='cancelled');
  const isOther=iso=>others.some(h=>iso>=h.dateFrom&&iso<=h.dateTo);
  const isReq=iso=>iso>=dateFrom&&iso<=dateTo;
  const isOff=d=>{const iso=toISO(d);return d.getDay()===0||d.getDay()===6||!!madHol(iso);};
  /* A working day is "stranded" when it belongs to a SHORT run of office days walled in by
     time off on both sides — the "back for 3 days, then off again" shape. Measure the whole
     run, not each side separately: a Wednesday with holidays five days either way is just a
     normal week, not a stranded day. */
  const STRAND_MAX=3;             // a run this short between two blocks is the thing to flag
  const strandCache={};
  const stranded=iso=>{
    if(iso in strandCache)return strandCache[iso];
    const d=ymd(iso);
    if(isOff(d)||isReq(iso)||isOther(iso))return strandCache[iso]=false;
    const run=[iso];let x,walled=true;
    /* walk back to the start of this run of office days */
    for(x=addDays(d,-1);;x=addDays(x,-1)){const i=toISO(x);
      if(isOff(x))continue;                       // weekends/bank holidays don't break a run
      if(isReq(i)||isOther(i))break;              // hit time off -> this end is walled
      run.push(i);
      if(run.length>STRAND_MAX){walled=false;break;}
    }
    if(walled)for(x=addDays(d,1);;x=addDays(x,1)){const i=toISO(x);
      if(isOff(x))continue;
      if(isReq(i)||isOther(i))break;
      run.push(i);
      if(run.length>STRAND_MAX){walled=false;break;}
    }
    const out=walled&&run.length<=STRAND_MAX;
    run.forEach(i=>{if(out)strandCache[i]=true;});  // whole run shares the verdict
    return strandCache[iso]=out;
  };
  /* which months to draw: every month the request touches (capped at 3) */
  const months=[];
  for(let d=new Date(ymd(dateFrom).getFullYear(),ymd(dateFrom).getMonth(),1);
      toISO(d)<=dateTo&&months.length<3;d=new Date(d.getFullYear(),d.getMonth()+1,1))
    months.push(new Date(d));
  if(!months.length)months.push(new Date(ymd(dateFrom).getFullYear(),ymd(dateFrom).getMonth(),1));
  let anyGap=false,anyOther=false;
  const grids=months.map(m0=>{
    const y=m0.getFullYear(),mo=m0.getMonth();
    let html='<div class="mc"><div class="mcm">'+MON[mo]+' '+y+'</div><table><tr>'+
      ['M','T','W','T','F','S','S'].map(x=>'<th>'+x+'</th>').join('')+'</tr>';
    let d=monday(new Date(y,mo,1));
    for(let w=0;w<6;w++){
      html+='<tr>';
      for(let i=0;i<7;i++,d=addDays(d,1)){
        const iso=toISO(d),num=d.getDate();
        if(d.getMonth()!==mo){html+='<td class="o">'+num+'</td>';continue;}
        const bh=madHol(iso),we=d.getDay()===0||d.getDay()===6;
        let cls='',tip='';
        if(isReq(iso)&&!we&&!bh){cls='req';tip='Asked for';}
        else if(isOther(iso)&&!we&&!bh){cls='oth';tip='Already off';anyOther=true;}
        else if(bh){cls='bh';tip=bh;}
        else if(we){cls='we';}
        else if(stranded(iso)){cls='gap';tip='In the office — on their own between two holidays';anyGap=true;}
        html+='<td class="'+cls+'"'+(tip?' title="'+esc(tip)+'"':'')+'>'+num+'</td>';
      }
      html+='</tr>';
      if(d.getMonth()!==mo&&w>=3)break;
    }
    return html+'</table></div>';
  });
  const lg=['<i><b style="background:#FF4A00"></b>asked for</i>'];
  if(anyOther)lg.push('<i><b style="background:#ffd9c9"></b>already off</i>');
  if(anyGap)lg.push('<i><b style="background:#fff;box-shadow:inset 0 0 0 1.5px #E84830"></b>alone in the office</i>');
  lg.push('<i><b style="background:#e6e4dd"></b>bank holiday</i>');
  return '<div class="mcw">'+grids.join('')+'</div><div class="mclg">'+lg.join('')+'</div>';
}
/* every vacation row charged to `year`, in date order — the per-person breakdown */
function holLedger(personId,year){
  return DB.holidays.filter(h=>h.personId==personId&&h.type!=='adjust'&&
      (h.type||'vacation')==='vacation'&&holYearOf(h)===year)
    .sort((a,b)=>(a.dateFrom||'').localeCompare(b.dateFrom||''));
}
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
  if(isTeamAccount(DB.person(personId)))return true; // external HR team: no allocation duty (Belén, 20 Jul)
  const w=weekWorkInfo(weekISO,personId);
  if(w.toAllocate<=0)return true; // all-holiday/vacation week: nothing to fill
  return Math.abs(tsManualSum(tsFor(personId,weekISO))-w.toAllocate)<0.01;
}
function missingWeeks(personId){
  if(isTeamAccount(DB.person(personId)))return []; // external HR team: never nagged for hours
  const out=[],cur=toISO(monday(new Date()));
  for(let m=ymd(HR_START);toISO(m)<cur;m=addDays(m,7)){
    const iso=toISO(m);
    if(!tsComplete(personId,iso))out.push(iso);}
  return out;
}
/* holiday approval chain: team manager → Belén → HR */
function isBelenP(p){return !!p&&(p.email||'').toLowerCase()==='belen.gallego@ata.email';}
/* the "Recursos Humanos" login is a TEAM inbox, not a person — no holiday allowance,
   and it never appears in the holiday calendar / balances. */
function isTeamAccount(p){return !!p&&(p.role==='HR'||(p.email||'').toLowerCase()==='rrhh@ata.email');}
/* WHO APPROVES WHOM — Belén's explicit map (2026-07-15). Every chain then runs
   → Belén → HR. This is deliberately a hand-written table, not inferred from role or
   access: the old version guessed "a manager with the same role", which put Belén at the
   manager step AND at her own step, so she was asked to decide the same request twice.
   Keyed by email — the same identity the login resolves against. */
const HOL_FIRST_APPROVER={
  /* PM team → Carlos */
  'andrea.renieblas@ata.email' :'carlos.marquez@ata.email',
  'cristina.galan@ata.email'   :'carlos.marquez@ata.email',
  'ewa.paryz@ata.email'        :'carlos.marquez@ata.email',
  'elena.spinelli@ata.email'   :'carlos.marquez@ata.email',
  'jesus.rgonzalez@ata.email'  :'carlos.marquez@ata.email',
  'francesca.ravera@ata.email' :'carlos.marquez@ata.email',
  /* Sales → Cintia */
  'ian.casares@ata.email'      :'cintia.hernandez@ata.email',
  'sheetal.shamdasani@ata.email':'cintia.hernandez@ata.email',
  /* Marketing → Araceli */
  'maria.mendicute@ata.email'  :'araceli.giner@ata.email',
  'valeria.garcia@ata.email'   :'araceli.giner@ata.email',
  /* Logistics → Valeria Vargas */
  'julian.uribe@ata.email'     :'valeria.vargas@ata.email',
  /* straight to Belén (no first approver): Admin + the managers themselves */
  'jesus.jimenez@ata.email'    :null,
  'carlos.marquez@ata.email'   :null,
  'cintia.hernandez@ata.email' :null,
  'araceli.giner@ata.email'    :null,
  'valeria.vargas@ata.email'   :null,
};
function holManager(p){ // the FIRST approver, or null when the chain starts at Belén
  if(!p||isBelenP(p)||isTeamAccount(p))return null;
  const key=(p.email||'').toLowerCase();
  if(!(key in HOL_FIRST_APPROVER))return null;      // unmapped → straight to Belén
  const mail=HOL_FIRST_APPROVER[key];
  if(!mail)return null;
  return DB.people.find(x=>(x.email||'').toLowerCase()===mail&&x.id!=p.id)||null;
}
function holChain(p){
  const c=[],m=holManager(p);
  if(m&&!isBelenP(m))c.push({key:'manager',who:m});
  const belen=DB.people.find(isBelenP);
  if(belen&&(!p||belen.id!=p.id))c.push({key:'belen',who:belen});  // Belén's own requests skip her step
  c.push({key:'hr',who:null});
  return c;
}
/* the first step a new request enters */
function holFirstStatus(p){return holChain(p)[0].key;}
function holStepName(req,key){
  const p=DB.person(req.personId);
  if(key==='manager'){const m=holManager(p);return m?m.name:'manager';}
  if(key==='belen')return 'Belén';
  return 'HR';
}
function holStageLabel(req){
  if(['manager','belen','hr'].includes(req.status))return 'waiting for '+holStepName(req,req.status);
  return req.status;
}
function holActsOnMe(req){ // is it MY turn to decide this request?
  const me=DB.currentUser;if(!me||req.personId==me.id)return false;
  const p=DB.person(req.personId);if(!p)return false;
  /* strict: each step has exactly ONE holder. Belén acts at her own step only — she is
     never also the manager step, which is what made her turn appear twice. */
  if(req.status==='manager'){const m=holManager(p);return !!(m&&m.id==me.id);}
  if(req.status==='belen')return isBelenP(me);
  if(req.status==='hr')return !!me.hr; // rrhh is the ONLY seat that closes — Belén reviews at her step but never finalises (labour sign-off must be HR)
  return false;
}
function holNextStatus(req){
  const chain=holChain(DB.person(req.personId)).map(s=>s.key);
  const i=chain.indexOf(req.status);
  return (i<0||i===chain.length-1)?'approved':chain[i+1];
}
function myPendingApprovals(){return DB.hrReady()?DB.holidays.filter(holActsOnMe).length:0;}
/* ---- messages on a holiday request ----
   Approvers 1 and 2 need to talk about a request ("is he really taking these apart?")
   without the requester reading over their shoulder — and separately need to be able to
   ask the requester something. Same thread, two visibilities.
   The server hides approver-only rows from the requester (RLS); these helpers are the UI
   half and must never be the only guard. */
function holCanApprove(p){ // is this person ever an approver? (managers, admins, HR)
  if(!p)return false;
  return p.access==='manager'||p.access==='admin'||!!p.hr;
}
function holMsgs(holidayId){
  if(!DB.holmsgReady())return [];
  const me=DB.currentUser;if(!me)return [];
  const r=DB.holidays.find(h=>h.id==holidayId);
  const iAmRequester=!!(r&&r.personId==me.id);
  const approver=holCanApprove(me);
  /* mirrors dc_holiday_msgs_sel exactly: approvers see the thread, the requester sees only
     what was addressed to them, everyone else sees nothing. The server enforces this too —
     this is the second lock, not the only one. */
  return DB.holmsgs.filter(m=>m.holidayId==holidayId)
    .filter(m=>approver||(iAmRequester&&!!m.toRequester))
    .sort((a,b)=>(a.created||'').localeCompare(b.created||''));
}
function holMsgSend(holidayId,text,toRequester){
  if(!DB.holmsgReady())return null;
  const me=DB.currentUser;if(!me)return null;
  text=(text||'').trim();if(!text)return null;
  const r=DB.holidays.find(h=>h.id==holidayId);if(!r)return null;
  const row={id:DB.newId(),holidayId:r.id,personId:r.personId,byName:me.name,
    text,toRequester:!!toRequester,created:new Date().toISOString()};
  DB.data.holmsgs=DB.data.holmsgs||[];
  DB.data.holmsgs.push(row);
  DB.save();
  /* a message FOR the requester should reach them like any other notification */
  if(toRequester&&r.personId!=me.id){
    try{notifySend(r.personId,'holiday',me.name+' about your time off ('+fmtHumanRange(r.dateFrom,r.dateTo)+'): “'+text+'”','home.html');}catch(e){}
  }
  return row;
}
/* office days: up to 8 office days per person per year — logged via the 'remote' entry type */
const REMOTE_MAX_DAYS=8;
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
function tcEffective(personId,day){ // resolve the amendment graph: a punch dies only if a LIVE row amends it
  const rows=tcRows(personId,day);
  // Process newest-first (amends always points to an OLDER row, so every amender is resolved before its target).
  // A row is inactive when an ACTIVE row (a replacement OR a void) amends it; voiding that amender revives the original,
  // which is what makes a denial actually restore the punches the plan had replaced.
  const order=rows.slice().sort((a,b)=>(b.id-a.id));
  const active={};
  order.forEach(r=>{ active[r.id]=!rows.some(a=>a.amends!=null&&a.amends==r.id&&active[a.id]); });
  return rows.filter(r=>active[r.id]&&r.kind!=='void').sort((a,b)=>(a.time||'').localeCompare(b.time||''));
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
/* ---------------------------------------------------------------------------
   FAIL-PROOF CORRECTIONS (2026-07-15). The person states WHAT HAPPENED; this
   works out the punches; HR approves the OUTCOME. Nobody picks add/void/fix.
   planAmendments() is PURE (no DB, no DOM) so every failure we have actually
   hit is unit-testable. See PROPOSAL - Fail-proof time-clock corrections.md.
--------------------------------------------------------------------------- */
const CLAIM_MAX_DAYS = 14;      // how far back a claim may reach (her call)
const CLAIM_TOLERANCE_H = 1;    // auto-apply only up to expected + 1h
window._claimReady = true;      // flipped off at boot if dispatch_hr11_claims.sql has not run
window._inv2Ready = true;       // flipped off at boot if dispatch_invoicing2.sql has not run
/* claim = {type, time?, from?, to?, entryId?, text?}
   types: forgot_out | forgot_in | wrong_time | extra_punch | whole_day | other */
/* display-time de-ISO (Belén, 20 Jul): stored texts written BEFORE the date rule reached
   every writer still carry yyyy-mm-dd — rewrite them to dd/mm/yyyy wherever they render.
   Only touches digit-dash-digit patterns, safe to run on escaped HTML. */
function deIso(s){return (''+(s==null?'':s)).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,'$3/$2/$1');}
function fmtStamp(at){if(!at)return '';const s=''+at;return deIso(s.slice(0,10))+(s.length>10?' '+s.slice(11,16):'');}
function claimDescribe(c, day) {
  const d = fmtHuman(day); // Belén's date format everywhere: day, month and year — never ISO
  switch (c.type) {
    case 'forgot_out':  return 'add a clock-out at ' + c.time + ' on ' + d;
    case 'forgot_in':   return 'add a clock-in at ' + c.time + ' on ' + d;
    case 'wrong_time':  return 'correct a punch to ' + c.time + ' on ' + d;
    case 'extra_punch': return 'remove a punch on ' + d;
    case 'whole_day':   return 'set ' + d + ' to ' + c.from + ' → ' + c.to;
    default:            return 'a correction on ' + d;
  }
}
function pairState(entries) {            // -> {total(min), open, openAt(min|null)}
  let total = 0, openSince = null;
  entries.slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')).forEach(e => {
    if (e.kind === 'in') { if (openSince == null) openSince = tcMinutes(e.time); }
    else if (e.kind === 'out' && openSince != null) { total += Math.max(0, tcMinutes(e.time) - openSince); openSince = null; }
  });
  return { total: total, open: openSince != null, openAt: openSince };
}
function pairTotals(entries) {          // -> {total(min), open}
  const s = pairState(entries);
  return { total: s.total, open: s.open };
}
function planAmendments(personId, day, claim) {
  const es = tcEffective(personId, day);
  const before = pairTotals(es);
  const today = toISO(new Date());
  const out = { ops: [], before: before, after: null, blocked: null, describe: claimDescribe(claim, day), simple: false };

  if (!claim || claim.type === 'other') { out.blocked = 'manual'; return out; }

  /* R1 - never write a punch in the future (this is what froze Andrea's clock) */
  const future = t => day > today || (day === today && t && t > nowHMS().slice(0, 5));
  const times = [claim.time, claim.from, claim.to].filter(Boolean);
  if (times.some(future)) { out.blocked = 'future'; return out; }

  /* claim window */
  const ageDays = Math.round((ymd(today) - ymd(day)) / 86400000);
  if (ageDays > CLAIM_MAX_DAYS) { out.blocked = 'too_old'; return out; }
  if (ageDays < 0) { out.blocked = 'future'; return out; }

  const sim = es.map(e => ({ id: e.id, kind: e.kind, time: e.time }));
  const target = claim.entryId ? es.find(e => e.id == claim.entryId) : null;
  switch (claim.type) {
    case 'forgot_out':
      out.ops.push({ act: 'add', kind: 'out', time: claim.time });
      sim.push({ kind: 'out', time: claim.time }); break;
    case 'forgot_in': {
      /* "I forgot to clock in / I arrived at X." Correct the OPEN session's clock-in ONLY
         when X actually belongs to that session (X is after the last clock-out). Otherwise
         "fixing the last in" would rewrite the wrong punch and clock a still-working person
         OUT — the split-day bug (morning 09→13, back at 14 open, claims arrival 08:30). When
         X does not belong to the open session we ADD a clock-in (never destructive) and let
         pairing + the review gate handle it, rather than silently destroy the live session. */
      const openState = pairState(es);
      const openIn = openState.open ? es.slice().reverse().find(e => e.kind === 'in') : null;
      const lastOut = es.filter(e => e.kind === 'out').map(e => e.time).sort().pop() || null;
      if (openIn && (!lastOut || claim.time > lastOut)) {
        out.ops.push({ act: 'fix', kind: 'in', time: claim.time, entryId: openIn.id });
        sim.forEach(x => { if (x.id == openIn.id) x.kind = 'void'; });
        sim.push({ kind: 'in', time: claim.time });
      } else {
        out.ops.push({ act: 'add', kind: 'in', time: claim.time });
        sim.push({ kind: 'in', time: claim.time });
      }
      break;
    }
    case 'wrong_time':
      if (!target) { out.blocked = 'no_target'; return out; }
      out.ops.push({ act: 'fix', kind: target.kind, time: claim.time, entryId: target.id });
      sim.forEach(x => { if (x.id == target.id) x.kind = 'void'; });
      sim.push({ kind: target.kind, time: claim.time }); break;
    case 'extra_punch':
      if (!target) { out.blocked = 'no_target'; return out; }
      out.ops.push({ act: 'void', kind: 'void', time: target.time, entryId: target.id });
      sim.forEach(x => { if (x.id == target.id) x.kind = 'void'; }); break;
    case 'whole_day':
      es.forEach(e => { out.ops.push({ act: 'void', kind: 'void', time: e.time, entryId: e.id }); });
      sim.forEach(x => { x.kind = 'void'; });
      out.ops.push({ act: 'add', kind: 'in', time: claim.from });
      out.ops.push({ act: 'add', kind: 'out', time: claim.to });
      sim.push({ kind: 'in', time: claim.from }, { kind: 'out', time: claim.to }); break;
    default: out.blocked = 'manual'; return out;
  }

  out.after = pairTotals(sim.filter(x => x.kind !== 'void'));
  /* R2 - a correction that changes nothing is a mistake, not a correction.
     Compare the day as it will actually RESOLVE, not just the paired total: on an
     OPEN day the total is 0 until clocked out, so moving the clock-in earlier looks
     like "no change" by total alone (the bug a colleague hit 16/07 — clocked in 09:37,
     really arrived 08:30). Also compare where the open session STARTS.
     EXCEPT removing a stray punch: voiding one of Andrea's 12 duplicate clock-ins
     moves no hours but still cleans the record — that is the whole point of it. */
  const beforeS = pairState(es), afterS = pairState(sim.filter(x => x.kind !== 'void'));
  const mFloor = v => v == null ? null : Math.floor(v);   // claims are HH:MM — ignore a seconds-only diff
  if (claim.type !== 'extra_punch' &&
      Math.round(afterS.total) === Math.round(beforeS.total) && afterS.open === beforeS.open &&
      mFloor(afterS.openAt) === mFloor(beforeS.openAt)) {
    out.blocked = 'noop'; return out;
  }
  /* R3 - result sanity */
  if (out.after.total < 0 || out.after.total > 16 * 60) { out.blocked = 'insane'; return out; }

  /* "simple" = safe to apply straight away; anything else waits for Belén */
  const expected = (typeof tcExpectedDay === 'function') ? tcExpectedDay(personId, day) : 8;
  out.simple = !out.after.open && out.after.total <= (expected + CLAIM_TOLERANCE_H) * 60;
  return out;
}
/* Write a plan to the ledger. Each op becomes a NEW linked row (nothing is ever
   updated or deleted); created_by/hash are stamped server-side by dc_tc_stamp().
   `by` is only used for the thread note - the DB decides the real author. */
function applyPlan(personId, day, plan, reportId, reason) {
  if (!plan || plan.blocked || !plan.ops.length) return { ok: false, msg: plan && plan.blocked };
  plan.ops.forEach(op => {
    DB.timeclock.push({
      id: DB.newId(), personId: personId, day: day,
      time: op.time, kind: op.act === 'void' ? 'void' : op.kind,
      manual: op.act === 'add', amends: op.entryId || null,
      reason: reason, note: null, reportId: reportId || null
    });
  });
  DB.save();
  return { ok: true, n: plan.ops.length };
}
/* Undo a correction that Belen denies: void every row the plan wrote. Still additive -
   the denial is itself a linked amendment, so the trail shows claim -> applied -> denied. */
function reversePlan(reportId, reason) {
  const rows = DB.timeclock.filter(r => r.reportId == reportId);   // ALL rows this plan wrote, incl. its own void rows
  const already = {}; DB.timeclock.forEach(r => { if (r.amends != null) already[r.amends] = true; });
  let n = 0;
  rows.forEach(r => {
    if (already[r.id]) return;
    DB.timeclock.push({
      id: DB.newId(), personId: r.personId, day: r.day, time: r.time, kind: 'void',
      manual: false, amends: r.id, reason: reason, note: null, reportId: reportId
    });
    n++;
  });
  DB.save();
  return n;
}
const CLAIM_BLOCK_MSG = {
  future: 'That time has not happened yet. A punch dated in the future stops the clock.',
  too_old: 'That day is more than ' + CLAIM_MAX_DAYS + ' days ago — Belén has to make this one.',
  noop: 'That would not change anything on the record. Check the day and the time.',
  insane: 'That would make the day longer than 16 hours. Check the times.',
  no_target: 'Pick which punch you mean.',
  manual: 'Belen will look at this one.'
};
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
/* "time for a break?" nudge — Belén's spec (18 Jul): appears after 4.5 h of unbroken
   clocked time, snoozeable ONCE for 30 min, then ONCE for 1 h, then never again that day.
   The snooze ladder is persisted per person per day (survives reloads). */
const BREAK_AFTER_H=4.5, BREAK_SNOOZES=[30,60]; // minutes: 1st snooze, 2nd snooze — then done for the day
let _breakTimer=null;
function breakKey(){return 'dcBreakSnooze|'+(DB.currentUser?DB.currentUser.id:0)+'|'+toISO(new Date());}
function breakState(){try{return JSON.parse(localStorage.getItem(breakKey()))||{n:0,until:0};}catch(e){return {n:0,until:0};}}
function setBreakState(s){try{localStorage.setItem(breakKey(),JSON.stringify(s));}catch(e){}}
function breakReminderTick(){
  try{flushPendingPunches();}catch(e){} // retry any punch that failed to save
  if(!DB.currentUser||!DB.tcReady()||isTeamAccount(DB.currentUser))return;
  const cont=tcContinuousSeconds(DB.currentUser.id),el=document.getElementById('breakToast');
  const s=breakState();
  if(cont>=BREAK_AFTER_H*3600 && s.n<=BREAK_SNOOZES.length && Date.now()>s.until){ if(!el)showBreakToast(cont,s); }
  else if(el&&cont<60){el.remove();} // they clocked out — clear it
  try{weeklyGoalTick();}catch(e){} // also run the weekly-hours alarm ladder
}
function showBreakToast(cont,s){
  const h=Math.floor(cont/3600),m=Math.floor((cont%3600)/60);
  const nextSnooze=s.n<BREAK_SNOOZES.length?BREAK_SNOOZES[s.n]:null; // null → last showing today
  const d=document.createElement('div');d.id='breakToast';
  d.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9998;background:#2B2B2B;color:#fff;border-radius:12px;padding:14px 16px;max-width:320px;box-shadow:0 8px 30px rgba(0,0,0,.28);font-family:Segoe UI,system-ui,sans-serif;font-size:13px';
  d.innerHTML='<div style="font-weight:700;margin-bottom:4px">🚗☕ Time for a break?</div>'+
    '<div style="color:#e6e4df;margin-bottom:10px">You’ve been clocked in for '+h+' h '+String(m).padStart(2,'0')+' without a break. Stopping for lunch or a rest? Remember to clock back in when you’re back.</div>'+
    '<div style="display:flex;gap:8px"><button id="bt_out" style="background:#FF4A00;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-weight:600;cursor:pointer;font:inherit">Clock out for a break</button>'+
    '<button id="bt_dismiss" style="background:none;color:#cfcdc7;border:1px solid #55534e;border-radius:8px;padding:7px 12px;cursor:pointer;font:inherit">'+(nextSnooze?'Snooze '+(nextSnooze>=60?'1 h':nextSnooze+' min'):'Don’t show again today')+'</button></div>';
  document.body.appendChild(d);
  document.getElementById('bt_out').onclick=async ()=>{
    d.remove();setBreakState({n:0,until:0}); // a real break resets the ladder
    await DB.punch('out'); // awaited + queued-on-failure, like the clock buttons
    window.dispatchEvent(new Event('dc-remote'));
  };
  document.getElementById('bt_dismiss').onclick=()=>{
    const n=s.n+1;
    setBreakState(n<=BREAK_SNOOZES.length?{n,until:Date.now()+BREAK_SNOOZES[n-1]*60000}:{n,until:8640000000000000}); // past the ladder → silent for the rest of the day
    d.remove();
  };
}
function tcExpectedDay(personId,iso){ // 0 on weekends, bank holidays and any approved leave (holiday/sick/maternity/paternity)
  if(isTeamAccount(DB.person(personId)))return 0; // external HR team: no clock duty (Belén, 20 Jul)
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
/* ---- pending-punch safety net ----
   Punches are too important for the debounced background sync: they are inserted
   IMMEDIATELY and awaited. If the database cannot be reached (offline, expired
   session, server error) the punch is kept here — localStorage, survives closing
   the browser — shown in a red banner and retried until it lands. */
const PUNCH_QUEUE_KEY='dcPendingPunches';
let _punchAck=null,_punchFlushing=false,_punchClockWarn=false;
function pendingPunches(){try{return JSON.parse(localStorage.getItem(PUNCH_QUEUE_KEY))||[];}catch(e){return [];}}
function setPendingPunches(q){try{if(q.length)localStorage.setItem(PUNCH_QUEUE_KEY,JSON.stringify(q));else localStorage.removeItem(PUNCH_QUEUE_KEY);}catch(e){}renderPunchBanner();}
async function flushPendingPunches(){
  if(!USE_SUPABASE||!sb||_punchFlushing)return;
  const q=pendingPunches();if(!q.length)return;
  _punchFlushing=true;
  try{
    const left=[];let clockWarn=false;
    const isClockErr=m=>/future|dated in the future|no_future/i.test(m||'');
    for(const p of q){
      try{
        const {error}=await sb.from('dc_timeclock').insert([p]);
        if(error&&!(error.code==='23505'||/duplicate key/i.test(error.message||''))){
          /* the server refused it as future-dated → the DEVICE clock was wrong when this
             punch was made, so its day/time can't be trusted and blind retry will loop
             forever (audit H2). Keep it (never lose a punch) but flag the real cause so the
             banner tells the worker to fix their clock + offers an explicit Dismiss. */
          if(isClockErr(error.message))clockWarn=true;
          left.push(p);continue;
        }
        if(DB.data&&DB.data.timeclock&&!DB.data.timeclock.some(r=>r.id==p.id))DB.data.timeclock.push(p);
        if(_shadow&&_shadow.timeclock)_shadow.timeclock[p.id]=JSON.stringify(p);
      }catch(e){if(isClockErr(e&&e.message))clockWarn=true;left.push(p);}
    }
    const saved=q.length-left.length;
    _punchClockWarn=left.length?clockWarn:false;
    setPendingPunches(left);
    if(saved)window.dispatchEvent(new Event('dc-remote'));
  }finally{_punchFlushing=false;}
}
function renderPunchBanner(){
  const q=USE_SUPABASE?pendingPunches():[];
  let el=document.getElementById('punchPendingBar');
  if(!q.length){if(el)el.remove();return;}
  if(!el){el=document.createElement('div');el.id='punchPendingBar';document.body.prepend(el);}
  el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#D32230;color:#fff;padding:8px 16px;font:13px Segoe UI,system-ui,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 2px 10px rgba(0,0,0,.25)';
  const list=q.map(p=>p.kind.toUpperCase()+' '+fmtHumanShort(p.day)+' '+(p.time||'').slice(0,5)).join(' · ');
  if(_punchClockWarn){
    /* H2: a future-dated punch can never save as-is — name the real cause (device clock)
       and give an explicit Dismiss so a stuck, mis-dated punch can be cleared after the
       worker fixes their clock and re-clocks. */
    el.innerHTML='<b>⚠ Clock punch not saved — this device\'s date/time looks wrong</b>'+
      '<span style="opacity:.92">It recorded: '+esc(list)+'</span>'+
      '<span style="opacity:.85">Set your device to the correct date &amp; time, then Retry. If you have already clocked again correctly, Dismiss this.</span>'+
      '<button id="ppRetry" style="margin-left:auto;background:#fff;color:#D32230;border:none;border-radius:7px;padding:5px 12px;font-weight:700;cursor:pointer;font:inherit">Retry</button>'+
      '<button id="ppDismiss" style="background:transparent;color:#fff;border:1px solid #fff;border-radius:7px;padding:5px 12px;font-weight:600;cursor:pointer;font:inherit">Dismiss</button>';
    document.getElementById('ppDismiss').onclick=()=>{if(confirm('Discard '+q.length+' unsaved punch'+(q.length>1?'es':'')+'? Only do this if the times were wrong and you have re-clocked correctly.')){_punchClockWarn=false;setPendingPunches([]);}};
  }else{
    el.innerHTML='<b>⚠ '+q.length+' clock punch'+(q.length>1?'es':'')+' not saved yet</b>'+
      '<span style="opacity:.92">'+esc(list)+'</span>'+
      '<span style="opacity:.8">Kept safe on this device — retrying automatically.</span>'+
      '<button id="ppRetry" style="margin-left:auto;background:#fff;color:#D32230;border:none;border-radius:7px;padding:5px 12px;font-weight:700;cursor:pointer;font:inherit">Retry now</button>';
  }
  document.getElementById('ppRetry').onclick=()=>flushPendingPunches();
}
function punchAckHtml(){ // confirmation line under the clock button (both clock cards)
  if(!_punchAck||Date.now()-_punchAck.at>20000)return '';
  return _punchAck.ok
    ?'<div style="color:var(--green,#1D6B34);font-weight:700;font-size:12.5px;margin-top:6px">✓ Saved in the record — '+_punchAck.kind.toUpperCase()+' '+_punchAck.time+'</div>'
    :'<div style="color:#D32230;font-weight:700;font-size:12.5px;margin-top:6px">⚠ Could not reach the database — your punch is kept safe on this device and will retry automatically.</div>';
}
window.addEventListener('online',()=>{try{flushPendingPunches();}catch(e){}});
/* weekly overtime: hours clocked vs the hours ALLOWED that week (37.5, or 35 in Jul/Aug,
   less bank holidays). Daily distribution is flexible — only the WEEKLY total matters. */
function tcWeekOvertime(personId,mondayISO){
  const w=weekWorkInfo(mondayISO,personId);
  const allowed=Math.max(0,w.toAllocate); // bank holidays AND approved vacation/leave lower the week's allowance
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
/* progress toward THIS week's required hours. target = hours actually expected
   (required − bank holidays − approved vacation/leave); worked includes the live tick. */
function tcWeekProgress(personId,mondayISO){
  const mon=mondayISO||toISO(monday(new Date()));
  const w=weekWorkInfo(mon,personId), target=w.toAllocate;
  const monD=ymd(mon);let sec=0;for(let i=0;i<7;i++)sec+=tcLiveSeconds(personId,toISO(addDays(monD,i))).seconds;
  const worked=sec/3600;
  return {target,worked,remaining:Math.max(0,target-worked),pct:target>0?Math.min(1,worked/target):1,done:target>0&&worked>=target-1e-6};
}
/* escalating weekly-hours alarms — Belén's spec (18 Jul): "It's hard not to forget the
   time!" → alarm 1 h before the week's allotted hours are consumed, then 30 min, then
   15 min, then every 5 min till the end. Only while clocked in (the countdown only moves
   then); fired marks persist per person per week so a reload never re-spams. */
const WEEK_ALARMS=[60,30,15,10,5,0]; // minutes-left marks
function weekAlarmKey(){return 'dcWeekAlarms|'+(DB.currentUser?DB.currentUser.id:0)+'|'+toISO(monday(new Date()));}
function weeklyGoalTick(){
  if(!DB.currentUser||!DB.tcReady()||isTeamAccount(DB.currentUser))return;
  const me=DB.currentUser, info=tcDayInfo(me.id,toISO(new Date()));
  const el=document.getElementById('weekAlarmToast');
  if(!info.open){if(el)el.remove();return;}
  const p=tcWeekProgress(me.id);
  if(p.target<=0)return;
  const remMin=Math.floor(p.remaining*60);
  if(remMin>60)return;
  let fired={};try{fired=JSON.parse(localStorage.getItem(weekAlarmKey()))||{};}catch(e){}
  const crossed=WEEK_ALARMS.filter(t=>remMin<=t&&!fired[t]);
  if(!crossed.length)return;
  const due=Math.min.apply(null,crossed);            // the most urgent mark not yet sounded
  crossed.forEach(t=>fired[t]=1);                    // crossing 12 min marks 60/30/15 as done in one go
  try{localStorage.setItem(weekAlarmKey(),JSON.stringify(fired));}catch(e){}
  showWeekAlarm(p,remMin,due);
}
function alarmBeep(n){ // short attention beeps; silently skipped if the browser blocks audio
  try{const ac=new (window.AudioContext||window.webkitAudioContext)();
    if(ac.state==='suspended')ac.resume();
    let t=ac.currentTime;
    for(let i=0;i<n;i++){const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);
      o.frequency.value=880;g.gain.setValueAtTime(0.14,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
      o.start(t);o.stop(t+0.24);t+=0.32;}
  }catch(e){}
}
function showWeekAlarm(p,remMin,mark){
  const old=document.getElementById('weekAlarmToast');if(old)old.remove();
  const urgent=remMin<=15, done=remMin<=0;
  const bg=done?'#D32230':urgent?'#C43A12':'#C77800';
  const head=done?'⏰ That’s your '+Math.round(p.target)+' h for this week':'⏰ '+remMin+' min of your week left';
  const body=done
    ?'Your allotted weekly hours are consumed — time to clock out.'
    :'About '+remMin+' min until your '+Math.round(p.target)+' h for this week are used up.'+(urgent?' Wrap up and clock out on time.':'');
  const d=document.createElement('div');d.id='weekAlarmToast';
  d.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:9999;background:'+bg+';color:#fff;border-radius:12px;padding:14px 20px;min-width:340px;max-width:520px;box-shadow:0 10px 34px rgba(0,0,0,.35);font-family:Segoe UI,system-ui,sans-serif;font-size:14px';
  d.innerHTML='<div style="font-weight:800;font-size:15px;margin-bottom:3px">'+head+'</div>'+
    '<div style="opacity:.94;margin-bottom:10px">'+body+'</div>'+
    '<div style="display:flex;gap:8px"><button id="wa_out" style="background:#fff;color:'+bg+';border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;font:inherit">Clock out now</button>'+
    (done?'':'<button id="wa_ok" style="background:none;color:#fff;border:1px solid rgba(255,255,255,.55);border-radius:8px;padding:7px 12px;cursor:pointer;font:inherit">OK</button>')+'</div>';
  document.body.appendChild(d);
  alarmBeep(done?4:urgent?3:2);
  document.getElementById('wa_out').onclick=async ()=>{d.remove();await DB.punch('out');window.dispatchEvent(new Event('dc-remote'));};
  const ok=document.getElementById('wa_ok');if(ok)ok.onclick=()=>d.remove();
  // the final "time's up" banner stays until they clock out (weeklyGoalTick removes it then)
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
  /* admins: new (untriaged) team requests — the Requests box lives under Tools now */
  if(DB.isAdmin()&&DB.tickReady()){
    const nt=DB.tickets.filter(t=>t.status==='new').length;
    const el=document.getElementById('nav-tools');
    if(el&&nt>0)el.innerHTML+=' <span title="New team requests waiting for triage" style="background:#D32230;color:#fff;border-radius:9px;font-size:10px;font-weight:700;padding:1px 6px;vertical-align:1px">'+nt+'</span>';
  }
  /* 🔔 unread notifications (answers to your requests, team notices, time-off decisions) */
  if(DB.inboxReady()){
    const nu=inboxUnread();
    const el=document.getElementById('nav-inbox');
    if(el&&nu>0)el.innerHTML+=' <span title="Unread notifications" style="background:#FF4A00;color:#fff;border-radius:9px;font-size:10px;font-weight:700;padding:1px 6px;vertical-align:1px">'+nu+'</span>';
  }
}

/* ================= notifications inbox (🔔) ================= */
const INBOX_KINDS={ticket:{label:'Request update',icon:'💡',color:'#185FA5'},
  notice:{label:'Team notice',icon:'📢',color:'#FF4A00'},
  holiday:{label:'Time off',icon:'🌴',color:'#3E8C28'},
  alarm:{label:'Follow-up alarm',icon:'⏰',color:'#D32230'}};
/* send a notification. to = personId | [personIds] | 'all' (whole roster except team
   accounts and the sender). Silently no-ops if the inbox table isn't created yet. */
function notifySend(to,kind,text,link){
  if(!DB.inboxReady()||!DB.currentUser)return 0;
  DB.data.inbox=DB.data.inbox||[];DB.data.todos=DB.data.todos||[]; // local-mode safety
  text=(text||'').trim();if(!text)return 0;
  let ids=[];
  if(to==='all')ids=DB.people.filter(p=>!isTeamAccount(p)&&p.id!=DB.currentUser.id).map(p=>p.id);
  else if(Array.isArray(to))ids=to.slice();
  else if(to!=null)ids=[to];
  ids=[...new Set(ids)].filter(id=>DB.person(id));
  const created=toISO(new Date())+' '+nowHMS().slice(0,5);
  ids.forEach(pid=>DB.inbox.unshift({id:DB.newId(),personId:pid,kind:kind||'notice',text,
    link:link||'',isRead:false,fromName:DB.currentUser.name||'',created}));
  if(ids.length)DB.save();
  return ids.length;
}
function inboxMine(){const me=DB.currentUser;return me?DB.inbox.filter(m=>m.personId==me.id):[];}
function inboxUnread(){return inboxMine().filter(m=>!m.isRead).length;}

/* ⏰ SPX follow-up alarms: when one of MY live proposals has a next-touchpoint
   (fechaSeguimiento) in the past, drop an alarm in my own inbox — once per
   proposal+date (deduped on the link key; RLS only lets me read my own inbox,
   which is exactly the set the dedupe needs). Won/Lost never alarm. */
function spxTouchpointAlarms(){
  const me=DB.currentUser;
  if(!me||!me.email||!DB.inboxReady()||!DB.spxReady())return 0;
  const today=toISO(new Date());
  let sent=0;
  (DB.spxProps||[]).filter(p=>p.active!==false&&!p.superseded
      &&p.salesStatus==='Sent'
      &&(''+(p.responsableEmail||'')).toLowerCase()===(''+me.email).toLowerCase()
      &&p.fechaSeguimiento&&(''+p.fechaSeguimiento).slice(0,10)<today)
    .forEach(p=>{
      const due=(''+p.fechaSeguimiento).slice(0,10);
      const key='spx.html?fu='+p.id+':'+due;
      if((DB.inbox||[]).some(m=>m.personId==me.id&&m.link===key))return;   // already alarmed for this date
      sent+=notifySend(me.id,'alarm','⏰ Follow-up overdue: '+(p.company||'proposal')+' — next touchpoint was '+due+'. Time to chase.',key);
    });
  return sent;
}

/* ================= team request box (💡 Requests) ================= */
const TICKET_TYPES={bug:{label:'Bug — something is broken',short:'Bug',color:'#D32230'},
  usability:{label:'Usability — works but it’s clunky',short:'Usability',color:'#C77800'},
  change:{label:'Change request',short:'Change',color:'#185FA5'},
  idea:{label:'Idea / addition',short:'Idea',color:'#3E8C28'}};
const TICKET_STATUS={new:{label:'New',color:'#FF4A00'},planned:{label:'Planned',color:'#185FA5'},
  inprogress:{label:'In progress',color:'#C77800'},done:{label:'Done',color:'#3E8C28'},declined:{label:'Declined',color:'#9AA0A8'}};
const TICKET_PRIORITY={high:{label:'High',color:'#D32230',rank:1},normal:{label:'Normal',color:'#C77800',rank:2},low:{label:'Low',color:'#9AA0A8',rank:3}};
const TICKET_AREAS=['Me','Projects','Event page','Team','Money','Invoicing','Impact','HR','Tools','Requests','Mobile / phone use','General'];
/* which page am I on? (pre-fills the "area" of a quick ticket) */
function pageArea(){
  const f=(location.pathname.split('/').pop()||'').toLowerCase();
  const map={'home.html':'Me','index.html':'Me','gantt.html':'Projects','event.html':'Event page',
    'people.html':'Team','person.html':'Team','dashboard.html':'Money','facturacion.html':'Invoicing',
    'impact.html':'Impact','hr.html':'HR','tools.html':'Tools','tool.html':'Tools','tickets.html':'Requests','inbox.html':'General'};
  return map[f]||'General';
}
/* the quick "open a request" modal — under a minute: type, one line, optional detail */
function quickTicketUI(){
  const me=DB.currentUser;
  const old=document.getElementById('qtOv');if(old)old.remove();
  const ov=document.createElement('div');ov.id='qtOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:9995;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,system-ui,sans-serif;padding:12px';
  if(!me||!DB.tickReady()){
    ov.innerHTML='<div style="background:#fff;border-radius:14px;padding:24px 26px;max-width:360px;font-size:13.5px;color:#3a3a3a">'
      +(!me?'You need to be in the staff roster to open requests.':'The requests module is not switched on yet — Belén needs to run its update in the database. Try again later.')
      +'<div style="margin-top:14px;text-align:right"><button id="qt_x" style="font:inherit;padding:8px 16px;border:1px solid #e3e1da;background:#fff;border-radius:8px;cursor:pointer">Close</button></div></div>';
    document.body.appendChild(ov);document.getElementById('qt_x').onclick=()=>ov.remove();return;
  }
  const area=pageArea();
  ov.innerHTML='<div style="background:#fff;border-radius:14px;padding:22px 24px;width:430px;max-width:96vw;box-shadow:0 14px 50px rgba(0,0,0,.25)">'
   +'<div style="font-size:17px;font-weight:700;color:#2B2B2B">💡 Open a request</div>'
   +'<div style="font-size:12px;color:#7c7c78;margin:3px 0 14px">A bug, something clunky, a change or an idea about the Dispatch Center. The whole team can see it; Bel&eacute;n &amp; Carlos triage it.</div>'
   +'<div style="display:flex;gap:8px;margin-bottom:9px">'
   +'<select id="qt_type" style="flex:1;font:inherit;padding:9px;border:1px solid #e3e1da;border-radius:8px">'+Object.keys(TICKET_TYPES).map(k=>'<option value="'+k+'">'+TICKET_TYPES[k].label+'</option>').join('')+'</select>'
   +'<select id="qt_area" style="width:150px;font:inherit;padding:9px;border:1px solid #e3e1da;border-radius:8px">'+TICKET_AREAS.map(a=>'<option '+(a===area?'selected':'')+'>'+a+'</option>').join('')+'</select></div>'
   +'<input id="qt_title" maxlength="140" placeholder="One line — what is it about?" style="width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #e3e1da;border-radius:8px;margin-bottom:9px">'
   +'<textarea id="qt_desc" rows="3" placeholder="Details (optional) — what happened, what you expected, where…" style="width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #e3e1da;border-radius:8px;margin-bottom:12px;resize:vertical"></textarea>'
   +'<div style="display:flex;gap:8px;align-items:center"><button id="qt_send" style="font:inherit;flex:1;padding:11px;background:#FF4A00;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">Send</button>'
   +'<button id="qt_cancel" style="font:inherit;padding:11px 16px;border:1px solid #e3e1da;background:#fff;border-radius:8px;cursor:pointer">Cancel</button></div>'
   +'<div style="font-size:11.5px;color:#7c7c78;margin-top:10px"><a href="tickets.html" style="color:#7c7c78">See all requests →</a> <span style="opacity:.8">(maybe it’s already reported — you can add a comment there instead)</span></div></div>';
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  document.getElementById('qt_cancel').onclick=close;
  ov.onclick=e=>{if(e.target===ov)close();};
  document.getElementById('qt_title').focus();
  document.getElementById('qt_send').onclick=()=>{
    const title=document.getElementById('qt_title').value.trim();
    if(!title){document.getElementById('qt_title').style.borderColor='#D32230';document.getElementById('qt_title').focus();return;}
    DB.tickets.push({id:DB.newId(),personId:me.id,area:document.getElementById('qt_area').value,
      type:document.getElementById('qt_type').value,title,description:document.getElementById('qt_desc').value.trim(),
      status:'new',priority:null,thread:[],created:toISO(new Date())+' '+nowHMS().slice(0,5)});
    DB.save();
    ov.firstChild.innerHTML='<div style="font-size:17px;font-weight:700;color:#3E8C28">✓ Sent — thank you!</div>'
      +'<div style="font-size:13px;color:#3a3a3a;margin:8px 0 14px">It’s in the queue. You can follow it (and comment) on the <a href="tickets.html">Requests page</a>.</div>'
      +'<div style="text-align:right"><button id="qt_done" style="font:inherit;padding:9px 18px;background:#FF4A00;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">Close</button></div>';
    document.getElementById('qt_done').onclick=close;
    try{window.dispatchEvent(new Event('dc-remote'));}catch(e){}
  };
}
/* the small always-there "💡 Request" button (every page, bottom-left) */
function injectTicketFab(){
  if(document.getElementById('dcTicketFab'))return;
  if(/tickets\.html/i.test(location.pathname))return; // that page has its own button
  if(!DB.currentUser)return;
  const b=document.createElement('button');b.id='dcTicketFab';
  b.title='Something broken? Clunky? An idea? Open a request — takes under a minute';
  b.textContent='💡 Request';
  b.style.cssText='position:fixed;left:14px;bottom:14px;z-index:9990;background:#2B2B2B;color:#fff;border:none;border-radius:22px;padding:9px 15px;font:600 12.5px "Segoe UI",system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.25);opacity:.92';
  b.onmouseenter=()=>b.style.opacity='1';b.onmouseleave=()=>b.style.opacity='.92';
  b.onclick=()=>quickTicketUI();
  document.body.appendChild(b);
}

/* ================= device visibility (Belén-only adoption picture) =================
   One tiny row per person / device / day at app-open: date, phone|tablet|desktop and
   whether it ran as the installed app (standalone). NOTHING else — no location, no IP,
   no page tracking. Server-side RLS: ONLY Belén can read the table. */
function deviceKind(){
  try{
    const coarse=matchMedia('(pointer:coarse)').matches;
    const w=Math.min(screen.width||1024,screen.height||1024);
    const ua=navigator.userAgent||'';
    if(/iPad/i.test(ua)||(coarse&&w>=600&&w<=1100))return 'tablet';
    if(/Mobi|iPhone|Android/i.test(ua)||(coarse&&w<600))return 'phone';
    return 'desktop';
  }catch(e){return 'desktop';}
}
function isStandalone(){
  try{return matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}catch(e){return false;}
}
async function recordLogin(){
  const me=DB.currentUser;if(!me)return;
  const day=toISO(new Date()),device=deviceKind(),standalone=isStandalone();
  const stamp=me.id+'|'+day+'|'+device+'|'+(standalone?1:0);
  try{if(localStorage.getItem('dcLoginStamp')===stamp)return;}catch(e){}
  if(!USE_SUPABASE){ // local demo: keep in the local store so the panel can be tested
    const arr=DB.data.logins=DB.data.logins||[];
    const ex=arr.find(r=>r.personId==me.id&&r.day===day&&r.device===device);
    if(ex){if(standalone)ex.standalone=true;}else arr.push({id:DB.newId(),personId:me.id,day,device,standalone});
    localStorage.setItem('dispatchStore',JSON.stringify(DB.data));
    try{localStorage.setItem('dcLoginStamp',stamp);}catch(e){}
    return;
  }
  try{
    const {error}=await sb.from('dc_logins').insert([{id:DB.newId(),personId:me.id,day,device,standalone}]);
    if(error){
      if(error.code==='23505'||/duplicate/i.test(error.message||'')){
        if(standalone)await sb.from('dc_logins').update({standalone:true}).eq('personId',me.id).eq('day',day).eq('device',device);
      }else return; // table not there yet (or RLS said no) — try again next visit
    }
    try{localStorage.setItem('dcLoginStamp',stamp);}catch(e){}
  }catch(e){}
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
  /* Jesús is finance-only: he reports on allocations but is NOT in the HR seat — the
     HR/reporting unbundle (dispatch_hr10_alloc_unbundle.sql) set his hr flag false live.
     This used to say .hr=true "to mirror the SQL seed" and never caught up, which made the
     local demo grant him HR powers he does not have in production. */
  {const c=people.find(p=>p.name==='Cintia Hernández');if(c)c.salesLead=true;} // local demo mirrors dispatch_spx.sql
  /* Facturación códigos-contables master (mirrors dispatch_facturacion_codigos.sql).
     eventId links an item to its dc_finance row so RENMAD lines still feed the € Dashboard;
     Webinars / ATA / future editions carry a código but no event. */
  const codigos=[
   {id:1,item:'Webinars',codigo:'01',eventId:null},
   {id:2,item:'ATA',codigo:'06',eventId:null},
   {id:3,item:'Almacenamiento 26',codigo:'70308',eventId:5},
   {id:4,item:'Invest 26',codigo:'70309',eventId:1},
   {id:5,item:'Biometano 26',codigo:'70310',eventId:2},
   {id:6,item:'Polonia 26',codigo:'70311',eventId:4},
   {id:7,item:'Datacenters 26',codigo:'70312',eventId:3},
   {id:8,item:'Storage Italia 26',codigo:'70313',eventId:6},
   {id:9,item:'Hidrógeno 26',codigo:'70315',eventId:11},
   {id:10,item:'Chile 26',codigo:'70316',eventId:9},
   {id:11,item:'México 27',codigo:'70317',eventId:null},
   {id:12,item:'Useful AI 26',codigo:'70318',eventId:7},
   {id:13,item:'Invest Italia 26',codigo:'70319',eventId:8},
   {id:14,item:'Datacenters Italia 26',codigo:'70320',eventId:10},
   {id:15,item:'Biometano 27',codigo:'70321',eventId:null},
   {id:16,item:'Almacenamiento 27',codigo:'70322',eventId:null},
  ];
  return {v:STORE_VERSION,events,people,substages:subs,tasks,finance,weekly:[],projects,holidays:[],timesheets:[],timeclock:[],tcreports:[],eventaway:[],invoices:[],invalloc:[],delegates:[],codigos,tickets:[],logins:[],spxProps:[],spxLines:[],spxTargets:[],companyMap:[],spxEventReg:[],nextEvent:7,nextPerson:19,nextSub:sid,nextTask:tid};
}

/* ---- Supabase config: if URL set => shared cloud database + login; else local browser storage ---- */
const SUPABASE_URL='https://dxgvbufsifgowwfggvmr.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3ZidWZzaWZnb3d3Zmdndm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODM1OTUsImV4cCI6MjA5ODA1OTU5NX0.EDMWWjMuDM0jS0d0SwzdhuW_ZnHP0T0kqwL3xc6Cw-w';
const USE_SUPABASE=!!SUPABASE_URL;
let sb=null,_saveTimer=null,_syncing=false,_pendingSync=false,_remoteTimer=null,_lastId=0;
let _syncFails=0,_syncErr='',_syncRetryTimer=null;   // failed-sync retry state (audit Critical 3)
/* Fixed banner while an edit could not be saved: the data is still on this device and
   retries automatically. After 5 straight refusals (a permissions "no" is permanent,
   not transient) it offers discard-and-reload as an explicit user choice. */
function renderSyncBanner(){
  let b=document.getElementById('syncBanner');
  if(!_syncFails){if(b)b.remove();return;}
  if(!document.body)return;
  if(!b){b=document.createElement('div');b.id='syncBanner';
    b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#D32230;color:#fff;font:600 13px \'Segoe UI\',sans-serif;padding:10px 16px;text-align:center;box-shadow:0 -2px 8px rgba(0,0,0,.25)';
    document.body.appendChild(b);}
  b.innerHTML=_syncFails<5
    ?'⚠ A change could not be saved yet — retrying automatically. Keep this page open. <a href="#" id="syncRetry" style="color:#fff;text-decoration:underline">Retry now</a>'
    :'⚠ A change keeps being refused ('+esc(_syncErr)+'). It may not be allowed for your access level. <a href="#" id="syncRetry" style="color:#fff;text-decoration:underline">Try again</a> &nbsp;·&nbsp; <a href="#" id="syncDiscard" style="color:#fff;text-decoration:underline">Discard that change and reload</a>';
  const r=document.getElementById('syncRetry');if(r)r.onclick=e=>{e.preventDefault();DB.syncNow();};
  const d=document.getElementById('syncDiscard');if(d)d.onclick=e=>{e.preventDefault();if(confirm('Discard the unsaved change and reload the page?'))location.reload();};
}
window.addEventListener('online',()=>{if(_syncFails)DB.syncNow();});

/* per-entity tables; column whitelists = exactly what the app owns.
   Server-managed fields (updated_at/by, doneAt/By, deleted) are never pushed. */
const TABLES={events:'dc_events',people:'dc_people',substages:'dc_substages',tasks:'dc_tasks',finance:'dc_finance',weekly:'dc_weekly',projects:'dc_projects',holidays:'dc_holidays',timesheets:'dc_timesheets',timeclock:'dc_timeclock',tcreports:'dc_tcreports',eventaway:'dc_eventaway',invoices:'dc_invoices',invalloc:'dc_invoice_alloc',delegates:'dc_delegates',codigos:'dc_codigos',tickets:'dc_tickets',spxProps:'dc_spx_proposals',spxLines:'dc_spx_lines',spxTargets:'dc_spx_targets',companyMap:'dc_company_map',spxEventReg:'dc_spx_events',todos:'dc_todos',inbox:'dc_inbox',holmsgs:'dc_holiday_msgs'};
const COLS={
  events:['id','name','topic','pm','lead','sales','city','country','date','days','prov','milestones','alerts','dur','team','markers','kind','lanes'],
  people:['id','name','role','access','email','finance','hr','billing','salesLead','holidayDays','photo','phone','startDate'], // startDate tolerant (2-line SQL)
  substages:['id','eventId','lane','stage','name','order','week','span','type'],
  tasks:['id','eventId','lane','stage','substageId','title','assignee','deadline','status'],
  finance:['id','eventId','name','edition','year','semester','city','when','pm','sales','target','stretch','invoiced','spex','notes'],
  weekly:['id','eventCode','name','year','date','week','topicLeads','eventLeads','sponsorsN','sponsorsEur','spxAcc','delegatesN','ticketsEur','ticketsAcc','telesalesN','telesalesEur','grabacionesEur','siteVisitsEur','totalEur','soFarEur','target','stretch'],
  projects:['id','label','code','kind','sort','active',
    'eventId'], // board-event link for auto-created lines (dispatch_event_lines.sql)
  /* chargeYear = which holiday year these days come out of. Normally derived from the dates
     (Jan/Feb -> previous year), stored only when HR overrides it. Tolerant: stripped below
     if dispatch_hol_year.sql hasn't been run yet. */
  holidays:['id','personId','dateFrom','dateTo','workDays','note','status','log','type','replaces','chargeYear'],
  timesheets:['id','personId','week','hours'],
  timeclock:['id','personId','day','time','kind','manual','amends','reason','note','reportId'], // hash/created_* are server-set
  tcreports:['id','personId','day','entryId','thread','status','claim','ratify'], // claim/ratify tolerant (dispatch_hr11_claims.sql)
  eventaway:['id','personId','dateFrom','dateTo','title','note'], // "at an event" — away from the office
  /* Facturación: "eventId" in invalloc/delegates = dc_finance.id (the event-edition money
     row) — H2 26 / DC Italia 26 live only there, and it's the row the money must sum into. */
  invoices:['id','codigo_contable','producto','cantidad','tipo_pase','pase_cantidad','fecha','numero_factura','pedido','vencimiento','responsable_comercial','razon_social','importe_base','en_usd','importe_usd','usd_rate','usd_rate_date','iva_pct','iva_motivo','iva_importe','total_factura','descuento_pct','status','fecha_cobro','importe_cobrado','metodo_pago','comentarios','abono_de','entered_by',
    'spxProposalId'], // invoice ↔ contract link, set by Jesús in Facturación (dispatch_invoice_contract.sql)
  invalloc:['id','invoice_id','eventId','amount','passes','codigo','codigoId',
    'producto','tipo_pase','qty','price'], // Invoicing 2.0 line model (dispatch_invoicing2.sql)
  delegates:['id','eventId','source','invoice_id','sponsor_name','name','email','company','job_title','seller','crm_tagged','materials_sent','added_by','notes'],
  /* códigos = the item↔código-contable master Jesús maintains (item name + accounting
     code + optional link to a dc_finance event so RENMAD lines still roll into the € Dashboard) */
  codigos:['id','item','codigo','descripcion','eventId'],
  /* team request box: anyone opens tickets about the Dispatch Center itself
     (bug / usability / change / idea); admins triage (status + priority);
     the thread jsonb holds follow-up comments [{who,when,text|sys}] */
  tickets:['id','personId','area','type','title','description','status','priority','thread','created'],
  /* SPX sales module. camelCase keys map 1:1 to the quoted columns in dispatch_spx.sql.
     Server-managed (updated_at/by, deleted) never pushed; createdAt/createdBy are set on
     insert (by the Proposal Builder or the app) and echoed unchanged on edits. */
  spxProps:['id','createdAt','createdBy','responsable','responsableName','responsableEmail','company','companyId','source','origen','salesStatus','contents','valueEur','valueEdited','fechaEnvio','fechaSeguimiento','notas','contacts','fileName','sentLink','isGeneral','mode','active','superseded','supersededBy',
    'accountType','stage','productPackage','packageTier','reasonForLoss'], // Zoho-mirrored fields (dispatch_spx_zoho.sql) — salesStatus stays derived from stage
  spxLines:['id','parentId','eventId','eventKey','eventName','valueEur','valueEdited','contents'],
  spxTargets:['id','eventId','sponsorshipTarget','sponsorshipStretch','pasesTarget','pasesStretch','convByStatus'],
  companyMap:['id','canonicalName','marketingAliases','legalAliases','emailDomains','invoiceClientKey','confirmedBy','confirmedAt','status'],
  spxEventReg:['id','eventKey','name','financeId','sponsorshipTarget','sponsorshipStretch','pasesTarget','pasesStretch','convByStatus','active','sort'],
  /* personal to-dos (Me tab): each person sees ONLY their own (RLS) */
  todos:['id','personId','text','due','done','doneAt','sort','created'],
  /* notifications inbox (🔔): ticket answers, HR notices, alarms. kind = ticket|notice|holiday.
     personId = recipient; fromName = display name of the sender; isRead toggled by the recipient. */
  inbox:['id','personId','kind','text','link','isRead','fromName','created'],
  /* messages ON a holiday request. Approvers talk to each other here; the requester never
     sees those. toRequester=true flips a message into a note they DO see.
     personId = the REQUESTER (denormalised so the RLS policy stays a one-liner).
     Deliberately its own table, not a jsonb on dc_holidays: row-level security cannot hide
     one column of a row the requester is allowed to read. */
  holmsgs:['id','holidayId','personId','byName','text','toRequester','created'],
};
let _finReady=false,_weeklyReady=false,_hrReady=false,_tcReady=false,_eventReady=false,_billReady=false,_tickReady=false,_spxReady=false,_spxEvReady=false,_todoReady=false,_inboxReady=false,_holmsgReady=false; // optional tables (tolerant: app works without them)
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
      /* Projects split is tolerant: until the 2-line SQL adds kind/lanes to dc_events,
         never push those columns (PostgREST rejects unknowns) and flag the UI */
      window._extColsMissing=false;
      if(this.data.events.length && !('kind' in this.data.events[0])){
        window._extColsMissing=true;
        ['kind','lanes'].forEach(c=>{const i2=COLS.events.indexOf(c);if(i2>=0)COLS.events.splice(i2,1);});
      }
      /* startDate on people is tolerant the same way (1-line SQL adds it) */
      if(this.data.people.length && !('startDate' in this.data.people[0])){
        const i3=COLS.people.indexOf('startDate');if(i3>=0)COLS.people.splice(i3,1);
      }
      /* claims are tolerant too: until dispatch_hr11_claims.sql runs, never push
         claim/ratify (PostgREST rejects unknowns) and fall back to the old report
         form. Explicit probe — the table may legitimately have zero rows. */
      window._claimReady=true;
      try{const cp=await sb.from('dc_tcreports').select('claim').limit(1);if(cp.error)throw cp.error;}
      catch(e){window._claimReady=false;
        ['claim','ratify'].forEach(c=>{const i2=COLS.tcreports.indexOf(c);if(i2>=0)COLS.tcreports.splice(i2,1);});}
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
        /* holidays paged too: ~100+ rows/yr — the 1000-row cap would silently
           truncate balances in a few seasons (same trap as invoices/SPX) */
        const pagedHol=(async()=>{const out=[];let from=0,page=1000;
          for(;;){const r=await sb.from('dc_holidays').select('*').eq('deleted',false).order('id').range(from,from+page-1);
            if(r.error)throw r.error;out.push.apply(out,r.data||[]);
            if(!r.data||r.data.length<page)break;from+=page;}return out;})();
        const [pr,ho,ts]=await Promise.all([
          sb.from('dc_projects').select('*').eq('deleted',false).order('sort'),
          pagedHol,
          sb.from('dc_timesheets').select('*').eq('deleted',false).order('id')]);
        if(pr.error)throw pr.error;if(ts.error)throw ts.error;
        this.data.projects=pr.data||[];this.data.holidays=ho||[];this.data.timesheets=ts.data||[];
        _hrReady=true;
        /* tolerant like the events kind/lanes split: until dispatch_hol_year.sql adds
           chargeYear, never push the column (PostgREST rejects unknown columns).
           The Jan/Feb rule still works — it is derived from the dates. */
        window._holYearColMissing=false;
        if(this.data.holidays.length && !('chargeYear' in this.data.holidays[0])){
          window._holYearColMissing=true;
          const i2=COLS.holidays.indexOf('chargeYear');if(i2>=0)COLS.holidays.splice(i2,1);
        }
        /* event-line cascade is tolerant too: until dispatch_event_lines.sql adds
           dc_projects."eventId", never push it and skip the auto-project sweep
           (without the link column the dedupe cannot be trusted). */
        window._projEvReady=true;
        if(this.data.projects.length && !('eventId' in this.data.projects[0])){
          window._projEvReady=false;
          const i3=COLS.projects.indexOf('eventId');if(i3>=0)COLS.projects.splice(i3,1);
        }
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
      /* "at an event" away-days (tolerant — app runs fine before dispatch_hr8_events.sql) */
      this.data.eventaway=[];_eventReady=false;
      try{const er=await sb.from('dc_eventaway').select('*').eq('deleted',false).order('id');
        if(er.error)throw er.error;this.data.eventaway=er.data||[];_eventReady=true;
      }catch(e){console.warn('event-away module not ready:',e.message||e);}
      /* Facturación (invoices + allocations + delegates + código lookup): tolerant —
         the app runs fine before dispatch_facturacion.sql is applied */
      this.data.invoices=[];this.data.invalloc=[];this.data.delegates=[];this.data.codigos=[];_billReady=false;
      try{
        /* paged: Supabase caps selects at 1000 rows — invoices/allocs/delegates grow past
           that within a couple of seasons and the cap TRUNCATES SILENTLY (audit Critical 4) */
        const paged=async tbl=>{const out=[];let from=0,page=1000;
          for(;;){const r=await sb.from(tbl).select('*').eq('deleted',false).order('id').range(from,from+page-1);
            if(r.error)throw r.error;out.push.apply(out,r.data||[]);
            if(!r.data||r.data.length<page)break;from+=page;}return out;};
        const [iv,al,dg,cg]=await Promise.all([
          paged('dc_invoices'),paged('dc_invoice_alloc'),paged('dc_delegates'),paged('dc_codigos')]);
        this.data.invoices=iv;this.data.invalloc=al;this.data.delegates=dg;this.data.codigos=cg;
        _billReady=true;
        /* Invoicing 2.0 line columns are tolerant: until dispatch_invoicing2.sql runs,
           never push producto/tipo_pase/qty/price on alloc rows (PostgREST rejects
           unknown columns). Explicit probe — the table may legitimately be empty. */
        window._inv2Ready=true;
        try{const p2=await sb.from('dc_invoice_alloc').select('qty').limit(1);if(p2.error)throw p2.error;}
        catch(e){window._inv2Ready=false;
          ['producto','tipo_pase','qty','price'].forEach(c=>{const i2=COLS.invalloc.indexOf(c);if(i2>=0)COLS.invalloc.splice(i2,1);});}
      }catch(e){console.warn('facturación module not ready:',e.message||e);}
      /* team request box (tolerant — app runs fine before dispatch_tickets.sql) */
      this.data.tickets=[];_tickReady=false;
      try{const tk=await sb.from('dc_tickets').select('*').eq('deleted',false).order('id');
        if(tk.error)throw tk.error;this.data.tickets=tk.data||[];_tickReady=true;
      }catch(e){console.warn('requests module not ready:',e.message||e);}
      /* personal to-dos + notifications inbox (tolerant — run dispatch_me_inbox.sql to enable) */
      this.data.todos=[];_todoReady=false;
      try{const td=await sb.from('dc_todos').select('*').eq('deleted',false).order('sort');
        if(td.error)throw td.error;this.data.todos=td.data||[];_todoReady=true;
      }catch(e){console.warn('to-dos module not ready:',e.message||e);}
      this.data.inbox=[];_inboxReady=false;
      try{const ib=await sb.from('dc_inbox').select('*').eq('deleted',false).order('id',{ascending:false}).limit(400);
        if(ib.error)throw ib.error;this.data.inbox=ib.data||[];_inboxReady=true;
      }catch(e){console.warn('inbox module not ready:',e.message||e);}
      /* messages on holiday requests (tolerant — the app runs fine before dispatch_hol_msgs.sql).
         RLS already hides approver-only messages from the requester, so whatever comes back
         here is what this user is allowed to see. */
      this.data.holmsgs=[];_holmsgReady=false;
      try{const hm=await sb.from('dc_holiday_msgs').select('*').eq('deleted',false).order('id');
        if(hm.error)throw hm.error;this.data.holmsgs=hm.data||[];_holmsgReady=true;
      }catch(e){console.warn('holiday messages not ready:',e.message||e);}
      /* SPX sales module (proposals + lines + targets + company crosswalk): tolerant —
         the app runs fine before dispatch_spx.sql is applied */
      this.data.spxProps=[];this.data.spxLines=[];this.data.spxTargets=[];this.data.companyMap=[];_spxReady=false;
      try{
        /* paged like facturación — the proposal board already imports ~full seasons */
        const paged=async tbl=>{const out=[];let from=0,page=1000;
          for(;;){const r=await sb.from(tbl).select('*').eq('deleted',false).order('id').range(from,from+page-1);
            if(r.error)throw r.error;out.push.apply(out,r.data||[]);
            if(!r.data||r.data.length<page)break;from+=page;}return out;};
        const [sp,sl,stg,cm]=await Promise.all([
          paged('dc_spx_proposals'),paged('dc_spx_lines'),paged('dc_spx_targets'),paged('dc_company_map')]);
        this.data.spxProps=sp;this.data.spxLines=sl;this.data.spxTargets=stg;this.data.companyMap=cm;
        _spxReady=true;
      }catch(e){console.warn('SPX module not ready:',e.message||e);}
      /* SPX event registry (tolerant + separate: the board works before it exists, falling back to proposal-derived events) */
      this.data.spxEventReg=[];_spxEvReady=false;
      try{const er=await sb.from('dc_spx_events').select('*').eq('deleted',false).order('sort');
        if(er.error)throw er.error;this.data.spxEventReg=er.data||[];_spxEvReady=true;
      }catch(e){console.warn('SPX event registry not ready:',e.message||e);}
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
  save(){if(USE_SUPABASE){clearTimeout(_saveTimer);_saveTimer=setTimeout(()=>{_saveTimer=null;this.syncNow();},700);}else localStorage.setItem('dispatchStore',JSON.stringify(this.data));},
  /* save and WAIT for the database to confirm it. Use this behind any button that then
     tells the user their work is safe. The 700 ms debounce in save() is fine for incidental
     edits on a desktop, but a phone suspends timers the instant the app is backgrounded —
     so "Saved ✓" could appear on a write that never left the device, and the orphaned local
     edit then made applyRemote() reject the other device's version for good. */
  async saveNow(){
    if(!USE_SUPABASE){localStorage.setItem('dispatchStore',JSON.stringify(this.data));return true;}
    clearTimeout(_saveTimer);_saveTimer=null;
    /* if a sync is already in flight our rows would only be queued behind it — wait it out
       (briefly) so the answer we return is about OUR write, not someone else's */
    for(let i=0;i<40&&_syncing;i++)await new Promise(r=>setTimeout(r,50));
    return await this.syncNow();
  },
  /* diff vs the last-synced picture and write ONLY the touched rows:
     new rows -> insert, changed rows -> per-row update, vanished rows -> soft delete.
     Two people editing different rows no longer overwrite each other. */
  async syncNow(){
    if(!USE_SUPABASE||!sb)return true;
    if(_syncing){_pendingSync=true;return true;}
    _syncing=true;
    try{
      for(const k of Object.keys(TABLES)){
        if(k==='finance'&&!_finReady)continue; // finance table not created yet
        if(k==='weekly'&&!_weeklyReady)continue; // weekly table not created yet
        if((k==='projects'||k==='holidays'||k==='timesheets')&&!_hrReady)continue; // HR tables not created yet
        if((k==='timeclock'||k==='tcreports')&&!_tcReady)continue; // time clock tables not created yet
        if(k==='eventaway'&&!_eventReady)continue; // event-away table not created yet
        if((k==='invoices'||k==='invalloc'||k==='delegates'||k==='codigos')&&!_billReady)continue; // facturación tables not created yet
        if(k==='tickets'&&!_tickReady)continue; // requests table not created yet
        if(k==='todos'&&!_todoReady)continue; // to-dos table not created yet
        if(k==='inbox'&&!_inboxReady)continue; // inbox table not created yet
        if(k==='holmsgs'&&!_holmsgReady)continue; // holiday messages table not created yet
        if((((k==='spxProps'||k==='spxLines'||k==='spxTargets'||k==='companyMap')&&!_spxReady)||(k==='spxEventReg'&&!_spxEvReady)))continue; // SPX tables not created yet
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
      _syncFails=0;renderSyncBanner();          // success clears the not-saved banner
    }catch(e){
      /* audit Critical 3: do NOT reload — a reload discards every unsaved edit in
         this.data. Keep the edits (the shadow diff is untouched, so the very same
         rows retry), show a persistent banner, and retry with backoff. Only after
         repeated refusals (an RLS "not allowed" is permanent) does the banner offer
         "discard and reload" as an EXPLICIT choice — never automatic data loss. */
      console.error('sync failed',e);
      _syncFails++;_syncErr=String((e&&(e.message||e))||'unknown error');
      renderSyncBanner();
      if(!_syncRetryTimer)_syncRetryTimer=setTimeout(()=>{_syncRetryTimer=null;DB.syncNow();},Math.min(60,10*_syncFails)*1000);
      _syncing=false;
      if(_pendingSync){_pendingSync=false;}     // the scheduled retry covers it
      return false;
    }finally{_syncing=false;}
    if(_pendingSync){_pendingSync=false;this.syncNow();}
    return true;
  },
  newId(){let id=Date.now()*10+Math.floor(Math.random()*10);if(id<=_lastId)id=_lastId+1;_lastId=id;return id;},
  /* registro horario: insert the punch NOW, await the database's answer, and never
     lose it — on failure it goes to the pending queue (banner + auto-retry). */
  async punch(kind){
    const me=this.currentUser;if(!me)return {ok:false,msg:'not logged in'};
    /* Guard the record before writing to it (it is append-only — a bad punch is forever).
       A punch that lands BEFORE a punch already on the day is swallowed by the pairing and
       does nothing, so the button never changes and people keep clicking (Andrea, 15/07:
       an amendment filed an OUT at 15:00 on the wrong day → 12 dead clock-ins in 4 minutes).
       Refuse it loudly and point at HR instead of silently appending junk. */
    const _day=toISO(new Date()),_now=nowHMS(),_es=tcEffective(me.id,_day),_last=_es[_es.length-1];
    if(_last&&(_last.time||'')>_now){
      const msg='Your record already has a '+String(_last.kind).toUpperCase()+' at '+String(_last.time).slice(0,5)+
        ' today — later than right now, so clocking here would change nothing. Ask HR to correct the record (Me → “a punch is wrong”).';
      _punchAck={ok:false,kind,time:_now,msg,at:Date.now()};
      return {ok:false,blocked:true,msg};
    }
    if(_last&&_last.kind===kind){
      const msg='You are already clocked '+(kind==='in'?'in':'out')+' (since '+String(_last.time).slice(0,5)+').';
      _punchAck={ok:false,kind,time:_now,msg,at:Date.now()};
      return {ok:false,blocked:true,msg};
    }
    const row={id:this.newId(),personId:me.id,day:_day,time:_now,kind,manual:false,amends:null,reason:null,note:null,reportId:null};
    if(!USE_SUPABASE){this.timeclock.push(row);this.save();_punchAck={ok:true,kind,time:row.time,at:Date.now()};return {ok:true,row};}
    try{
      const {error}=await sb.from('dc_timeclock').insert([pickRow(row,'timeclock')]);
      if(error)throw error;
      this.data.timeclock.push(row);
      if(_shadow&&_shadow.timeclock)_shadow.timeclock[row.id]=JSON.stringify(pickRow(row,'timeclock'));
      _punchAck={ok:true,kind,time:row.time,at:Date.now()};
      return {ok:true,row};
    }catch(e){
      console.error('punch failed',e);
      const q=pendingPunches();q.push(pickRow(row,'timeclock'));setPendingPunches(q);
      _punchAck={ok:false,kind,time:row.time,msg:(e.message||''+e),at:Date.now()};
      return {ok:false,row,msg:e.message||''+e};
    }
  },
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
  get eventaway(){return this.data.eventaway||[];},
  eventReady(){return !USE_SUPABASE||_eventReady;},
  /* ---- Facturación (billing engine) ----
     The billing key space is dc_finance.id (event-edition money row): allocations and
     delegates carry "eventId" = dc_finance.id. Event pages resolve it via financeFor(). */
  get invoices(){return this.data.invoices||[];},
  get invoiceAllocs(){return this.data.invalloc||[];},
  get delegates(){return this.data.delegates||[];},
  get codigos(){return this.data.codigos||[];},
  billReady(){return !USE_SUPABASE||_billReady;},
  /* billing editor = the external invoicing freelancer (billing tick, provisioned by Belén)
     or an admin. Mirrors dc_can_bill() in SQL. Separate from the finance flag — Jesús
     keeps editing the € figures exactly as today. */
  canBill(){return !!(this.currentUser&&(this.currentUser.billing||this.currentUser.access==='admin'));},
  /* ---- team request box (tickets about the Dispatch Center itself) ---- */
  get tickets(){return this.data.tickets||[];},
  tickReady(){return !USE_SUPABASE||_tickReady;},
  /* personal to-dos + notifications inbox */
  get todos(){return this.data.todos||[];},
  todoReady(){return !USE_SUPABASE||_todoReady;},
  get inbox(){return this.data.inbox||[];},
  inboxReady(){return !USE_SUPABASE||_inboxReady;},
  get holmsgs(){return this.data.holmsgs||[];},
  holmsgReady(){return !USE_SUPABASE||_holmsgReady;},
  /* who may open the 🌴 HR page at all: Belén + the HR tick + finance (Jesús — he only
     gets the Allocation-admin sections there; the page itself sub-gates the rest) */
  canSeeHR(){return !!(this.currentUser&&(this.isHRAdmin()||this.isHR()||this.canFinance()));},
  /* ---- SPX sales module (sponsorship proposals + health-check + reporting) ----
     Board reads: whole roster. Writes gated to mirror the RLS in dispatch_spx.sql. */
  get spxProps(){return this.data.spxProps||[];},
  get spxLines(){return this.data.spxLines||[];},
  get spxTargets(){return this.data.spxTargets||[];},
  get companyMap(){return this.data.companyMap||[];},
  get spxEventReg(){return this.data.spxEventReg||[];},
  spxReady(){return !USE_SUPABASE||_spxReady;},
  spxLinesFor(parentId){return this.spxLines.filter(l=>l.parentId==parentId);},
  spxTargetFor(finId){return this.spxTargets.find(t=>t.eventId==finId)||null;},
  /* sales lead (Cintia) or admin (Belén): edits ANY proposal + targets + crosswalk. Mirrors dc_can_sales_lead(). */
  canSalesLead(){return !!(this.currentUser&&(this.currentUser.salesLead||this.currentUser.access==='admin'));},
  /* who may CREATE proposals — Sales/Lead roles, admins, the sales lead. Mirrors dc_is_sales(). */
  isSales(){const u=this.currentUser;return !!(u&&(u.role==='Sales'||u.role==='Lead'||u.access==='admin'||u.salesLead));},
  /* may this user edit THIS proposal? own (by responsable email) OR sales lead/admin. Mirrors the RLS UPDATE policy. */
  canEditProp(p){if(this.canSalesLead())return true;const u=this.currentUser;return !!(u&&p&&(''+(p.responsableEmail||'')).toLowerCase()===(''+(u.email||'')).toLowerCase());},
  invoice(id){return this.invoices.find(i=>i.id==id);},
  /* item↔código master lookups (Jesús's mini-BD) */
  codigoById(id){return id?this.codigos.find(c=>c.id==id):null;},
  codigoForEvent(finId){return (finId!=null&&finId!=='')?this.codigos.find(c=>c.eventId==finId):null;},
  allocsFor(invoiceId){return this.invoiceAllocs.filter(a=>a.invoice_id==invoiceId);},
  invoicesFor(finId){const ids={};this.invoiceAllocs.forEach(a=>{if(a.eventId==finId)ids[a.invoice_id]=1;});return this.invoices.filter(i=>ids[i.id]);},
  delegatesFor(finId){return this.delegates.filter(d=>d.eventId==finId);},
  /* the event's facturado = SUM of its invoice allocations (paid + unpaid; cancelled
     invoices excluded). null when the event has no lines yet → caller falls back. */
  invoicedTotal(finId){let sum=0,any=false;
    this.invoiceAllocs.forEach(a=>{if(a.eventId!=finId)return;const inv=this.invoice(a.invoice_id);
      if(!inv||inv.status==='cancelado')return;any=true;sum+=(+a.amount||0);});
    return any?sum:null;},
  /* what the money views show: invoice-line total when lines exist, else the typed
     dc_finance.invoiced (fallback for past events / before back-fill) */
  finInvoiced(f){if(!f)return null;const t=this.billReady()?this.invoicedTotal(f.id):null;return t==null?f.invoiced:t;},
  /* HR admin = Belén + the HR tick (Jesús). Deliberately NOT every events admin. */
  isHRAdmin(){const u=this.currentUser;return !!(u&&(u.hr||(u.email||'').toLowerCase()==='belen.gallego@ata.email'));},
  isAdmin(){return !!(this.currentUser&&this.currentUser.access==='admin');},
  canManage(){return !!(this.currentUser&&(this.currentUser.access==='admin'||this.currentUser.access==='manager'));},
  /* who may CREATE / retire the hour-allocation project numbers: Belén, Carlos and
     Jesús (accounting). Mirrors dc_can_finance() in SQL = admin OR finance flag, so
     the client shows the panel to exactly whom the server-side RLS will let write. */
  canManageProjects(){const u=this.currentUser;return !!(u&&(u.access==='admin'||u.finance));},
  /* ---------- event → allocation-line cascade (Belén, 2026-07-17) ----------
     The moment an event exists, its two "allocation" lines exist too:
     an invoicing ITEM in dc_codigos and an hour-allocation PROJECT in
     dc_projects — both with the accounting code left PENDING for Jesús to
     fill when accounting assigns it. So nobody is ever unable to log hours
     or raise an invoice against a new event. Only CURRENT-or-future events
     are swept (historic editions stay out of the curated lists). */
  evCleanName(ev){return (''+(ev.name||'')).replace(/^E\d+\s*RENMAD\s*/i,'').trim();},
  ensureEventLines(){
    const out={items:0,projects:0,adopted:0};
    const curYear=new Date().getFullYear();
    /* invoicing items: one per Money row (dc_finance) of this year or later */
    if(this.canBill()&&this.billReady()){
      this.finance.forEach(f=>{
        if((+f.year||0)<curYear)return;
        if(this.codigos.some(c=>c.eventId==f.id))return;
        const label=((f.name||'?')+' '+(f.year?(''+f.year).slice(-2):'')).trim();
        this.codigos.push({id:this.newId(),item:label,codigo:'',descripcion:'auto — created with the event',eventId:f.id});
        out.items++;
      });
    }
    /* hour projects: one per board event of this year or later (needs the eventId column) */
    if(this.canManageProjects()&&window._projEvReady!==false){
      const pad2=n=>(''+n).length<2?'0'+n:(''+n);
      this.events.forEach(ev=>{
        const d=ev.date?ymd(ev.date):null;
        if(!d||d.getFullYear()<curYear)return;
        if(this.projects.some(p=>p.eventId==ev.id))return;
        const clean=this.evCleanName(ev),yy=(''+d.getFullYear()).slice(-2);
        const wanted=(clean+' '+yy).toLowerCase();
        /* adopt a hand-made project whose label already names this event (no duplicates) */
        const match=this.projects.find(p=>!p.kind&&p.eventId==null&&(''+(p.label||'')).replace(/^\d+\.\s*/,'').trim().toLowerCase()===wanted);
        if(match){match.eventId=ev.id;out.adopted++;return;}
        const sort=Math.max(0,...this.projects.map(p=>p.sort||0))+1;
        this.projects.push({id:this.newId(),label:pad2(sort)+'. '+clean+' '+yy,code:null,kind:null,sort,active:true,eventId:ev.id});
        out.projects++;
      });
    }
    this.syncEventCodes();
    return out;
  },
  /* one fill covers both registers: a código set on an event's invoicing item
     flows to its blank hour-project code, and vice versa. Only ever fills
     BLANKS — a code someone typed is never overwritten. */
  syncEventCodes(){
    let n=0;
    this.finance.forEach(f=>{
      if(f.eventId==null)return; // Money row not linked to a board event
      const item=this.codigos.find(c=>c.eventId==f.id);
      const proj=this.projects.find(p=>p.eventId==f.eventId);
      if(!item||!proj)return;
      if(item.codigo&&!proj.code){proj.code=item.codigo;n++;}
      else if(proj.code&&!item.codigo){item.codigo=proj.code;n++;}
    });
    return n;
  },
  /* admins & managers set any status; members set the status of their OWN tasks
     (all of this is also enforced server-side by row-level security) */
  canEditStatus(t){if(this.canManage())return true;return !!(t&&this.currentUser&&t.assignee==this.currentUser.id);},
};
function personByEmail(email){if(!email)return null;email=(''+email).toLowerCase();return DB.people.find(p=>(p.email||'').toLowerCase()===email)||null;}
/* delegate row colour — DERIVED, never stored: yellow = a reserved pass with no name yet,
   red = linked invoice not paid, white = paid (or no invoice: speakers/freebies/manual). */
function delegateState(d){
  if(!((d.name||'').trim()))return {key:'unnamed',bg:'#FFF3C4',label:'pass reserved — delegate name missing'};
  if(d.invoice_id){const inv=DB.invoice(d.invoice_id);
    if(inv&&inv.status==='cancelado')return {key:'cancelled',bg:'#F8D7D7',label:'invoice CANCELLED'};
    if(inv&&inv.status!=='pagado')return {key:'unpaid',bg:'#F8D7D7',label:'invoice not paid yet'};}
  return {key:'ok',bg:'#fff',label:''};
}
const PRODUCTOS=['sponsorship','tickets','ata','webinar','abono','comisiones','upgrade','sitevisits','grabaciones','refacturacion'];
const PRODUCTO_LABEL={sponsorship:'Sponsorship',tickets:'Tickets',ata:'ATA',webinar:'Webinar',abono:'Credit note',comisiones:'Commissions',upgrade:'Upgrade',sitevisits:'Site Visits',grabaciones:'Recordings',refacturacion:'Refacturación'};
const TIPO_PASES={single:1,double:2,triple:3,quad:4};
const INV_STATUS={pagado:'Paid',no_pagado:'Unpaid',cancelado:'Cancelled',abono:'Credit note'};
const IVA_MOTIVOS=['exempt','not subject','reverse charge (ISP)','export'];
/* label used by the Facturación event picker & delegate lists: the dc_finance row */
function finLabel(f){return (f.name||'?')+' '+(f.year||'')+(f.city?' · '+f.city:'');}

/* ---- realtime: colleagues' edits appear without reloading ---- */
function subscribeRealtime(){
  try{
    const ch=sb.channel('dc-sync');
    Object.keys(TABLES).forEach(k=>{
      if(k==='finance'&&!_finReady)return;
      if(k==='weekly')return; // bulk table, no realtime — dashboard reloads on demand
      if((k==='projects'||k==='holidays'||k==='timesheets')&&!_hrReady)return;
      /* timesheets ARE live. They used to be skipped as "own-row edits, no realtime needed",
         but the row's owner is exactly who edits it twice: allocation filled on the laptop
         never reached the phone (and vice versa), because nothing told the other device. */
      if(k==='holmsgs'&&!_holmsgReady)return;
      if(k==='timeclock')return; // append-only, reloaded on demand
      if(k==='tcreports'&&!_tcReady)return;
      if(k==='eventaway'&&!_eventReady)return;
      if((k==='invoices'||k==='invalloc'||k==='delegates'||k==='codigos')&&!_billReady)return;
      if(k==='tickets'&&!_tickReady)return;
      if((((k==='spxProps'||k==='spxLines'||k==='spxTargets'||k==='companyMap')&&!_spxReady)||(k==='spxEventReg'&&!_spxEvReady)))return;
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
/* a colleague's live edit must NOT wipe a form the user is halfway through
   filling. If they're typing in a field, hold the re-render until they leave it. */
let _remotePending=false;
function userIsTyping(){const a=document.activeElement;return !!(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT')&&a.type!=='button'&&a.type!=='checkbox'&&a.type!=='radio');} // SELECT too — a re-render mid-pick wiped half-filled forms
function scheduleRemoteRender(){
  clearTimeout(_remoteTimer);
  _remoteTimer=setTimeout(function tick(){
    if(userIsTyping()){_remotePending=true;_remoteTimer=setTimeout(tick,800);return;} // keep waiting while they type
    _remotePending=false;
    window.dispatchEvent(new Event('dc-remote'));
  },250);
}
/* also catch the moment they leave a field (instant on real browsers) */
document.addEventListener('focusout',()=>{setTimeout(()=>{if(_remotePending&&!userIsTyping()){_remotePending=false;clearTimeout(_remoteTimer);window.dispatchEvent(new Event('dc-remote'));}},0);});

function cdnFailBanner(what){
  const b=document.createElement('div');
  b.style.cssText='background:#D32230;color:#fff;padding:10px 16px;font:13px Segoe UI,system-ui,sans-serif;text-align:center';
  b.innerHTML='⚠ Could not load '+esc(what)+' — check your internet connection or firewall, then <a href="#" onclick="location.reload();return false" style="color:#fff;font-weight:700">reload</a>.';
  document.body.prepend(b);
}
function injectSB(){return new Promise((res,rej)=>{if(window.supabase)return res();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=res;s.onerror=()=>{cdnFailBanner('the app engine (Supabase)');rej(new Error('Supabase library failed to load'));};document.head.appendChild(s);});}
/* resilience: pages restored from the back/forward cache re-initialise cleanly */
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
/* An installed app on a phone is not reloaded when you come back to it — it is resumed,
   with whatever it rendered days ago still on screen and its realtime socket long dead.
   Trusting that stale picture is how allocation got overwritten from the other device.
   So: if we were in the background for more than a couple of minutes, start fresh. */
(function(){
  const STALE_MS=120000;let hiddenAt=0;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();return;}
    if(!hiddenAt)return;
    const away=Date.now()-hiddenAt;hiddenAt=0;
    if(away<STALE_MS)return;
    if(_saveTimer||_syncing||_syncFails)return;   // an edit is still in flight or queued for retry — don't discard it
    if(typeof userIsTyping==='function'&&userIsTyping())return;
    if(pendingPunches().length)return;            // unsent punches must flush first
    location.reload();
  });
})();
/* don't let a navigation swallow an edit still waiting in the 700 ms sync window */
window.addEventListener('beforeunload',e=>{if(_saveTimer||_syncing||_syncFails){e.preventDefault();e.returnValue='';}});
/* ---- page-crash alarm (20 Jul 2026 lesson) ----
   A JS crash used to die silently and could leave a half-wired page that LOOKS fine
   (buttons drawn but no handlers attached — the Monday clock-in outage). Any uncaught
   error or promise rejection now raises a visible bar so a broken page says so. */
let _jsErrShown=false;
function showJsErrBar(msg){
  if(_jsErrShown)return;
  const put=()=>{ if(_jsErrShown)return;_jsErrShown=true;
    try{
      const d=document.createElement('div');d.id='dcJsErrBar';
      d.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#8E1B26;color:#fff;padding:9px 16px;font:13px Segoe UI,system-ui,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 -2px 10px rgba(0,0,0,.3)';
      d.innerHTML='<b>⚠ Something broke on this page</b>'+
        '<span style="opacity:.9">Some buttons or panels may not respond. Reload usually fixes it — if it keeps happening, file a 💡 Request.</span>'+
        '<span style="opacity:.6;font-size:11.5px;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+String(msg||'').replace(/</g,'&lt;')+'</span>'+
        '<button id="dcJsErrReload" style="margin-left:auto;background:#fff;color:#8E1B26;border:none;border-radius:7px;padding:5px 12px;font-weight:700;cursor:pointer;font:inherit">Reload</button>';
      document.body.appendChild(d);
      document.getElementById('dcJsErrReload').onclick=()=>location.reload();
    }catch(e){}
  };
  if(document.body)put();else document.addEventListener('DOMContentLoaded',put);
}
window.addEventListener('error',e=>{
  const m=(e&&e.message)||'';
  if(/ResizeObserver loop/.test(m))return;   // benign browser noise, not a crash
  showJsErrBar(m+(e&&e.filename?' — '+String(e.filename).split('/').pop()+':'+e.lineno:''));
});
window.addEventListener('unhandledrejection',e=>{
  const r=e&&e.reason,m=(r&&(r.message||String(r)))||'';
  if(!m||/AbortError/.test(m))return;        // aborted fetches on navigation are normal
  showJsErrBar(m);
});
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
  try{const r=DB.ensureEventLines();if(r&&(r.items||r.projects||r.adopted))DB.save();}catch(e){} // event → item/project cascade (writes only for Belén/Jesús-level logins)
  try{const nc=document.getElementById('nav-crm');if(nc&&isBelenP(DB.currentUser))nc.style.display='';}catch(e){} // CRM tab: Belén only (invoicing now opens from inside Money)
  try{const nh=document.getElementById('nav-hr');if(nh&&DB.canSeeHR())nh.style.display='';}catch(e){} // HR tab: Belén + HR + Jesús (allocations) — everyone else's personal stuff lives in Me
  renderFn();
  try{decorateNav();}catch(e){} // alarm badges on the nav (holiday approvals / missing hours)
  try{injectTicketFab();}catch(e){} // the "💡 Request" button on every page
  try{recordLogin();}catch(e){} // device-visibility row (1/person/device/day, Belén-only read)
  try{renderPunchBanner();flushPendingPunches();}catch(e){} // recover punches that failed to save last time
  try{if(_breakTimer)clearInterval(_breakTimer);breakReminderTick();_breakTimer=setInterval(breakReminderTick,60000);}catch(e){} // break nudge on any page
  try{spxTouchpointAlarms();}catch(e){} // ⏰ my overdue SPX touchpoints → my inbox (any page)
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
  // RETIRED 2026-07-13: the Proposals Dashboard is reborn as the 💼 SPX page's Reporting tab
  // (backoffice.py stays in the proposal_builder repo, unlinked). Tile removed from Tools.
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
  if(t.dcAuth&&token){
    add('dc_token='+encodeURIComponent(token));
    /* the refresh token lets the tool mint a FRESH access token at write time —
       without it, a builder session open >1h writes with a dead token and the
       proposal is lost (audit: builder record-loss path #3) */
    if(window._dcRefresh)add('dc_refresh='+encodeURIComponent(window._dcRefresh));
  }
  return u;
}
/* current Supabase access token (for dcAuth tool embeds); '' in local mode.
   Also stashes the session's refresh token for toolEmbedUrl. */
async function dcToken(){
  if(!USE_SUPABASE||!sb)return '';
  try{const {data:{session}}=await sb.auth.getSession();
    window._dcRefresh=(session&&session.refresh_token)||'';
    return (session&&session.access_token)||'';}
  catch(e){return '';}
}
function navBar(active){
  /* .navlinks is display:contents on desktop (renders exactly as before);
     on phones the burger shows and the links drop down as a menu */
  return '<div class="nav" id="dcNav"><button class="navburger" aria-label="Menu" onclick="document.getElementById(\'dcNav\').classList.toggle(\'open\')">☰ Menu</button>'+
         '<div class="navlinks" onclick="document.getElementById(\'dcNav\').classList.remove(\'open\')">'+
         '<a href="home.html" id="nav-home" style="white-space:nowrap" class="'+(active==='home'?'on':'')+'" title="Your day: clock, hours, to-dos, holidays — everything personal">🙋 Me</a>'+
         '<a href="gantt.html" style="white-space:nowrap" class="'+(active==='overview'?'on':'')+'">📅 Projects</a>'+
         '<a href="people.html" style="white-space:nowrap" class="'+(active==='people'?'on':'')+'" title="The roster + the team holiday calendar">👥 Team</a>'+
         '<a href="dashboard.html" style="white-space:nowrap" class="'+(active==='dashboard'||active==='fact'?'on':'')+'" title="Everything money — Invoicing and Reporting">💶 Money</a>'+
         '<a href="spx.html" id="nav-spx" style="white-space:nowrap" class="'+(active==='spx'?'on':'')+'" title="Sponsorship sales — proposals, health-check, reporting">💼 SPX</a>'+
         '<a href="impact.html" style="white-space:nowrap" class="'+(active==='impact'?'on':'')+'">📣 Impact</a>'+
         '<a href="hr.html" id="nav-hr" style="white-space:nowrap;display:none" class="'+(active==='hr'?'on':'')+'" title="Managing the team’s time — Belén &amp; HR (Jesús: allocations)">🌴 HR</a>'+
         '<a href="tools.html" id="nav-tools" style="white-space:nowrap" class="'+(active==='tools'||active==='tickets'?'on':'')+'" title="Team tools — the Requests box lives here too">🧰 Tools</a>'+
         '<a href="crm.html" id="nav-crm" style="white-space:nowrap;display:none" class="'+(active==='crm'?'on':'')+'" title="Leads CRM — private, only Belén sees this tab">📇 CRM</a>'+
         '<a href="inbox.html" id="nav-inbox" style="white-space:nowrap" class="'+(active==='inbox'?'on':'')+'" title="Notifications — answers to your requests, team notices, time-off decisions">🔔</a>'+
         '</div><span class="brandlet">RENMAD <b>Dispatch Center</b>'+
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
function loadXLSX(cb){if(window.XLSX)return cb();const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=cb;s.onerror=()=>alert('Could not load the Excel component (check your connection / firewall). Please try again.');document.head.appendChild(s);}
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
