/* RENMAD Dispatch Center — shared data store (prototype stand-in for Supabase).
   Lives in browser localStorage so all pages share it and edits survive reloads. */
const STORE_VERSION = 5;
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TOPICS={'Renewables / AI':'#FF4A00','Storage':'#E84830','Biomethane':'#4C3079','Hydrogen':'#3E8C28','Data Centers':'#29ACE3','Investment':'#185FA5'};
const COUNTRIES={Spain:'ES',Poland:'PL',Italy:'IT',Mexico:'MX',Chile:'CL',Brazil:'BR','Dominican Rep.':'DO',Other:''};
const CRIT={research:[3,7],prep:[4,17],marketing:[16,27]};
const ROLES=['Lead','PM','Sales','Marketing','Logistics'];
const STATUS=['To do','In progress','Done'];
const POST_PM=1, POST_SALES=2;
/* lanes + stages, coloured to match the overview exactly */
const STAGES={
 project:[{key:'research',name:'Research',color:'#B5D4F4'},{key:'prep',name:'Prep',color:'#378ADD'},{key:'marketing',name:'Marketing',color:'#185FA5'}],
 sales:[{key:'prospecting',name:'Prospecting',color:'#C0DD97'},{key:'outreach',name:'Outreach',color:'#639922'},{key:'closing',name:'Closing',color:'#3B6D11'}],
 logistics:[{key:'venue',name:'Venue & contract',color:'#9a978f'},{key:'onsite',name:'Onsite & materials',color:'#76746d'}],
};
const LANE_LABEL={project:'Project / Marketing',sales:'Sales (SPX)',logistics:'Logistics'};
function stageColor(lane,key){const s=(STAGES[lane]||[]).find(s=>s.key===key);return s?s.color:'#b4b2a9';}
function stageName(lane,key){const s=(STAGES[lane]||[]).find(s=>s.key===key);return s?s.name:key;}

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

/* ---- seed ---- */
const SEED_EVENTS=[
 {id:1,name:'E053 RENMAD Invest',topic:'Investment',pm:'Belén',lead:'',sales:'Sheetal',city:'Madrid',country:'Spain',date:'2027-01-26',days:2,proj:{research:5,prep:5,marketing:16},salesT:{prospecting:8,outreach:10,closing:6},prov:true},
 {id:2,name:'E056 RENMAD Biomethane',topic:'Biomethane',pm:'Jesús R',lead:'',sales:'Ian',city:'Toledo',country:'Spain',date:'2027-02-11',days:2,proj:{research:5,prep:5,marketing:18},salesT:{prospecting:8,outreach:10,closing:6},prov:true},
 {id:3,name:'E057 RENMAD Storage',topic:'Storage',pm:'Ian',lead:'',sales:'Carlos',city:'Seville',country:'Spain',date:'2027-03-25',days:2,proj:{research:5,prep:7,marketing:20},salesT:{prospecting:10,outreach:12,closing:6},prov:true},
 {id:4,name:'E058 RENMAD Storage Italia',topic:'Storage',pm:'Elena',lead:'',sales:'Cristina',city:'Rome',country:'Italy',date:'2027-04-07',days:2,proj:{research:4,prep:5,marketing:18},salesT:{prospecting:8,outreach:10,closing:6},prov:true},
 {id:5,name:'E052 RENMAD UsefulAI',topic:'Renewables / AI',pm:'Belén',lead:'Cintia',sales:'Diego',city:'Madrid',country:'Spain',date:'2027-06-02',days:2,proj:{research:5,prep:5,marketing:18},salesT:{prospecting:8,outreach:10,closing:6},prov:true},
 {id:6,name:'E055 RENMAD Data Centers',topic:'Data Centers',pm:'Cintia',lead:'',sales:'Andrea',city:'Madrid',country:'Spain',date:'2027-07-08',days:2,proj:{research:5,prep:5,marketing:18},salesT:{prospecting:8,outreach:10,closing:6},prov:true},
];
const SEED_PEOPLE=[
 {id:1,name:'Belén',role:'Lead',email:'belen@ata.email'},{id:2,name:'Jesús R',role:'PM',email:''},{id:3,name:'Cintia',role:'PM',email:''},
 {id:4,name:'Andrea',role:'Marketing',email:''},{id:5,name:'Ewa',role:'PM',email:''},{id:6,name:'Ian',role:'Sales',email:''},
 {id:7,name:'Carlos',role:'Sales',email:''},{id:8,name:'Helena',role:'PM',email:''},{id:9,name:'Elena',role:'PM',email:''},
 {id:10,name:'Cristina',role:'PM',email:''},{id:11,name:'Sheetal',role:'Sales',email:''},{id:12,name:'Daniel',role:'Logistics',email:''},
 {id:13,name:'Valeria',role:'Logistics',email:''},{id:14,name:'Diego',role:'Sales',email:''},
];
function buildSeed(){
  const events=JSON.parse(JSON.stringify(SEED_EVENTS));
  const people=JSON.parse(JSON.stringify(SEED_PEOPLE));
  const byName=n=>{const p=people.find(p=>p.name===n);return p?p.id:null;};
  const subs=[],tasks=[];let sid=1,tid=1;
  const PLAN={
    project:{research:['Speaker research','Topic scoping'],prep:['Agenda build','Confirm speakers'],marketing:['Content & assets','Email campaign']},
    sales:{prospecting:['Target list','First calls'],outreach:['Send proposals'],closing:['Negotiate & close']},
    logistics:{venue:['Venue shortlist','Contract & payments'],onsite:['Badges & lanyards','AV & catering']},
  };
  events.forEach(ev=>{
    // free-floating milestone offsets (weeks before event), start at the natural boundaries
    ev.proj.goNoGoOff=ev.proj.prep+ev.proj.marketing;
    ev.proj.launchOff=ev.proj.marketing;
    ev.salesT.goNoGoOff=ev.salesT.outreach+ev.salesT.closing;
    // team attached to the event
    ev.team=[];const add=(n,r)=>{const id=byName(n);if(id&&!ev.team.find(t=>t.personId===id))ev.team.push({personId:id,role:r});};
    add(ev.pm,'PM');if(ev.lead)add(ev.lead,'Lead');add(ev.sales,'Sales');
    // stages -> substages -> 1 sample task each
    Object.keys(PLAN).forEach(lane=>Object.keys(PLAN[lane]).forEach(stage=>{
      PLAN[lane][stage].forEach((nm,i)=>{const sub={id:sid++,eventId:ev.id,lane,stage,name:nm,order:i};subs.push(sub);
        const who=lane==='sales'?byName(ev.sales):byName(ev.pm);
        tasks.push({id:tid++,eventId:ev.id,lane,stage,substageId:sub.id,title:nm,assignee:who,deadline:'',status:'To do'});});
    }));
  });
  return {v:STORE_VERSION,events,people,substages:subs,tasks,nextEvent:7,nextPerson:15,nextSub:sid,nextTask:tid};
}

/* ---- Supabase config: if URL set => shared cloud database + login; else local browser storage ---- */
const SUPABASE_URL='https://dxgvbufsifgowwfggvmr.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3ZidWZzaWZnb3d3Zmdndm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODM1OTUsImV4cCI6MjA5ODA1OTU5NX0.EDMWWjMuDM0jS0d0SwzdhuW_ZnHP0T0kqwL3xc6Cw-w';
const USE_SUPABASE=!!SUPABASE_URL;
let sb=null,_saveTimer=null;

const DB={
  data:null,
  async load(){
    if(USE_SUPABASE){
      const {data,error}=await sb.from('dispatch_state').select('data').eq('id',1).single();
      if(error)throw error;
      const d=data&&data.data;
      if(d&&d.events&&d.events.length&&d.v===STORE_VERSION){this.data=d;}
      else{this.data=buildSeed();await this.pushNow();}
      return this.data;
    }
    try{this.data=JSON.parse(localStorage.getItem('dispatchStore'));}catch(e){this.data=null;}
    if(!this.data||this.data.v!==STORE_VERSION){this.data=buildSeed();localStorage.setItem('dispatchStore',JSON.stringify(this.data));}
    return this.data;
  },
  save(){if(USE_SUPABASE){clearTimeout(_saveTimer);_saveTimer=setTimeout(()=>this.pushNow(),700);}else localStorage.setItem('dispatchStore',JSON.stringify(this.data));},
  async pushNow(){if(USE_SUPABASE&&sb)await sb.from('dispatch_state').update({data:this.data,updated_at:new Date().toISOString()}).eq('id',1);},
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
};

function injectSB(){return new Promise(res=>{if(window.supabase)return res();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=res;document.head.appendChild(s);});}
async function boot(renderFn){
  if(USE_SUPABASE){
    await injectSB();
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const {data:{session}}=await sb.auth.getSession();
    if(!session)await showLogin();
  }
  try{await DB.load();}catch(e){document.body.innerHTML='<div style="font-family:Segoe UI,sans-serif;padding:40px;color:#A32D2D;max-width:520px">Could not load data: '+(e.message||e)+'<br><br>If this says the table is missing, run the <b>dispatch_state</b> SQL from SETUP_ONLINE.md in the Supabase SQL editor.</div>';return;}
  renderFn();
  if(USE_SUPABASE&&sb){try{const {data}=await sb.auth.getUser();const w=document.getElementById('whoami');if(w&&data&&data.user)w.textContent=data.user.email+' · ';}catch(e){}}
}
function showLogin(){return new Promise(resolve=>{
  const ov=document.createElement('div');ov.id='loginov';
  ov.style.cssText='position:fixed;inset:0;background:#f3f2ee;z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,system-ui,sans-serif';
  ov.innerHTML='<div style="background:#fff;border:1px solid #e3e1da;border-radius:14px;padding:26px 28px;width:330px;box-shadow:0 10px 40px rgba(0,0,0,.08)">'
    +'<div style="font-size:20px;font-weight:700;color:#2B2B2B">RENMAD <span style="color:#FF4A00">Dispatch Center</span></div>'
    +'<div style="font-size:12px;color:#7c7c78;margin:2px 0 18px;font-style:italic">where the magic gets orchestrated</div>'
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
function navBar(active){
  return '<div class="nav"><a href="gantt.html" class="'+(active==='overview'?'on':'')+'">Overview</a>'+
         '<a href="people.html" class="'+(active==='people'?'on':'')+'">Personnel</a>'+
         '<span class="brandlet"><span id="whoami" style="color:#7c7c78"></span>RENMAD <b>Dispatch Center</b>'+
         (USE_SUPABASE?' &nbsp;·&nbsp; <a href="#" onclick="changePasswordUI();return false" style="color:#7c7c78;text-decoration:none">change password</a> &nbsp;·&nbsp; <a href="#" onclick="DB.logout();return false" style="color:#7c7c78;text-decoration:none">log out</a>':'')+'</span></div>';
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
function exportXLSX(filename,sheets){loadXLSX(()=>{const wb=XLSX.utils.book_new();sheets.forEach(s=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s.rows),s.name.slice(0,31)));XLSX.writeFile(wb,filename);});}
