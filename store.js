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
const ROLES=['Lead','PM','Sales','Marketing','Logistics','Admin','HR','Accounts'];
/* access tiers (permission level, separate from job role): member = own lane; manager = stage/release; admin = everything */
/* task-status colours. Lifted out of home.html on 6 Aug 2026 so the shared task list
   (🙋 Me and 👥 Team) can use them — it was the only page that owned them.
   The two legacy keys stay as a fallback: a browser holding a cached row from before
   the migration must still render a colour rather than a blank chip. */
const STCOL={'Assigned':'#FF4A00','Pending':'#9AA0A8','Done':'#3E8C28','Cancelled':'#b9b6ad',
             'To do':'#9AA0A8','In progress':'#9AA0A8'};
const ACCESS=['member','manager','admin'];
const ACCESS_LABEL={member:'Member',manager:'Manager',admin:'Admin (full)'};
/* ================= THE FOUR TASK STATES (Belén, 6 Aug 2026) =================
   Assigned  — it is yours and you have not looked at it yet. Fires the "assigned to
               you" message; flips to Pending automatically the moment you open it, so
               it is never a chore.
   Pending   — unowned, or seen and live on your runway.
   Done      — finished.
   Cancelled — decided against, with a reason. NOT the same as deleting: delete means
               "this should not exist", cancel means "we decided not to do this", and
               the second one is worth keeping on the record.
   "In progress" was removed. It had no consequence — nothing behaved differently — so
   nobody maintained it: 1 task in 116, by one person, in a month. Belén: "if you change
   status you change it to done, so what is to do after changing status?"
   ORDER MATTERS: this array is the dropdown. */
const STATUS=['Assigned','Pending','Done','Cancelled'];
const STATUS_LIVE=['Assigned','Pending'];        // "open" — still to be done
/* legacy rows (pre-migration caches) read as Pending so nothing falls off a list */
function taskStatus(t){const s=(t&&t.status)||'Pending';
  return (s==='To do'||s==='In progress')?'Pending':s;}
function taskLive(t){return STATUS_LIVE.indexOf(taskStatus(t))>=0;}
function taskDone(t){return taskStatus(t)==='Done';}
function taskCancelled(t){return taskStatus(t)==='Cancelled';}
/* ---- the runway (Belén: "X tasks 2 weeks away, 1 week away and then days") ----
   A task can sit in the books for months before its deadline, so a flat list of
   everything open is noise — Julián's would open on 90 rows. The bands make the list
   finishable: everything past two weeks collapses to a single number and only
   surfaces as it climbs. */
function taskDueDate(t){return (t&&t.deadline)?ymd(t.deadline):taskDate(t);}
function taskDaysAway(t){
  const d=taskDueDate(t);if(!d)return 9999;
  const a=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const n=new Date();const b=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  return Math.round((+a-+b)/86400000);
}
const TASK_BANDS=[
  {key:'overdue',label:'Overdue',    color:'#D32230', test:d=>d<0},
  {key:'today',  label:'Today',      color:'#FF4A00', test:d=>d===0},
  {key:'days',   label:'In days',    color:'#C77800', test:d=>d>=1&&d<=6},
  {key:'week1',  label:'1 week away',color:'#B08900', test:d=>d>=7&&d<=13},
  {key:'week2',  label:'2 weeks away',color:'#7c7c78',test:d=>d>=14&&d<=20},
  {key:'later',  label:'Further out',color:'#a9a79f', test:d=>d>=21},
];
function taskBand(t){const d=taskDaysAway(t);return TASK_BANDS.find(b=>b.test(d))||TASK_BANDS[TASK_BANDS.length-1];}
/* group a person's live tasks into the bands, soonest first within each */
function taskRunway(personId){
  const out={};TASK_BANDS.forEach(b=>out[b.key]=[]);
  DB.tasksOf(personId).filter(taskLive).forEach(t=>out[taskBand(t).key].push(t));
  Object.keys(out).forEach(k=>out[k].sort((a,b)=>taskDaysAway(a)-taskDaysAway(b)));
  return out;
}
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
/* ---------------- THE VENUE CHECKLIST every event is born with ----------------
   Valeria's list, sent 6 Aug 2026 15:04, translated to English (the rulebook: team-wide
   surfaces are English). Loaded into an event the first time its Venue tab is opened, so
   the lines that are always there — there is always a screen — are already waiting; each
   one deletes with a single ×, and new categories and items are added at any time.
   Interpretation appears twice ON PURPOSE and that is not a mistake: the BOOTHS are an AV
   line item, the INTERPRETER is a supplier. Whether the interpreter should be its own
   category is still open — logistics said they'd think about it (in Spain it is contracted
   and paid separately; in many countries the AV company brings them). */
const VENUE_DEFAULTS=[
  {name:'Venue',              items:['Venue','Special rate','Dinner','Networking drinks']},
  {name:'AV',                 items:['Screen / projector','Microphones','Video production','Audio recording','Comfort screen','Interpretation booths','Wifi']},
  {name:'Materials & branding',items:['Banners / roll-up (event)','Banners / roll-up (sponsors)','Bottles','Badges','Notebooks','Lanyards','Printed photocall','Table signs','QR codes']},
  {name:'Tech',               items:['Registration QR','Event app','Slido']},
  {name:'Suppliers',          items:['Photography','Interpretation']},
  {name:'Other',              items:['Awards','Sponsored pre-registration','Raffle tickets']},
];
/* An EXTERNAL project writes its OWN phases — Cristina's request of 17 Jul 2026: a
   non-RENMAD job must not inherit speaker recruitment, prospecting, venue sourcing & co.
   ev.stages = {lane:[{key,name,color,d}]}, edited on the project's own page.
   Two differences from a RENMAD event:
     · phases run FORWARD from the start date (a project starts and runs; an event
       counts backwards from the day it happens);
     · until she edits them, a project shows ONE neutral phase per lane covering its own
       duration — so nothing RENMAD-shaped ever appears on the Projects tab. */
const EXT_COLORS={project:'#A9CBEE',marketing:'#FFC9A3',sales:'#BFE0A0',logistics:'#F2D86E'};
function extDefaultStages(ev,lane){
  const wks=Math.max(1,Math.ceil((+(ev&&ev.days)||1)/7));
  return [{key:'phase1',name:'Phase 1',color:EXT_COLORS[lane]||'#A9CBEE',d:wks,phase:'ext'}];
}
function evStages(ev,lane){
  if(evKind(ev)==='external'){
    const st=ev&&ev.stages&&ev.stages[lane];
    return (Array.isArray(st)&&st.length)?st:extDefaultStages(ev,lane);
  }
  return STAGES[lane]||[];
}
/* the three lookups take the event when the caller has it (external phases live on it);
   without it they fall back to the RENMAD catalogue, which is what every old call meant */
function stageList(lane,ev){return ev?evStages(ev,lane):(STAGES[lane]||[]);}
function stageColor(lane,key,ev){const s=stageList(lane,ev).find(s=>s.key===key);return s?s.color:'#b4b2a9';}
/* ---- per-event stage overrides (dc_stages, 6 Aug 2026) ----
   Three things a team can now change about a stage on THEIR event without touching the
   catalogue every event is born with: where it starts, how wide it is, what it is called.
   Belén's warning to logistics: a NEW event is still created with the default names, so
   if a stage should always be called something else, say so and the default changes. */
function stageLayOf(ev,lane,key){
  try{return (ev&&typeof DB!=='undefined'&&DB.stageLayFor)?DB.stageLayFor(ev.id,lane,key):null;}catch(e){return null;}
}
function stageName(lane,key,ev){
  const L=stageLayOf(ev,lane,key);if(L&&L.name)return L.name;
  const s=stageList(lane,ev).find(s=>s.key===key);return s?s.name:key;}
function stageDef(lane,key,ev){return stageList(lane,ev).find(s=>s.key===key);}
function stageDur(ev,lane,s){
  const L=stageLayOf(ev,lane,s.key);if(L&&L.dur!=null)return Math.max(1,+L.dur||1);
  const o=(ev&&ev.dur&&ev.dur[lane])||{};return Math.max(1,+(o[s.key]||s.d)||1);}
/* where a stage's left edge sits, in weeks before the event. null = chain it behind the
   one before it, the way every event has worked until now. */
function stageStart(ev,lane,key){const L=stageLayOf(ev,lane,key);return (L&&L.start!=null)?+L.start:null;}
/* shared timeline layout — both overview & event page call this, so they always mirror */
function laneTotalPre(ev,lane){
  const pre=evStages(ev,lane).filter(s=>s.phase==='pre');
  let total=pre.reduce((a,s)=>a+stageDur(ev,lane,s),0);
  /* a stage dragged backwards can reach further than the plain chain — the board has to
     be wide enough to show it, or it would render off the left edge */
  pre.forEach(s=>{const st=stageStart(ev,lane,s.key);if(st!=null)total=Math.max(total,st);});
  return total;}
/* how far a project reaches AFTER its start week — external only; RENMAD post-stages are
   already covered by the fixed right-hand margins on both boards */
function postExtent(ev){if(evKind(ev)!=='external')return 0;
  let m=0;evLanes(ev).forEach(l=>{m=Math.max(m,evStages(ev,l).reduce((a,s)=>a+stageDur(ev,l,s),0));});return m;}
function preExtent(ev){let m=0;evLanes(ev).forEach(l=>m=Math.max(m,laneTotalPre(ev,l)));
  if(evKind(ev)==='external')return Math.max(m,4); // external: no milestone/discount machinery — runway = its own lanes
  return Math.max(m,ev.milestones.goNoGo,ev.milestones.launch,ev.alerts.LD.off,ev.alerts.SE.off,ev.alerts.EB.off,ev.alerts.LC.off);}
function layLane(ev,lane,evIdx){
  const sts=evStages(ev,lane),dur=(ev.dur&&ev.dur[lane])||{};const bars=[];
  if(evKind(ev)==='external'){ // phases chain forward from the start week
    let cur=evIdx;sts.forEach(s=>{const d=stageDur(ev,lane,s);bars.push({s,x:cur,w:d});cur+=d;});
    return bars;
  }
  /* A stage with its own start jumps there; the ones after it chain on from where it
     actually landed, so pulling Materials in close to the event takes the stages behind
     it along instead of leaving them overlapping. GAPS are allowed now (a stage can
     genuinely not have started yet) — an OVERLAP never is, so each stage is floored at
     the end of the one before it. The first stage has nothing before it and is therefore
     free to reach as far back as it likes. */
  const pre=sts.filter(s=>s.phase==='pre');
  let cur=evIdx-pre.reduce((a,s)=>a+stageDur(ev,lane,s),0), prevEnd=null;
  pre.forEach(s=>{const d=stageDur(ev,lane,s);const st=stageStart(ev,lane,s.key);
    let x=(st!=null)?(evIdx-st):cur;
    if(prevEnd!=null&&x<prevEnd)x=prevEnd;
    bars.push({s,x:x,w:d});prevEnd=x+d;cur=x+d;});
  const evs=sts.find(s=>s.phase==='event');if(evs){bars.push({s:evs,x:evIdx,w:stageDur(ev,lane,evs)});}
  let c2=evIdx+(evs?stageDur(ev,lane,evs):1);
  sts.filter(s=>s.phase==='post').forEach(s=>{const d=stageDur(ev,lane,s);bars.push({s,x:c2,w:d});c2+=d;});
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
  const sub=DB.substages.find(s=>s.id==t.substageId);
  let wk=(sub&&sub.week!=null)?sub.week:null;
  /* a task hanging straight off a stage (no substage) is placed at the END of that
     stage — the moment it has to be finished by — so it still lands somewhere honest on
     the person page and in the digest instead of collapsing onto W0. */
  if(wk==null&&t.stage){
    const st=stageStart(ev,t.lane,t.stage);
    if(st!=null){const d=stageDef(t.lane,t.stage,ev);wk=Math.max(0,st-(d?stageDur(ev,t.lane,d):1));}
    else{const evIdx=evIndex(ev),bars=layLane(ev,t.lane,evIdx),b=bars.find(b=>b.s.key===t.stage);
      if(b)wk=Math.max(0,evIdx-(b.x+b.w));}
  }
  if(wk==null)wk=0;
  return addDays(monday(ymd(ev.date)),-wk*7);}

/* ---- date helpers ---- */
function ymd(s){const p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function monday(d){const x=new Date(d);const o=(x.getDay()+6)%7;x.setDate(x.getDate()-o);x.setHours(0,0,0,0);return x;}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function toISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtD(d){return d.getDate()+' '+MON[d.getMonth()];}
/* a 2-day event shows the year once; a project can run over a year end, and then BOTH
   ends need their year ("7 Sep 2026–6 Sep 2027", not the old "7 Sep–6 Sep 2026") */
function dateRange(ev){const s=ymd(ev.date);
  if(!(ev.days>1))return fmtD(s)+' '+s.getFullYear();
  const e=addDays(s,Math.round(ev.days)-1);
  return e.getFullYear()===s.getFullYear()
    ? fmtD(s)+'–'+fmtD(e)+' '+s.getFullYear()
    : fmtD(s)+' '+s.getFullYear()+'–'+fmtD(e)+' '+e.getFullYear();}
/* the short "When" the reporting column has always shown — day-first, no year (the table
   is already grouped by year): "26 Jan" · "11-12 Feb" · "31 Mar-1 Apr". Same shape the
   event cascade writes, so a linked row reads identically before and after (3 Aug). */
function evWhenShort(ev){
  if(!ev||!ev.date)return '';
  const s=ymd(ev.date);if(isNaN(s))return '';
  const days=Math.max(1,Math.round(+ev.days||1));
  if(days<2)return s.getDate()+' '+MON[s.getMonth()];
  const e=addDays(s,days-1);
  return s.getMonth()===e.getMonth()
    ? s.getDate()+'-'+e.getDate()+' '+MON[s.getMonth()]
    : s.getDate()+' '+MON[s.getMonth()]+'-'+e.getDate()+' '+MON[e.getMonth()];
}
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
/* Belén, 30 Jul: "can you make clear which requests are holidays and which are remote
   work? Here these are remote work but nothing really is explaining them." The type was
   labelled "Office day" on the request cards while the presence badge called the same thing
   "Remote 🏠" — so nobody could tell what they were approving. One name everywhere now:
   REMOTE WORK. The stored value stays 'remote'. */
const TYPE_LABEL={vacation:'Holidays',remote:'Remote work',sick:'Sick leave',maternity:'Maternity leave',paternity:'Paternity leave',adjust:'Balance adjustment'};
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
   Belén's rule (30 Jul 2026, REPLACING the old Jan/Feb spill model): days are charged to
   the CALENDAR YEAR they are enjoyed in. A January-2027 booking spends the 2027 allowance
   — an advance deduction. That IS "the 2027 system": every year has its own 23-day count
   and bookings into it deduct from it the moment they're approved, year after year.
   (The old model charged Jan/Feb to the PREVIOUS year, which made balances impossible to
   follow — a next-January booking inflated this year's "used" count.)
   What survives from the old policy:
     • chargeYear on the row still overrides (HR can charge January days to last year's
       leftover when that is what was agreed)
     • carry-over 'adjust' rows: HR moves leftover days into the next year explicitly,
       and THOSE still expire on 28 Feb
   'adjust' rows are stamped on 1 Jan of the year they apply to = their calendar year. */
const HOL_DEADLINE_MD='02-28';    // carry-over days must be enjoyed before end of February
function holYearOf(h){
  if(!h)return null;
  if(h.chargeYear!=null&&h.chargeYear!=='')return +h.chargeYear;
  const iso=h.dateFrom||'';if(iso.length<4)return null;
  return +iso.slice(0,4);         // the calendar year of the dates — nothing cleverer
}
/* the charge year a NEW request would default to (shown in the form so nobody is surprised) */
function holYearOfDate(iso){const y=+(''+(iso||'')).slice(0,4);return y||null;}
/* kept for the pages: Jan/Feb window (only informational now) */
function inSpillWindow(iso){const m=+(iso||'').slice(5,7);return m<=2;}
/* Under calendar-year charging the judgement call moved to NEW YEAR'S EVE: a range that
   crosses 31 Dec (e.g. 28 Dec – 3 Jan) has days in two years but is charged whole by its
   start date. Flag it so HR can split the row or set chargeYear rather than the system
   quietly deciding. (The old 28-Feb straddle is gone — Feb→Mar is one calendar year.) */
function holStraddles(h){
  if(!h||h.type==='adjust'||!h.dateFrom||!h.dateTo)return false;
  if(h.chargeYear!=null&&h.chargeYear!=='')return false;   // HR has already ruled on it
  return h.dateFrom.slice(0,4)!==h.dateTo.slice(0,4);
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
   in the future — next-year bookings sit in NEXT year's count, not this one's), and
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
function holDeadlineText(year){return 'enjoy them within '+year+' — leftover days only continue as an HR carry-over, and carry-over expires 28 Feb '+(year+1);}
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
    if(hol){fest+=h;festNames.push(iso.slice(8,10)+'/'+iso.slice(5,7)+' '+hol);} // day-first, Belén's rule
    else if(vacDays.includes(iso))vac+=h;
    else if(leaveDays.includes(iso))leave+=h;
  }
  return {required,fest,festNames,vac,leave,toAllocate:Math.max(0,required-fest-vac-leave)};
}
const HR_START='2026-07-06'; // first week the timesheet is mandatory (module go-live)
function tsFor(personId,weekISO){return DB.timesheets.find(t=>t.personId==personId&&t.week===weekISO);}
/* the two lines nobody types: 00. Festivos and 04. Vacaciones. Bank holidays and approved
   holidays are ALLOCATION like any other project — since 28 Jul 2026 they are written onto
   the week when it is saved, not re-derived at every read (Belén: "these are allocated
   AUTOMATICALLY to holidays, and therefore deducted from the amount to allocate").
   Sick/maternity/paternity leave is NOT allocation — the person isn't working, so it is
   only recorded, never written to a project. */
function autoProject(kind){return DB.projects.find(p=>p.kind===kind);}
function isAutoProject(pid){const p=DB.projects.find(x=>String(x.id)===String(pid));return !!(p&&p.kind);}
/* what a saved week SHOULD carry on its two auto lines, from today's holiday record */
function tsAutoHours(personId,weekISO){
  const w=weekWorkInfo(weekISO,personId),fp=autoProject('festivos'),vp=autoProject('vacaciones');
  const out={};
  if(fp&&w.fest>0)out[fp.id]=w.fest;
  if(vp&&w.vac>0)out[vp.id]=w.vac;
  return out;
}
/* what storage is still MISSING — weeks saved before this change, and weeks nobody ever
   filled, still have to reconcile, so the read sites top them up rather than double count */
function tsAutoMissing(personId,weekISO){
  const h=(tsFor(personId,weekISO)||{}).hours||{},want=tsAutoHours(personId,weekISO),out={};
  Object.keys(want).forEach(pid=>{if(!(+h[pid]>0))out[pid]=want[pid];});
  return out;
}
/* the hours a PERSON typed — the auto lines never count towards "have you filled your week" */
function tsManualSum(t){return t?Object.keys(t.hours||{}).reduce((a,pid)=>a+(isAutoProject(pid)?0:(+t.hours[pid]||0)),0):0;}
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
/* ---- SERVICE ACCOUNTS: a login that is not a person on the team ----
   An outside company or freelancer who needs ONE part of the Dispatch and nothing else.
   It never clocks in, never allocates its own hours, and never shows up in the roster,
   the holiday calendar, a balance, a broadcast or the quick-jump people list — but it DOES
   show in Belén's permissions panel, because that is where she manages it (Belén, 5 Aug
   2026: "no appearance as a member to the team, but please do create it in the permissions
   side so I can manage it"). Two of them so far:
     HR       — Recursos Humanos, the external HR company (they keep time in their own system)
     Accounts — the external accountant who invoices, and covers Jesús while he is away
   The role IS the mechanism; the e-mails are a belt-and-braces so renaming a role can never
   silently promote a service account into a team member. */
const SERVICE_ROLES=['HR','Accounts'];
const SERVICE_EMAILS=['rrhh@ata.email','cristina.raboso@ata.email'];
function isTeamAccount(p){return !!p&&(SERVICE_ROLES.indexOf(p.role)>=0||SERVICE_EMAILS.indexOf((p.email||'').toLowerCase())>=0);}
/* the one line each service account sees where a team member sees the clock / allocation */
function serviceNote(p){
  if(!isTeamAccount(p))return '';
  if(p.role==='Accounts')return 'External accounts account — no clock in/out and no hour allocation here; you keep your own time. Invoicing is under 💶 Money.';
  return 'External HR team account — no clock in/out needed here (your team keeps time in its own system). You will get an email at rrhh@ata.email whenever something needs HR action; the 🔔 panel on the right shows the same items.';
}
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
/* remote work: up to 8 days per person per year — logged via the 'remote' entry type */
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
/* ---- where was this punched from? (Belén, 29 Jul: "if there is a request from the
   government we should be able to say the person was working in a different time zone
   and which it was") ----
   deviceTz()  = the zone the browser is set to. This is the truth about the recorded
                 time string, and it is captured, never typed.
   workPlace   = what the person declares on 🙋 Me. It exists because the device can be
                 honestly wrong: Carlos's laptop stays on Madrid while he is in Chile,
                 so his punches ARE Madrid times even though he is 6 hours away. */
function deviceTz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){return '';}}
function deviceOffsetMin(){try{return -new Date().getTimezoneOffset();}catch(e){return null;}} // minutes EAST of UTC
const HOME_TZ='Europe/Madrid';
function tzStamp(){
  const me=DB.currentUser;
  return {tz:deviceTz()||null,tzOffset:deviceOffsetMin(),place:(me&&me.workPlace)||null};
}
/* the places this team actually works from (events + remote spells). Label → IANA zone;
   the label is what gets written on the punch, the zone is only used to warn when the
   laptop clock disagrees with where the person says they are. */
const WORK_PLACES=[['Spain','Europe/Madrid'],['Poland','Europe/Warsaw'],['Italy','Europe/Rome'],
  ['United Kingdom','Europe/London'],['Germany','Europe/Berlin'],['Mexico','America/Mexico_City'],
  ['Chile','America/Santiago'],['Colombia','America/Bogota'],['Brazil','America/Sao_Paulo'],
  ['Dominican Republic','America/Santo_Domingo'],['United States (East)','America/New_York'],
  ['United States (West)','America/Los_Angeles'],['Elsewhere','']];
function placeZone(label){const p=WORK_PLACES.find(x=>x[0]===label);return p?p[1]:'';}
/* what is the clock in that zone right now, in minutes east of UTC */
function tzOffsetOf(zone,date){
  if(!zone)return null;
  try{
    const d=date||new Date();
    const p={};
    new Intl.DateTimeFormat('en-US',{timeZone:zone,hour12:false,year:'numeric',month:'2-digit',
      day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})
      .formatToParts(d).forEach(x=>{p[x.type]=x.value;});
    const asUTC=Date.UTC(+p.year,+p.month-1,(+p.day),(+p.hour)%24,+p.minute,+p.second);
    return Math.round((asUTC-d.getTime())/60000);
  }catch(e){return null;}
}
function tzOffsetLabel(off){
  if(off==null||off==='')return '';
  const s=off<0?'−':'+',a=Math.abs(+off);
  return 'UTC'+s+Math.floor(a/60)+(a%60?':'+String(a%60).padStart(2,'0'):'');
}
/* one short human label for a punch's origin — '' when it is a plain Madrid punch */
function tzLabel(e){
  if(!e)return '';
  const off=e.tzOffset==null?null:+e.tzOffset;
  /* "odd" = worth flagging. Someone who simply declares Spain on a Spanish laptop is the
     normal case and must not carry a globe on every punch. 60/120 = Madrid winter/summer. */
  const oddDevice=(e.tz&&e.tz!==HOME_TZ)||(off!=null&&off!==120&&off!==60);
  const oddPlace=e.place&&placeZone(e.place)!==HOME_TZ;
  if(!oddDevice&&!oddPlace)return '';
  const parts=[];
  if(e.place)parts.push(e.place);
  if(e.tz)parts.push(e.tz+(off==null?'':' · '+tzOffsetLabel(off)));
  return parts.join(' — ');
}
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
window._tzReady = true;         // flipped off at boot if dc_people has no workPlace column yet
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
/* ---- what STATE is a clock request in? (Belén, 29 Jul: "I never know how it is working")
   Derived from the LEDGER, never from a flag: a report is "applied" when it has live rows
   in dc_timeclock carrying its id. The old code read r.ratify, and when the second save of
   a self-service claim did not land (Cintia, 23 Jul) the punch existed while the card still
   said "waiting for you" and then refused to apply it again ("that would not change
   anything"). Asking the ledger cannot drift. */
function tcAppliedRows(reportId){
  if(reportId==null)return [];
  const rows=DB.timeclock.filter(r=>r.reportId==reportId);
  if(!rows.length)return [];
  /* a row that something else amends (i.e. a reversal) no longer counts as applied */
  const amended={};DB.timeclock.forEach(r=>{if(r.amends!=null)amended[r.amends]=true;});
  return rows.filter(r=>!amended[r.id]&&r.kind!=='void');
}
function tcReportState(r){
  if(!r)return 'waiting';
  if(r.status==='resolved')return 'resolved';
  if(r.status==='needs_info')return 'needs_info';        // sent back — the person has to answer
  if(tcAppliedRows(r.id).length)return 'applied';        // written already; only needs a yes/no
  return 'waiting';                                      // Belén has to decide
}
/* every decision on a clock request goes back to the person's 🔔 inbox. Before this,
   the answer only lived inside the report thread — so people wrote in twice, or gave up. */
/* the watcher behind the midnight split: call it from the 1-second clock tick. It fires
   only when THIS page saw the date roll over a moment ago — if the laptop slept through
   midnight and woke at 08:00 the gap gives it away and we leave the day alone rather than
   credit eight hours of sleep. */
let _tickDay=null,_tickAt=0;
function midnightWatch(){
  const d=toISO(new Date()),now=Date.now();
  const fresh=_tickAt&&(now-_tickAt)<5*60*1000;          // the tab was really awake and ticking
  if(_tickDay&&_tickDay!==d&&fresh)DB.splitAtMidnight(_tickDay,d);
  _tickDay=d;_tickAt=now;
}
function tcNotify(r,text){
  try{return notifySend(r.personId,'notice','🕘 '+text,'home.html');}catch(e){return 0;}
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
/* what is on HR's plate. A request that was sent back is waiting on the PERSON, so it
   stops nagging Belén and starts nagging them instead (openReports vs myReportsToFix). */
function openReports(){return DB.tcreports.filter(r=>r.status!=='resolved'&&r.status!=='needs_info');}
function myReportsToFix(){const me=DB.currentUser;return me?DB.tcreports.filter(r=>r.personId==me.id&&r.status==='needs_info'):[];}
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
        if(error&&(error.code==='23505'||/duplicate key/i.test(error.message||''))){
          /* duplicate id — either this punch already landed (retry after a lost ack), or a
             COLLEAGUE's same-millisecond punch took the id (newId is per-device). Only treat
             as saved if the existing row is really ours; otherwise re-mint and retry, else
             this device's punch would be silently lost forever (append-only record). */
          let ex=null;try{const r=await sb.from('dc_timeclock').select('id,personId').eq('id',p.id).maybeSingle();ex=r.data;}catch(_){}
          if(!(ex&&ex.personId==p.personId)){p.id=DB.newId();left.push(p);continue;}
        }else if(error){
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
  if(_punchAck.ok)
    return '<div style="color:var(--green,#1D6B34);font-weight:700;font-size:12.5px;margin-top:6px">✓ Saved in the record — '+_punchAck.kind.toUpperCase()+' '+_punchAck.time+'</div>';
  if(_punchAck.blocked) // refused on purpose (guard) — it was NOT queued, saying "will retry" here would be a lie
    return '<div style="color:#B36B00;font-weight:700;font-size:12.5px;margin-top:6px">⚠ '+esc(_punchAck.msg||'This punch was not recorded.')+'</div>';
  return '<div style="color:#D32230;font-weight:700;font-size:12.5px;margin-top:6px">⚠ Could not reach the database — your punch is kept safe on this device and will retry automatically.</div>';
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
    if(o.over>5/60)out.push({week:toISO(m),over:o.over,worked:o.workedH,allowed:o.allowed}); // ±5 min is square (Belén, 31 Jul)
  }
  return out.slice(-8);
}
/* ---- the hours BALANCE (Belén, 31 Jul): "the alarm is a nudge to take it lighter
   another week … it all needs to add up overall" ----
   Running ledger of (worked − allowed) across COMPLETED weeks. Weeks within ±5 min
   count as exactly square; weeks with no punches at all are skipped (approved leave
   already lowers the allowance — an empty week would swamp the ledger).
   streak = consecutive trailing weeks the ledger stayed >5 min over: at 4+ Belén
   gets a quiet line in her Needs-you so she can have a word. */
function tcBalance(personId){
  const weeks=[];let bal=0;
  const curMon=monday(new Date());
  for(let m=monday(ymd(TC_START));toISO(m)<toISO(curMon);m=addDays(m,7)){
    const iso=toISO(m),o=tcWeekOvertime(personId,iso);
    if(!(o.workedH>0))continue;
    const dev=Math.abs(o.over)<=5/60?0:o.over;
    bal+=dev;
    weeks.push({week:iso,dev,bal});
  }
  let streak=0;
  for(let i=weeks.length-1;i>=0;i--){if(weeks[i].bal>5/60)streak++;else break;}
  const prevBal=weeks.length>1?weeks[weeks.length-2].bal:0;
  return {weeks,balance:bal,streak,rising:weeks.length>1&&(bal-prevBal)>5/60};
}
/* "I understand" on the balance nudge — recorded as a message on the person's own
   thread (visible to them + Belén/HR), tagged so the nudge stays quiet for the rest
   of the week and comes back only if a new week ends still over. */
function tcAckMarker(){return '[tc-ack:'+toISO(monday(new Date()))+']';}
function tcAckedThisWeek(personId){
  const mk=tcAckMarker();
  if(DB.pmsgReady&&DB.pmsgReady()&&(DB.pmsgs||[]).some(m=>!m.deleted&&m.personId==personId&&(''+m.text).indexOf(mk)>=0))return true;
  try{return localStorage.getItem('dcTcAck')===mk;}catch(e){return false;}
}
function tcAckBalance(){
  const me=DB.currentUser;if(!me)return Promise.resolve(false);
  const b=tcBalance(me.id);
  const txt='⏱ I understand — I am '+fmtMin(Math.round(b.balance*60))+' over the allowed hours overall and will take it lighter to balance it. '+tcAckMarker();
  try{localStorage.setItem('dcTcAck',tcAckMarker());}catch(e){}
  if(!(DB.pmsgReady&&DB.pmsgReady()))return Promise.resolve(true);
  DB.pmsgs.push({id:DB.newId(),personId:me.id,byId:me.id,byName:me.name,text:txt,
    created:toISO(new Date())+' '+nowHMS().slice(0,5)});
  return DB.saveNow();
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
/* the last day of THIS week that still has expected hours (Fri normally, or Thu if Fri is
   a bank holiday / full-leave day). Used so the "Today" view switches to week-remaining. */
function tcLastWorkingDay(personId,mondayISO){
  const mon=mondayISO||toISO(monday(new Date())),monD=ymd(mon);let last=null;
  for(let i=0;i<5;i++){const iso=toISO(addDays(monD,i));if(tcExpectedDay(personId,iso)>0)last=iso;}
  return last;
}
/* most recent PAST day this week whose punches end on an open IN — i.e. a forgotten
   clock-out. Those hours count as 0 (an open pair only runs live on TODAY), so the
   home clock card shows a banner pointing at the claims flow. */
function tcOpenPastPair(personId){
  const pid=personId||(DB.currentUser&&DB.currentUser.id);if(!pid)return null;
  const monD=monday(new Date()),today=toISO(new Date());
  let found=null;
  for(let i=0;i<7;i++){
    const iso=toISO(addDays(monD,i));
    if(iso>=today)break;
    const es=tcEffective(pid,iso),last=es[es.length-1];
    if(last&&last.kind==='in')found={day:iso};
  }
  return found;
}
/* today's goal (Belén, 22 Jul): normally the day's expected hours; on the LAST working day
   of the week it becomes the week's remainder, so the finish line is "complete the week",
   not a full extra day. A helper, not an enforcer — doing more is fine. */
function tcDayGoal(personId){
  const today=toISO(new Date());
  const dailyExp=tcExpectedDay(personId,today);
  const worked=tcLiveSeconds(personId,today).seconds/3600;
  if(dailyExp<=0)return {off:true,goal:0,worked,remaining:0,pct:1,done:true,isLastDay:false};
  const isLast=tcLastWorkingDay(personId)===today;
  let goal=dailyExp;
  if(isLast){const wp=tcWeekProgress(personId);goal=wp.target-(wp.worked-worked);}  // so worked→goal ⇔ week complete
  goal=Math.max(0,goal);
  return {off:false,goal,worked,remaining:Math.max(0,goal-worked),pct:goal>0?Math.min(1,worked/goal):1,done:goal<=0||worked>=goal-1e-6,isLastDay:isLast};
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
  /* HR moved in with Team (29 Jul UX round) — approvers see the count on 👥 Team now */
  const badgeIds=DB.canSeeHR&&DB.canSeeHR()?['nav-team','nav-home']:['nav-home'];
  badgeIds.forEach(id=>{const el=document.getElementById(id);if(el&&n>0)el.innerHTML+=' '+pill;});
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
    if(el&&nu>0)el.innerHTML+=' <span title="New notifications since you last looked" style="background:#FF4A00;color:#fff;border-radius:9px;font-size:10px;font-weight:700;padding:1px 6px;vertical-align:1px">'+nu+'</span>';
  }
}

/* ---- SPX status rollup for the Money page (29 Jul: "Money absorbing (or replicating)
   the Status quo tab of SPX"). One row per registry event with the board buckets and
   targets. Line→event matching now lives in DB.spxLineReg (spx.html delegates there
   too, so there is one implementation). ⚠ KEEP IN SYNC with spx.html: spxBucket and
   eventTargets are still the canonical versions there — if bucket or target rules
   change on the board, change them here too. */
function spxStatusAll(){
  if(!DB.spxReady||!DB.spxReady())return [];
  const live=(DB.spxProps||[]).filter(p=>p.active!==false&&!p.superseded);
  const regs=(DB.spxEventReg||[]).filter(e=>!e.deleted);
  if(!regs.length)return [];
  const findReg=l=>DB.spxLineReg(l);
  const bucket=p=>p.stage==='Silent'?'Silent':p.salesStatus;
  const rows={};
  /* `active` = the manual tick (what weeklyAutoRefresh still keys off, so a finished
     edition's curve keeps being rebuilt from its invoices); `current` = the tick AND the
     date not yet passed — that is what every "Selling now / Before" split reads. */
  regs.forEach(e=>{rows[e.eventKey]={key:e.eventKey,name:e.name,active:e.active!==false,
    current:DB.spxIsCurrent(e),past:DB.spxRegIsPast(e),financeId:e.financeId,
    sort:+e.sort||0,won:0,wonN:0,sent:0,sentN:0,silent:0,lost:0,reg:e};});
  live.forEach(p=>{
    const b=bucket(p),touched={};
    (DB.spxLinesFor(p.id)||[]).forEach(l=>{
      const e=findReg(l);if(!e)return;
      const r=rows[e.eventKey],v=+l.valueEur||0;
      if(b==='Confirmed')r.won+=v;else if(b==='Sent')r.sent+=v;else if(b==='Silent')r.silent+=v;else if(b==='Lost')r.lost+=v;
      touched[e.eventKey]=b;
    });
    Object.keys(touched).forEach(k=>{if(touched[k]==='Confirmed')rows[k].wonN++;else if(touched[k]==='Sent')rows[k].sentN++;});
  });
  Object.values(rows).forEach(r=>{
    const fin=(r.financeId!=null&&DB.finance)?DB.finance.find(f=>f.id==r.financeId):null;
    let w=(r.reg.convByStatus&&r.reg.convByStatus.specsPct!=null)?+r.reg.convByStatus.specsPct:null;
    if(w!=null){if(w>1)w=w/100;w=Math.max(0,Math.min(1,w));}
    if(fin&&fin.target!=null&&w!=null){r.totTarget=+fin.target||0;r.totStretch=+fin.stretch||0;r.spTarget=r.totTarget*w;}
    else{
      /* ONE target on the board — the SPX one (Belén, 3 Aug 2026: "the tickets target does
         not need to be on the board… a simple subtraction job to show the rest"). The total
         is the event's Money target; the rest is total − SPX. pasesTarget/pasesStretch are
         no longer read. ⚠ KEEP IN SYNC with eventTargets() in spx.html. */
      const g=r.reg;r.spTarget=+g.sponsorshipTarget||0;
      r.totTarget=(fin&&fin.target!=null)?(+fin.target||0):r.spTarget;
      r.totStretch=(fin&&fin.stretch!=null)?(+fin.stretch||0):(+g.sponsorshipStretch||0);}
    r.restTarget=r.totTarget>r.spTarget?(r.totTarget-r.spTarget):(r.totTarget?0:null);
    delete r.reg;
  });
  return Object.values(rows).sort((a,b)=>a.sort-b.sort);
}

/* ---- the weekly series, rebuilt from source (Belén, 3 Aug 2026) ----
   WHAT WENT WRONG, so nobody rebuilds it the old way:
   the week's movement used to be worked out by SUBTRACTION — the live accumulated
   total minus every week already on record. The July Excel import filled only the
   ACCUMULATED columns (spxAcc / ticketsAcc / soFarEur) and left the per-week movement
   columns empty, so the subtraction had nothing to subtract and each event's entire
   back-history landed in one single week. That is how "signed this week" came to read
   63.593 € on a week that really took 13.318,40 €.

   Every week is now computed from what is DATED IN THAT WEEK:
     invoiced — invoice allocations, by the invoice's own fecha
     signed   — Won proposal lines, by the contract's signedAt
   Nothing is derived from what was written before, so a wrong week can never be baked
   in, and re-running REPAIRS the history instead of compounding it. It is idempotent:
   run it a hundred times and the numbers do not move.

   TWO LINES, deliberately (her ask, 3 Aug): sponsorship is routinely signed months
   before it may be invoiced, so the invoiced figures alone hide real money.
     soFarEur  = what is INVOICED         → "where we officially are"
     signedAcc = signed contracts + tickets → "where we really are"
   The gap between them is exactly the money that was invisible before.

   Runs by itself after any save that touches invoicing or the SPX board (the syncNow
   hook) and when a finance user opens Money; the ⟳ button is only "recalculate now".
   RLS: dc_weekly writes need dc_can_finance(), so it only acts for finance holders
   (Jesús, Belén). A salesperson's Won deal is picked up at the next finance touchpoint.
   Change-detected: writes ONLY when a value differs, which also breaks the save loop
   (refresh -> save -> sync -> hook -> refresh -> no change -> stop).
   Leads/telesales columns are never touched — marketing is not in the platform. */
/* the money columns this engine owns. Everything else on a weekly row (leads,
   telesales, the name/year) is hand-kept and must survive a rebuild untouched. */
const WK_OWNED=['sponsorsEur','sponsorsN','ticketsEur','delegatesN','grabacionesEur',
  'siteVisitsEur','signedEur','spxAcc','ticketsAcc','signedAcc','totalEur','soFarEur'];
let _wkCalcAt=null;   // when the series was last rebuilt, for the "live" stamp on Money
function weeklyAutoRefresh(){
  const res={updated:[],skipped:[],changed:false};
  try{
    if(!DB.canFinance()||!DB.weeklyReady()||!DB.spxReady()||!DB.billReady())return res;
    _wkCalcAt=new Date();
    const nowMon=monday(new Date()),WEEKMS=7*864e5;
    spxStatusAll().filter(r=>r.active&&r.financeId!=null).forEach(r=>{
      const f=DB.finance.find(x=>x.id==r.financeId);if(!f)return;
      /* the weekly history's eventCode = the registry key when it is an E-code
         (E047=E047) — the board-event link is a fallback, not a requirement
         (30 Jul fix: almost no Money row is linked to a board event, so the
         old rule skipped nearly everything) */
      const evRow=f.eventId?DB.event(f.eventId):null;
      let code=/^E\d+$/i.test(''+r.key)?(''+r.key).toUpperCase():null;
      if(!code&&evRow){const c=DB.evCode(evRow);if(c&&/^E\d+$/i.test(c))code=c;}
      if(!code){res.skipped.push(r.name+' — registry key is not an E-code and no board event is linked');return;}

      /* ---- W0 anchor. The board event's date owns it; failing that, read it back
         off the grid (a dated row's own week number says where W0 sits). Deriving
         every row's date FROM the anchor is what stops a moved event date growing a
         second row under a new anchor — that is how E059/E061 ended up doubled. */
      let rows=DB.weekly.filter(x=>x.eventCode===code);
      let ev0=null;
      if(evRow&&evRow.date)ev0=monday(ymd(evRow.date));
      if(!ev0){let last=null;rows.forEach(x=>{if(x.date&&x.week!=null&&(!last||+x.week>+last.week))last=x;});
        if(last)ev0=addDays(monday(ymd(last.date)),-7*(+last.week));}
      if(!ev0){res.skipped.push(r.name+' — no event date and no dated weekly row to anchor W0');return;}
      const curWk=Math.round((nowMon-ev0)/WEEKMS);

      /* one row per week: if a past collision left twins, keep the fuller one */
      const byWeek={};
      rows.slice().forEach(x=>{
        if(x.week==null)return;const w=+x.week,k=WK_OWNED.reduce((a,c)=>a+(x[c]!=null?1:0),0);
        if(!byWeek[w]){byWeek[w]={row:x,score:k};return;}
        const loser=(k>byWeek[w].score)?byWeek[w].row:x;
        if(k>byWeek[w].score)byWeek[w]={row:x,score:k};
        const i=DB.weekly.indexOf(loser);if(i>=0)DB.weekly.splice(i,1);   // → sync marks it deleted
        res.changed=true;
      });
      rows=DB.weekly.filter(x=>x.eventCode===code);

      /* ---- bucket every euro into the week it is DATED in ---- */
      const wk={},B=w=>(wk[w]=wk[w]||{sponsorsEur:0,sponsorsN:0,ticketsEur:0,delegatesN:0,
        grabacionesEur:0,siteVisitsEur:0,signedEur:0});
      const weekOf=iso=>{const s=(''+iso).slice(0,10);
        return /^\d{4}-\d{2}-\d{2}$/.test(s)?Math.round((monday(ymd(s))-ev0)/WEEKMS):null;};
      DB.invoiceAllocs.forEach(a=>{
        if(a.eventId!=f.id)return;
        const inv=DB.invoice(a.invoice_id);
        /* euros follow the pair rule (cancellation + abono = 0, see invCountsMoney);
           PASSES don't: a cancelled registration's seats are gone, and abonos carry
           no real seats — only live non-abono invoices contribute passes. */
        if(!DB.invCountsMoney(inv))return;
        const w=inv?weekOf(inv.fecha):null;if(w==null)return;
        const b=B(w),eur=DB.allocEur(a),p=DB.lineProdEff(a),
              seats=(inv.status!=='cancelado'&&inv.status!=='abono');
        if(isTicketProd(p)){b.ticketsEur+=eur;if(seats)b.delegatesN+=(+a.passes||0);}
        else if(p==='grabaciones')b.grabacionesEur+=eur;
        else if(p==='sitevisits')b.siteVisitsEur+=eur;
        else b.sponsorsEur+=eur;                       // anything else is sponsorship
      });
      /* signed contracts: the Won pile, placed on the week the contract was signed.
         signedAt is filled by the Won pop-up; older deals fall back to the dates
         they do have, so the signed line has history from day one. */
      const nk=k=>(''+(k==null?'':k)).trim().toLowerCase();
      (DB.spxProps||[]).forEach(p=>{
        if(p.active===false||p.superseded)return;
        if(!(p.stage==='Won'||p.salesStatus==='Confirmed'))return;
        const w=weekOf(p.signedAt||p.fechaEnvio||p.createdAt||'');if(w==null)return;
        let counted=false;
        (DB.spxLinesFor(p.id)||[]).forEach(l=>{
          const hit=(nk(l.eventKey)&&nk(l.eventKey)===nk(r.key))||(l.eventId!=null&&l.eventId==r.financeId);
          if(!hit)return;
          B(w).signedEur+=(+l.valueEur||0);
          if(!counted){B(w).sponsorsN++;counted=true;}   // contracts signed that week
        });
      });

      /* ---- walk the weeks in order, accumulating as we go ---- */
      const known=Object.keys(wk).map(Number).concat(rows.map(x=>+x.week).filter(w=>!isNaN(w)),[curWk]);
      const lo=Math.min.apply(null,known),hi=Math.max.apply(null,known);
      let spx=0,tik=0,gra=0,sv=0,tele=0,sig=0,n=0;
      for(let w=lo;w<=hi;w++){
        let row=rows.find(x=>+x.week===w);
        const wantDate=toISO(addDays(ev0,7*w));
        if(w>curWk){
          /* nothing has happened yet. A scaffold row must not carry last month's
             numbers forward or the curve jumps back up after today — which is
             exactly what the July import left behind. */
          if(row){
            if(WK_OWNED.some(k=>row[k]!=null)){WK_OWNED.forEach(k=>{row[k]=null;});res.changed=true;n++;}
            if(row.date!==wantDate){row.date=wantDate;res.changed=true;}
          }
          continue;
        }
        const b=wk[w]||B(w);
        const has=b.sponsorsEur||b.ticketsEur||b.grabacionesEur||b.siteVisitsEur||b.signedEur||b.delegatesN;
        tele+=((row&&+row.telesalesEur)||0);
        spx+=b.sponsorsEur;tik+=b.ticketsEur;gra+=b.grabacionesEur;sv+=b.siteVisitsEur;sig+=b.signedEur;
        if(!row&&!has&&w!==curWk)continue;             // don't invent empty weeks
        const vals={
          sponsorsEur:b.sponsorsEur,sponsorsN:b.sponsorsN,
          ticketsEur:b.ticketsEur,delegatesN:b.delegatesN,
          grabacionesEur:b.grabacionesEur,siteVisitsEur:b.siteVisitsEur,
          signedEur:b.signedEur,
          spxAcc:spx,ticketsAcc:tik,
          totalEur:b.sponsorsEur+b.ticketsEur+b.grabacionesEur+b.siteVisitsEur+((row&&+row.telesalesEur)||0),
          soFarEur:spx+tik+gra+sv+tele,                          // official: invoiced
          /* real: signed contracts + everything already billed. MAX, not sum, on the
             sponsorship side — a sponsorship that has been invoiced is self-evidently
             signed, and plenty of pre-board deals were invoiced without ever being
             marked Won. Adding the two would double-count them; taking the larger
             keeps the promise that the real line is never below the official one,
             so the gap between them only ever means "signed, not yet billable". */
          signedAcc:Math.max(sig,spx)+tik+gra+sv+tele};
        if(f.target!=null)vals.target=+f.target;
        if(f.stretch!=null)vals.stretch=+f.stretch;
        const isNew=!row;
        if(isNew){row={id:DB.newId(),eventCode:code,
          name:(rows[0]&&rows[0].name)||(f.name+' '+(f.year||'')).trim(),  // keep the history's own naming
          year:(rows[0]&&rows[0].year)||f.year||null,
          date:wantDate,week:w,topicLeads:null,eventLeads:null,telesalesN:null,telesalesEur:null};
          DB.weekly.push(row);rows.push(row);}
        const dirty=isNew||row.date!==wantDate||Object.keys(vals).some(k=>(+(row[k])||0)!==(+vals[k]||0));
        if(!dirty)continue;
        row.date=wantDate;
        Object.assign(row,vals);
        res.changed=true;n++;
      }
      if(n)res.updated.push(code+' · '+n+' week'+(n===1?'':'s')+' recomputed');
    });
  }catch(e){console.warn('weekly auto-refresh:',e.message||e);}
  return res;
}
/* ---------- Money event card data (Belén, 30 Jul 2026) ----------
   The Year tab's expandable event card shows CUMULATIVE curves: this edition,
   the previous edition of the same franchise (if any) and the average finished
   event shaped to this target. Joins follow the standing rule: dc_weekly ↔
   registry on the E-CODE, never on dc_finance names; the franchise fallback
   folds accents/spaces/digits. spx.html drawHcPace applies the same rules —
   KEEP IN SYNC (changing a join rule here means changing it there). */
function famFold(s){return (''+(s||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z]/g,'').replace(/^renmad/,'');}
function evCardCode(f){
  if(!f)return null;
  const reg=(DB.spxEventReg||[]).find(r=>!r.deleted&&r.financeId==f.id);
  if(reg&&/^E\d+$/i.test(''+reg.eventKey))return (''+reg.eventKey).toUpperCase();
  const ev=f.eventId?DB.event(f.eventId):null;
  const c=ev?DB.evCode(ev):null;
  return (c&&/^E\d+$/i.test(c))?c:null;
}
/* ---- what an E-code is CALLED, resolved live (Belén, 3 Aug) ----
   A weekly row keeps the name it was born with, which is right for history and wrong for
   everything else: E059 was still labelled "Talks BESS 2026" all over the reporting long
   after the code had been reassigned to Invest Italia 2027. The name a report shows now
   walks code → SPX registry (or the timeline event carrying that ecode) → Money row →
   finTrueLabel, i.e. the SAME label the Year table prints. Only a code with no home left
   anywhere (a closed 2021 edition) falls back to the name on its own history. */
function weeklyLabel(code,fallback){
  const c=(''+(code||'')).trim().toUpperCase();
  if(!c)return fallback||'';
  let fin=null;
  try{
    const reg=(DB.spxEventReg||[]).find(r=>!r.deleted&&(''+r.eventKey).trim().toUpperCase()===c);
    if(reg&&reg.financeId!=null)fin=(DB.finance||[]).find(f=>!f.deleted&&f.id==reg.financeId);
    if(!fin){const ev=(DB.events||[]).find(e=>!e.deleted&&DB.evCode(e)===c);
      if(ev)fin=(DB.finance||[]).find(f=>!f.deleted&&f.eventId==ev.id);}
  }catch(e){}
  return fin?DB.finTrueLabel(fin):(fallback||c);
}
function evPaceCard(f){
  const code=evCardCode(f);
  const rowsOf=c=>DB.weekly.filter(x=>x.eventCode===c).sort((a,b)=>(+a.week)-(+b.week));
  const cur=code?rowsOf(code):[];
  const codes={};DB.weekly.forEach(x=>{if(x.eventCode)codes[x.eventCode]=1;});
  const finished=[];
  Object.keys(codes).forEach(c=>{
    const rs=rowsOf(c);if(!rs.length)return;
    /* finished = the curve reached W0 AND that week has actually HAPPENED.
       (3 Aug fix: the imported grid pre-creates the whole W-24…W+1 scaffold, so
       every live event already owns a W0 row and was being counted as finished —
       which put live half-sold events into the benchmark median and dragged the
       "typical event" line down. The 30 Jul lesson still holds: don't use
       "last date < today", use the W0 row's own date.) */
    const today0=new Date().toISOString().slice(0,10);
    if(!rs.some(r=>+r.week>=0&&r.date&&r.date<=today0))return;
    const fin=Math.max(0,...rs.map(r=>+r.soFarEur||0));
    if(fin>0)finished.push({code:c,rows:rs,final:fin,name:rs[0].name||c,year:rs[0].year});
  });
  const fam=famFold(cur.length?cur[0].name:DB.finTrueLabel(f));
  let prev=null;
  finished.forEach(e=>{if(e.code===code||famFold(e.name)!==fam)return;
    if(!prev||(+e.year||0)>(+prev.year||0))prev=e;});
  /* average finished event: per-week MEDIAN share of final, scaled to this target */
  const shares={};
  finished.forEach(e=>{e.rows.forEach(r=>{const s=(+r.soFarEur||0)/e.final;
    (shares[r.week]=shares[r.week]||[]).push(s);});});
  const medShare=w=>{const a=(shares[w]||[]).slice().sort((x,y)=>x-y);
    return a.length?a[Math.floor(a.length/2)]:null;};
  const tgt=(+f.target||+f.stretch||0)||null;
  return {code,cur,prev,medShare,tgt,finishedN:finished.length};
}
let _wkAutoTimer=null;
/* called from syncNow with the set of tables the sync just pushed */
function weeklyAutoHook(touched){
  if(!touched)return;
  /* 'events' is in the list because the timeline owns W0: move an event's date and every
     week number under it moves with it, so the series must be rebuilt there and then
     (Belén, 3 Aug: "it should get into an immediate update situation, continuously"). */
  const rel=['invoices','invalloc','spxProps','spxLines','spxFrags','finance','events'];
  if(!rel.some(k=>touched[k]))return;
  clearTimeout(_wkAutoTimer);
  _wkAutoTimer=setTimeout(()=>{_wkAutoTimer=null;
    const r=weeklyAutoRefresh();
    if(r.changed){DB.save();try{window.dispatchEvent(new CustomEvent('dc-remote',{detail:{src:'weekly-auto'}}));}catch(e){}}
  },400);
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
/* ---- tell Belén when an event appears, gets its code, or goes (Belén, 3 Aug: "inform me
   each time a new event and code is created, just in case") ----
   These are the moments that can move money: a new event on the timeline, the code that
   turns a draft into real Money / Invoicing / SPX lines, and a deletion that retires them.
   The message says WHICH of those happened and, for a code, whether it ATTACHED to a row
   that already existed or created new lines — so a wrong code is visible the same minute
   instead of at month end.
   She is not told about her own edits. RLS is what makes this work for everyone else:
   dc_inbox lets any signed-in person write to another person's inbox, while letting them
   read only their own — so a PM's notification reaches her and nobody else sees it. */
/* ================= TASK STATE TRANSITIONS (6 Aug 2026) =================
   Everything that moves a task between the four states lives here, so the rules cannot
   drift between the event page, 🙋 Me and 👥 Team. */

/* Assigned → Pending, automatically, when the owner actually opens it.
   Belén chose automatic over a manual "accept": a click you have to remember is a click
   that rots, which is exactly how "In progress" ended up on one task in a hundred.
   Only the OWNER opening it counts — a manager reading the list does not clear it for
   them, or the "nobody has looked at this" signal would be worthless. */
function taskSeen(t){
  try{
    const me=DB.currentUser;
    if(!me||!t||taskStatus(t)!=='Assigned')return false;
    if(!DB.taskIsMine(t,me.id))return false;
    t.status='Pending';
    DB.save();
    return true;
  }catch(e){return false;}
}
/* mark every Assigned task in a list as seen in one pass — used when a person opens
   their own runway, because that IS them looking at them */
function taskSeenAll(tasks){
  const me=DB.currentUser;if(!me)return 0;
  let n=0;(tasks||[]).forEach(t=>{if(taskStatus(t)==='Assigned'&&DB.taskIsMine(t,me.id)){t.status='Pending';n++;}});
  if(n)DB.save();
  return n;
}
/* Cancelled needs a reason — the same rule as denying a holiday. Without one, a
   cancelled task is indistinguishable from work that quietly vanished, which is the
   opposite of what a record is for. */
function cancelTask(t,reason){
  if(!t)return false;
  const why=(''+(reason||'')).trim();
  if(!why)return false;
  t.status='Cancelled';t.cancelReason=why;
  DB.save();
  return true;
}
/* ---- "N new tasks assigned to you", batched ----
   One message per (recipient, event, lane, who assigned, day). Valeria loading 80
   material tasks sends Julián ONE line, not eighty — the volume problem Belén refused
   to solve with a per-task toggle ("es terrible porque tú piensas que está saliendo y a
   lo mejor no está saliendo"). A second assignment the same day finds the unread row
   and re-counts it. */
function notifyAssigned(task,recipientIds){
  try{
    if(!DB.inboxReady()||!DB.currentUser||!task)return 0;
    const me=DB.currentUser, ev=DB.event(task.eventId);
    const day=toISO(new Date());
    const ids=(recipientIds||[]).filter(id=>id&&id!=me.id);
    if(!ids.length)return 0;
    DB.data.inbox=DB.data.inbox||[];
    ids.forEach(pid=>{
      const key='asg:'+task.eventId+':'+task.lane+':'+me.id+':'+day;
      const row=DB.inbox.find(x=>!x.deleted&&x.personId==pid&&x.batchKey===key&&x.isRead!==true);
      /* count what this person actually has from this batch, so the number is true
         even if some were assigned minutes apart */
      const n=DB.tasks.filter(x=>x.eventId==task.eventId&&x.lane===task.lane
                 &&DB.taskIsMine(x,pid)&&taskStatus(x)==='Assigned').length;
      const where=(ev?DB.evMasterName(ev):'an event')+' · '+(LANE_LABEL[task.lane]||task.lane);
      const text=(n>1?(n+' new tasks for you on '):'A new task for you on ')+where+
                 (n>1?'':' — '+(task.title||''))+' (from '+me.name+')';
      if(row){row.text=text;row.created=toISO(new Date())+' '+nowHMS().slice(0,5);}
      else DB.data.inbox.push({id:DB.newId(),personId:pid,kind:'task',text:text,
        link:'event.html?id='+task.eventId,isRead:false,fromName:me.name,
        batchKey:key,created:toISO(new Date())+' '+nowHMS().slice(0,5)});
    });
    return ids.length;
  }catch(e){return 0;}
}
/* set who is on a task, and raise the message for anyone newly put on it.
   The single place assignment happens, so Assigned can never be forgotten. */
function setTaskPeople(t,ids){
  if(!t)return;
  const before=DB.taskPeople(t);
  const after=(ids||[]).filter((v,i,a)=>v!=null&&a.indexOf(v)===i).map(Number);
  const added=after.filter(id=>before.indexOf(id)<0);
  t.assignees=after.slice();
  t.assignee=after.length?after[0]:null;
  /* an unowned task is Pending — nothing is "assigned to" nobody. The moment a name
     goes on it, it becomes Assigned until that person opens it (Belén's rule). */
  if(!after.length){ if(taskLive(t))t.status='Pending'; }
  else if(added.length&&taskLive(t)) t.status='Assigned';
  DB.save();
  if(added.length)notifyAssigned(t,added);
}
/* who changed the status of this task, and when. The record already existed —
   dc_audit has logged it since 7 Jul — but dc_audit also holds holidays, the time
   clock and the invoice book, so it stays shut and this reads one task through a
   narrow security-definer function (dc_task_history). */
async function taskHistory(taskId){
  if(!USE_SUPABASE)return null;                 // offline rig: no audit log to read
  try{
    const r=await sb.rpc('dc_task_history',{task_id:taskId});
    if(r.error)throw r.error;
    return r.data||[];
  }catch(e){console.warn('task history:',e.message||e);return null;}
}
/* ---------------- the request thread (6 Aug 2026) ----------------
   Same {who,when,text|sys} shape dc_tickets already uses, so the rendering is shared.
   sys = something the system recorded (a status change), text = somebody typing. */
function reqLog(req,sys,text){
  if(!req)return;
  const me=DB.currentUser;
  req.thread=Array.isArray(req.thread)?req.thread.slice():[];
  req.thread.push({who:(me&&me.name)||'system',when:toISO(new Date())+' '+nowHMS().slice(0,5),
                   sys:sys||undefined,text:text||undefined});
}
/* who hears about a request: the asker and the logistics desk, minus whoever just typed.
   Deliberately not "all" — this is the volume problem Belén flagged about task emails. */
function reqNotify(req,text){
  try{
    if(!req||!DB.inboxReady()||!DB.currentUser)return 0;
    const link='event.html?id='+req.eventId+'#req';
    const desk=DB.people.filter(p=>!p.deleted&&(''+(p.role||'')).toLowerCase()==='logistics').map(p=>p.id);
    const ids=desk.concat([req.personId]).filter((id,i,a)=>id!=DB.currentUser.id&&a.indexOf(id)===i);
    return ids.length?notifySend(ids,'notice',text,link):0;
  }catch(e){return 0;}
}
/* ================= THE WEEKLY DIGEST (Belén, 6 Aug 2026) =================
   Logistics asked for an email every time a task is assigned. Belén said no, and was
   right about why: "si se cargan 200 tareas de materiales de golpe, la gente acaba harta."
   She also killed the obvious workaround — a "send a notice? yes/no" tick per task —
   because "es terrible, tú piensas que está saliendo y a lo mejor no está saliendo."
   What ships instead: ONE digest of everything that landed on you this week, plus the
   in-app notice on 🙋 Me. Computed at read time from doneAt/updated_at — no queue to
   drain, nothing to get out of step, and it says the same thing however often you look.
   ⚠️ THE EMAIL LEG IS NOT BUILT. The Dispatch has no mail sender of any kind today
   (verified 6 Aug: no Resend, no SMTP, and the only edge functions are stripe-webhook,
   web-extractor and dc-events). Sending this as mail needs a sender first. */
function weekStartISO(d){return toISO(monday(d||new Date()));}
function digestFor(personId,fromISO){
  const from=fromISO||weekStartISO();
  const mine=DB.tasksOf(personId);
  const isNew=t=>{
    const u=(''+(t.updated_at||'')).slice(0,10);
    return u&&u>=from;                       // landed on (or was changed for) you this week
  };
  const fresh=mine.filter(isNew);
  const mon=+monday(new Date());
  const open=mine.filter(taskLive);   // Cancelled must not keep nagging
  return {
    from:from,
    added:fresh,
    open:open.length,
    overdue:open.filter(t=>(+taskDate(t))<mon).length,
    thisWeek:open.filter(t=>{const d=+taskDate(t);return d>=mon&&d<mon+7*86400000;}),
    done:mine.filter(t=>taskDone(t)&&(''+(t.doneAt||'')).slice(0,10)>=from).length,
  };
}
/* one line per event, so "80 lanyard tasks" reads as one sentence and not eighty */
function digestText(personId,fromISO){
  const d=digestFor(personId,fromISO);
  const byEvent={};
  d.added.forEach(t=>{const e=DB.event(t.eventId);const k=e?e.name:'—';(byEvent[k]=byEvent[k]||[]).push(t);});
  const parts=[];
  const keys=Object.keys(byEvent);
  /* "added or changed", not "added": dc_tasks has no createdAt, only updated_at, so a task
     someone re-assigned counts too. Saying so is better than implying a precision we do
     not have. */
  if(keys.length)parts.push('added or changed — '+
    keys.map(k=>byEvent[k].length+' on '+k).join(', '));
  if(d.thisWeek.length)parts.push(d.thisWeek.length+' due this week');
  if(d.overdue)parts.push(d.overdue+' overdue');
  if(d.done)parts.push(d.done+' finished');
  return parts.join(' · ');
}
function notifyBelen(text,link){
  try{
    if(!DB.inboxReady()||!DB.currentUser)return 0;
    const belen=(DB.people||[]).find(isBelenP);
    if(!belen||belen.id==DB.currentUser.id)return 0;      // no need to tell herself
    return notifySend(belen.id,'notice',text,link||'gantt.html');
  }catch(e){return 0;}
}
function evWatchLabel(ev){
  const when=(ev&&ev.date)?dateRange(ev):'no date yet';
  return '“'+((ev&&ev.name)||'?')+'” ('+when+((ev&&ev.city)?' · '+ev.city:'')+')';
}
/* before = a copy of the event as it was, or null when it has just been created.
   plan = the DB.evConnectPlan() result taken BEFORE saving, so we can say what the code did. */
function notifyEventChange(ev,before,plan){
  try{
    if(!ev||evKind(ev)==='external')return;              // one-off projects never touch money
    const who=(DB.currentUser&&DB.currentUser.name)||'Someone';
    const code=DB.evCode(ev)||'';
    const acode=(''+(ev.acode||'')).trim();
    const didWhat=(plan&&plan.state==='adopt')?' It ATTACHED to the Money row that already existed.'
                 :(plan&&plan.state==='create')?' It created its Money row, invoicing item and sales-board entry.':'';
    /* the one that needs an answer, not just a read: someone has coded an event and it is
       sitting in the queue for her OK before anything touches Money */
    const ask=DB.evAwaitingOk(ev)
      ? ' ⏳ It is NOT in Money, Invoicing or SPX yet — it needs your OK. Open the timeline and press “connect”.'
      : '';
    if(!before){
      notifyBelen('📅 '+who+' added the event '+evWatchLabel(ev)+'. '+
        (code?('Marketing code '+code+(acode?' · accounting code '+acode:'')+'.'+(ask||didWhat))
             :'No marketing code yet, so it is NOT in Money, Invoicing or SPX — it stays a draft until the code arrives.'));
      return;
    }
    const wasE=(''+(before.ecode||'')).trim().toUpperCase(), nowE=code.toUpperCase();
    const wasA=(''+(before.acode||'')).trim(), nowA=acode;
    if(wasE!==nowE&&nowE){
      notifyBelen('🔗 '+who+' gave '+evWatchLabel(ev)+' the marketing code '+nowE+
        (wasE?(' — it used to be '+wasE):'')+'.'+(ask||didWhat));
    }else if(wasE!==nowE&&!nowE){
      notifyBelen('⚠ '+who+' REMOVED the marketing code from '+evWatchLabel(ev)+
        ' (it was '+wasE+'). Nothing new will reach Money, Invoicing or SPX for it.');
    }
    if(wasA!==nowA&&nowA)notifyBelen('🧾 '+who+' set the accounting code '+nowA+' on '+evWatchLabel(ev)+'.');
  }catch(e){console.warn('event watch:',e.message||e);}
}
/* ================= 💬 the conversation on a person =================
   Belén, 29 Jul: "a little area in each person for the messages — whether they are for
   holidays, changes in clock ins and outs, changes to the platform — so there can be a
   conversation". One thread per person, plus a short index of the open items that already
   have their own threads elsewhere, so this page is where you START and never the place
   where a decision quietly ends up duplicated.
   Visible to the person, to admins and to HR (RLS says the same thing on the server). */
function canSeePersonThread(personId){
  const me=DB.currentUser;if(!me)return false;
  if(me.id==personId)return true;                      // your own thread, always
  const o=permOverride(me,'people.msgs');if(o&&o.see!=null)return !!o.see;
  return me.access==='admin'||!!me.hr;
}
function personThreadHtml(personId,opts){
  opts=opts||{};
  if(!DB.pmsgReady())return '<p class="hint">Messages are not active yet — the dc_person_msgs table is missing.</p>';
  if(!canSeePersonThread(personId))return '';
  const ms=DB.pmsgsFor(personId),me=DB.currentUser;
  let h='<div id="pmsgList" style="max-height:280px;overflow:auto">';
  h+=ms.length?ms.map(m=>{
    const mine=m.byId==me.id;
    return '<div style="margin-bottom:8px;padding:7px 10px;border-radius:9px;background:'+(mine?'#FFF3EC':'#f6f5f1')+';border:1px solid '+(mine?'#F3D9B8':'var(--line)')+'">'+
      '<div style="font-size:11px;color:var(--muted)"><b style="color:var(--charcoal)">'+esc(m.byName||'?')+'</b> · '+esc(deIso(m.created||''))+'</div>'+
      '<div style="font-size:13px;white-space:pre-wrap">'+esc(m.text||'')+'</div></div>';
  }).join(''):'<div class="hint">No messages yet.</div>';
  h+='</div>'+
    '<div style="display:flex;gap:6px;margin-top:8px">'+
    '<input id="pmsgTxt" placeholder="'+(personId==me.id?'Write to Belén / HR…':'Write to '+esc(DB.personName(personId))+'…')+'" style="flex:1;font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:8px">'+
    '<button class="btn primary" id="pmsgSend" style="font-size:12px">Send</button></div>'+
    '<div class="hint" style="margin-top:4px">'+(personId==me.id?'Belén and HR see this.':'They get it in their 🔔 inbox.')+'</div>';
  return h;
}
function wirePersonThread(personId,rerender){
  const btn=document.getElementById('pmsgSend'),inp=document.getElementById('pmsgTxt');
  if(!btn||!inp)return;
  const send=async()=>{
    const t=(inp.value||'').trim();if(!t)return;
    const me=DB.currentUser;
    btn.disabled=true;
    DB.pmsgs.push({id:DB.newId(),personId:personId,byId:me.id,byName:me.name,text:t,
      created:toISO(new Date())+' '+nowHMS().slice(0,5)});
    await DB.saveNow();
    /* the point of the thread is that the other side hears about it */
    if(personId==me.id){
      const to=DB.people.filter(p=>!isTeamAccount(p)&&(p.hr||isBelenP(p))).map(p=>p.id);
      notifySend(to,'notice','💬 '+me.name+': “'+t+'”','person.html?id='+personId);
    }else{
      notifySend(personId,'notice','💬 '+me.name+' wrote to you: “'+t+'”','home.html');
    }
    btn.disabled=false;inp.value='';
    if(rerender)rerender();
  };
  btn.onclick=send;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')send();});
}
/* the open items about this person that live in their own modules — listed, never duplicated */
function personOpenItemsHtml(personId){
  const out=[];
  if(DB.tcReady())DB.tcreports.filter(r=>r.personId==personId&&r.status!=='resolved')
    .forEach(r=>out.push('🕘 Clock correction · '+fmtHuman(r.day)+' — <a href="hr.html#pending" style="color:var(--orange)">'+(r.status==='needs_info'?'sent back to them':'waiting for a decision')+'</a>'));
  if(DB.hrReady())DB.holidays.filter(h=>h.personId==personId&&['manager','belen','hr'].includes(h.status))
    .forEach(h=>out.push('🌴 Time off · '+fmtHumanRange(h.dateFrom,h.dateTo)+' — <a href="home.html" style="color:var(--orange)">'+esc(holStageLabel(h))+'</a>'));
  if(DB.tickReady())DB.tickets.filter(t=>t.personId==personId&&(t.status==='new'||t.status==='open'))
    .forEach(t=>out.push('💡 Request · '+esc(t.title||'')+' — <a href="inbox.html#requests" style="color:var(--orange)">open</a>'));
  if(!out.length)return '<div class="hint">Nothing open right now.</div>';
  return '<div style="font-size:12.5px">'+out.map(x=>'<div style="margin-bottom:3px">'+x+'</div>').join('')+'</div>';
}
/* ---- what the bell counts, and where the old ones go (Belén, 31 Jul) ----
   "Once the messages have been seen, can they be moved to read and only new ones be
   noted? After 2 months they can be moved to a different folder."
   → SEEN = READ: inbox.html marks them the moment you actually look at the list, so the
     🔔 badge only ever counts what has arrived SINCE your last look.
   → OLD = ARCHIVED: a read notification older than INBOX_ARCHIVE_DAYS leaves the inbox
     for the 🗄 Archive folder. Archiving is COMPUTED from the date — no flag, no
     migration, nothing to maintain — and an UNREAD one is never hidden, however old. */
const INBOX_ARCHIVE_DAYS=60;
function inboxAgeDays(m){
  const s=((m&&m.created)||'').slice(0,10);if(s.length!==10)return 0;
  const d=ymd(s);if(!d||isNaN(d))return 0;
  return Math.round((ymd(toISO(new Date()))-d)/86400000);
}
function inboxArchived(m){return !!(m&&m.isRead)&&inboxAgeDays(m)>INBOX_ARCHIVE_DAYS;}
function inboxMine(){const me=DB.currentUser;return me?DB.inbox.filter(m=>m.personId==me.id):[];}
function inboxCurrent(){return inboxMine().filter(m=>!inboxArchived(m));} // the inbox itself
function inboxOld(){return inboxMine().filter(inboxArchived);}           // the 🗄 Archive folder
function inboxUnread(){return inboxMine().filter(m=>!m.isRead).length;}
/* mark notifications as seen (ids omitted = all of mine). Returns how many changed. */
function inboxMarkSeen(ids){
  const set=ids?new Set(ids.map(String)):null;let n=0;
  inboxMine().forEach(m=>{if(!m.isRead&&(!set||set.has(String(m.id)))){m.isRead=true;n++;}});
  if(n)DB.save();
  return n;
}

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
      &&p.stage!=='Silent'                                    // dormant on purpose — the board suppresses these, so must the alarms
      &&(''+(p.responsableEmail||'')).toLowerCase()===(''+me.email).toLowerCase()
      &&p.fechaSeguimiento&&(''+p.fechaSeguimiento).slice(0,10)<today)
    .forEach(p=>{
      const due=(''+p.fechaSeguimiento).slice(0,10);
      const key='spx.html?fu='+p.id+':'+due;                  // dedupe key stays ISO — only the display text changes
      if((DB.inbox||[]).some(m=>m.personId==me.id&&m.link===key))return;   // already alarmed for this date
      sent+=notifySend(me.id,'alarm','⏰ Follow-up overdue: '+(p.company||'proposal')+' — next touchpoint was '+deIso(due)+'. Time to chase.',key);
    });
  return sent;
}

/* 📦 SPX delivery-details alarms (Belén, 3 Aug 2026: "how can I force the sales team to
   fill in those pending now?"). A contract of MINE that is Won but never said what was
   sold leaves logistics working blind, so it comes back ONCE A WEEK — deduped on
   proposal + that week's Monday — until it is filled in. One alarm per person, not per
   contract: a wall of twelve notifications is noise, one that says "you owe 12" is a
   task. It stops arriving by itself the moment the count reaches zero. */
function spxDeliveryAlarms(){
  const me=DB.currentUser;
  if(!me||!me.email||!DB.inboxReady()||!DB.spxReady())return 0;
  const mine=DB.spxDeliveryPending(me.email);
  if(!mine.length)return 0;
  const wk=toISO(monday(new Date()));
  const key='spx.html?fill=me:'+wk;                          // one nudge per person per week
  if((DB.inbox||[]).some(m=>m.personId==me.id&&m.link===key))return 0;
  const n=mine.length;
  return notifySend(me.id,'alarm','📦 '+n+' signed contract'+(n===1?'':'s')+' of yours '+(n===1?'has':'have')+
    ' no delivery details — logistics cannot deliver a stand from a signature. Open the board and fill '+(n===1?'it':'them')+' in.',key);
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
   +'<div style="font-size:11.5px;color:#7c7c78;margin-top:10px"><a href="inbox.html#requests" style="color:#7c7c78">See all requests →</a> <span style="opacity:.8">(maybe it’s already reported — you can add a comment there instead)</span></div></div>';
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
      +'<div style="font-size:13px;color:#3a3a3a;margin:8px 0 14px">It’s in the queue. You can follow it (and comment) on the <a href="inbox.html#requests">Requests page</a>.</div>'
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
 {id:17,name:'Jesús Jiménez',role:'Admin',access:'member',email:'jesus.jimenez@ata.email',finance:true,billing:true}, // Accounting — the finance + invoicing editor
 /* Human Resources — the final holiday approver (Belén + Jesús can also act) */
 {id:18,name:'Recursos Humanos',role:'HR',access:'member',email:'rrhh@ata.email',hr:true}, // HR access only; primary final approver
 /* External accountant — invoices, and covers Jesús while he is away, so she carries his two
    ticks. A SERVICE ACCOUNT: no clock, no roster, no holidays (Belén, 5 Aug 2026). */
 {id:19,name:'Accounts',role:'Accounts',access:'member',email:'cristina.raboso@ata.email',finance:true,billing:true,holidayDays:0},
];
function buildSeed(){
  /* seeded events are pre-approved for the money side — offline/demo mode should not open
     with six events queued for a confirmation nobody asked for (3 Aug) */
  const events=JSON.parse(JSON.stringify(SEED_EVENTS)).map(e=>Object.assign({moneyOk:true},e));
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
        tasks.push({id:tid++,eventId:ev.id,lane,stage,substageId:sub.id,title:nm,assignee:who,deadline:'',status:'Pending'});});
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
  return {v:STORE_VERSION,events,people,substages:subs,tasks,finance,weekly:[],projects,holidays:[],timesheets:[],timeclock:[],tcreports:[],eventaway:[],invoices:[],invalloc:[],delegates:[],codigos,payments:[],tickets:[],logins:[],spxProps:[],spxLines:[],spxTargets:[],companyMap:[],spxEventReg:[],spxFrags:[],
    stageLay:[],venueCats:[],venueItems:[],requests:[],
    nextEvent:7,nextPerson:19,nextSub:sid,nextTask:tid};
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
const TABLES={events:'dc_events',people:'dc_people',substages:'dc_substages',tasks:'dc_tasks',finance:'dc_finance',weekly:'dc_weekly',projects:'dc_projects',holidays:'dc_holidays',timesheets:'dc_timesheets',timeclock:'dc_timeclock',tcreports:'dc_tcreports',eventaway:'dc_eventaway',invoices:'dc_invoices',invalloc:'dc_invoice_alloc',delegates:'dc_delegates',codigos:'dc_codigos',payments:'dc_invoice_payments',tickets:'dc_tickets',spxProps:'dc_spx_proposals',spxLines:'dc_spx_lines',spxTargets:'dc_spx_targets',companyMap:'dc_company_map',spxEventReg:'dc_spx_events',spxFrags:'dc_spx_fragments',todos:'dc_todos',inbox:'dc_inbox',holmsgs:'dc_holiday_msgs',productos:'dc_productos',pmsgs:'dc_person_msgs',
  stageLay:'dc_stages',venueCats:'dc_venue_cats',venueItems:'dc_venue_items',requests:'dc_requests'};
const COLS={
  events:['id','name','topic','pm','lead','sales','city','country','date','days','prov','milestones','alerts','dur','team','markers','kind','lanes','stages','ecode',
    'acode','moneyOk'], // moneyOk = Belén has OK'd wiring this event into Money/Invoicing/SPX (migration event_money_connection_needs_belen_ok, 3 Aug) // stages tolerant (1-line SQL: dispatch_projects_phases.sql); ecode = MARKETING code (E0xx, ActiveCampaign); acode = Jesús's ACCOUNTING code — different systems, both needed for time allocation (3 Aug)
  people:['id','name','role','access','email','finance','hr','billing','salesLead','holidayDays','photo','phone','startDate','workPlace','perms'], // startDate/workPlace/perms tolerant (SQL adds them)
  substages:['id','eventId','lane','stage','name','order','week','span','type'],
  /* substageId null = the task hangs straight off the STAGE. Valeria, 5 Aug: with 80
     material tasks, being forced to split them across substages just to file them is
     visual noise — "click Materials and the task list unfolds". Substages stay for the
     teams that use them as the steps of the stage; Belén: "os voy a dar los dos".
     assignee = the primary owner (every alarm, person page and digest reads it);
     assignees = the whole list, primary included. notes = the short note per task. */
  tasks:['id','eventId','lane','stage','substageId','title','assignee','deadline','status','assignees','notes','cancelReason'],
  /* per-event stage overrides: where a stage STARTS (weeks before the event), how wide it
     is, and what it is called here. Its own table rather than more jsonb on dc_events
     because dc_events is manager-only writable and Julián is a member — a stage row
     carries its lane, so RLS can let logistics move THEIR stages and nothing else. */
  stageLay:['id','eventId','lane','stageKey','start','dur','name'],
  /* the venue / event overview: Category → Item · Notes, the shape of Valeria's Excel */
  venueCats:['id','eventId','name','sort'],
  venueItems:['id','eventId','catId','item','notes','requestId','sort'],
  /* internal requests to logistics, per event: ask → quote in the thread → confirm →
     the item lands in that event's venue list; closing keeps it as history */
  requests:['id','eventId','personId','title','description','status','thread','reservedUntil','possibleSponsor','costEur','category','venueItemId','created'],
  finance:['id','eventId','name','edition','year','semester','city','when','pm','sales','target','stretch','invoiced','spex','notes'],
  weekly:['id','eventCode','name','year','date','week','topicLeads','eventLeads','sponsorsN','sponsorsEur','spxAcc','delegatesN','ticketsEur','ticketsAcc','telesalesN','telesalesEur','grabacionesEur','siteVisitsEur','totalEur','soFarEur','target','stretch',
    'signedEur','signedAcc'], // signed-but-not-yet-invoiced money (migration signed_money_won_details_accounting_code, 3 Aug)
  projects:['id','label','code','kind','sort','active',
    'eventId'], // board-event link for auto-created lines (dispatch_event_lines.sql)
  /* chargeYear = which holiday year these days come out of. Normally the calendar year of
     the dates, stored only when HR overrides it. Tolerant: stripped below
     if dispatch_hol_year.sql hasn't been run yet. */
  holidays:['id','personId','dateFrom','dateTo','workDays','note','status','log','type','replaces','chargeYear'],
  timesheets:['id','personId','week','hours'],
  /* tz/tzOffset = the DEVICE zone the 	ime string is expressed in (captured, never typed);
     place = what the person declares they are working FROM. Both tolerant: stripped at boot
     if the 3-line SQL has not run. Kept apart because they can legitimately disagree —
     Carlos's laptop says Madrid while he is in Chile. */
  timeclock:['id','personId','day','time','kind','manual','amends','reason','note','reportId','tz','tzOffset','place'], // hash/created_* are server-set
  tcreports:['id','personId','day','entryId','thread','status','claim','ratify'], // claim/ratify tolerant (dispatch_hr11_claims.sql)
  eventaway:['id','personId','dateFrom','dateTo','title','note'], // "at an event" — away from the office
  /* Facturación: "eventId" in invalloc/delegates = dc_finance.id (the event-edition money
     row) — H2 26 / DC Italia 26 live only there, and it's the row the money must sum into. */
  invoices:['id','codigo_contable','producto','cantidad','tipo_pase','pase_cantidad','fecha','numero_factura','pedido','vencimiento','responsable_comercial','razon_social','importe_base','en_usd','importe_usd','usd_rate','usd_rate_date','iva_pct','iva_motivo','iva_importe','total_factura','descuento_pct','status','fecha_cobro','importe_cobrado','metodo_pago','comentarios','abono_de','entered_by',
    'spxProposalId', // invoice ↔ contract link, set by Jesús in Facturación (dispatch_invoice_contract.sql)
    'spxFragmentId'], // which fragment of a split contract this invoice bills (dispatch_spx_fragments.sql)
  invalloc:['id','invoice_id','eventId','amount','passes','codigo','codigoId',
    'producto','tipo_pase','qty','price'], // Invoicing 2.0 line model (dispatch_invoicing2.sql)
  delegates:['id','eventId','source','invoice_id','sponsor_name','name','email','company','job_title','seller','crm_tagged','materials_sent','added_by','notes'],
  /* split-payment ledger: one row per partial payment against a dc_invoices row
     (deposit now, balance later…). The invoice's collected/outstanding + Paid
     status are DERIVED from the sum of these (dispatch_invoice_payments.sql). */
  payments:['id','invoice_id','fecha','importe','metodo','notas'],
  /* códigos = the item↔código-contable master Jesús maintains (item name + accounting
     code + optional link to a dc_finance event so RENMAD lines still roll into the € Dashboard) */
  codigos:['id','item','codigo','descripcion','eventId','archived'],
  /* team request box: anyone opens tickets about the Dispatch Center itself
     (bug / usability / change / idea); admins triage (status + priority);
     the thread jsonb holds follow-up comments [{who,when,text|sys}] */
  tickets:['id','personId','area','type','title','description','status','priority','thread','created'],
  /* SPX sales module. camelCase keys map 1:1 to the quoted columns in dispatch_spx.sql.
     Server-managed (updated_at/by, deleted) never pushed; createdAt/createdBy are set on
     insert (by the Proposal Builder or the app) and echoed unchanged on edits. */
  spxProps:['id','createdAt','createdBy','responsable','responsableName','responsableEmail','company','companyId','source','origen','salesStatus','contents','valueEur','valueEdited','fechaEnvio','fechaSeguimiento','notas','contacts','fileName','sentLink','isGeneral','mode','active','superseded','supersededBy',
    'accountType','stage','productPackage','packageTier','reasonForLoss',
    'signedAt','branding','attendeesN','speakersN','stand','brandedItems','wonNotes'], // Zoho-mirrored fields (dispatch_spx_zoho.sql) — salesStatus stays derived from stage; the Won pop-up's answers (3 Aug) live here and feed the event's SPX tab
  spxLines:['id','parentId','eventId','eventKey','eventName','valueEur','valueEdited','contents'],
  spxTargets:['id','eventId','sponsorshipTarget','sponsorshipStretch','pasesTarget','pasesStretch','convByStatus'],
  /* one SPX contract billed across several invoices (Jesús, 24 jul): the contract is
     "broken" into fragments and each invoice links to its own fragment */
  spxFrags:['id','proposalId','label','amount','expected','notes','sort'],
  companyMap:['id','canonicalName','marketingAliases','legalAliases','emailDomains','invoiceClientKey','confirmedBy','confirmedAt','status'],
  spxEventReg:['id','eventKey','name','financeId','sponsorshipTarget','sponsorshipStretch','pasesTarget','pasesStretch','convByStatus','active','sort'],
  /* personal to-dos (Me tab): each person sees ONLY their own (RLS) */
  todos:['id','personId','text','due','done','doneAt','color','sort','created'], // color tolerant (1-line SQL: dispatch_todos_color.sql)
  /* notifications inbox (🔔): ticket answers, HR notices, alarms. kind = ticket|notice|holiday.
     personId = recipient; fromName = display name of the sender; isRead toggled by the recipient. */
  /* batchKey collapses a burst into one message — see notifyAssigned() */
  inbox:['id','personId','kind','text','link','isRead','fromName','created','batchKey'],
  /* messages ON a holiday request. Approvers talk to each other here; the requester never
     sees those. toRequester=true flips a message into a note they DO see.
     personId = the REQUESTER (denormalised so the RLS policy stays a one-liner).
     Deliberately its own table, not a jsonb on dc_holidays: row-level security cannot hide
     one column of a row the requester is allowed to read. */
  holmsgs:['id','holidayId','personId','byName','text','toRequester','created'],
  /* the products an invoice line can be sold as. The ten originals are built into the
     code (they carry behaviour: tickets counts passes, abono is a credit note…); this
     table only holds the ones accounting adds itself — "Pase Online" for the Talks was
     the first. `pases` = behaves like Tickets (pass type × qty, delegate row, counts as
     ticket money on the SPX board). Retire, never delete: old invoices still resolve. */
  productos:['id','key','label','pases','sort','archived'],
  /* the conversation on a person's page: personId = whose thread it is (not the sender) */
  pmsgs:['id','personId','byId','byName','text','created'],
};
let _pmsgReady=false,_prodReady=false,_finReady=false,_weeklyReady=false,_hrReady=false,_tcReady=false,_eventReady=false,_billReady=false,_payReady=false,_tickReady=false,_spxReady=false,_spxEvReady=false,_spxFragReady=false,_todoReady=false,_inboxReady=false,_holmsgReady=false; // optional tables (tolerant: app works without them)
let _stageLayReady=false,_venueReady=false,_reqReady=false; // logistics round, 6 Aug 2026
/* ---- module flags travel WITH the snapshot (30 Jul fix) ----
   A snapshot boot used to render with every flag still false, so pages showed
   "module not active — run X.sql in Supabase" although Supabase had everything;
   Belén read it as SQL never applied. The snapshot now restores the flags the
   live load discovered, so the first paint knows what exists. */
function _modFlags(){return {fin:_finReady,weekly:_weeklyReady,hr:_hrReady,tc:_tcReady,event:_eventReady,
  bill:_billReady,pay:_payReady,tick:_tickReady,spx:_spxReady,spxEv:_spxEvReady,spxFrag:_spxFragReady,
  todo:_todoReady,inbox:_inboxReady,holmsg:_holmsgReady,pmsg:_pmsgReady,prod:_prodReady,
  stageLay:_stageLayReady,venue:_venueReady,req:_reqReady,
  w:{_extColsMissing:window._extColsMissing,_phaseColMissing:window._phaseColMissing,_tzReady:window._tzReady,
     _permsColReady:window._permsColReady,_holYearColMissing:window._holYearColMissing,_projEvReady:window._projEvReady,
     _claimReady:window._claimReady,_inv2Ready:window._inv2Ready,_tzColsReady:window._tzColsReady,_tdColorMissing:window._tdColorMissing}};}
function _setModFlags(f){if(!f)return;
  _finReady=!!f.fin;_weeklyReady=!!f.weekly;_hrReady=!!f.hr;_tcReady=!!f.tc;_eventReady=!!f.event;
  _billReady=!!f.bill;_payReady=!!f.pay;_tickReady=!!f.tick;_spxReady=!!f.spx;_spxEvReady=!!f.spxEv;
  _spxFragReady=!!f.spxFrag;_todoReady=!!f.todo;_inboxReady=!!f.inbox;_holmsgReady=!!f.holmsg;
  _pmsgReady=!!f.pmsg;_prodReady=!!f.prod;
  _stageLayReady=!!f.stageLay;_venueReady=!!f.venue;_reqReady=!!f.req;
  Object.keys(f.w||{}).forEach(k=>{if(f.w[k]!==undefined)window[k]=f.w[k];});}
function pickRow(r,key){const o={};COLS[key].forEach(c=>{o[c]=(r[c]===undefined?null:r[c]);});return o;}
let _shadow=null; // last-synced picture, per table, id -> JSON string of picked row
/* skip = tables whose write was refused this round: their shadow must stay as it was,
   or the rows that never landed would be marked "saved" and silently lost (3 Aug). */
function snapshot(skip){if(!_shadow)_shadow={};
  Object.keys(TABLES).forEach(k=>{if(skip&&skip[k])return;
    _shadow[k]={};(DB.data[k]||[]).forEach(r=>{_shadow[k][r.id]=JSON.stringify(pickRow(r,k));});});}

const DB={
  data:null,
  async load(){
    if(USE_SUPABASE){
      /* SNAPSHOT-FIRST (batch 3, 29 Jul 2026): render NOW from the last-known copy in
         sessionStorage, fetch fresh data in the background, re-render through the same
         'dc-remote' event realtime already uses. Every click between pages used to
         re-download the whole DB (~2 MB) before drawing; now only the first page of the
         session pays that, and even it pays only once. The snapshot is per-user (RLS!),
         per-STORE_VERSION, tab-scoped (sessionStorage) and ≤30 min old — anything else
         falls through to a normal live load. */
      try{const {data}=await sb.auth.getSession();this._snapEm=(data&&data.session&&data.session.user&&data.session.user.email)||'';}catch(e){this._snapEm='';}
      const snap=this._readSnap();
      if(snap){
        this.data=snap.data;_setModFlags(snap.flags);rebuildProductos();snapshot();this.fromSnapshot=true;
        setTimeout(()=>{this._refresh();},0);
        setTimeout(()=>{try{subscribeRealtime();}catch(e){console.warn('realtime:',e.message||e);}},0);
        return this.data;
      }
      await this._live();
      this._writeSnap();
      setTimeout(()=>{try{subscribeRealtime();}catch(e){console.warn('realtime:',e.message||e);}},0);
      return this.data;
    }
    try{this.data=JSON.parse(localStorage.getItem('dispatchStore'));}catch(e){this.data=null;}
    if(!this.data||this.data.v!==STORE_VERSION){this.data=buildSeed();localStorage.setItem('dispatchStore',JSON.stringify(this.data));}
    if(!this.data.payments)this.data.payments=[]; // tolerant: older local stores predate the ledger
    if(!this.data.productos)this.data.productos=[]; // …and predate the custom-product list
    if(!this.data.pmsgs)this.data.pmsgs=[];         // …and the per-person conversation
    ['stageLay','venueCats','venueItems','requests'].forEach(k=>{if(!this.data[k])this.data[k]=[];}); // …and the 6 Aug logistics round
    rebuildProductos();
    return this.data;
  },
  /* fresh copy in the background after a snapshot boot. If a save raced the refresh,
     run one more pass so the fetched picture cannot bury an edit made mid-flight. */
  async _refresh(){
    const started=Date.now();
    try{
      await this._live();
      this._writeSnap();
      window.dispatchEvent(new CustomEvent('dc-remote',{detail:{src:'snap-refresh'}}));
      if(this._dirtyAt&&this._dirtyAt>started)setTimeout(()=>this._refresh(),500);
    }catch(e){console.warn('background refresh failed — keeping the cached copy:',e.message||e);}
  },
  _snapKey(){return 'dcSnap:'+STORE_VERSION+':'+(this._snapEm||'');},
  _readSnap(){
    try{
      const raw=sessionStorage.getItem(this._snapKey());if(!raw)return null;
      const s=JSON.parse(raw);
      if(!s||!s.t||Date.now()-s.t>30*60*1000)return null;      // too old to flash at the user
      if(!s.data||!Array.isArray(s.data.people)||!s.data.people.length)return null;
      if(!s.flags)return null;   // pre-30-Jul snapshot without flags → do a live boot instead
      return {data:s.data,flags:s.flags};
    }catch(e){return null;}
  },
  _writeSnap(){
    try{
      if(!USE_SUPABASE||!this.data)return;
      Object.keys(sessionStorage).filter(k=>k.indexOf('dcSnap:')===0&&k!==this._snapKey())
        .forEach(k=>sessionStorage.removeItem(k));                // user/version switch: drop foreign snapshots
      sessionStorage.setItem(this._snapKey(),JSON.stringify({t:Date.now(),data:this.data,flags:_modFlags()}));
    }catch(e){/* quota / private mode: the snapshot is a luxury, never an error */}
  },
  async _live(){
      /* ONE WAVE, NOT TWENTY (Belén, 29 Jul 2026 — "las páginas tardan en cargar").
         Every module below used to be awaited in turn, so opening any page paid ~20
         round trips to Supabase (2–4 s on a normal connection) before it drew a single
         pixel — and this app is multi-page, so every click paid it again. The loads do
         not depend on each other, so they now all start together: the boot costs the
         SLOWEST query instead of the sum of all of them. Each module keeps its own
         try/catch, so a table that has not been created yet still degrades on its own.
         Built into a LOCAL object and swapped into this.data in one piece at the end —
         a background refresh must never blank a page that is already drawn. */
      const D={events:[],people:[],substages:[],tasks:[],finance:[],weekly:[],
        projects:[],holidays:[],timesheets:[],timeclock:[],tcreports:[],eventaway:[],
        invoices:[],invalloc:[],delegates:[],codigos:[],payments:[],tickets:[],
        todos:[],inbox:[],holmsgs:[],spxProps:[],spxLines:[],spxTargets:[],
        companyMap:[],spxFrags:[],spxEventReg:[],productos:[],pmsgs:[],
        stageLay:[],venueCats:[],venueItems:[],requests:[]};
      /* paged: Supabase caps a select at 1000 rows and TRUNCATES SILENTLY (audit Critical 4) */
      const paged=async tbl=>{const out=[];let from=0,page=1000;
        for(;;){const r=await sb.from(tbl).select('*').eq('deleted',false).order('id').range(from,from+page-1);
          if(r.error)throw r.error;out.push.apply(out,r.data||[]);
          if(!r.data||r.data.length<page)break;from+=page;}return out;};
      /* a column the SQL has not added yet must never be pushed — PostgREST rejects unknowns */
      const strip=(key,cols)=>cols.forEach(c=>{const i=COLS[key].indexOf(c);if(i>=0)COLS[key].splice(i,1);});

      const pCore=(async()=>{
        const keys=['events','people','substages','tasks'];
        const res=await Promise.all(keys.map(k=>sb.from(TABLES[k]).select('*').eq('deleted',false).order('id')));
        const bad=res.find(r=>r.error);
        if(bad)throw new Error(bad.error.message+' — if the dc_* tables are missing, run dispatch_upgrade.sql in the Supabase SQL editor first.');
        keys.forEach((k,i)=>{D[k]=res[i].data||[];});
        /* Projects split is tolerant: until the 2-line SQL adds kind/lanes to dc_events,
           never push those columns and flag the UI */
        window._extColsMissing=false;
        if(D.events.length && !('kind' in D.events[0])){window._extColsMissing=true;strip('events',['kind','lanes']);}
        /* per-project phases are tolerant the same way (dispatch_projects_phases.sql adds
           `stages`); without it a project still renders — it just cannot save custom phases */
        window._phaseColMissing=false;
        if(D.events.length && !('stages' in D.events[0])){window._phaseColMissing=true;strip('events',['stages']);}
        /* startDate on people is tolerant the same way (1-line SQL adds it) */
        if(D.people.length && !('startDate' in D.people[0]))strip('people',['startDate']);
        /* …and so is the declared working place */
        window._tzReady=true;
        if(D.people.length && !('workPlace' in D.people[0])){window._tzReady=false;strip('people',['workPlace']);}
        /* per-cell permission overrides (perms jsonb) — tolerant until the 1-line SQL runs */
        window._permsColReady=true;
        if(D.people.length && !('perms' in D.people[0])){window._permsColReady=false;strip('people',['perms']);}
      })();

      /* claims are tolerant: until dispatch_hr11_claims.sql runs, never push claim/ratify
         and fall back to the old report form. Explicit probe — the table may legitimately
         have zero rows. */
      const pClaim=(async()=>{window._claimReady=true;
        try{const cp=await sb.from('dc_tcreports').select('claim').limit(1);if(cp.error)throw cp.error;}
        catch(e){window._claimReady=false;strip('tcreports',['claim','ratify']);}
      })();

      /* finance is tolerant: the app runs fine before dispatch_finance.sql exists */
      _finReady=false;
      const pFin=(async()=>{
        try{const fr=await sb.from('dc_finance').select('*').eq('deleted',false).order('id');
          if(fr.error)throw fr.error;D.finance=fr.data||[];_finReady=true;
        }catch(e){console.warn('finance module not ready:',e.message||e);}
      })();

      /* weekly pacing data (dashboard): tolerant + paged */
      _weeklyReady=false;
      const pWeekly=(async()=>{
        try{D.weekly=await paged('dc_weekly');_weeklyReady=true;}
        catch(e){D.weekly=[];console.warn('weekly module not ready:',e.message||e);}
      })();

      /* HR module (projects + holidays + timesheets): tolerant too */
      _hrReady=false;
      const pHr=(async()=>{
        try{
          /* holidays paged too: ~100+ rows/yr — the 1000-row cap would silently
             truncate balances in a few seasons (same trap as invoices/SPX) */
          const [pr,ho,ts]=await Promise.all([
            sb.from('dc_projects').select('*').eq('deleted',false).order('sort'),
            paged('dc_holidays'),
            sb.from('dc_timesheets').select('*').eq('deleted',false).order('id')]);
          if(pr.error)throw pr.error;if(ts.error)throw ts.error;
          D.projects=pr.data||[];D.holidays=ho||[];D.timesheets=ts.data||[];
          _hrReady=true;
          /* tolerant like the events kind/lanes split: until dispatch_hol_year.sql adds
             chargeYear, never push the column. The Jan/Feb rule still works — it is
             derived from the dates. */
          window._holYearColMissing=false;
          if(D.holidays.length && !('chargeYear' in D.holidays[0])){window._holYearColMissing=true;strip('holidays',['chargeYear']);}
          /* event-line cascade is tolerant too: until dispatch_event_lines.sql adds
             dc_projects."eventId", never push it and skip the auto-project sweep
             (without the link column the dedupe cannot be trusted). */
          window._projEvReady=true;
          if(D.projects.length && !('eventId' in D.projects[0])){window._projEvReady=false;strip('projects',['eventId']);}
        }catch(e){console.warn('HR module not ready:',e.message||e);}
      })();

      /* time clock (registro horario): append-only + no "deleted" column → own paged load */
      _tcReady=false;
      const pTc=(async()=>{
        try{
          /* tz/tzOffset/place are tolerant: probe the column, because the table is
             append-only and row 0 is the OLDEST punch — it will never have them */
          window._tzColsReady=true;
          try{const tp=await sb.from('dc_timeclock').select('tz').limit(1);if(tp.error)throw tp.error;}
          catch(e){window._tzColsReady=false;strip('timeclock',['tz','tzOffset','place']);}
          const out=[];let from=0,page=1000;
          for(;;){const tr=await sb.from('dc_timeclock').select('*').order('id').range(from,from+page-1);
            if(tr.error)throw tr.error;out.push.apply(out,tr.data||[]);
            if(!tr.data||tr.data.length<page)break;from+=page;}
          D.timeclock=out;
          const rp=await sb.from('dc_tcreports').select('*').eq('deleted',false).order('id');
          if(rp.error)throw rp.error;D.tcreports=rp.data||[];
          _tcReady=true;
        }catch(e){console.warn('time clock module not ready:',e.message||e);}
      })();

      /* "at an event" away-days (tolerant — app runs fine before dispatch_hr8_events.sql) */
      _eventReady=false;
      const pAway=(async()=>{
        try{const er=await sb.from('dc_eventaway').select('*').eq('deleted',false).order('id');
          if(er.error)throw er.error;D.eventaway=er.data||[];_eventReady=true;
        }catch(e){console.warn('event-away module not ready:',e.message||e);}
      })();

      /* Facturación (invoices + allocations + delegates + código lookup): tolerant —
         the app runs fine before dispatch_facturacion.sql is applied */
      _billReady=false;
      const pBill=(async()=>{
        try{
          const [iv,al,dg,cg]=await Promise.all([
            paged('dc_invoices'),paged('dc_invoice_alloc'),paged('dc_delegates'),paged('dc_codigos')]);
          D.invoices=iv;D.invalloc=al;D.delegates=dg;D.codigos=cg;
          _billReady=true;
        }catch(e){console.warn('facturación module not ready:',e.message||e);}
      })();
      /* Invoicing 2.0 line columns are tolerant: until dispatch_invoicing2.sql runs,
         never push producto/tipo_pase/qty/price on alloc rows. Explicit probe — the
         table may legitimately be empty. Runs beside the load, not after it. */
      const pInv2=(async()=>{window._inv2Ready=true;
        try{const p2=await sb.from('dc_invoice_alloc').select('qty').limit(1);if(p2.error)throw p2.error;}
        catch(e){window._inv2Ready=false;strip('invalloc',['producto','tipo_pase','qty','price']);}
      })();

      /* the per-person conversation (tolerant like everything else) */
      _pmsgReady=false;
      const pPmsg=(async()=>{
        try{const pm=await sb.from('dc_person_msgs').select('*').eq('deleted',false).order('id');
          if(pm.error)throw pm.error;D.pmsgs=pm.data||[];_pmsgReady=true;
        }catch(e){console.warn('person messages not ready:',e.message||e);}
      })();
      /* the products a line can be sold as (dc_productos). Tolerant: without the table
         the built-in list still works, the "Products" pop-up just says to run the SQL. */
      _prodReady=false;
      const pProd=(async()=>{
        try{const pr=await sb.from('dc_productos').select('*').eq('deleted',false).order('sort');
          if(pr.error)throw pr.error;D.productos=pr.data||[];_prodReady=true;
        }catch(e){console.warn('products table not ready:',e.message||e);}
      })();

      /* split-payment ledger (tolerant — its OWN loader so a missing table never
         affects the invoices/allocs load; run dispatch_invoice_payments.sql) */
      _payReady=false;
      const pPay=(async()=>{
        try{D.payments=await paged('dc_invoice_payments');_payReady=true;}
        catch(e){console.warn('invoice payments module not ready:',e.message||e);}
      })();

      /* team request box (tolerant — app runs fine before dispatch_tickets.sql) */
      _tickReady=false;
      const pTick=(async()=>{
        try{const tk=await sb.from('dc_tickets').select('*').eq('deleted',false).order('id');
          if(tk.error)throw tk.error;D.tickets=tk.data||[];_tickReady=true;
        }catch(e){console.warn('requests module not ready:',e.message||e);}
      })();

      /* ---- the logistics round (6 Aug 2026), all three tolerant like everything above ---- */
      _stageLayReady=false;
      const pStageLay=(async()=>{
        try{const r=await sb.from('dc_stages').select('*').eq('deleted',false).order('id');
          if(r.error)throw r.error;D.stageLay=r.data||[];_stageLayReady=true;
        }catch(e){console.warn('stage layout not ready:',e.message||e);}
      })();
      _venueReady=false;
      const pVenue=(async()=>{
        try{const [c,i]=await Promise.all([
            sb.from('dc_venue_cats').select('*').eq('deleted',false).order('sort'),
            sb.from('dc_venue_items').select('*').eq('deleted',false).order('sort')]);
          if(c.error)throw c.error;if(i.error)throw i.error;
          D.venueCats=c.data||[];D.venueItems=i.data||[];_venueReady=true;
        }catch(e){console.warn('venue module not ready:',e.message||e);}
      })();
      _reqReady=false;
      const pReq=(async()=>{
        try{const r=await sb.from('dc_requests').select('*').eq('deleted',false).order('id');
          if(r.error)throw r.error;D.requests=r.data||[];_reqReady=true;
        }catch(e){console.warn('event requests not ready:',e.message||e);}
      })();

      /* personal to-dos + notifications inbox (tolerant — run dispatch_me_inbox.sql to enable) */
      _todoReady=false;
      const pTodo=(async()=>{
        try{const td=await sb.from('dc_todos').select('*').eq('deleted',false).order('sort');
          if(td.error)throw td.error;D.todos=td.data||[];_todoReady=true;
          /* colour coding is tolerant: probe the column itself (a person with an empty
             list has no row to inspect). Until dispatch_todos_color.sql runs, never push
             `color` and the UI hides the palette. */
          window._tdColorMissing=false;
          const probe=await sb.from('dc_todos').select('color').limit(1);
          if(probe.error){window._tdColorMissing=true;strip('todos',['color']);}
        }catch(e){console.warn('to-dos module not ready:',e.message||e);}
      })();
      _inboxReady=false;
      const pInbox=(async()=>{
        try{const ib=await sb.from('dc_inbox').select('*').eq('deleted',false).order('id',{ascending:false}).limit(400);
          if(ib.error)throw ib.error;D.inbox=ib.data||[];_inboxReady=true;
        }catch(e){console.warn('inbox module not ready:',e.message||e);}
      })();

      /* messages ON a holiday request (tolerant — the app runs fine before dispatch_hol_msgs.sql).
         RLS already hides approver-only messages from the requester. */
      _holmsgReady=false;
      const pHolmsg=(async()=>{
        try{const hm=await sb.from('dc_holiday_msgs').select('*').eq('deleted',false).order('id');
          if(hm.error)throw hm.error;D.holmsgs=hm.data||[];_holmsgReady=true;
        }catch(e){console.warn('holiday messages not ready:',e.message||e);}
      })();

      /* SPX sales module (proposals + lines + targets + company crosswalk): tolerant */
      _spxReady=false;
      const pSpx=(async()=>{
        try{
          const [sp,sl,stg,cm]=await Promise.all([
            paged('dc_spx_proposals'),paged('dc_spx_lines'),paged('dc_spx_targets'),paged('dc_company_map')]);
          D.spxProps=sp;D.spxLines=sl;D.spxTargets=stg;D.companyMap=cm;
          _spxReady=true;
        }catch(e){console.warn('SPX module not ready:',e.message||e);}
      })();
      /* SPX billing fragments (tolerant + separate: a contract with no fragments simply
         bills in one invoice, exactly as before dispatch_spx_fragments.sql is applied) */
      _spxFragReady=false;
      const pFrag=(async()=>{
        try{const fr=await sb.from('dc_spx_fragments').select('*').eq('deleted',false).order('sort');
          if(fr.error)throw fr.error;D.spxFrags=fr.data||[];_spxFragReady=true;
        }catch(e){console.warn('SPX billing fragments not ready:',e.message||e);}
      })();
      /* SPX event registry (tolerant + separate: the board works before it exists, falling
         back to proposal-derived events) */
      _spxEvReady=false;
      const pReg=(async()=>{
        try{const er=await sb.from('dc_spx_events').select('*').eq('deleted',false).order('sort');
          if(er.error)throw er.error;D.spxEventReg=er.data||[];_spxEvReady=true;
        }catch(e){console.warn('SPX event registry not ready:',e.message||e);}
      })();

      await Promise.all([pCore,pClaim,pFin,pWeekly,pHr,pTc,pAway,pBill,pInv2,pProd,pPmsg,pPay,pTick,pTodo,pInbox,pHolmsg,pSpx,pFrag,pReg,pStageLay,pVenue,pReq]);
      if(!D.people.length){
        let em='';try{const {data}=await sb.auth.getUser();em=(data&&data.user&&data.user.email)||'';}catch(e){}
        throw new Error('No data is visible for your login'+(em?' ('+em+')':'')+'. Either your email is not in the personnel roster yet — ask Belén to add it (exactly as you log in) — or, if this is everyone, dispatch_upgrade.sql has not been run in Supabase.');
      }
      this.data=D;            // one-piece swap (see note above)
      rebuildProductos();
      snapshot();
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
    this._dirtyAt=Date.now();   // a background snapshot-refresh started before this edit must re-run
    if(_syncing){_pendingSync=true;return true;}
    _syncing=true;
    const touched={};   // tables this sync actually pushed — feeds the weekly auto-refresh
    /* ONE TABLE'S REFUSAL MUST NOT SILENCE THE OTHER 28 (Belén, 3 Aug: "a lot of the data
       is not getting cascaded through"). This loop used to throw on the first refused
       write, so everything after that table in TABLES order — invoices, hours, the SPX
       board, notifications — never got its turn either, on every retry, for ever. Now
       each table stands or falls alone: the healthy ones are saved and snapshotted, the
       refused one keeps its shadow (so it retries) and raises the banner. */
    const failed={};let firstErr=null;
    try{
      for(const k of Object.keys(TABLES)){
        if(k==='finance'&&!_finReady)continue; // finance table not created yet
        if(k==='weekly'&&!_weeklyReady)continue; // weekly table not created yet
        if((k==='projects'||k==='holidays'||k==='timesheets')&&!_hrReady)continue; // HR tables not created yet
        if((k==='timeclock'||k==='tcreports')&&!_tcReady)continue; // time clock tables not created yet
        if(k==='eventaway'&&!_eventReady)continue; // event-away table not created yet
        if((k==='invoices'||k==='invalloc'||k==='delegates'||k==='codigos')&&!_billReady)continue; // facturación tables not created yet
        if(k==='payments'&&!_payReady)continue; // split-payment ledger table not created yet
        if(k==='tickets'&&!_tickReady)continue; // requests table not created yet
        if(k==='todos'&&!_todoReady)continue; // to-dos table not created yet
        if(k==='inbox'&&!_inboxReady)continue; // inbox table not created yet
        if(k==='holmsgs'&&!_holmsgReady)continue; // holiday messages table not created yet
        if(k==='productos'&&!_prodReady)continue; // custom-products table not created yet
        if(k==='pmsgs'&&!_pmsgReady)continue; // person-messages table not created yet
        if((((k==='spxProps'||k==='spxLines'||k==='spxTargets'||k==='companyMap')&&!_spxReady)||(k==='spxEventReg'&&!_spxEvReady)||(k==='spxFrags'&&!_spxFragReady)))continue; // SPX tables not created yet
        const tbl=TABLES[k],seen={},inserts=[],updates=[],dels=[];
        (this.data[k]||[]).forEach(r=>{
          const p=pickRow(r,k),s=JSON.stringify(p);seen[r.id]=true;
          if(!(r.id in _shadow[k]))inserts.push(p);
          else if(_shadow[k][r.id]!==s)updates.push(p);
        });
        Object.keys(_shadow[k]).forEach(id=>{if(!seen[id])dels.push(id);});
        if(k==='timeclock'){updates.length=0;dels.length=0;} // registro horario: APPEND-ONLY, never update/delete
        try{
          if(inserts.length){
            /* dc_weekly is a DERIVED table whose real key is (eventCode, week), not the
               id. A row soft-deleted earlier still occupies that key while being invisible
               to the app, so the engine recreates it and the insert is refused for ever —
               that is exactly what jammed every save on 3 Aug (E059, E061). Upserting on
               the real key revives the ghost instead of colliding with it. */
            const {error}=(k==='weekly')
              ?await sb.from(tbl).upsert(inserts.map(p=>Object.assign({deleted:false},p)),{onConflict:'eventCode,week'})
              :await sb.from(tbl).insert(inserts);
            if(error)throw error;
          }
          for(const p of updates){const {error}=await sb.from(tbl).update(p).eq('id',p.id);if(error)throw error;}
          if(dels.length){const {error}=await sb.from(tbl).update({deleted:true}).in('id',dels);if(error)throw error;}
          if(inserts.length||updates.length||dels.length)touched[k]=true;
        }catch(e){failed[k]=true;if(!firstErr)firstErr=e;console.error('sync refused on '+tbl,e);}
      }
      snapshot(failed);   // only the tables that really landed count as saved
      this._writeSnap();                        // keep the page-boot snapshot as fresh as the DB
      /* an invoice or board change re-derives this week's dc_weekly rows by itself
         (Belén, 29 Jul night) — change-detected, so it cannot loop */
      try{weeklyAutoHook(touched);}catch(e){}
      if(firstErr)throw firstErr;               // the healthy tables are already safe — now raise the banner
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
      _punchAck={ok:false,blocked:true,kind,time:_now,msg,at:Date.now()};
      return {ok:false,blocked:true,msg};
    }
    if(_last&&_last.kind===kind){
      const msg='You are already clocked '+(kind==='in'?'in':'out')+' (since '+String(_last.time).slice(0,5)+').';
      _punchAck={ok:false,blocked:true,kind,time:_now,msg,at:Date.now()};
      return {ok:false,blocked:true,msg};
    }
    const row=Object.assign({id:this.newId(),personId:me.id,day:_day,time:_now,kind,manual:false,amends:null,reason:null,note:null,reportId:null},tzStamp());
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
  /* write ONE punch at a stated day/time (the midnight split — never a button). Same
     insert-now / queue-on-failure safety as punch(), but no "is it my turn" guards:
     the caller has already decided, and the reason goes into the permanent record. */
  async punchAt(kind,day,time,reason){
    const me=this.currentUser;if(!me)return {ok:false};
    const row=Object.assign({id:this.newId(),personId:me.id,day:day,time:time,kind:kind,manual:false,amends:null,reason:reason||null,note:null,reportId:null},tzStamp());
    if(!USE_SUPABASE){this.timeclock.push(row);this.save();return {ok:true,row};}
    try{
      const {error}=await sb.from('dc_timeclock').insert([pickRow(row,'timeclock')]);
      if(error)throw error;
      this.data.timeclock.push(row);
      if(_shadow&&_shadow.timeclock)_shadow.timeclock[row.id]=JSON.stringify(pickRow(row,'timeclock'));
      return {ok:true,row};
    }catch(e){
      console.error('midnight punch failed',e);
      const q=pendingPunches();q.push(pickRow(row,'timeclock'));setPendingPunches(q);
      return {ok:false,row,msg:e.message||''+e};
    }
  },
  /* Re-read ONE person's punches for named days straight from the server and merge in
     whatever this tab is missing. The clock is append-only, so this can only ADD rows —
     it can never undo an edit waiting to sync. Returns false when the read failed: a
     caller that is about to WRITE to the record must then do nothing rather than act on
     a picture it could not confirm. (Araceli, 4 Aug 2026 — see splitAtMidnight.) */
  async refreshPunchDays(personId,days){
    if(!USE_SUPABASE||!sb)return true;                    // offline rig: memory IS the record
    try{
      const r=await sb.from('dc_timeclock').select('*').eq('personId',personId).in('day',days);
      if(r.error)throw r.error;
      const have={};(this.data.timeclock||[]).forEach(x=>{have[x.id]=true;});
      (r.data||[]).forEach(row=>{
        if(have[row.id])return;
        this.data.timeclock.push(row);
        if(_shadow&&_shadow.timeclock)_shadow.timeclock[row.id]=JSON.stringify(pickRow(row,'timeclock'));
      });
      return true;
    }catch(e){console.warn('clock re-read failed',e.message||e);return false;}
  },
  /* --- THE MIDNIGHT SPLIT (Belén, 29 Jul 2026) ---------------------------------
     Punches pair inside ONE calendar day, so a session that crossed 00:00 could never be
     closed: the old day stayed open for ever and the hours were lost. Carlos works Chilean
     afternoons on a laptop still set to Madrid, so he crossed midnight every night (27 and
     28 Jul, both reported at 00:17 and 00:01 — which is also why his reports carry the
     wrong date); Cristina worked to 1:30 and watched the timer stop.
     We only ever split when the app was OPEN and SAW it happen (the tick below observed the
     date change a moment ago). If the app was closed at midnight we invent nothing — that
     stays a forgotten clock-out, with the banner and the claim form it always had. */
  async splitAtMidnight(prevDay,newDay){
    const me=this.currentUser;if(!me||isTeamAccount(me)||!this.tcReady())return false;
    if(!prevDay||!newDay||prevDay>=newDay)return false;
    if(!tcDayInfo(me.id,prevDay).open)return false;        // nothing was left open
    if(tcEffective(me.id,newDay).length)return false;      // the new day already has punches
    /* NEVER SPLIT ON A STALE PICTURE (Araceli, night of 3→4 Aug 2026). She clocked out at
       16:34 and the clock still opened a session for her at 00:00, because the tab that saw
       midnight had been open since the morning and had never learnt about that clock-out —
       another tab (or her phone) made it, and a tab left visible all day can sit on a dead
       realtime socket without ever being reloaded. The check above was therefore reading a
       picture from before lunch. A write to an append-only ledger has to be decided on what
       the SERVER says right now: ask it, re-check, and if we cannot ask, invent nothing. */
    if(!(await this.refreshPunchDays(me.id,[prevDay,newDay])))return false;
    if(!tcDayInfo(me.id,prevDay).open)return false;
    if(tcEffective(me.id,newDay).length)return false;
    /* and if two tabs of the same browser both watch midnight go by, only one writes */
    try{const K='dcMidnightSplit',mine=me.id+'|'+newDay;
      if(localStorage.getItem(K)===mine)return false;
      localStorage.setItem(K,mine);}catch(e){}
    const R='automatic midnight split';
    const a=await this.punchAt('out',prevDay,'23:59:59',R+' — the day ended while you were still clocked in');
    if(!a.ok)return false;
    await this.punchAt('in',newDay,'00:00:00',R+' — carried over from '+prevDay);
    try{window.dispatchEvent(new CustomEvent('dc-midnight',{detail:{prevDay,newDay}}));}catch(e){}
    return true;
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
  /* ---- multi-assignee (Valeria, 5 Aug: "@JulianUribe, @CintiaHernandez") ----
     assignee is still the primary owner. taskPeople is the full list, and it is what
     every "is this mine?" question must ask from now on, or a co-assignee would never
     see the task on their own page. */
  taskPeople(t){
    const out=[];
    if(t&&t.assignee!=null&&t.assignee!=='')out.push(+t.assignee);
    (Array.isArray(t&&t.assignees)?t.assignees:[]).forEach(id=>{if(id!=null&&out.indexOf(+id)<0)out.push(+id);});
    return out;
  },
  taskIsMine(t,personId){return this.taskPeople(t).indexOf(+personId)>=0;},
  tasksOf(personId){return this.data.tasks.filter(t=>this.taskIsMine(t,personId));},
  /* every task filed under a stage — the ones hanging straight off it AND the ones
     inside its substages. This is what "click Materials and see the whole list" means. */
  tasksForStage(eventId,lane,stageKey){
    const subIds=this.substages.filter(s=>!s.deleted&&s.eventId==eventId&&s.lane===lane&&s.stage===stageKey).map(s=>s.id);
    return this.data.tasks.filter(t=>t.eventId==eventId&&t.lane===lane&&t.stage===stageKey
      && (t.substageId==null||subIds.indexOf(t.substageId)>=0));
  },
  /* only the ones with no substage — the flat list Valeria asked for */
  tasksOnStage(eventId,lane,stageKey){
    return this.data.tasks.filter(t=>t.eventId==eventId&&t.lane===lane&&t.stage===stageKey&&t.substageId==null);
  },
  currentUser:null,
  get finance(){return this.data.finance||[];},
  financeFor(eventId){return (this.data.finance||[]).find(f=>f.eventId==eventId);},
  /* finance figures: whole roster reads; ONLY people with the finance tick write
     (Belén + Jesús). Admin tier alone no longer grants it — Carlos = events only. */
  /* per-cell overrides (dc_people.perms) are consulted FIRST in every flag gate below —
     the generic entry point for pages is DB.can(key,'see'|'edit') */
  can(key,which){return which==='edit'?permEdit(this.currentUser,key):permSee(this.currentUser,key);},
  canFinance(){return this.can('money.figures','edit');},
  financeReady(){return !USE_SUPABASE||_finReady;},
  get weekly(){return this.data.weekly||[];},
  weeklyReady(){return !USE_SUPABASE||_weeklyReady;},
  /* re-pull dc_weekly on demand (Belén, 31 Jul: "the week by week numbers are NOT
     updating"). dc_weekly is deliberately OUT of realtime (bulk table), so another
     user's auto-refresh is invisible to an open dashboard until reload — this fetches
     a fresh copy instead. Skips while an edit is in flight (the shadow diff would
     push stale rows back) and rate-limits itself to one pull per 45 s. */
  _weeklyPulledAt:0,
  async reloadWeekly(){
    if(!USE_SUPABASE||!sb||!_weeklyReady)return false;
    if(_saveTimer||_syncing||_syncFails)return false;
    if(Date.now()-this._weeklyPulledAt<45000)return false;
    this._weeklyPulledAt=Date.now();
    try{
      const rows=await paged('dc_weekly');
      if(_saveTimer||_syncing||_syncFails)return false; // an edit started mid-fetch — keep local
      this.data.weekly=rows;
      _shadow.weekly={};rows.forEach(r=>{_shadow.weekly[r.id]=JSON.stringify(pickRow(r,'weekly'));});
      return true;
    }catch(e){console.warn('weekly reload:',e.message||e);return false;}
  },
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
  /* ---- products accounting maintains itself (built-ins live in the code) ---- */
  get productos(){return this.data.productos||[];},
  prodReady(){return !USE_SUPABASE||_prodReady;},
  /* ---- the conversation on a person's page ---- */
  get pmsgs(){return this.data.pmsgs||[];},
  pmsgReady(){return !USE_SUPABASE||_pmsgReady;},
  pmsgsFor(personId){return this.pmsgs.filter(m=>m.personId==personId).sort((a,b)=>(''+(a.created||'')).localeCompare(''+(b.created||''))||a.id-b.id);},
  /* ---- split-payment ledger: partial payments against an invoice ---- */
  get payments(){return this.data.payments||[];},
  payReady(){return !USE_SUPABASE||_payReady;},
  paymentsFor(invoiceId){return this.payments.filter(p=>p.invoice_id==invoiceId);},
  /* total collected on an invoice: the ledger's sum when it has payments, else the
     legacy single importe_cobrado (or the whole total if flagged pagado with nothing typed) */
  paidTotal(inv){if(!inv)return 0;const ps=this.payReady()?this.paymentsFor(inv.id):[];
    if(ps.length)return Math.round(ps.reduce((s,p)=>s+(+p.importe||0),0)*100)/100;
    if(inv.importe_cobrado!=null&&inv.importe_cobrado!=='')return +inv.importe_cobrado;
    return inv.status==='pagado'?(+inv.total_factura||0):0;},
  remainingOf(inv){return Math.round(((+inv.total_factura||0)-this.paidTotal(inv))*100)/100;},
  hasLedger(inv){return !!(inv&&this.payReady()&&this.paymentsFor(inv.id).length);},
  /* billing editor = the external invoicing freelancer (billing tick, provisioned by Belén)
     or an admin. Mirrors dc_can_bill() in SQL. Separate from the finance flag — Jesús
     keeps editing the € figures exactly as today. */
  canBill(){return this.can('invoicing.book','edit');},
  /* ---- team request box (tickets about the Dispatch Center itself) ---- */
  get tickets(){return this.data.tickets||[];},
  tickReady(){return !USE_SUPABASE||_tickReady;},

  /* ================= THE LOGISTICS ROUND (6 Aug 2026) =================
     Belén, after the meeting with Julián and Valeria: the logistics timeline is
     theirs. Everyone READS it — "anybody can check any time" is the whole point of
     the Dispatch — but only the two of them and Belén MOVE it, so that next year,
     with Biometano sitting on top of everything else, nobody drags someone else's
     stage by accident. Mirrors dc_can_logistics() in SQL, override included, so the
     buttons the page shows are exactly the writes the server will accept. */
  canLogistics(){
    const o=permOverride(this.currentUser,'logistics.plan');
    if(o&&o.edit!=null)return !!o.edit;
    const u=this.currentUser;
    return !!(u&&((''+(u.role||'')).toLowerCase()==='logistics'||isBelenP(u)));
  },
  /* the one question every timeline control asks. An external project is still run by
     its own team, exactly as dc_substages/dc_tasks already allow. */
  canEditLane(lane,ev){
    if(ev&&evKind(ev)==='external')return true;
    if(lane==='logistics')return this.canLogistics();
    return this.canManage();
  },
  /* per-event stage overrides (start week / width / name) */
  get stageLay(){return this.data.stageLay||[];},
  stageLayReady(){return !USE_SUPABASE||_stageLayReady;},
  stageLayFor(eventId,lane,stageKey){
    return this.stageLay.find(s=>!s.deleted&&s.eventId==eventId&&s.lane===lane&&s.stageKey===stageKey)||null;
  },
  /* get-or-create — every stage edit goes through here so the row shape stays in one place */
  stageLayRow(eventId,lane,stageKey){
    let r=this.stageLayFor(eventId,lane,stageKey);
    if(!r){r={id:this.newId(),eventId:+eventId,lane:lane,stageKey:stageKey,start:null,dur:null,name:null};
      this.data.stageLay=this.data.stageLay||[];this.data.stageLay.push(r);}
    return r;
  },
  /* venue / event overview */
  get venueCats(){return this.data.venueCats||[];},
  get venueItems(){return this.data.venueItems||[];},
  venueReady(){return !USE_SUPABASE||_venueReady;},
  venueCatsFor(eventId){return this.venueCats.filter(c=>!c.deleted&&c.eventId==eventId).sort((a,b)=>(a.sort||0)-(b.sort||0)||a.id-b.id);},
  venueItemsFor(catId){return this.venueItems.filter(i=>!i.deleted&&i.catId==catId).sort((a,b)=>(a.sort||0)-(b.sort||0)||a.id-b.id);},
  /* event requests */
  get requests(){return this.data.requests||[];},
  reqReady(){return !USE_SUPABASE||_reqReady;},
  requestsFor(eventId){return this.requests.filter(r=>!r.deleted&&r.eventId==eventId).sort((a,b)=>b.id-a.id);},
  /* open = still waiting on logistics. Answered counts: the asker has an answer but the
     line is not in the venue list yet, so by Belén's rule it is not yet asked-and-settled. */
  requestsOpen(eventId){return this.requestsFor(eventId).filter(r=>r.status==='open'||r.status==='answered');},
  /* the default checklist, dropped into an event the first time somebody opens its Venue
     tab. Returns how many lines it wrote so the page can say so. Never runs twice: an
     event that already has a category is one somebody has already worked on. */
  seedVenue(eventId){
    if(!this.canLogistics())return 0;
    if(this.venueCatsFor(eventId).length)return 0;
    let n=0;
    VENUE_DEFAULTS.forEach((c,ci)=>{
      const cat={id:this.newId(),eventId:+eventId,name:c.name,sort:(ci+1)*10};
      this.data.venueCats=this.data.venueCats||[];this.data.venueCats.push(cat);
      c.items.forEach((it,ii)=>{
        this.data.venueItems=this.data.venueItems||[];
        this.data.venueItems.push({id:this.newId(),eventId:+eventId,catId:cat.id,item:it,notes:'',requestId:null,sort:(ii+1)*10});
        n++;});
    });
    return n;
  },
  addVenueCat(eventId,name){
    const sort=(this.venueCatsFor(eventId).reduce((a,c)=>Math.max(a,c.sort||0),0))+10;
    const cat={id:this.newId(),eventId:+eventId,name:name||'New category',sort:sort};
    this.data.venueCats=this.data.venueCats||[];this.data.venueCats.push(cat);return cat;
  },
  addVenueItem(eventId,catId,item,notes,requestId){
    const sort=(this.venueItemsFor(catId).reduce((a,i)=>Math.max(a,i.sort||0),0))+10;
    const row={id:this.newId(),eventId:+eventId,catId:+catId,item:item||'',notes:notes||'',requestId:requestId||null,sort:sort};
    this.data.venueItems=this.data.venueItems||[];this.data.venueItems.push(row);return row;
  },
  /* the whole point of the request flow: when logistics confirms, the thing that was
     asked for stops living in a conversation and becomes a line on the event.
     Belén: "si no está ahí, no está pedido." */
  confirmRequest(req,catId){
    if(!req||!this.canLogistics())return null;
    let cid=catId;
    if(!cid){
      const cats=this.venueCatsFor(req.eventId);
      const want=(req.category||'Other').toLowerCase();
      const hit=cats.find(c=>(c.name||'').toLowerCase()===want);
      cid=hit?hit.id:(cats.length?cats[cats.length-1].id:this.addVenueCat(req.eventId,'Other').id);
    }
    const money=(req.costEur!=null&&req.costEur!=='')
      ? (typeof finFmt==='function'?finFmt(req.costEur):(req.costEur+' €')) : '';
    const notes=[req.description,money,req.reservedUntil?('held until '+deIso(req.reservedUntil)):'']
                 .filter(Boolean).join(' · ');
    const row=this.addVenueItem(req.eventId,cid,req.title,notes,req.id);
    req.venueItemId=row.id;req.status='confirmed';
    reqLog(req,'confirmed — added to the venue list');
    return row;
  },
  /* personal to-dos + notifications inbox */
  get todos(){return this.data.todos||[];},
  todoReady(){return !USE_SUPABASE||_todoReady;},
  get inbox(){return this.data.inbox||[];},
  inboxReady(){return !USE_SUPABASE||_inboxReady;},
  get holmsgs(){return this.data.holmsgs||[];},
  holmsgReady(){return !USE_SUPABASE||_holmsgReady;},
  /* who may open the 🌴 HR page at all: Belén + the HR tick + finance (Jesús — he only
     gets the Allocation-admin sections there; the page itself sub-gates the rest) */
  canSeeHR(){return this.can('hr.area','see');},
  /* ---- SPX sales module (sponsorship proposals + health-check + reporting) ----
     Board reads: whole roster. Writes gated to mirror the RLS in dispatch_spx.sql. */
  get spxProps(){return this.data.spxProps||[];},
  get spxLines(){return this.data.spxLines||[];},
  get spxTargets(){return this.data.spxTargets||[];},
  get companyMap(){return this.data.companyMap||[];},
  get spxEventReg(){return this.data.spxEventReg||[];},
  spxReady(){return !USE_SUPABASE||_spxReady;},
  spxLinesFor(parentId){return this.spxLines.filter(l=>l.parentId==parentId);},
  /* billing fragments of one contract, in the order they get invoiced */
  get spxFrags(){return this.data.spxFrags||[];},
  spxFragsReady(){return !USE_SUPABASE||_spxFragReady;},
  spxFragsFor(propId){return this.spxFrags.filter(f=>f.proposalId==propId).sort((a,b)=>((+a.sort||0)-(+b.sort||0))||((''+(a.expected||'')).localeCompare(''+(b.expected||''))));},
  spxFragById(id){return this.spxFrags.find(f=>f.id==id)||null;},
  spxTargetFor(finId){return this.spxTargets.find(t=>t.eventId==finId)||null;},
  /* sales lead (Cintia) or admin (Belén): edits ANY proposal + targets + crosswalk. Mirrors dc_can_sales_lead(). */
  /* "sales lead" = edits ANYONE's proposals (stronger than the Sales-role own-edit).
     A stored spx.board override decides BOTH ways: edit:true grants the full power,
     edit:false makes the board read-only for that person. No override -> the old rule. */
  canSalesLead(){const o=permOverride(this.currentUser,'spx.board');if(o&&o.edit!=null)return !!o.edit;
    return !!(this.currentUser&&(this.currentUser.salesLead||this.currentUser.access==='admin'));},
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
  /* an allocation line in EUROS. USD invoices carry their lines in dollars and the
     manual EUR figure in importe_base — scale by importe_base/importe_usd so dollar
     amounts never leak into € sums (Money page, SPX, exports). */
  allocEur(a){const inv=this.invoice(a.invoice_id);const amt=+a.amount||0;
    if(inv&&inv.en_usd){const usd=+inv.importe_usd||0,eur=+inv.importe_base||0;
      if(usd&&eur)return amt*(eur/usd);}
    return amt;},
  /* ---- the accounting rule for credit notes (Belén, 30 Jul 2026) ----
     A cancellation and its credit note SUM TO ZERO: the cancelled invoice stays IN the
     money sums (+X) and its abono subtracts it back (−X). The old rule excluded the
     cancelled invoice AND counted the abono → every cancellation dug the hole twice
     (−X net instead of 0, i.e. 2X below the truth). A cancelled invoice WITHOUT a live
     credit note (legacy/manual states) stays excluded — nothing negates it. */
  hasLiveAbono(inv){return !!inv&&this.invoices.some(x=>x.abono_de==inv.id&&x.status==='abono');},
  invCountsMoney(inv){if(!inv)return false;return inv.status!=='cancelado'||this.hasLiveAbono(inv);},
  /* product of an allocation line for per-product breakdowns: an abono's lines say
     "abono" — resolve them to the product of the invoice they cancel, so the negative
     lands in the same bucket (tickets/sponsorship) as the positive it nets out. */
  lineProdEff(a){const inv=this.invoice(a.invoice_id);
    let p=a.producto||(inv?inv.producto:'')||'';
    if(p==='abono'&&inv&&inv.abono_de){const orig=this.invoice(inv.abono_de);
      if(orig)p=orig.producto&&orig.producto!=='abono'?orig.producto:p;}
    return p;},
  /* the event's facturado = SUM of its invoice allocations (paid + unpaid; a cancelled
     invoice counts as long as its credit note does — the pair nets to zero).
     null when the event has no lines yet → caller falls back. */
  invoicedTotal(finId){let sum=0,any=false;
    this.invoiceAllocs.forEach(a=>{if(a.eventId!=finId)return;const inv=this.invoice(a.invoice_id);
      if(!this.invCountsMoney(inv))return;any=true;sum+=this.allocEur(a);});
    return any?sum:null;},
  /* what the money views show: invoice-line total when lines exist, else the typed
     dc_finance.invoiced (fallback for past events / before back-fill) */
  finInvoiced(f){if(!f)return null;const t=this.billReady()?this.invoicedTotal(f.id):null;return t==null?f.invoiced:t;},
  /* HR admin = Belén + the HR tick (Jesús). Deliberately NOT every events admin. */
  isHRAdmin(){const u=this.currentUser;
    const o=permOverride(u,'hr.pending');if(o&&o.edit!=null)return !!o.edit;   // per-cell override decides both ways
    return !!(u&&(u.hr||(u.email||'').toLowerCase()==='belen.gallego@ata.email'));},
  isAdmin(){return !!(this.currentUser&&this.currentUser.access==='admin');},
  canManage(){return !!(this.currentUser&&(this.currentUser.access==='admin'||this.currentUser.access==='manager'));},
  /* who may CREATE / retire the hour-allocation project numbers: Belén, Carlos and
     Jesús (accounting). Mirrors dc_can_finance() in SQL = admin OR finance flag, so
     the client shows the panel to exactly whom the server-side RLS will let write. */
  canManageProjects(){const u=this.currentUser;return !!(u&&(u.access==='admin'||u.finance));},
  /* ---------- ONE TRUE SOURCE for event identity (Belén, 30 Jul 2026) ----------
     The timeline event (dc_events) is the master record: its name cascades to
     reporting/SPX/invoicing labels, which are NOT editable downstream.
     ecode = the official event code (E057…) as its OWN field — deliberately
     EDITABLE on the timeline, because codes are often assigned after the event
     starts life. Falls back to a legacy "E0xx " name prefix while any remain. */
  evCode(ev){if(!ev)return null;const c=(''+(ev.ecode||'')).trim();if(c)return c.toUpperCase();
    const m=/^E\d+\b/.exec(ev.name||'');return m?m[0].toUpperCase():null;},
  /* ---- the MARKETING code (E0xx). Jesús assigns it in ZOHO; it tags everything in
     ActiveCampaign AND it is the join every report runs on, so a duplicate is not a
     cosmetic slip — on 3 Aug E059 and E061 were each on two events and the reporting
     was silently writing two rows per week for them. Hence a guard and a suggestion.
     Jesús's ACCOUNTING code is a different system entirely and lives in ev.acode. */
  ecodesInUse(exceptId){const out={};
    (this.events||[]).forEach(e=>{if(e.kind==='external'||e.id==exceptId)return;
      const c=this.evCode(e);if(c&&/^E\d+$/i.test(c))out[c.toUpperCase()]=e;});
    (this.spxEventReg||[]).forEach(g=>{if(g.deleted)return;
      const k=(''+(g.eventKey||'')).toUpperCase();if(/^E\d+$/.test(k)&&!out[k])out[k]=g;});
    (this.weekly||[]).forEach(w=>{const k=(''+(w.eventCode||'')).toUpperCase();
      if(/^E\d+$/.test(k)&&!out[k])out[k]={name:w.name,_history:true};});
    return out;},
  ecodeOwner(code,exceptId){const c=(''+(code||'')).trim().toUpperCase();
    if(!/^E\d+$/.test(c))return null;const o=this.ecodesInUse(exceptId)[c];
    return o?(o.name||o.eventKey||'another event'):null;},
  /* ---- what must actually BLOCK a code being typed (Belén, 3 Aug) ----
     ecodeOwner() answers "is this code known anywhere", which is right for suggesting the
     next free number and WRONG as a save guard: a code held by a registry row or by weekly
     history is usually this event's OWN past waiting to be attached to. Refusing it is how
     someone ends up saving an event with no code at all — which is the failure that started
     all this. So only a clash with ANOTHER TIMELINE EVENT blocks; everything else is an
     adoption, and evConnectPlan says so in the form before Save is pressed. */
  ecodeBlocker(code,exceptId){
    const c=(''+(code||'')).trim().toUpperCase();
    if(!/^E\d+$/.test(c))return null;
    /* THE ONE EXEMPTION (Belén, 3 Aug: "don't allow the same code twice, and do keep the
       warnings and the draft"). A code already sitting on a Money row that is still WAITING
       for its event is not a duplicate: typing it ATTACHES the two, and the code ends up on
       exactly one event. That is the whole point of the draft → adopt path, so it must stay
       open. Everything else below is refused — including a code that exists only in an old
       edition's weekly history, because reusing it would pour this event's money into that
       edition's curve. */
    const reg=(this.spxEventReg||[]).find(g=>!g.deleted&&(''+g.eventKey).trim().toUpperCase()===c);
    if(reg&&reg.financeId!=null){
      const f=(this.finance||[]).find(x=>!x.deleted&&x.id==reg.financeId);
      const waiting=f&&(f.eventId==null||f.eventId===''||!this.event(f.eventId));
      if(f&&(waiting||f.eventId==exceptId))return null;      // adoptable, or already this event's
    }
    /* strict from here: another timeline event, another registry entry, or weekly history */
    const o=this.ecodesInUse(exceptId)[c];
    return o?(o.name||o.eventKey||'another event'):null;},
  nextEcode(){const used=this.ecodesInUse(null);let hi=0;
    Object.keys(used).forEach(k=>{const n=parseInt(k.slice(1),10);if(n>hi)hi=n;});
    return 'E'+String(hi+1).padStart(3,'0');},
  /* ---- the ONE place a proposal line is matched to a registry event ----
     Precedence across the WHOLE registry: exact eventKey → financeId → alias. Without
     that order a key that is one event's own key AND another's alias resolves by
     registry order and the turnover splits or doubles. spx.html lineRegEvent() and
     spxStatusAll() both delegate here, so a line can never bucket two ways. */
  spxLineReg(l){
    const evs=(this.spxEventReg||[]).filter(e=>!e.deleted);
    if(!evs.length||!l)return null;
    const nk=k=>(''+(k==null?'':k)).trim().toLowerCase(),lk=nk(l.eventKey);
    let e=lk?evs.find(x=>nk(x.eventKey)===lk):null;
    if(!e&&l.eventId!=null)e=evs.find(x=>x.financeId!=null&&x.financeId==l.eventId);
    if(!e&&lk)e=evs.find(x=>((x.convByStatus&&x.convByStatus.aliases)||[]).some(a=>nk(a)===lk));
    return e||null;},
  /* ---- "current" vs "Before" for a registry event: ONE definition (Belén, 4 Aug:
     "any events whose dates have passed, please move them to before… you are constantly
     showing Invest 26, which bears no relevance to our current work"). An edition whose
     date has passed is Before FULL STOP — nobody has to remember to untick it, and the
     board stops defaulting to a finished event. The manual `active` tick still parks a
     FUTURE event (a cancelled edition), it just can no longer resurrect a past one.
     A registry row with no Money link has no date, so it keeps the manual tick alone. */
  spxRegIsPast(r){
    if(!r||r.financeId==null)return false;
    const f=(this.finance||[]).find(x=>x.id==r.financeId);
    return f?this.finIsPast(f):false;},
  spxIsCurrent(r){return !!r&&r.active!==false&&!this.spxRegIsPast(r);},
  /* company-name normalisation — uppercase, accents/punctuation stripped, legal-form
     tokens dropped from the END only ("SOLAR AB" → "SOLAR", "AB SOLAR" stays).
     spx.html normCompany() delegates here: the crosswalk must match identically on
     every page or a contract reads "invoiced" on one and "not invoiced" on another. */
  spxNormCo(s){
    const SUF={SAU:1,SLU:1,SASU:1,SARL:1,UNIPESSOAL:1,LDA:1,SA:1,SL:1,SRL:1,SAS:1,SPA:1,GMBH:1,AG:1,NV:1,BV:1,AS:1,OY:1,AB:1,PLC:1,LTD:1,LLC:1,INC:1,APS:1};
    const n=(''+(s||'')).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase()
      .replace(/[.,;()\/]/g,' ').replace(/\s+/g,' ').trim();
    const parts=n.split(' ');
    while(parts.length>1&&SUF[parts[parts.length-1]])parts.pop();
    return parts.join(' ');},
  /* ---- where a signed contract's money actually is (was accountingFor() in spx.html;
     lifted here 3 Aug 2026 so the board, the event page and Money → Sponsorship all
     read the same answer). Sales never type this — it is derived:
       1) the explicit invoice ↔ contract link Jesús sets in Facturación (authoritative,
          amount-aware: a contract billed in instalments is "part invoiced", not
          "invoiced"; a linked invoice cancelled by an abono keeps its pair, netting to 0)
       2) fallback, the confirmed company crosswalk, scoped to the contract's own events */
  spxAccounting(p){
    if(!p)return {state:'none',linked:false};
    const linkedIds={};(this.invoices||[]).forEach(i=>{if(i.spxProposalId==p.id)linkedIds[i.id]=1;});
    const direct=(this.invoices||[]).filter(i=>(i.spxProposalId==p.id||(i.abono_de&&linkedIds[i.abono_de]&&i.status==='abono'))&&this.invCountsMoney(i));
    if(direct.length){
      const cVal=+p.valueEur||0;
      const net=direct.reduce((s,i)=>s+(+i.importe_base||0),0);
      const paidNet=direct.reduce((s,i)=>s+((i.status==='pagado'||i.fecha_cobro)?(+i.importe_base||0):0),0);
      if(!cVal)return {state:paidNet>0?'paid':'invoiced',linked:true,net:net,paid:paidNet,cVal:0};
      const paidEff=Math.min(paidNet,net);          // never more collected than billed
      const fullyInvoiced=net>=cVal-0.01;
      const state=(fullyInvoiced&&paidEff>=net-0.01)?'paid'
                 :(paidEff>0.005)                   ?'partpaid'
                 :fullyInvoiced                     ?'invoiced'
                 :(net>0.005)                       ?'partial'
                 :                                   'none';
      return {state:state,linked:true,net:net,paid:paidEff,cVal:cVal};
    }
    const n=this.spxNormCo(p.company);
    const cm=n?(this.companyMap||[]).find(m=>m.status==='confirmed'&&(
      (m.marketingAliases||[]).some(a=>this.spxNormCo(a)===n)||this.spxNormCo(m.canonicalName)===n)):null;
    if(!cm)return {state:'none',linked:false};
    const scope=[];   // ONLY event-linked lines — an empty scope must never match every allocation
    (this.spxLinesFor(p.id)||[]).forEach(l=>{
      if(l.eventId!=null){if(!scope.some(x=>x==l.eventId))scope.push(l.eventId);return;}
      const e=this.spxLineReg(l);
      if(e&&e.financeId!=null&&!scope.some(x=>x==e.financeId))scope.push(e.financeId);});
    if(!scope.length)return {state:'none',linked:true,noEvent:true};
    const key=this.spxNormCo(cm.invoiceClientKey);
    let inv=false,paid=false;
    if(key)(this.invoices||[]).forEach(i=>{
      if(i.status==='cancelado')return;
      if(!(i.producto==='sponsorship'||i.producto==='upgrade'))return;
      if(this.spxNormCo(i.razon_social)!==key)return;
      if(!(this.invoiceAllocs||[]).some(a=>a.invoice_id==i.id&&scope.some(x=>x==a.eventId)))return;
      inv=true;if(i.status==='pagado'||i.fecha_cobro)paid=true;});
    return {state:paid?'paid':inv?'invoiced':'none',linked:true};},
  /* ================= SIGNED, NOT YET INVOICED (Belén, 6 Aug 2026) =================
     "I want to be able to consider money already signed even if it is not invoiced, as
     it has already come into the system… In terms of BD this money is as good as
     invoiced, but obviously for accounting purposes it isn't."
     So it is never added to an invoiced figure — it is its own number, next to it.
     ONE definition, here, because Money, the SPX health-check, the event page and the
     reporting export all show it and must not disagree.
     The proportional step matters: `eur` is this event's slice of the contract, while
     `accNet` is what has been invoiced across the WHOLE contract (a multi-event deal
     bills once). Subtracting the whole from the slice would report a two-event contract
     as fully invoiced on the first event and fully pending on the second. */
  spxDealUninvoiced(d){
    if(!d)return 0;
    const v=+d.eur||0;if(v<=0)return 0;
    if(d.acc==='paid'||d.acc==='invoiced')return 0;     // fully billed, nothing pending
    const whole=+d.accVal||v;                           // the contract's full value
    const billed=+d.accNet||0;                          // invoiced across the whole contract
    const share=whole>0?Math.min(1,v/whole):1;          // this event's slice of it
    return Math.max(0,v-billed*share);},
  /* every signed contract on a Money row that still owes an invoice, and what it owes.
     Keyed off the SPX registry rows pointing at this dc_finance id (an event can have
     more than one registry row; a contract is only counted once). */
  signedUninvoicedForFin(finId){
    if(finId==null||!this.spxReady||!this.spxReady())return {total:0,rows:[]};
    const regs=(this.spxEventReg||[]).filter(r=>!r.deleted&&r.financeId!=null&&r.financeId==finId);
    const seen={},rows=[];
    regs.forEach(r=>{(this.wonDealsForSpxKey(r.eventKey)||[]).forEach(d=>{
      if(seen[d.id])return;seen[d.id]=1;
      const pending=this.spxDealUninvoiced(d);
      if(pending>0.005)rows.push(Object.assign({pending:pending},d));});});
    rows.sort((a,b)=>b.pending-a.pending);
    return {total:rows.reduce((a,d)=>a+d.pending,0),rows:rows};},
  /* has this won contract said what was actually sold? The ONE definition of
     "complete" — the Won dialog, the board's ⚠, the event list and the nudges all
     ask this, so they can never disagree about who still owes what. */
  spxDeliveryComplete(p){return !!(p&&p.branding&&p.attendeesN!=null&&p.speakersN!=null&&p.stand!=null&&p.brandedItems);},
  /* ---- what sales has SOLD on an event, for the people who have to deliver it ----
     (Belén, 3 Aug: "a list in each event that allows logistics and sales to exchange
     information easily so there is no mistake as to what needs to be done")
     One row per won contract: the answers the Won pop-up collects, plus where the
     money is. `match(line)` decides which lines belong to the event being asked about. */
  spxWonDealsWhere(match){
    if(!this.spxReady||!this.spxReady())return [];
    const out=[];
    (this.spxProps||[]).forEach(p=>{
      if(p.active===false||p.superseded)return;
      if(!(p.stage==='Won'||p.salesStatus==='Confirmed'))return;
      let eur=0,hit=false;
      (this.spxLinesFor(p.id)||[]).forEach(l=>{if(!match(l))return;hit=true;eur+=(+l.valueEur||0);});
      if(!hit)return;
      const acc=this.spxAccounting(p);
      out.push({id:p.id,company:p.company||'—',owner:p.responsableName||p.responsable||'',
        eur:eur,signedAt:p.signedAt||null,contents:p.contents||'',packageTier:p.packageTier||'',
        branding:p.branding||'',attendeesN:p.attendeesN,speakersN:p.speakersN,
        stand:p.stand,brandedItems:p.brandedItems||'',notes:p.wonNotes||'',
        acc:acc.state,accNet:acc.net,accPaid:acc.paid,accVal:acc.cVal,
        complete:this.spxDeliveryComplete(p)});
    });
    return out.sort((a,b)=>(b.eur||0)-(a.eur||0));},
  /* by TIMELINE event (the event page): walks event → Money row(s) → registry → lines,
     so it works whether the line was keyed by eventKey or by financeId */
  wonDealsForEvent(evId){
    if(!this.spxReady||!this.spxReady()||evId==null)return [];
    const fins=(this.finance||[]).filter(f=>!f.deleted&&f.eventId==evId).map(f=>f.id);
    if(!fins.length)return [];
    const keys={};(this.spxEventReg||[]).forEach(g=>{
      if(!g.deleted&&fins.indexOf(g.financeId)>=0)keys[(''+g.eventKey).trim().toLowerCase()]=1;});
    const nk=k=>(''+(k==null?'':k)).trim().toLowerCase();
    return this.spxWonDealsWhere(l=>!!(keys[nk(l.eventKey)]||(l.eventId!=null&&fins.indexOf(+l.eventId)>=0)));},
  /* the same walk WITHOUT the Won gate — every contract touching this event whatever
     stage it is at. Belén, 6 Aug 2026: the block inside the event that says who has sold
     what disappeared when the SPX tab was gated on Won (v99), so an event with proposals
     out and nothing signed yet showed no tab at all and you had to go to reporting to
     find the responsables. Won rows are still the ones that carry delivery details. */
  dealsForEvent(evId){
    if(!this.spxReady||!this.spxReady()||evId==null)return [];
    const fins=(this.finance||[]).filter(f=>!f.deleted&&f.eventId==evId).map(f=>f.id);
    if(!fins.length)return [];
    const keys={};(this.spxEventReg||[]).forEach(g=>{
      if(!g.deleted&&fins.indexOf(g.financeId)>=0)keys[(''+g.eventKey).trim().toLowerCase()]=1;});
    const nk=k=>(''+(k==null?'':k)).trim().toLowerCase();
    const match=l=>!!(keys[nk(l.eventKey)]||(l.eventId!=null&&fins.indexOf(+l.eventId)>=0));
    const out=[];
    (this.spxProps||[]).forEach(p=>{
      if(p.active===false||p.superseded)return;
      let eur=0,hit=false;
      (this.spxLinesFor(p.id)||[]).forEach(l=>{if(!match(l))return;hit=true;eur+=(+l.valueEur||0);});
      if(!hit)return;
      const won=(p.stage==='Won'||p.salesStatus==='Confirmed');
      out.push({id:p.id,company:p.company||'—',owner:p.responsableName||p.responsable||'',
        eur:eur,won:won,stage:p.stage||p.salesStatus||'',lost:p.stage==='Lost',
        sentAt:p.fechaEnvio||null,followAt:p.fechaSeguimiento||null,
        signedAt:p.signedAt||null,contents:p.contents||'',packageTier:p.packageTier||'',
        branding:p.branding||'',attendeesN:p.attendeesN,speakersN:p.speakersN,
        stand:p.stand,brandedItems:p.brandedItems||'',notes:p.wonNotes||'',
        complete:won?this.spxDeliveryComplete(p):false});
    });
    return out.sort((a,b)=>(b.won?1:0)-(a.won?1:0)||(b.eur||0)-(a.eur||0));},
  /* by SPX REGISTRY event (Money → Sponsorship, where the rows ARE registry events) */
  wonDealsForSpxKey(key){
    const nk=k=>(''+(k==null?'':k)).trim().toLowerCase(),want=nk(key);
    if(!want)return [];
    return this.spxWonDealsWhere(l=>{const e=this.spxLineReg(l);return e?nk(e.eventKey)===want:nk(l.eventKey)===want;});},
  /* won contracts still owing their delivery details — everyone's, or one person's.
     This is the backlog the board nags about and the 🔔 alarm counts. */
  spxDeliveryPending(email){
    if(!this.spxReady||!this.spxReady())return [];
    const em=(''+(email||'')).toLowerCase();
    return (this.spxProps||[]).filter(p=>p.active!==false&&!p.superseded
      &&(p.stage==='Won'||p.salesStatus==='Confirmed')
      &&!this.spxDeliveryComplete(p)
      &&(!em||(''+(p.responsableEmail||'')).toLowerCase()===em));},
  evMasterName(ev){return (''+((ev&&ev.name)||'')).replace(/^E\d+\s*/i,'').trim();},
  /* a Money row's display label — cascades from its linked timeline event; a row
     with no link (past editions) keeps its own stored name */
  finTrueLabel(f){if(!f)return '';
    const ev=f.eventId?this.event(f.eventId):null;
    const base=(ev?this.evMasterName(ev):(''+(f.name||'?'))).trim();
    const hasYear=/\b(19|20)\d{2}\b/.test(base)||/\s\d{2}$/.test(base);
    return base+((f.year&&!hasYear)?(' '+f.year):'');},
  /* a Money row's CITY — same cascade as the name (Belén, 31 Jul: "Zaragoza is on the
     timeline but not on the 2027 dashboard"): linked row → the timeline event's city,
     unlinked (past editions) → its own stored value */
  finTrueCity(f){if(!f)return '';
    const ev=f.eventId?this.event(f.eventId):null;
    return ((ev&&ev.city)||f.city||'');},
  /* a Money row's WHEN / PM / SALES — the same cascade again (Belén, 3 Aug: "a lot of the
     write-in text boxes in the reporting are not supposed to be there; they should cascade
     through from the timeline, like the other details — there is no point having more than
     one source of truth"). Linked row → the timeline event's own dates and people; an
     unlinked row (a past edition, which the board deliberately does not carry) keeps the
     text it was imported with, read-only. dateRange() gives the house day-first format. */
  finTrueWhen(f){if(!f)return '';
    const ev=f.eventId?this.event(f.eventId):null;
    return (ev&&ev.date)?evWhenShort(ev):(f['when']||'');},
  finTruePM(f){if(!f)return '';
    const ev=f.eventId?this.event(f.eventId):null;
    return ((ev&&ev.pm)||f.pm||'');},
  finTrueSales(f){if(!f)return '';
    const ev=f.eventId?this.event(f.eventId):null;
    return ((ev&&ev.sales)||f.sales||'');},
  /* is this Money row driven by the timeline at all? (used to mark the few that are not) */
  finLinked(f){return !!(f&&f.eventId&&this.event(f.eventId));},
  /* freshness, for the "live" stamp on the reporting pages */
  weeklyCalcAt(){return _wkCalcAt;},
  syncStuck(){return _syncFails>0?(_syncErr||'a change has not saved yet'):null;},
  /* sortable "when does this event happen" key for a Money row, in ms — linked timeline
     date first, else the free-text `when` month + year, else end-of-year, else far future.
     ONE ordering for every event list (Belén, 31 Jul: "order them by date please. Same in
     SPX and across the board"). */
  finStartKey(f){
    if(!f)return Infinity;
    const ev=f.eventId?this.event(f.eventId):null;
    if(ev&&ev.date){const d=ymd(ev.date);if(d&&!isNaN(d))return d.getTime();}
    const y=+f.year||0;
    if(!y)return Infinity;
    const M={jan:0,ene:0,feb:1,mar:2,apr:3,abr:3,may:4,jun:5,jul:6,aug:7,ago:7,sep:8,oct:9,nov:10,dic:11,dec:11};
    const m=/([a-z]{3})/i.exec(''+(f.when||''));
    const mo=m?M[m[1].toLowerCase()]:null;
    const day=(/(\d{1,2})/.exec(''+(f.when||''))||[])[1];
    return new Date(y,mo!=null?mo:11,mo!=null?(+day||1):31).getTime();},
  /* ...and when it FINISHES. Linked timeline event -> its own `days`; otherwise count the
     day numbers in the free-text `when` ("17-18 March" and "31 Mar-1 Apr" are both two
     days, "27 Jan" is one). Needed because finStartKey alone would call a two-day event
     finished on its opening morning. */
  finEndKey(f){
    const s=this.finStartKey(f);
    if(!f||!isFinite(s))return s;
    const ev=f.eventId?this.event(f.eventId):null;
    let days=(ev&&+ev.days>0)?+ev.days:((''+(f.when||'')).match(/\d{1,2}/g)||[]).length;
    if(!(days>0))days=1;
    return s+(days-1)*864e5;},
  /* has this edition already happened? (the day it ends still counts as current) */
  finIsPast(f){
    const e=this.finEndKey(f);
    if(!isFinite(e))return false;
    const t=new Date();t.setHours(0,0,0,0);
    return e<t.getTime();},
  /* ---------- event → allocation-line cascade (Belén, 2026-07-17) ----------
     The moment an event exists, its two "allocation" lines exist too:
     an invoicing ITEM in dc_codigos and an hour-allocation PROJECT in
     dc_projects — both with the accounting code left PENDING for Jesús to
     fill when accounting assigns it. So nobody is ever unable to log hours
     or raise an invoice against a new event. Only CURRENT-or-future events
     are swept (historic editions stay out of the curated lists). */
  /* event name for a project/item label: drop the "E056"/"RENMAD" prefixes and any trailing
     year, so the caller can append the year once (no "…27 27") — Belén, 22 Jul. */
  evCleanName(ev){return (''+(ev.name||'')).replace(/^E\d+\s*/i,'').replace(/^RENMAD\s+/i,'').replace(/\s+(20)?\d{2}$/,'').trim();},
  /* ---- WHEN MAY AN EVENT REACH THE MONEY REGISTERS? (Belén, 3 Aug 2026) ----
     "It is WAY too easy to screw the whole thing up just adding an event, which a bunch of
     people can do."  Only when it carries its MARKETING CODE and a date.
     That code is the join every report runs on. Without it a Money row can never meet its
     weekly history, its sales-board entry or its invoices — and if the event already exists
     as an imported Money row, the cascade mints a SECOND one plus a second accounting item
     (Datacenters Italia 26, 3 Aug: two rows and two items both carrying código 70320).
     So an event with no code is a DRAFT as far as money is concerned. It lives on the
     timeline, it can be planned, staffed and have hours logged against it — but nothing is
     created in Money, Invoicing or SPX until the code arrives. When it does, the cascade
     runs and ADOPTS the row that already exists, because nothing was created early.
     The failure mode is designed out instead of repaired: no merge, nothing to undo. */
  /* ---- and the second lock: BELÉN SAYS WHEN (her ask, 3 Aug) ----
     "Maybe get me to confirm it is ok for the event to be added to the plumbing. In the
     meanwhile can be created minus the code."  So anyone may create the event, and even
     put its code on it — but the moment that wires it into Money, Invoicing and SPX is
     hers. `moneyOk` is that consent. Her own saves carry it automatically: the form has
     already told her exactly what will happen, so asking her twice would be theatre. */
  evMoneyReady(ev){if(!ev||!ev.date)return false;
    const c=this.evCode(ev);
    return !!(c&&/^E\d+$/i.test(c)&&ev.moneyOk===true);},
  /* coded, legal, and only waiting for her — this is what the queue counts */
  evAwaitingOk(ev){if(!ev||!ev.date||evKind(ev)==='external')return false;
    const c=this.evCode(ev);
    return !!(c&&/^E\d+$/i.test(c))&&ev.moneyOk!==true&&!this.ecodeBlocker(c,ev.id);},
  evAwaitingOkList(){return (this.events||[]).filter(e=>!e.deleted&&this.evAwaitingOk(e));},
  /* the approval itself: flip the consent, then let the normal cascade do the work — one
     code path for wiring, whether it happens now or the day the code arrives. */
  connectEventMoney(evId){
    const ev=this.event(evId);if(!ev)return null;
    const plan=this.evConnectPlan(ev);
    if(plan.state==='taken'||plan.state==='draft'||plan.state==='nodate')return plan;
    ev.moneyOk=true;
    let out=null;try{out=this.ensureEventLines();}catch(e){console.warn('connect event:',e.message||e);}
    this.save();
    return Object.assign({},plan,{done:true,cascade:out});},
  /* what the timeline should tell the person in front of it, before they save */
  evConnectPlan(ev){
    if(!ev||!ev.date)return {state:'nodate',msg:'Set the date first.'};
    const c=this.evCode(ev);
    if(!c||!/^E\d+$/i.test(c))return {state:'draft',
      msg:'No marketing code yet — this event stays OFF the reporting: no Money row, no invoicing item, no sales-board entry. Add the code when ZOHO assigns it and all three appear at once, attached to whatever already exists. Nothing is duplicated by waiting.'};
    const owner=this.ecodeBlocker(c,ev.id);
    if(owner)return {state:'taken',msg:c+' already belongs to “'+owner+'”. An E-code can only belong to one event — a duplicate splits the event’s money in two.'};
    const reg=(this.spxEventReg||[]).find(g=>!g.deleted&&g.financeId!=null&&(''+g.eventKey).trim().toUpperCase()===c.toUpperCase());
    const twin=reg?this.finance.find(f=>!f.deleted&&f.id==reg.financeId&&(f.eventId==null||f.eventId===''))
                  :null;
    const item=twin?this.codigos.find(x=>!x.deleted&&x.eventId==twin.id):null;
    const what=twin
      ? 'ATTACH to the Money row that already exists, “'+this.finTrueLabel(twin)+'”'+(item&&item.codigo?' (accounting code '+item.codigo+')':'')+'. Nothing new is created, nothing is duplicated.'
      : 'create its Money row, its invoicing item (accounting code pending for Jesús) and its sales-board entry.';
    /* already wired? then this is just a description of what it did */
    if(ev.moneyOk===true)return {state:twin?'adopt':'create',msg:c+' → this will '+what};
    /* not yet: the event can be saved and lives on the timeline, but the wiring waits for
       Belén. Her own saves approve themselves (see evMoneyReady). */
    if(isBelenP(this.currentUser))return {state:twin?'adopt':'create',msg:c+' → on save this will '+what};
    return {state:'pending',msg:c+' → saved, this event waits for Belén’s OK before it reaches Money, Invoicing or SPX. '+
      'She will be asked, and when she approves it will '+what};
  },
  ensureEventLines(){
    const out={items:0,projects:0,adopted:0,money:0,spx:0,resynced:0};
    const curYear=new Date().getFullYear();
    /* ---- Money rows: one per board EVENT of this year or later (Belén, 31 Jul:
       Chile 2027 was on the timeline but invisible to the 2027 dashboard, SPX and
       invoicing — "adding a new event should cascade through"). RLS: dc_finance
       inserts need dc_can_finance(), so this stage acts only for finance holders —
       gate MUST match RLS or the sync would retry a refused insert forever.
       v95 rule: every whitelisted column is set explicitly (the diff-sync sends
       null for whitelisted-but-unset, and NOT NULL columns refuse the row). */
    if(this.canFinance()&&this.financeReady()){
      this.events.forEach(ev=>{
        const d=ev.date?ymd(ev.date):null;
        if(!d||isNaN(d)||d.getFullYear()<curYear)return;
        if(evKind(ev)==='external')return;               // projects are not sellable events
        if(this.finance.some(f=>!f.deleted&&f.eventId==ev.id))return;
        /* THE GATE: no code, no money registers (see evMoneyReady above). This single
           line is what stops a half-made event duplicating a Money row and an accounting
           code. Hours are deliberately NOT gated — the project below is created either
           way, so nobody is ever blocked from logging time on a real event. */
        if(!this.evMoneyReady(ev))return;
        /* ADOPT, NEVER DUPLICATE (3 Aug). A Money row usually exists long before its
           event reaches the timeline — every 2026 edition was imported that way. The two
           are matched on the E-CODE, through the registry row that already carries it;
           never on the name, which drifts ("H2" vs "Hidrógeno", "DC Italia" vs
           "Datacenters Italia"). Without this, putting a live event on the board would
           mint a SECOND Money row and split its invoices, targets and SPX history in two. */
        const ecode=this.evCode(ev);
        if(ecode&&/^E\d+$/i.test(ecode)){
          const reg=(this.spxEventReg||[]).find(g=>!g.deleted&&g.financeId!=null&&(''+g.eventKey).trim().toUpperCase()===ecode);
          const twin=reg?this.finance.find(f=>!f.deleted&&f.id==reg.financeId&&(f.eventId==null||f.eventId===''))
                        :null;
          if(twin){twin.eventId=ev.id;out.adopted++;return;}
        }
        /* the stored city/when are only a seed for the day the link is ever broken —
           what reporting SHOWS comes from finTrueCity/finTrueWhen, i.e. the timeline */
        this.finance.push({id:this.newId(),eventId:ev.id,name:this.evCleanName(ev),edition:null,
          year:d.getFullYear(),semester:(d.getMonth()<6?1:2),city:ev.city||null,when:evWhenShort(ev),
          pm:null,sales:null,target:null,stretch:null,invoiced:null,spex:null,
          notes:'auto — created with the event'});
        out.money++;
      });
    }
    /* invoicing items: one per Money row (dc_finance) of this year or later */
    if(this.canBill()&&this.billReady()){
      this.finance.forEach(f=>{
        if((+f.year||0)<curYear)return;
        if(this.codigos.some(c=>c.eventId==f.id))return;
        const label=((f.name||'?')+' '+(f.year?(''+f.year).slice(-2):'')).trim();
        /* archived set EXPLICITLY: the diff-sync sends null for whitelisted-but-unset
           columns, and a NOT NULL column then refuses the whole insert forever
           (30 Jul: "a change could not be saved" on Belén's screen — the cascade
           kept failing to create the 2027 items). Rule: every column in COLS that
           the DB constrains must be set here, not left to the default. */
        this.codigos.push({id:this.newId(),item:label,codigo:'',descripcion:'auto — created with the event',eventId:f.id,archived:false});
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
        /* events are accounting category "02." — use it (not the running sort number) so new
           projects read like the rest of the list, e.g. "02. Datacenters Italia 27". */
        this.projects.push({id:this.newId(),label:'02. '+clean+' '+yy,code:null,kind:null,sort,active:true,eventId:ev.id});
        out.projects++;
      });
    }
    /* ---- SPX registry rows: one per Money row of this year or later, so a new
       event reaches the sales board and the proposal pickers without anyone asking
       (Belén, 31 Jul). RLS: dc_spx_events inserts need dc_can_sales_lead() — the
       gate mirrors it (Cintia / Belén). Every whitelisted column set explicitly. */
    if(this.canSalesLead&&this.canSalesLead()&&(!USE_SUPABASE||_spxEvReady)){
      const regs=this.spxEventReg||[];
      this.finance.forEach(f=>{
        if(f.deleted||(+f.year||0)<curYear)return;
        if(regs.some(s=>!s.deleted&&s.financeId==f.id))return;
        /* an intentionally-UNLINKED registry event already naming this franchise means
           the link was left off on purpose (E052 Useful.AI: linking the 2027 Money row
           would write 2027 into the 2026 curve) — never mint a duplicate for it */
        if(regs.some(s=>!s.deleted&&s.financeId==null&&famFold(s.name)===famFold(this.finTrueLabel(f))))return;
        const evRow=f.eventId?this.event(f.eventId):null;
        let key=evRow?this.evCode(evRow):null;
        if(!key){key=((this.evCleanName(evRow||{name:f.name})||'EV').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)+(''+f.year).slice(-2));}
        while(regs.some(s=>(''+s.eventKey).toUpperCase()===key))key+='X';
        const row={id:this.newId(),eventKey:key,name:this.finTrueLabel(f),financeId:f.id,
          sponsorshipTarget:null,sponsorshipStretch:null,pasesTarget:null,pasesStretch:null,
          convByStatus:{Sent:0.35,Confirmed:0.7},active:true,
          sort:Math.max(0,...regs.map(s=>+s.sort||0))+1};
        regs.push(row);
        out.spx++;
      });
      this.data.spxEventReg=regs;
    }
    /* ---- keep a linked Money row in step with its event (Belén, 3 Aug) ----
       Hidrógeno 26 was created with a 2027 date and corrected minutes later; its Money row
       kept 2027 and would have sat in the wrong year of the report for good. The DISPLAY
       already cascades (finTrueWhen / finTrueCity), but YEAR and SEMESTER are what the
       table groups by, so they have to follow the event too. The stored city/when are
       refreshed at the same time, so a row that ever loses its link degrades to the last
       truth rather than to a stale guess. */
    if(this.canFinance()&&this.financeReady()){
      this.finance.forEach(f=>{
        if(f.deleted||!f.eventId)return;
        const ev=this.event(f.eventId);if(!ev||!ev.date)return;
        const d=ymd(ev.date);if(!d||isNaN(d))return;
        const want={year:d.getFullYear(),semester:(d.getMonth()<6?1:2),city:ev.city||null,when:evWhenShort(ev)};
        let n=0;
        Object.keys(want).forEach(k=>{
          const now=(f[k]==null?'':''+f[k]),next=(want[k]==null?'':''+want[k]);
          if(now!==next){f[k]=want[k];n++;}});
        if(n)out.resynced++;
      });
    }
    this.syncEventCodes();
    return out;
  },
  /* ---------- event delete → RETIRE its lines (Belén, 31 Jul 2026) ----------
     The mirror of ensureEventLines. Deleting an event off the timeline used to
     leave every line it had minted behind: the RENMAD Talks Biometano encuentro
     was cancelled and still showed on the Money dashboard, in the invoicing
     picker, on the SPX board and in the proposal builder.
     RETIRE, never destroy — her rule, and the hours prove why: that event
     already had 18.5 h logged against its project. So:
       · hour project   → active=false   (retired; logged hours keep their label)
       · invoicing item → archived=true  (out of the picker, still on old invoices)
       · SPX registry   → active=false   (off the current board, and out of the
                                          proposal builder's picker)
       · Money row      → deleted, but ONLY when it carries no numbers and no
                          invoice lines. A cancelled event that already billed
                          something keeps its row: that money really happened.
     Call it BEFORE dropping the event from DB.data.events (it reads f.eventId).
     Returns what it touched so the caller can tell the user. */
  retireEventLines(evId){
    const out={projects:0,items:0,spx:0,money:0,moneyKept:0};
    if(evId==null)return out;
    /* every stage is gated like its ensureEventLines twin, i.e. like RLS: a write
       the database will refuse is a write the diff-sync retries forever (v95). */
    const canFin=this.canFinance()&&this.financeReady();
    const canBill=this.canBill()&&this.billReady();
    const canSpx=this.canSalesLead&&this.canSalesLead()&&(!USE_SUPABASE||_spxEvReady);
    const fins=this.finance.filter(f=>!f.deleted&&f.eventId==evId);
    fins.forEach(f=>{
      if(canBill)this.codigos.filter(c=>!c.deleted&&c.eventId==f.id&&c.archived!==true)
        .forEach(c=>{c.archived=true;out.items++;});
      if(canSpx)(this.spxEventReg||[]).filter(s=>!s.deleted&&s.financeId==f.id&&s.active!==false)
        .forEach(s=>{s.active=false;out.spx++;});
      if(!canFin){out.moneyKept++;return;}
      const hasFigures=['target','stretch','invoiced','spex']
        .some(k=>f[k]!=null&&f[k]!=='');
      /* "eventId" on an allocation line is the dc_finance id, not the board event
         (store.js COLS note). Without the invoicing tables loaded we cannot tell
         whether money was billed, so the row stays — never guess with revenue. */
      const hasInvoices=!canBill||(this.data.invalloc||[]).some(a=>!a.deleted&&a.eventId==f.id);
      if(hasFigures||hasInvoices){out.moneyKept++;return;}
      this.data.finance=this.finance.filter(x=>x.id!==f.id);
      out.money++;
    });
    if(this.canManageProjects())this.projects
      .filter(p=>!p.deleted&&p.eventId==evId&&p.active!==false)
      .forEach(p=>{p.active=false;out.projects++;});
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
  canEditStatus(t){if(this.canManage())return true;
    const e=t&&this.event(t.eventId);if(e&&evKind(e)==='external')return true; // a project's team runs its own tasks
    if(t&&t.lane==='logistics'&&this.canLogistics())return true;
    /* a co-assignee owns the task as much as the primary one does */
    return !!(t&&this.currentUser&&this.taskIsMine(t,this.currentUser.id));},
};
/* ================= 🔐 THE PERMISSION REGISTRY (Belén only) =================
   Belén, 29 Jul: "I'd like a list of the permissions each person has, and what they can
   see and what they can edit… as we are expanding the system the permits are likely to
   change". So this is ONE list, written against the same predicates the app actually
   uses — `grants` mirrors DB.canX()/isX() with the person passed in, so a new module is
   added here the day it is built and the matrix cannot drift from the code.
   SEE and EDIT are separate answers for every person — Belén, 29 Jul: "everybody needs
   access to the invoicing, but only Jesús and accounts can edit… but also there are things
   that are not for everybody's eyes". So each row answers both, per person. */
const EVERYONE=p=>true, NOBODY=p=>false;
/* "everyone who is actually on the team" — the team-wide surfaces (the event board, the
   plan, the sales board) are not a service account's business, and saying so HERE rather
   than in the navigation is what keeps the panel honest: the tab a person is offered and
   the row Belén reads in this list come from the same predicate. Belén can still open any
   of them for one person with the per-cell tick. */
const TEAM_ONLY=p=>!isTeamAccount(p);
/* Every entry carries a stable `key` — dc_people.perms (jsonb, Belén-only writable, like
   the four ticks) stores PER-CELL OVERRIDES on top of the derived defaults:
     perms = { "invoicing.book": {see:true, edit:true}, "money.insights": {see:false} }
   Belén, 29 Jul evening: "I can either give access to all clicked to see or to edit, but
   cannot choose each individual setting — each team is responsible for different things."
   The tier + four ticks stay the BASELINE; an override changes exactly one cell for one
   person. `lock:true` = not overridable (this panel itself: RLS would refuse anyway). */
const PERMS=[
  {key:'proj.board', area:'📅 Projects', label:'The event board — events, lanes, tasks', lock:true,
   see:TEAM_ONLY, edit:TEAM_ONLY,
   seeTxt:'Every event, every lane, every task — the team; service accounts have no board', editTxt:'Their own tasks'},
  {key:'proj.plan', area:'📅 Projects', label:'Anyone’s task status & the plan itself',
   see:TEAM_ONLY, edit:p=>p.access==='admin'||p.access==='manager',
   seeTxt:'Everyone on the team sees the plan', editTxt:'Managers & admins (plus anyone on a non-RENMAD project)'},
  /* Belén, 6 Aug 2026, after the meeting with Julián and Valeria: the logistics lane,
     the Venue list and the request box are theirs. Everyone reads them; only the two
     logistics people and Belén move them — deliberately NOT every manager, and not
     every admin, so next year nobody drags Biometano's stages by accident.
     Change your mind about a person here and dc_can_logistics() honours it too. */
  {key:'logistics.plan', area:'📅 Projects', label:'The logistics lane, the Venue list & requests',
   see:TEAM_ONLY, edit:p=>(''+(p.role||'')).toLowerCase()==='logistics'||isBelenP(p),
   seeTxt:'Everyone on the team — anybody can check what is booked, any time',
   editTxt:'Logistics (Julián, Valeria) and Belén — no other manager or admin'},
  {key:'team.roster', area:'👥 Team', label:'The roster — people, roles, emails',
   see:EVERYONE, edit:p=>p.access==='admin',
   seeTxt:'The whole team list', editTxt:'Admins: add, edit, remove, set the tier'},
  {key:'team.perms', area:'👥 Team', label:'This permission list & the four ticks', lock:true,
   see:p=>isBelenP(p), edit:p=>isBelenP(p),
   seeTxt:'Belén only', editTxt:'Belén only — the database refuses everyone else'},
  {key:'money.figures', area:'💶 Money', label:'Event money figures (targets, invoiced, margin)',
   see:EVERYONE, edit:p=>!!p.finance,
   seeTxt:'Whole roster', editTxt:'The finance tick only'},
  {key:'money.insights', area:'💶 Money', label:'Insights & the analysis strips',
   see:p=>p.access==='admin'||p.access==='manager', edit:NOBODY,
   seeTxt:'Managers & admins — members see the raw figures without the conclusions', editTxt:'Computed, nobody edits it'},
  {key:'invoicing.book', area:'🧾 Invoicing', label:'The invoice book (invoices, credit notes, items, products)',
   see:EVERYONE, edit:p=>!!p.billing||p.access==='admin',
   seeTxt:'Whole roster — read, search, download', editTxt:'Accounting (invoicing tick) and admins'},
  {key:'spx.board', area:'💼 SPX', label:'The sales board & proposals',
   see:TEAM_ONLY, edit:p=>!!p.salesLead||p.access==='admin'||p.role==='Sales'||p.role==='Lead',
   seeTxt:'Whole team — service accounts have no sales board', editTxt:'Sales roles, the sales-lead tick and admins'},
  {key:'hr.area', area:'🌴 HR', label:'The HR area (team holidays, allocation, the clock)',
   see:p=>!!p.hr||isBelenP(p)||!!p.finance, edit:p=>!!p.hr||isBelenP(p),
   seeTxt:'Belén, HR and the finance tick (for allocation)', editTxt:'Belén and HR'},
  {key:'hr.pending', area:'🌴 HR', label:'⏳ Pending — decide clock corrections',
   see:p=>!!p.hr||isBelenP(p), edit:p=>!!p.hr||isBelenP(p),
   seeTxt:'Everyone’s requests and their punches', editTxt:'Approve, deny, send back, amend the legal record'},
  {key:'hr.alloc', area:'🌴 HR', label:'Hour allocation across projects',
   see:p=>p.access==='admin'||!!p.finance||!!p.hr, edit:p=>p.access==='admin'||!!p.finance,
   seeTxt:'Everyone’s weeks', editTxt:'Admins and the finance tick'},
  {key:'hr.timeoff', area:'🌴 HR', label:'Approve time off', lock:true,
   see:p=>p.access==='manager'||p.access==='admin'||!!p.hr, edit:p=>p.access==='manager'||p.access==='admin'||!!p.hr,
   seeTxt:'The requests where it is their turn — follows the approval chain, not a tick', editTxt:'Their step of the chain (manager → Belén → HR)'},
  {key:'hr.detail', area:'🌴 HR', label:'Someone else’s clock & hours in detail', lock:true,
   see:p=>!!p.hr||isBelenP(p), edit:p=>!!p.hr||isBelenP(p),
   seeTxt:'Belén and HR — everyone else sees only their own (legal record, tied to the HR tick)', editTxt:'Amendments, always logged'},
  {key:'crm.leads', area:'📇 CRM', label:'The leads CRM',
   see:p=>isBelenP(p), edit:p=>isBelenP(p),
   seeTxt:'Belén only', editTxt:'Belén only'},
  {key:'people.msgs', area:'💬 People', label:'A person’s message thread',
   see:p=>p.access==='admin'||!!p.hr, edit:p=>p.access==='admin'||!!p.hr,
   seeTxt:'Their own always; admins and HR see everyone’s', editTxt:'Write in the ones they can see'},
  {key:'req.triage', area:'💡 Requests', label:'The requests box',
   see:EVERYONE, edit:p=>p.access==='admin',
   seeTxt:'Everyone opens and follows requests', editTxt:'Admins triage: status, priority, replies'},
];
/* effective permission = per-cell override when one is stored, else the derived default */
function permOverride(p,key){const o=(p&&p.perms&&typeof p.perms==='object')?p.perms[key]:null;return o&&typeof o==='object'?o:null;}
function permByKey(key){return PERMS.find(e=>e.key===key)||null;}
function permSee(p,key){if(!p)return false;const o=permOverride(p,key);if(o&&o.see!=null)return !!o.see;const x=permByKey(key);return x?!!x.see(p):false;}
function permEdit(p,key){if(!p)return false;const o=permOverride(p,key);if(o&&o.edit!=null)return !!o.edit;const x=permByKey(key);return x?!!x.edit(p):false;}
/* what does THIS person hold? -> [{perm, canSee, canEdit, ovr}] (ovr = the stored override, if any) */
function permsOf(p){return PERMS.map(x=>({perm:x,canSee:permSee(p,x.key),canEdit:permEdit(p,x.key),ovr:permOverride(p,x.key)}));}
function permCount(p){const r=permsOf(p);return {see:r.filter(x=>x.canSee).length,edit:r.filter(x=>x.canEdit).length};}
/* and the other way round: who can see / edit THIS permission (the audit view).
   Service accounts ARE counted here: they hold real powers (Accounts edits the invoice
   book), so leaving them out would make this table quietly lie about who can change what. */
function whoHas(perm,which){
  return DB.people.filter(p=>which==='see'?permSee(p,perm.key):permEdit(p,perm.key)).map(p=>p.name);
}
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
/* ---- the products an invoice line can be sold as ----
   The ten BUILT-IN ones carry behaviour in the code (tickets counts passes, abono is a
   credit note, sponsorship opens a delegate…), so they are never editable or removable.
   Accounting adds the rest itself in the Products pop-up on Facturación (dc_productos) —
   "Pase Online" for the Talks was the first. PRODUCTOS / PRODUCTO_LABEL keep exactly the
   shape every page already reads; rebuildProductos() re-fills them after each load. */
const PRODUCTOS_BUILTIN=['sponsorship','tickets','ata','webinar','abono','comisiones','upgrade','sitevisits','grabaciones','refacturacion'];
/* product labels in Spanish — accounting's surface (29 Jul language rule) */
const PRODUCTO_LABEL_BUILTIN={sponsorship:'Sponsorship',tickets:'Tickets',ata:'ATA',webinar:'Webinar',abono:'Abono',comisiones:'Comisiones',upgrade:'Upgrade',sitevisits:'Site Visits',grabaciones:'Grabaciones',refacturacion:'Refacturación'};
let PRODUCTOS=PRODUCTOS_BUILTIN.slice();
let PRODUCTO_LABEL=Object.assign({},PRODUCTO_LABEL_BUILTIN);
let TICKET_PRODS=['tickets'];
function isBuiltinProd(k){return PRODUCTOS_BUILTIN.indexOf(k)>=0;}
/* "does this product behave like Tickets?" — shows the pass-type column, counts passes,
   opens a delegate row and lands as ticket money on the SPX board. A custom product ticked
   "counts passes" (Pase Online) answers yes, which is why the code asks this instead of
   comparing producto==='tickets'. */
function isTicketProd(k){return TICKET_PRODS.indexOf(k)>=0;}
function rebuildProductos(){
  PRODUCTOS=PRODUCTOS_BUILTIN.slice();
  PRODUCTO_LABEL=Object.assign({},PRODUCTO_LABEL_BUILTIN);
  TICKET_PRODS=['tickets'];
  ((DB.data&&DB.data.productos)||[]).slice().sort((a,b)=>(+a.sort||0)-(+b.sort||0)).forEach(p=>{
    const k=(''+(p.key||'')).trim();if(!k||isBuiltinProd(k))return;
    PRODUCTO_LABEL[k]=p.label||k;                 // a retired product keeps its label so old invoices still read
    if(p.archived!==true)PRODUCTOS.push(k);       // …but drops out of the pickers for new ones
    if(p.pases===true)TICKET_PRODS.push(k);
  });
}
const TIPO_PASES={single:1,double:2,triple:3,quad:4};
/* accounting speaks Spanish (29 Jul language rule: one language per audience) */
const INV_STATUS={pagado:'Pagada',no_pagado:'No pagada',cancelado:'Cancelada',abono:'Abono'};
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
      if(k==='payments'&&!_payReady)return;
      if(k==='tickets'&&!_tickReady)return;
      if(k==='stageLay'&&!_stageLayReady)return;
      if((k==='venueCats'||k==='venueItems')&&!_venueReady)return;
      if(k==='requests'&&!_reqReady)return;
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
    /* row absent locally but still in the shadow = WE deleted it and the delete is
       still in the debounced sync queue. A colleague's update arriving in that window
       must not resurrect it (the delete will still be sent from the shadow diff). */
    if(_shadow[key][row.id]!==undefined)return;
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
      document.getElementById('dcJsErrReload').onclick=()=>dcHardReload(); // cache-busting reload — a plain reload can re-serve the broken cached pair
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
    /* getSession() reads the token already in this browser; getUser() was a second network
       round trip to /auth/v1/user on every single page load, for an email we hold locally. */
    try{const {data}=await sb.auth.getSession();const em=data&&data.session&&data.session.user&&data.session.user.email;DB.currentUser=personByEmail(em);
      const w=document.getElementById('whoami');if(w&&em)w.textContent=em+(DB.currentUser?'':' (not in roster)')+' · ';
      if(em&&!DB.currentUser)rosterBanner(em);
    }catch(e){}
  }
  else{const p=new URLSearchParams(location.search).get('as')||localStorage.getItem('dispatchAs');DB.currentUser=p?DB.person(+p):(DB.people.find(x=>x.access==='admin')||null);} // local test: ?as=<personId> to simulate a user
  ensureSubDefaults();
  try{const r=DB.ensureEventLines();if(r&&(r.items||r.projects||r.adopted||r.money||r.spx||r.resynced))DB.save();}catch(e){} // event → Money/item/project/SPX cascade (writes only for finance/billing/sales-lead logins)
  try{const nc=document.getElementById('nav-crm');if(nc&&DB.can('crm.leads','see'))nc.style.display='';}catch(e){} // CRM tab: Belén (grantable per-cell in the 🔐 panel)
  /* A tab that is not offered must not be reachable by typing the URL either. A page
     declares what it needs before boot: DC_NEEDS='<perm key>' (checked against the same
     permission the 🔐 panel prints) or DC_TEAM_ONLY for the pages that have no permission
     row of their own. Anyone without it is sent to their own page rather than shown a wall. */
  try{
    const lack=(window.DC_NEEDS&&!DB.can(window.DC_NEEDS,'see'))
            || (window.DC_TEAM_ONLY&&isTeamAccount(DB.currentUser));
    if(lack){location.replace('home.html');return;}
  }catch(e){}
  /* A SERVICE ACCOUNT is not on the team, so the team-wide tabs are not offered to it.
     Projects and SPX read the SAME predicates the 🔐 permissions panel prints, so what
     Belén sees in that list is exactly what the person is offered — tick a cell open there
     and the tab comes back. Impact and Tools have no permission row of their own, so they
     follow the plain "is this a team member" answer. Me / Team / Money / 🔔 stay: the
     accountant needs Money (Invoicing), Team (hour allocation, on the finance tick), 🔔 to
     hear back, and Me to change their own password. */
  try{
    const off=(id,ok)=>{const el=document.getElementById(id);if(el&&!ok)el.style.display='none';};
    off('nav-projects',DB.can('proj.board','see'));
    off('nav-spx',DB.can('spx.board','see'));
    const onTeam=!isTeamAccount(DB.currentUser);
    off('nav-impact',onTeam);
    off('nav-tools',onTeam);
  }catch(e){}
  /* HR is no longer its own nav tab — it lives inside 👥 Team (gated there by DB.canSeeHR) */
  renderFn();
  try{decorateNav();}catch(e){} // alarm badges on the nav (holiday approvals / missing hours)
  try{injectTicketFab();}catch(e){} // the "💡 Request" button on every page
  try{recordLogin();}catch(e){} // device-visibility row (1/person/device/day, Belén-only read)
  try{renderPunchBanner();flushPendingPunches();}catch(e){} // recover punches that failed to save last time
  try{if(_breakTimer)clearInterval(_breakTimer);breakReminderTick();_breakTimer=setInterval(breakReminderTick,60000);}catch(e){} // break nudge on any page
  try{spxTouchpointAlarms();}catch(e){} // ⏰ my overdue SPX touchpoints → my inbox (any page)
  try{spxDeliveryAlarms();}catch(e){}   // 📦 my won contracts still owing their delivery details (weekly)
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
/* ---- 🌙 dark mode (Jesús's request, 31 Jul) ----
   Opt-in per device: the moon/sun button in the nav flips it, localStorage remembers
   it, default stays light so nobody is surprised. Stage 1 = variable overrides + the
   white-surface selectors harvested from every page; hardcoded pastel chips stay
   light on purpose (their text is dark). Charts re-colour via Chart.defaults and a
   render() nudge. */
const DC_THEME_KEY='dcTheme';
function dcTheme(){try{return localStorage.getItem(DC_THEME_KEY)||'light';}catch(e){return 'light';}}
function dcApplyTheme(){
  const t=dcTheme();
  document.documentElement.setAttribute('data-theme',t);
  try{if(window.Chart){Chart.defaults.color=(t==='dark'?'#b6bbc2':'#666');Chart.defaults.borderColor=(t==='dark'?'rgba(255,255,255,.09)':'rgba(0,0,0,.1)');}}catch(e){}
  const b=document.getElementById('dcThemeBtn');if(b){b.textContent=(t==='dark'?'☀️':'🌙');b.title=(t==='dark'?'Back to light mode':'Dark mode');}
}
function dcThemeToggle(){
  try{localStorage.setItem(DC_THEME_KEY,dcTheme()==='dark'?'light':'dark');}catch(e){}
  dcApplyTheme();
  try{if(typeof render==='function')render();}catch(e){} // charts redraw with the new colours
}
(function(){
  const css=
  ':root[data-theme=dark]{color-scheme:dark;'+
    '--bg:#16181b;--card:#1e2226;--ink:#e6e4df;--line:#3b4046;--muted:#a4a9af;--mut:#a4a9af;--grey:#a4a9af;'+
    '--ch:#d9dce0;--charcoal:#d9dce0;--green:#58b56c;--red:#ff7066;--amber:#e2a43f;--blue:#5fb7e8;--purple:#b48fe0;--violet:#a598e8}'+
  '[data-theme=dark] body{background:#16181b;color:#e6e4df}'+
  /* every selector any page paints white (harvested 31 Jul — re-run the scan when new pages land) */
  '[data-theme=dark] .card,[data-theme=dark] .panel,[data-theme=dark] .sec,[data-theme=dark] .fold,[data-theme=dark] .tile,'+
  '[data-theme=dark] .tblwrap,[data-theme=dark] .chartbox,[data-theme=dark] #modal .card,[data-theme=dark] .banner,'+
  '[data-theme=dark] .decidecard,[data-theme=dark] .deal,[data-theme=dark] .cardk,[data-theme=dark] .cmt,[data-theme=dark] .cgpop,'+
  '[data-theme=dark] .evc-box,[data-theme=dark] .evchip,[data-theme=dark] .evc-sc,[data-theme=dark] .addld,[data-theme=dark] .addsub,'+
  '[data-theme=dark] .scatter,[data-theme=dark] .frameWrap,[data-theme=dark] .tlwrap,[data-theme=dark] .tlflex,[data-theme=dark] .lightlead .lc'+
  '{background:#1e2226!important;border-color:#3b4046!important;color:var(--ink,#e6e4df)}'+
  '[data-theme=dark] .btn.ghost,[data-theme=dark] .hbtn,[data-theme=dark] .zbtn,[data-theme=dark] .lang button,'+
  '[data-theme=dark] .seg button,[data-theme=dark] .lanetog.exp,[data-theme=dark] .ptabs button,[data-theme=dark] .tdseg button,'+
  '[data-theme=dark] .viewtabs button,[data-theme=dark] .ytab.on,[data-theme=dark] .chip,[data-theme=dark] .chip.line'+
  '{background:#262b31!important;border-color:#40464d!important;color:var(--ink,#e6e4df)!important}'+
  '[data-theme=dark] .seg button.on{background:var(--orange,#FF4A00)!important;color:#fff!important}'+
  '[data-theme=dark] input,[data-theme=dark] select,[data-theme=dark] textarea'+
  '{background:#22262b!important;color:#e6e4df!important;border-color:#40464d!important}'+
  '[data-theme=dark] table{background:#1b1f23}'+
  '[data-theme=dark] th{background:#242a30!important;color:#cfd3d8!important}'+
  '[data-theme=dark] td{border-color:#33383e}'+
  '[data-theme=dark] .nav a{color:#a4a9af}[data-theme=dark] .nav a.on{background:var(--orange,#FF4A00);color:#fff}'+
  '[data-theme=dark] .brandlet{color:#a4a9af}'+
  '[data-theme=dark] img.logo,[data-theme=dark] .clientlogo{background:#e6e4df;border-radius:6px;padding:2px}';
  const st=document.createElement('style');st.id='dcDarkCss';st.textContent=css;
  (document.head||document.documentElement).appendChild(st);
  dcApplyTheme();
})();
function navBar(active){
  /* .navlinks is display:contents on desktop (renders exactly as before);
     on phones the burger shows and the links drop down as a menu */
  return '<div class="nav" id="dcNav"><button class="navburger" aria-label="Menu" onclick="document.getElementById(\'dcNav\').classList.toggle(\'open\')">☰ Menu</button>'+
         '<div class="navlinks" onclick="document.getElementById(\'dcNav\').classList.remove(\'open\')">'+
         '<a href="home.html" id="nav-home" style="white-space:nowrap" class="'+(active==='home'?'on':'')+'" title="Your day: clock, hours, to-dos, holidays — everything personal">🙋 Me</a>'+
         '<a href="gantt.html" id="nav-projects" style="white-space:nowrap" class="'+(active==='overview'?'on':'')+'">📅 Projects</a>'+
         '<a href="people.html" id="nav-team" style="white-space:nowrap" class="'+(active==='people'||active==='hr'?'on':'')+'" title="The roster + the team holiday calendar — HR admin lives here too">👥 Team</a>'+
         '<a href="dashboard.html" style="white-space:nowrap" class="'+(active==='dashboard'||active==='fact'?'on':'')+'" title="Everything money — Invoicing and Reporting">💶 Money</a>'+
         '<a href="spx.html" id="nav-spx" style="white-space:nowrap" class="'+(active==='spx'?'on':'')+'" title="Sponsorship sales — proposals, health-check, reporting">💼 SPX</a>'+
         '<a href="impact.html" id="nav-impact" style="white-space:nowrap" class="'+(active==='impact'?'on':'')+'">📣 Impact</a>'+
         '<a href="tools.html" id="nav-tools" style="white-space:nowrap" class="'+(active==='tools'||active==='tickets'?'on':'')+'" title="Team tools — the Requests box lives here too">🧰 Tools</a>'+
         '<a href="crm.html" id="nav-crm" style="white-space:nowrap;display:none" class="'+(active==='crm'?'on':'')+'" title="Leads CRM — private, only Belén sees this tab">📇 CRM</a>'+
         '<a href="#" id="dcThemeBtn" onclick="dcThemeToggle();return false" style="white-space:nowrap" title="Dark mode">'+(dcTheme()==='dark'?'☀️':'🌙')+'</a>'+
         '<a href="#" onclick="dcQuickOpen();return false" style="white-space:nowrap" title="Quick-jump — Ctrl+K: events, people, invoices, contracts, requests">🔍</a>'+
         '<a href="inbox.html" id="nav-inbox" style="white-space:nowrap" class="'+(active==='inbox'?'on':'')+'" title="Notifications — answers to your requests, team notices, time-off decisions">🔔</a>'+
         '</div><span class="brandlet">RENMAD <b>Dispatch Center</b>'+
         (USE_SUPABASE?' &nbsp;·&nbsp; <a href="#" onclick="DB.logout();return false" style="color:#7c7c78;text-decoration:none">log out</a>':'')+'</span></div>';
}
/* ---- "new version" banner (29 Jul UX round) ----
   After every deploy someone swears nothing changed: the HTML itself is browser-cached,
   so an open tab keeps requesting the OLD store.js?v= until a hard refresh (the v72/v74
   incident, and the "Haz Ctrl+F5" line in every ticket reply). Instead of teaching the
   team keyboard folklore, each page compares the ?v= it was ACTUALLY loaded with against
   version.json (bumped with the cache-buster on every deploy) and offers one tap.
   Local rigs: fetch fails or matches -> silent. */
const PAGE_V=(()=>{try{const s=[...document.scripts].find(x=>/store\.js\?v=/.test(x.src));return +s.src.match(/v=(\d+)/)[1];}catch(e){return 0;}})();
/* A NORMAL reload reuses cached html+js — exactly what a broken page must NOT do.
   30 Jul incident: a tab that fetched store.js mid-deploy cached the OLD file under
   the NEW ?v= (the server sends max-age=1 YEAR on .js), and location.reload() kept
   serving that poisoned pair forever. Reloading through a fresh query string forces
   the page itself to come from the server, whose reference then points at a clean
   store.js URL. Every recovery button goes through this, never location.reload(). */
function dcHardReload(){
  try{
    const u=new URL(location.href);
    u.searchParams.set('fresh',Date.now().toString(36));
    location.replace(u.toString());
  }catch(e){location.reload();}
}
async function dcCheckBuild(){
  if(!PAGE_V)return;
  try{
    const r=await fetch('version.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)return;
    const j=await r.json();
    if(j&&+j.v>PAGE_V&&!document.getElementById('dcUpd')){
      const d=document.createElement('div');d.id='dcUpd';
      d.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#FF4A00;color:#fff;font:600 13px Segoe UI,system-ui,sans-serif;padding:12px 16px;text-align:center;cursor:pointer;box-shadow:0 -4px 18px rgba(0,0,0,.18)';
      d.textContent='⚡ The Dispatch has been updated — tap here to load the new version';
      d.onclick=()=>dcHardReload();
      document.body.appendChild(d);
    }
  }catch(e){}
}
setInterval(dcCheckBuild,5*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)dcCheckBuild();});
setTimeout(dcCheckBuild,15000);

/* ---- 🔍 quick-jump, Ctrl+K / Cmd+K or the nav button (29 Jul UX round) ----
   Type "verdian" → the invoice, the SPX contract, the person, the event. Pure
   client-side: everything is already in DB after boot. CRM contacts only appear
   on crm.html (their blob lives on that page, Belén-only). */
/* accent-insensitive: "belen" must find "Belén", "jesus" → "Jesús" (Spanish roster) */
function dcFold(s){return (''+(s||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function dcQuickIndex(){
  const ix=[],push=(icon,label,sub,href)=>{if(label)ix.push({icon,label,sub:sub||'',href,q:dcFold(label+' '+(sub||''))});};
  try{(DB.events||[]).forEach(e=>push('📅',e.name,((e.city||'')+' · '+deIso(e.date||'')).replace(/^ · /,''),'event.html?id='+e.id));}catch(e){}
  try{(DB.people||[]).filter(p=>!isTeamAccount(p)).forEach(p=>push('👤',p.name,p.role||'','person.html?id='+p.id));}catch(e){}
  try{if(DB.financeReady())(DB.finance||[]).forEach(f=>push('💶',f.name+' '+(f.year||''),'Money · '+(f.when||''),'dashboard.html#year'));}catch(e){}
  try{if(DB.billReady())(DB.invoices||[]).forEach(i=>push('🧾',(i.numero_factura||'—')+' · '+(i.razon_social||''),deIso((i.fecha||'').slice(0,10)),'facturacion.html'));}catch(e){}
  try{if(DB.spxReady())(DB.spxProps||[]).filter(p=>p.active!==false&&!p.superseded).forEach(p=>push('💼',p.company||'—','SPX · '+(p.stage||p.salesStatus||''),'spx.html'));}catch(e){}
  try{if(DB.tickReady())(DB.tickets||[]).forEach(t=>push('💡',t.title,'request · '+(t.status||''),'inbox.html#requests'));}catch(e){}
  try{if(typeof CRM!=='undefined'&&CRM.data&&isBelenP(DB.currentUser))(CRM.data.contacts||[]).forEach(c=>push('📇',c.name||c.company||'—','CRM · '+(c.company||''),'crm.html#contacts'));}catch(e){}
  return ix;
}
function dcQuickOpen(){
  if(document.getElementById('dcQj'))return;
  const d=document.createElement('div');d.id='dcQj';
  d.style.cssText='position:fixed;inset:0;background:rgba(20,20,20,.45);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding-top:12vh';
  d.innerHTML='<div style="background:#fff;border-radius:14px;width:560px;max-width:92vw;box-shadow:0 18px 60px rgba(0,0,0,.3);overflow:hidden">'+
    '<input id="qjIn" placeholder="Jump to… events, people, invoices, contracts, requests" autocomplete="off" style="width:100%;box-sizing:border-box;border:none;outline:none;font:15px Segoe UI,system-ui,sans-serif;padding:15px 18px;border-bottom:1px solid #e3e1da">'+
    '<div id="qjList" style="max-height:46vh;overflow:auto"></div>'+
    '<div style="font-size:11px;color:#7c7c78;padding:7px 14px;background:#faf9f6;font-family:Segoe UI,system-ui,sans-serif">↑↓ move · Enter open · Esc close</div></div>';
  document.body.appendChild(d);
  d.onclick=e=>{if(e.target===d)d.remove();};
  const ix=dcQuickIndex();let sel=0,cur=[];
  const inp=document.getElementById('qjIn'),list=document.getElementById('qjList');
  const go=x=>{if(!x)return;d.remove();location.href=x.href;};
  const draw=()=>{
    const q=dcFold(inp.value.trim());
    cur=q?ix.filter(x=>q.split(/\s+/).every(w=>x.q.indexOf(w)>=0)).slice(0,12):[];
    if(sel>=cur.length)sel=Math.max(0,cur.length-1);
    list.innerHTML=cur.map((x,i)=>'<div data-qj="'+i+'" style="display:flex;gap:10px;align-items:center;padding:9px 16px;cursor:pointer;font:13.5px Segoe UI,system-ui,sans-serif;'+(i===sel?'background:#FFF3EC':'')+'">'+
      '<span>'+x.icon+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b style="color:#2B2B2B">'+esc(x.label)+'</b>'+(x.sub?' <span style="color:#7c7c78;font-size:12px">'+esc(x.sub)+'</span>':'')+'</span></div>').join('')||
      (q?'<div style="padding:14px 16px;color:#7c7c78;font-size:13px;font-style:italic;font-family:Segoe UI,system-ui,sans-serif">Nothing matches.</div>':'');
    list.querySelectorAll('[data-qj]').forEach(el=>{
      el.onmouseenter=()=>{if(sel!==+el.dataset.qj){sel=+el.dataset.qj;draw();}};
      el.onclick=()=>go(cur[+el.dataset.qj]);});
  };
  inp.oninput=()=>{sel=0;draw();};
  inp.onkeydown=e=>{
    if(e.key==='Escape')d.remove();
    else if(e.key==='ArrowDown'){sel=Math.min(sel+1,Math.max(0,cur.length-1));draw();e.preventDefault();}
    else if(e.key==='ArrowUp'){sel=Math.max(sel-1,0);draw();e.preventDefault();}
    else if(e.key==='Enter')go(cur[sel]);
  };
  inp.focus();draw();
}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();dcQuickOpen();}
});
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
/* ================= 📅 THE TASK CALENDAR (shared, 6 Aug 2026) =================
   The horizontal "week of 10 August and it does not escape you" view. It used to live
   only on a person's page in 👥 Team; Belén asked for it on 🙋 Me too, right under the
   pending block. Lifted here rather than copied so the two can never drift (rulebook:
   prefer lifting the helper into store.js). It injects its own scoped CSS, so it works
   on any page without that page owning a stylesheet for it.
   Rows = events, bars = that person's tasks placed by taskDate(). */
const DCTC_W=24, DCTC_TASKH=17, DCTC_TGAP=3, DCTC_ROWPAD=7, DCTC_TOPH=34;
function dctcCss(){
  if(document.getElementById('dctcCss'))return;
  const s=document.createElement('style');s.id='dctcCss';
  s.textContent=
  '.dctc-wrap{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow-x:auto;overflow-y:hidden}'+
  '.dctc{position:relative;font-size:12px}'+
  '.dctc-row{display:flex;align-items:stretch;border-bottom:1px solid var(--line)}.dctc-row:last-child{border-bottom:none}'+
  '.dctc-corner{flex:0 0 200px;position:sticky;left:0;z-index:6;background:var(--card);border-right:2px solid var(--line)}'+
  '.dctc-head{position:sticky;left:0;z-index:5;flex:0 0 200px;background:var(--card);border-right:2px solid var(--line);padding:7px 10px;display:flex;flex-direction:column;gap:2px;justify-content:center}'+
  '.dctc-head .nm{font-weight:700;font-size:13px;line-height:1.15;display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--charcoal)}'+
  '.dctc-head .nm:hover .t{text-decoration:underline;color:var(--orange)}'+
  '.dctc-head .chip{width:10px;height:10px;border-radius:3px;flex:0 0 auto}'+
  '.dctc-head .ln{font-size:10px;color:var(--muted)}'+
  '.dctc-hbody{position:relative}'+
  '.dctc-mlabel{position:absolute;top:2px;height:16px;font-size:11px;color:var(--charcoal);font-weight:600;padding-left:4px;white-space:nowrap;border-left:1px solid var(--line)}'+
  '.dctc-wtick{position:absolute;top:20px;height:14px;font-size:9px;color:#a9a79f;text-align:center;border-left:1px solid #efece5}'+
  '.dctc-body{position:relative;flex:1 1 auto}'+
  '.dctc-bg{position:absolute;inset:0;z-index:0}'+
  '.dctc-band{position:absolute;top:0;bottom:0;z-index:1;background:repeating-linear-gradient(45deg,rgba(150,147,140,.14) 0 5px,rgba(150,147,140,0) 5px 10px)}'+
  '.dctc-band.skip{background:repeating-linear-gradient(45deg,rgba(120,118,112,.24) 0 5px,rgba(120,118,112,.04) 5px 10px)}'+
  '.dctc-w0{position:absolute;z-index:3;width:2px;background:#111}'+
  '.dctc-w0lab{position:absolute;z-index:4;background:#111;color:#fff;font-size:8px;font-weight:800;padding:0 3px;border-radius:2px}'+
  '.dctc-task{position:absolute;z-index:5;height:17px;border-radius:3px;font-size:10px;font-weight:600;line-height:17px;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;border:1px solid rgba(0,0,0,.18)}'+
  '.dctc-task.done{opacity:.55;text-decoration:line-through}'+
  '.dctc-task.prog{box-shadow:inset 3px 0 0 var(--orange)}'+
  '.dctc-today{position:absolute;z-index:7;width:2px;background:var(--orange);top:0}'+
  '.dctc-todaylab{position:absolute;z-index:9;background:var(--orange);color:#fff;font-size:8px;font-weight:800;padding:0 4px;border-radius:2px;top:1px}'+
  '.dctc-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted);align-items:center;margin:6px 0 8px}'+
  '.dctc-legend .sw{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:4px}'+
  '#dctcTip{position:fixed;z-index:50;background:#2b2b2b;color:#fff;font-size:11px;padding:4px 8px;border-radius:5px;pointer-events:none;display:none;white-space:nowrap;max-width:340px;line-height:1.4}'+
  /* the shared task list carries its own table styling so it looks the same on any page */
  '.dctl{width:100%;border-collapse:collapse;font-size:13px}'+
  '.dctl th,.dctl td{text-align:left;padding:6px 9px;border-bottom:1px solid #efede8;vertical-align:top}'+
  '.dctl th{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700}'+
  '.dctl input,.dctl select{font:inherit;font-size:12.5px;padding:4px 6px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);width:100%}'+
  '.dctl .st{font-size:11px;font-weight:700;border-radius:10px;padding:1px 8px;color:#fff;white-space:nowrap}'+
  '.dctl .empty{color:var(--muted);font-style:italic}'+
  '.dctl .hint{font-size:11px;color:var(--muted)}'+
  /* the runway bands + the NEW chip + the 🕘 history pop-out */
  '.dctl-band{display:flex;align-items:center;gap:8px;margin:12px 0 2px;font-size:13px}'+
  '.dctl-band .dot{width:9px;height:9px;border-radius:3px;flex:0 0 auto}'+
  '.dctl-band .hint{font-size:11.5px;color:var(--muted);font-weight:400}'+
  '.dctl-new{background:var(--orange);color:#fff;border-radius:9px;padding:0 6px;font-size:9.5px;font-weight:800;letter-spacing:.4px;vertical-align:1px}'+
  '.dctl-hist{background:none;border:none;cursor:pointer;font-size:13px;opacity:.45;padding:2px}'+
  '.dctl-hist:hover{opacity:1}'+
  '.dctl-histpop{position:absolute;z-index:70;background:var(--card);border:1px solid var(--line);border-radius:10px;'+
    'box-shadow:0 8px 24px rgba(0,0,0,.16);padding:10px 12px;min-width:300px;max-width:420px;max-height:300px;overflow:auto;font-size:12.5px}';
  document.head.appendChild(s);
  const t=document.createElement('div');t.id='dctcTip';document.body.appendChild(t);
}
function dctcTip(x,y,html){const t=document.getElementById('dctcTip');if(!t)return;
  t.innerHTML=html;t.style.display='block';t.style.left=(x+13)+'px';t.style.top=(y+14)+'px';}
function dctcHideTip(){const t=document.getElementById('dctcTip');if(t)t.style.display='none';}
/* which events belong on this person's calendar */
function dctcEvents(personId){
  const p=DB.person(personId);
  const mine=DB.tasksOf(personId);
  const ids=new Set(mine.map(t=>t.eventId));
  DB.events.forEach(ev=>{if((ev.team||[]).some(m=>m.personId==personId))ids.add(ev.id);});
  if(p&&p.access==='admin')DB.events.forEach(e=>ids.add(e.id));   // admins oversee every event
  return DB.events.filter(e=>ids.has(e.id)).sort((a,b)=>ymd(a.date)-ymd(b.date));
}
function dcTaskCalendar(host,personId,opts){
  opts=opts||{};
  if(!host)return;
  dctcCss();
  const mine=DB.tasksOf(personId), events=dctcEvents(personId);
  if(!events.length){host.innerHTML='<p class="empty" style="padding:14px">No events or tasks assigned yet.</p>';return;}
  const legend='<div class="dctc-legend"><span><span class="sw" style="background:#A9CBEE"></span>PM</span>'+
    '<span><span class="sw" style="background:#FFC9A3"></span>Marketing</span>'+
    '<span><span class="sw" style="background:#BFE0A0"></span>Sales</span>'+
    '<span><span class="sw" style="background:#ECCA46"></span>Logistics</span>'+
    '<span><span class="sw" style="background:#111"></span>Event week</span>'+
    '<span style="color:#b9b6ad">✓ done · line = today</span></div>';
  host.innerHTML=legend+'<div class="dctc-wrap"><div class="dctc"></div></div>';
  const wrap=host.querySelector('.dctc-wrap'), grid=host.querySelector('.dctc');
  const W=DCTC_W;
  const dts=[];mine.forEach(t=>dts.push(+taskDate(t)));events.forEach(e=>dts.push(+monday(ymd(e.date))));dts.push(+monday(new Date()));
  const start=addDays(monday(new Date(Math.min.apply(null,dts))),-2*7);
  const end=addDays(monday(new Date(Math.max.apply(null,dts))),3*7);
  const NW=Math.round((+end-+start)/(7*86400000))+1, BW=NW*W;
  const todayIdx=Math.round((+monday(new Date())-+start)/(7*86400000));
  const wcol=d=>Math.round((+monday(d)-+start)/(7*86400000));

  const hrow=document.createElement('div');hrow.className='dctc-row';
  hrow.innerHTML='<div class="dctc-corner" style="min-height:'+DCTC_TOPH+'px"></div>';
  const hb=document.createElement('div');hb.className='dctc-hbody';hb.style.cssText='flex:0 0 '+BW+'px;width:'+BW+'px;height:'+DCTC_TOPH+'px';
  for(let w=0;w<NW;w++){const d=addDays(start,w*7);
    if(d.getDate()<=7){const ml=document.createElement('div');ml.className='dctc-mlabel';ml.style.left=(w*W)+'px';
      ml.textContent=MON[d.getMonth()]+(d.getMonth()===0?" '"+String(d.getFullYear()).slice(2):'');hb.appendChild(ml);}
    const wt=document.createElement('div');wt.className='dctc-wtick';wt.style.cssText='left:'+(w*W)+'px;width:'+W+'px';wt.textContent=d.getDate();hb.appendChild(wt);}
  if(todayIdx>=0&&todayIdx<NW){const tl=document.createElement('div');tl.className='dctc-todaylab';tl.style.left=(todayIdx*W)+'px';tl.textContent='TODAY';hb.appendChild(tl);}
  hrow.appendChild(hb);grid.appendChild(hrow);

  events.forEach(ev=>{
    const evCol=wcol(monday(ymd(ev.date)));
    const rowTasks=mine.filter(t=>t.eventId===ev.id);
    const items=rowTasks.map(t=>{const c=wcol(taskDate(t));return {t,c,x:c*W,w:Math.max((t.title||'').length*6+22,44)};}).sort((a,b)=>a.x-b.x);
    const rowRight=[];items.forEach(it=>{let r=rowRight.findIndex(rr=>rr<=it.x-3);if(r<0){r=rowRight.length;rowRight.push(0);}rowRight[r]=it.x+it.w;it.row=r;});
    const rows=Math.max(rowRight.length,1), bodyH=DCTC_ROWPAD+rows*(DCTC_TASKH+DCTC_TGAP);

    const row=document.createElement('div');row.className='dctc-row';
    const head=document.createElement('div');head.className='dctc-head';
    head.innerHTML='<div class="nm"><span class="chip" style="background:'+(TOPICS[ev.topic]||'#999')+'"></span><span class="t">'+esc(ev.name)+'</span></div>'+
      '<div class="ln">'+esc(ev.city||'')+(ev.city&&ev.country?', ':'')+esc(ev.country||'')+' · '+dateRange(ev)+' · '+rowTasks.length+' task'+(rowTasks.length===1?'':'s')+'</div>';
    head.querySelector('.nm').onclick=()=>location.href='event.html?id='+ev.id;

    const body=document.createElement('div');body.className='dctc-body';body.style.cssText='flex:0 0 '+BW+'px;width:'+BW+'px;height:'+bodyH+'px';
    const gb=document.createElement('div');gb.className='dctc-bg';
    gb.style.background='repeating-linear-gradient(to right,transparent 0,transparent '+(W-1)+'px,#efece5 '+(W-1)+'px,#efece5 '+W+'px)';body.appendChild(gb);
    for(let w=0;w<NW;w++){const m=addDays(start,w*7);const c=capacity(m);
      if(c.w<1){const b=document.createElement('div');b.className='dctc-band'+(c.w===0?' skip':'');
        b.style.cssText+=';left:'+(w*W)+'px;width:'+W+'px';b.title=c.why;body.appendChild(b);}}
    if(evCol>=0&&evCol<NW){const w0=document.createElement('div');w0.className='dctc-w0';w0.style.cssText='left:'+(evCol*W)+'px;height:'+bodyH+'px';body.appendChild(w0);
      const w0l=document.createElement('div');w0l.className='dctc-w0lab';w0l.style.cssText='left:'+(evCol*W+3)+'px;top:2px';w0l.textContent='EVENT';body.appendChild(w0l);}
    if(todayIdx>=0&&todayIdx<NW){const tln=document.createElement('div');tln.className='dctc-today';tln.style.cssText='left:'+(todayIdx*W)+'px;height:'+bodyH+'px';body.appendChild(tln);}
    items.forEach(it=>{const t=it.t, col=stageColor(t.lane,t.stage,ev);
      /* .prog is the orange edge — it now marks ASSIGNED (nobody has looked at it yet),
         which is the state that actually deserves the eye */
      const el=document.createElement('div');el.className='dctc-task'+(taskDone(t)||taskCancelled(t)?' done':taskStatus(t)==='Assigned'?' prog':'');
      el.style.cssText='left:'+(it.x+2)+'px;top:'+(DCTC_ROWPAD+it.row*(DCTC_TASKH+DCTC_TGAP))+'px;width:'+(it.w)+'px;height:'+DCTC_TASKH+'px;background:'+col+';color:'+(col==='#111111'?'#fff':'#2b2b2b');
      el.textContent=(taskDone(t)?'✓ ':taskCancelled(t)?'✕ ':'')+t.title;
      const sub=DB.substages.find(s=>s.id==t.substageId);
      const who=DB.taskPeople(t).map(id=>DB.personName(id)).join(', ');
      el.addEventListener('mousemove',e=>dctcTip(e.clientX,e.clientY,'<b>'+esc(t.title)+'</b><br>'+esc(ev.name)+' · '+esc(stageName(t.lane,t.stage,ev))+
        (sub?' · '+esc(sub.name):'')+'<br>'+(t.deadline?('due '+deIso(t.deadline)):('week of '+fmtD(taskDate(t))))+' · '+esc(t.status)+
        (who?('<br>'+esc(who)):'')+(t.notes?('<br><i>'+esc(t.notes)+'</i>'):'')));
      el.addEventListener('mouseleave',dctcHideTip);
      el.onclick=()=>location.href='event.html?id='+ev.id;
      body.appendChild(el);});
    row.appendChild(head);row.appendChild(body);grid.appendChild(row);
  });
  /* open on today, the way every other timeline in the app does */
  if(opts.scroll!==false)wrap.scrollLeft=Math.max(0,todayIdx*W-40);
}

/* ---- the editable task list, shared by 🙋 Me and 👥 Team (Belén, 6 Aug 2026) ----
   "desde ahí no se puede cambiar el estatus — hay que entrar proyecto por proyecto."
   Status and notes are editable right here; everything else stays where it is decided. */
function dctlRow(t,personId){
  const e=DB.event(t.eventId), canS=DB.canEditStatus(t), st=taskStatus(t);
  const d=taskDaysAway(t), band=taskBand(t);
  const others=DB.taskPeople(t).filter(id=>id!=personId);
  const when=t.deadline?deIso(t.deadline):('wk '+fmtD(taskDate(t)));
  const rel=taskLive(t)?(d<0?(-d)+'d late':d===0?'today':d===1?'tomorrow':d<=20?('in '+d+'d'):''):'';
  return '<tr'+(taskCancelled(t)?' style="opacity:.55"':'')+'>'+
    '<td style="font-weight:600;color:var(--charcoal)">'+
      '<a href="event.html?id='+t.eventId+'" data-dtlopen="'+t.id+'" style="color:inherit;text-decoration:none'+(taskCancelled(t)?';text-decoration:line-through':'')+'">'+esc(t.title||'')+'</a>'+
      (st==='Assigned'?' <span class="dctl-new">NEW</span>':'')+
      (others.length?'<div class="hint" style="font-weight:400">with '+esc(others.map(id=>DB.personName(id)).join(', '))+'</div>':'')+
      (taskCancelled(t)&&t.cancelReason?'<div class="hint" style="font-weight:400">cancelled — '+esc(t.cancelReason)+'</div>':'')+
    '</td>'+
    '<td>'+esc(e?e.name:'—')+'</td>'+
    '<td'+(taskLive(t)&&d<0?' style="color:#D32230;font-weight:700"':'')+'>'+when+
      (rel?'<div class="hint" style="color:'+band.color+'">'+rel+'</div>':'')+'</td>'+
    '<td>'+(canS?'<input data-dtl="notes" data-id="'+t.id+'" value="'+esc(t.notes||'')+'" placeholder="short note">'
                :(t.notes?esc(t.notes):'<span class="empty">—</span>'))+'</td>'+
    '<td>'+(canS?('<select data-dtl="status" data-id="'+t.id+'">'+STATUS.map(s=>'<option '+(s===st?'selected':'')+'>'+s+'</option>').join('')+'</select>')
                :('<span class="st" style="background:'+(STCOL[st]||'#9AA0A8')+'">'+esc(st)+'</span>'))+'</td>'+
    '<td><button class="dctl-hist" data-dtlhist="'+t.id+'" title="Who changed this, and when">🕘</button></td></tr>';
}
function dctlHead(){
  return '<tr><th>Task</th><th>Event</th><th style="width:120px">When</th>'+
    '<th style="width:170px">Notes</th><th style="width:130px">Status</th><th style="width:28px"></th></tr>';
}
/* The runway view: bands, soonest first, everything past two weeks collapsed to one
   number. Belén, 6 Aug: "X tasks 2 weeks away, 1 week away and then days" — because a
   task can sit in the books for months and a flat open-list is unreadable. */
function dcRunwayHtml(personId,opts){
  opts=opts||{};
  const R=taskRunway(personId);
  const live=TASK_BANDS.reduce((a,b)=>a+R[b.key].length,0);
  if(!live)return '<p class="empty" style="padding:8px 2px">'+(opts.empty||'Nothing on your runway — all clear. 🎉')+'</p>';
  const near=TASK_BANDS.filter(b=>b.key!=='later');
  let h='';
  near.forEach(b=>{
    const rows=R[b.key];if(!rows.length)return;
    h+='<div class="dctl-band"><span class="dot" style="background:'+b.color+'"></span>'+
       '<b>'+b.label+'</b><span class="hint">'+rows.length+' task'+(rows.length===1?'':'s')+'</span></div>'+
       '<table class="dctl">'+dctlHead()+rows.map(t=>dctlRow(t,personId)).join('')+'</table>';
  });
  const later=R.later;
  if(later.length){
    h+='<div class="dctl-band" style="margin-top:10px"><span class="dot" style="background:#a9a79f"></span>'+
       '<b>Further out</b><span class="hint">'+later.length+' task'+(later.length===1?'':'s')+' more than two weeks away — '+
       '<a href="#" data-dtlmore="1">show them</a></span></div>'+
       '<div id="dctlLater" style="display:none"><table class="dctl">'+dctlHead()+later.map(t=>dctlRow(t,personId)).join('')+'</table></div>';
  }
  if(!near.some(b=>R[b.key].length))
    h='<p class="hint" style="padding:4px 2px">Nothing due in the next two weeks. '+later.length+' task'+(later.length===1?'':'s')+' further out.</p>'+h;
  return h;
}
function dcTaskListHtml(personId,opts){
  opts=opts||{};
  const tasks=(opts.tasks||DB.tasksOf(personId)).slice()
    .sort((a,b)=>(+taskDueDate(a))-(+taskDueDate(b)));
  const lim=opts.limit||0;
  const shown=lim?tasks.slice(0,lim):tasks;
  let h='<table class="dctl">'+dctlHead();
  if(!shown.length)h+='<tr><td colspan="6" class="empty">'+(opts.empty||'Nothing here.')+'</td></tr>';
  shown.forEach(t=>{h+=dctlRow(t,personId);});
  h+='</table>';
  if(lim&&tasks.length>lim)h+='<p class="hint" style="margin-top:6px">Showing '+lim+' of '+tasks.length+
    ' — <a href="person.html?id='+personId+'">see all →</a></p>';
  return h;
}
function wireTaskList(box,after){
  if(!box)return;
  const redraw=()=>{if(typeof after==='function')after();};
  box.querySelectorAll('[data-dtl]').forEach(el=>el.onchange=async()=>{
    const t=DB.tasks.find(x=>x.id==el.dataset.id);if(!t)return;
    if(el.dataset.dtl==='status'){
      const v=el.value;
      if(v==='Cancelled'){
        const why=prompt('Why is this cancelled? Everyone on the task will see this.');
        if(why===null||!(''+why).trim()){el.value=taskStatus(t);return;}   // no reason, no cancel
        cancelTask(t,why);
      }else{t.status=v;if(v!=='Cancelled')t.cancelReason=null;}
    }else t[el.dataset.dtl]=el.value;
    await DB.saveNow();
    redraw();
  });
  /* opening the task IS reading it — that is what clears Assigned (automatic, never a click) */
  box.querySelectorAll('[data-dtlopen]').forEach(a=>a.addEventListener('click',()=>{
    const t=DB.tasks.find(x=>x.id==a.dataset.dtlopen);if(t)taskSeen(t);
  }));
  box.querySelectorAll('[data-dtlhist]').forEach(b=>b.onclick=e=>{e.preventDefault();openTaskHistory(b,b.dataset.dtlhist);});
  const more=box.querySelector('[data-dtlmore]');
  if(more)more.onclick=e=>{e.preventDefault();
    const box2=document.getElementById('dctlLater');
    if(!box2)return;
    const open=box2.style.display!=='none';
    box2.style.display=open?'none':'';
    more.textContent=open?'show them':'hide them';};
}
/* the 🕘 button: who moved this task, and when */
async function openTaskHistory(btn,taskId){
  document.querySelectorAll('.dctl-histpop').forEach(x=>x.remove());
  const pop=document.createElement('div');pop.className='dctl-histpop';
  pop.innerHTML='<div class="hint">Loading the record…</div>';
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect();
  pop.style.left=Math.max(8,Math.min(r.left+window.scrollX-180,window.scrollX+document.documentElement.clientWidth-330))+'px';
  pop.style.top=(r.bottom+window.scrollY+5)+'px';
  const close=e=>{if(pop.contains(e.target))return;pop.remove();document.removeEventListener('mousedown',close);};
  setTimeout(()=>document.addEventListener('mousedown',close),0);
  const t=DB.tasks.find(x=>x.id==taskId);
  const rows=await taskHistory(taskId);
  let h='<div style="font-weight:700;margin-bottom:6px">'+esc((t&&t.title)||'This task')+'</div>';
  if(rows===null)h+='<div class="hint">The record is only readable on the live site.</div>';
  else if(!rows.length)h+='<div class="hint">No status change recorded yet — it has not moved since it was created.</div>';
  else h+='<table class="dctl"><tr><th>When</th><th>Who</th><th>Change</th></tr>'+
    rows.map(x=>{
      const who=(DB.people.find(p=>(p.email||'').toLowerCase()===(''+(x.actor||'')).toLowerCase())||{}).name||x.actor||'—';
      const from=x.from_status||'created', to=x.to_status||'—';
      return '<tr><td style="white-space:nowrap">'+esc((''+x.at).slice(0,16).replace('T',' '))+'</td>'+
             '<td>'+esc(who)+'</td><td>'+esc(from)+' → <b>'+esc(to)+'</b></td></tr>';}).join('')+'</table>';
  if(t&&taskCancelled(t)&&t.cancelReason)h+='<div class="hint" style="margin-top:6px">Cancelled because: '+esc(t.cancelReason)+'</div>';
  pop.innerHTML=h;
}
/* resizeImage() centre-CROPS to a square, which is right for an avatar and wrong for
   anything you actually have to read. This one fits the whole image inside maxDim and
   keeps its shape — floor plans, room photos (6 Aug 2026). */
function resizeImageFit(file,cb,maxDim){maxDim=maxDim||1400;const rd=new FileReader();
  rd.onload=e=>{const img=new Image();img.onload=()=>{
    const sc=Math.min(1,maxDim/Math.max(img.width,img.height));
    const w=Math.max(1,Math.round(img.width*sc)),h=Math.max(1,Math.round(img.height*sc));
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);   // a transparent PNG plan must not go black
    cx.drawImage(img,0,0,w,h);
    cb(cv.toDataURL('image/jpeg',0.85));};img.onerror=()=>cb(null);img.src=e.target.result;};
  rd.onerror=()=>cb(null);rd.readAsDataURL(file);}
/* avatar HTML: the photo, or a coloured initials circle */
function avatarHtml(p,px){px=px||34;const init=(p.name||'?').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const pal=['#FF4A00','#185FA5','#3E8C28','#4C3079','#29ACE3','#C77800','#D32230','#0E7C6B'];
  const col=pal[(p.id||0)%pal.length];
  if(p.photo)return '<span style="display:inline-block;width:'+px+'px;height:'+px+'px;border-radius:50%;background-image:url('+p.photo+');background-size:cover;background-position:center;vertical-align:middle;flex:0 0 auto"></span>';
  return '<span style="display:inline-flex;width:'+px+'px;height:'+px+'px;border-radius:50%;background:'+col+';color:#fff;font-weight:700;font-size:'+Math.round(px*0.4)+'px;align-items:center;justify-content:center;vertical-align:middle;flex:0 0 auto">'+init+'</span>';}
function exportXLSX(filename,sheets){loadXLSX(()=>{const wb=XLSX.utils.book_new();sheets.forEach(s=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s.rows),s.name.slice(0,31)));XLSX.writeFile(wb,filename);});}
