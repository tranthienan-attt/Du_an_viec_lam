(()=>{
'use strict';
/* =====================================================================
   UEH Professional · Lodestar AI Career Platform (bản demo chạy trong trình duyệt)
   Toàn bộ dữ liệu lưu trong localStorage của trình duyệt, không gọi máy chủ.
   ===================================================================== */

/* ---------- Tiện ích ---------- */
const $=id=>document.getElementById(id);
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const pad=n=>String(n).padStart(2,'0');
const HOUR=3600e3,DAY=24*HOUR;
const fmtDate=ts=>{const d=new Date(ts);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`};
const ago=ts=>{const d=Date.now()-ts;if(d<60e3)return 'Vừa xong';if(d<HOUR)return Math.floor(d/60e3)+' phút trước';if(d<DAY)return Math.floor(d/HOUR)+' giờ trước';if(d<30*DAY)return Math.floor(d/DAY)+' ngày trước';return fmtDate(ts)};
const initials=n=>{const p=String(n||'').trim().split(/\s+/).filter(Boolean);if(!p.length)return '?';return (p.length>1?p[0][0]+p[p.length-1][0]:p[0].slice(0,2)).toUpperCase()};
const firstName=n=>String(n||'').trim().split(/\s+/).pop()||'bạn';
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const fmtSize=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';
const addMonths=(ts,n)=>{const d=new Date(ts);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return d.getTime()};
const vnd=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' VND';
const dayKey=(ts=Date.now())=>{const d=new Date(ts);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const monthKey=(ts=Date.now())=>dayKey(ts).slice(0,7);
const fmtHM=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}g ${pad(m)}p`:`${m} phút`};

/* ---------- Lưu trữ (localStorage, có dự phòng bộ nhớ tạm) ---------- */
const NS='uehp2:';
const mem={};
let persistent=true;
try{localStorage.setItem(NS+'t','1');localStorage.removeItem(NS+'t')}catch(e){persistent=false}
const store={
  get(k,d){try{const v=persistent?localStorage.getItem(NS+k):mem[k];return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){const s=JSON.stringify(v);try{if(persistent)localStorage.setItem(NS+k,s);else mem[k]=s;return true}catch(e){mem[k]=s;return false}},
  clearAll(){try{if(persistent)Object.keys(localStorage).filter(k=>k.startsWith(NS)).forEach(k=>localStorage.removeItem(k))}catch(e){}Object.keys(mem).forEach(k=>delete mem[k]);try{sessionStorage.removeItem(NS+'sid')}catch(e){}}
};
let memSid=null;
const readSession=()=>{try{return sessionStorage.getItem(NS+'sid')||(persistent?localStorage.getItem(NS+'sid'):null)||memSid}catch(e){return memSid}};
const writeSession=(id,remember)=>{memSid=id||null;try{sessionStorage.removeItem(NS+'sid');if(persistent)localStorage.removeItem(NS+'sid');if(id){if(remember&&persistent)localStorage.setItem(NS+'sid',id);else sessionStorage.setItem(NS+'sid',id)}}catch(e){}};

/* ---------- Mật khẩu (demo: băm SHA-256 + muối, không thay thế bảo mật máy chủ) ---------- */
async function hashPw(pw,salt){
  const data=new TextEncoder().encode(salt+'|'+pw);
  try{if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){}
  let h=2166136261;for(const b of data){h^=b;h=Math.imul(h,16777619)>>>0}return 'f'+h.toString(16);
}

/* ---------- Trạng thái ---------- */
const S={users:[],jobs:[],apps:[],posts:[],notifs:{}};
const persist=(...ks)=>{
  let ok=true;ks.forEach(k=>{if(store.set(k,S[k])===false)ok=false});
  if(!ok&&!persist.warned){persist.warned=true;setTimeout(()=>{persist.warned=false},15000);toast('Bộ nhớ trình duyệt đã đầy nên thay đổi gần nhất có thể không được lưu. Hãy xóa bớt bài đăng có ảnh hoặc CV cũ.','bad')}
  return ok;
};
let meId=null;
const me=()=>S.users.find(u=>u.id===meId)||null;
const isStudent=()=>me()?.role==='student';
const isEmployer=()=>me()?.role==='employer';
let view='home';

/* ---------- Toast ---------- */
function toast(msg,type='ok'){
  const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;
  const box=$('toasts');while(box.children.length>=3)box.firstElementChild.remove();
  box.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300)},type==='bad'?5000:3400);
}

/* ---------- Modal (có ngăn xếp, Esc, click nền, bẫy phím Tab) ---------- */
const stack=[];
const lockScroll=()=>{document.body.style.overflow=stack.length?'hidden':''};
function openEl(el){
  el.classList.remove('hide');el._prev=document.activeElement;stack.push(el);lockScroll();
  setTimeout(()=>{const f=el.querySelector('[autofocus]')||qsa('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select',el).find(x=>x.offsetParent!==null)||el.querySelector('.close');f&&f.focus()},30);
}
function closeEl(el){
  const i=stack.indexOf(el);if(i>-1)stack.splice(i,1);
  if(el.dataset.static)el.classList.add('hide');else el.remove();
  lockScroll();
  const cb=el._onClose;el._onClose=null;cb&&cb();
  try{if(el._prev&&el._prev.isConnected&&!el._prev.disabled)el._prev.focus()}catch(e){}
}
function modal(html,{wide=false,small=false}={}){
  const bg=document.createElement('div');bg.className='modalBG';
  bg.innerHTML=`<div class="modal${wide?' wide':''}${small?' small':''}" role="dialog" aria-modal="true"><button type="button" class="close" data-close aria-label="Đóng">×</button>${html}</div>`;
  document.body.appendChild(bg);openEl(bg);return bg;
}
document.addEventListener('mousedown',e=>{const top=stack[stack.length-1];if(top&&e.target===top)closeEl(top)});
document.addEventListener('keydown',e=>{
  const top=stack[stack.length-1];if(!top)return;
  if(e.key==='Escape'){e.preventDefault();closeEl(top);return}
  if(e.key==='Tab'){
    const f=qsa('a[href],button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled)',top).filter(x=>x.offsetParent!==null);
    if(!f.length)return;const a=f[0],b=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus()}
    else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus()}
  }
});
document.addEventListener('click',e=>{const c=e.target.closest('[data-close]');if(c){const m=c.closest('.modalBG');m&&closeEl(m)}});

function confirmBox(msg,ok='Xác nhận',danger=false){
  return new Promise(res=>{
    const m=modal(`<h2>${esc(msg)}</h2><div class="modal-actions"><button type="button" class="btn outline" data-close>Hủy</button><button type="button" class="btn ${danger?'danger':'primary'}" data-ok>${esc(ok)}</button></div>`,{small:true});
    let done=false;
    m.addEventListener('click',e=>{if(e.target.closest('[data-ok]')){done=true;closeEl(m);res(true)}});
    m._onClose=()=>{if(!done)res(false)};
  });
}

/* ---------- Form động trong modal ---------- */
function fieldHtml(f,val){
  const id='f_'+f.name+'_'+Math.random().toString(36).slice(2,6);
  const v=val??f.value??'';
  const req=f.req?' <i class="req" aria-hidden="true">*</i>':'';
  if(f.type==='checks'){
    const sel=new Set(Array.isArray(val)?val:(f.value||[]));
    return `<fieldset class="field"><legend>${esc(f.label)}${req}</legend><div class="checks">${f.options.map(o=>`<label class="check"><input type="checkbox" name="${f.name}" value="${esc(o.v)}" ${sel.has(o.v)?'checked':''}> ${esc(o.l)}</label>`).join('')}</div>${f.hint?`<small class="muted">${esc(f.hint)}</small>`:''}<small class="err"></small></fieldset>`;
  }
  let ctl;
  if(f.type==='textarea')ctl=`<textarea id="${id}" name="${f.name}" rows="${f.rows||4}" maxlength="${f.maxlength||1500}" placeholder="${esc(f.ph||'')}">${esc(v)}</textarea>`;
  else if(f.type==='select')ctl=`<select id="${id}" name="${f.name}">${f.options.map(o=>{const ov=typeof o==='string'?o:o.v,ol=typeof o==='string'?o:o.l;return `<option value="${esc(ov)}" ${String(ov)===String(v)?'selected':''}>${esc(ol)}</option>`}).join('')}</select>`;
  else if(f.type==='file')ctl=`<input id="${id}" name="${f.name}" type="file" accept="${f.accept||''}">`;
  else ctl=`<input id="${id}" name="${f.name}" type="${f.type||'text'}" value="${esc(v)}" placeholder="${esc(f.ph||'')}" autocomplete="off" ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''} ${f.step?`step="${f.step}"`:''} ${f.maxlength?`maxlength="${f.maxlength}"`:''} ${f.list?`list="${f.list}"`:''}>`;
  return `<div class="field"><label for="${id}">${esc(f.label)}${req}</label>${ctl}${f.hint?`<small class="muted">${esc(f.hint)}</small>`:''}<small class="err"></small></div>`;
}
function setFieldErr(box,msg){
  const fld=box.closest?.('.field')||box;const er=qs('.err',fld);
  fld.classList.toggle('invalid',!!msg);if(er)er.textContent=msg||'';
  const inp=qs('input,select,textarea',fld);if(inp){if(msg)inp.setAttribute('aria-invalid','true');else inp.removeAttribute('aria-invalid')}
}
function openForm({title,sub='',fields,values={},submit='Lưu',wide=false,onSubmit}){
  const m=modal(`<h2>${esc(title)}</h2>${sub?`<p class="muted">${sub}</p>`:''}<form novalidate>${fields.map(f=>fieldHtml(f,values[f.name])).join('')}<p class="error hide" role="alert"></p><div class="modal-actions"><button type="button" class="btn outline" data-close>Hủy</button><button class="btn primary">${esc(submit)}</button></div></form>`,{wide});
  const form=qs('form',m);
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const d={};let ok=true;
    fields.forEach(f=>{
      const el=form.elements[f.name];let v;
      if(f.type==='checks')v=qsa(`input[name="${f.name}"]:checked`,form).map(x=>x.value);
      else if(f.type==='file'){const fl=el.files&&el.files[0];v=fl?{name:fl.name,size:fl.size}:null}
      else v=(el.value||'').trim();
      d[f.name]=v;
      const box=f.type==='checks'?qs(`input[name="${f.name}"]`,form):el;let msg='';
      if(f.req&&(f.type==='checks'?!v.length:!v))msg='Vui lòng điền mục này';
      else if(f.validate&&(v||f.type==='checks'))msg=f.validate(v,d)||'';
      if(msg)ok=false;setFieldErr(box,msg);
    });
    if(!ok){const bad=qs('.field.invalid input,.field.invalid select,.field.invalid textarea',form);bad&&bad.focus();return}
    const err=await onSubmit(d);
    if(err){const p=qs('p.error',form);p.textContent=err;p.classList.remove('hide')}else closeEl(m);
  });
  return m;
}

/* ---------- Danh mục kỹ năng (dùng cho hồ sơ, tin tuyển dụng, khóa học) ---------- */
const CAT=[
{id:'sql',label:'SQL',alt:['sql','mysql','postgresql']},
{id:'powerbi',label:'Power BI',alt:['power bi','powerbi','dax']},
{id:'excel',label:'Excel',alt:['excel']},
{id:'python',label:'Python',alt:['python','pandas']},
{id:'data',label:'Phân tích dữ liệu',alt:['phan tich du lieu','data analytics','data analysis','data analyst']},
{id:'viz',label:'Trực quan hóa dữ liệu',alt:['truc quan','dashboard','visualization','tableau','looker']},
{id:'bpmn',label:'BPMN',alt:['bpmn']},
{id:'brd',label:'Viết BRD',alt:['brd','business requirement','tai lieu yeu cau','yeu cau nghiep vu']},
{id:'ba',label:'Phân tích nghiệp vụ',alt:['phan tich nghiep vu','business analyst','business analysis']},
{id:'ga4',label:'GA4',alt:['ga4','google analytics']},
{id:'seo',label:'SEO',alt:['seo']},
{id:'content',label:'Content marketing',alt:['content','noi dung']},
{id:'ads',label:'Quảng cáo số',alt:['facebook ads','google ads','quang cao']},
{id:'mkt',label:'Digital marketing',alt:['digital marketing','marketing']},
{id:'html',label:'HTML/CSS',alt:['html','css']},
{id:'js',label:'JavaScript',alt:['javascript','js','typescript']},
{id:'react',label:'React',alt:['react']},
{id:'git',label:'Git',alt:['git','github']},
{id:'ecom',label:'Thương mại điện tử',alt:['thuong mai dien tu','e-commerce','ecommerce','shopee','lazada']},
{id:'ops',label:'Vận hành',alt:['van hanh','operations','logistics']},
{id:'report',label:'Báo cáo',alt:['bao cao','report']},
{id:'english',label:'Tiếng Anh giao tiếp',alt:['ielts','toeic','toefl','tieng anh','english']},
{id:'bizeng',label:'Tiếng Anh thương mại',alt:['tieng anh thuong mai','business english','english for business']},
{id:'present',label:'Thuyết trình',alt:['thuyet trinh','presentation']},
{id:'team',label:'Làm việc nhóm',alt:['lam viec nhom','teamwork']},
{id:'think',label:'Tư duy phản biện',alt:['tu duy phan bien','critical thinking']},
{id:'time',label:'Quản lý thời gian',alt:['quan ly thoi gian','time management']},
{id:'comm',label:'Giao tiếp',alt:['giao tiep','communication']},
{id:'problem',label:'Giải quyết vấn đề',alt:['giai quyet van de','problem solving']},
{id:'agile',label:'Agile/Scrum',alt:['agile','scrum']},
{id:'roadmap',label:'Product roadmap',alt:['roadmap','product management','product manager']},
{id:'ux',label:'UX Research',alt:['ux','user research','nghien cuu nguoi dung']},
{id:'figma',label:'Figma',alt:['figma']},
{id:'recruit',label:'Tuyển dụng',alt:['tuyen dung','recruitment','talent acquisition','nhan su']},
{id:'crm',label:'CRM',alt:['crm','cham soc khach hang','customer success']},
{id:'fin',label:'Tài chính doanh nghiệp',alt:['tai chinh','finance','financial']}
];
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
CAT.forEach(s=>{s.res=s.alt.map(a=>new RegExp('(^|[^a-z0-9])'+reEsc(a)+'([^a-z0-9]|$)'))});
const CAT_BY_ID=Object.fromEntries(CAT.map(s=>[s.id,s]));
const labelOf=id=>CAT_BY_ID[id]?CAT_BY_ID[id].label:id;

/* ---------- Vị trí mục tiêu và kỹ năng cốt lõi ---------- */
const ROLES={
 'Business Analyst':{tpl:'ba',skills:['sql','bpmn','brd','powerbi','excel','ba','bizeng','present']},
 'Data Analyst':{tpl:'da',skills:['sql','python','powerbi','excel','viz','data','english']},
 'Digital Marketing':{tpl:'mkt',skills:['ga4','seo','content','ads','excel','mkt','present']},
 'Frontend Developer':{tpl:'fe',skills:['html','js','react','git','english','team']},
 'E-commerce Operations':{tpl:'eco',skills:['ecom','ops','excel','report','data','comm']},
 'Associate Product Manager':{tpl:'pm',skills:['agile','roadmap','data','present','ux','english']},
 'Nhân sự & Tuyển dụng':{tpl:'hr',skills:['recruit','comm','excel','english','team']},
 'Financial Analyst':{tpl:'fin',skills:['fin','excel','powerbi','report','english']}
};
const CITIES=['TP.HCM','Hà Nội','Đà Nẵng','Toàn quốc'];

/* ---------- Khóa học (giữ nguyên 17 khóa gốc, thêm nhãn kỹ năng sk) ---------- */
const COURSES=[
{id:1,title:'SQL for Data Analysis',icon:'🗄️',level:'Cơ bản',duration:'6 tuần',desc:'Nắm cú pháp SQL, truy vấn dữ liệu và xử lý bài toán phân tích kinh doanh.',route:'SELECT cơ bản → JOIN → Tổng hợp → Case study doanh thu',skills:['SQL','Data'],sk:['sql','data'],match:95},
{id:2,title:'Business Analysis Foundations',icon:'📊',level:'Cơ bản',duration:'8 tuần',desc:'Học cách thu thập yêu cầu, xác định vấn đề và mô hình hóa quy trình nghiệp vụ.',route:'Stakeholder → Requirement → BPMN → BRD → Case study',skills:['BPMN','BRD'],sk:['bpmn','brd','ba'],match:93},
{id:3,title:'Power BI Dashboard',icon:'📈',level:'Trung cấp',duration:'5 tuần',desc:'Biến dữ liệu thô thành dashboard trực quan phục vụ quyết định kinh doanh.',route:'Power Query → Data Model → DAX → Dashboard → Storytelling',skills:['Power BI','DAX'],sk:['powerbi','viz'],match:91},
{id:4,title:'Digital Marketing Analytics',icon:'📣',level:'Trung cấp',duration:'6 tuần',desc:'Đo lường chiến dịch, đọc phễu chuyển đổi và tối ưu hiệu quả marketing.',route:'Metrics → GA4 → Funnel → Attribution → Báo cáo',skills:['GA4','Marketing'],sk:['ga4','mkt','ads'],match:89},
{id:5,title:'Excel nâng cao cho kinh doanh',icon:'📑',level:'Trung cấp',duration:'4 tuần',desc:'Ứng dụng hàm nâng cao, PivotTable và mô hình dữ liệu trong công việc.',route:'Hàm nâng cao → Pivot → Power Query → Dashboard',skills:['Excel','Reporting'],sk:['excel','report'],match:87},
{id:6,title:'Kỹ năng thuyết trình chuyên nghiệp',icon:'🎤',level:'Cơ bản',duration:'3 tuần',desc:'Xây dựng thông điệp rõ ràng, thiết kế nội dung và trình bày thuyết phục.',route:'Cấu trúc → Slide → Giọng nói → Thực hành → Phản hồi',skills:['Thuyết trình','Giao tiếp'],sk:['present','comm'],match:85},
{id:7,title:'Frontend Web Development',icon:'💻',level:'Cơ bản',duration:'10 tuần',desc:'Xây dựng website responsive với HTML, CSS và JavaScript hiện đại.',route:'HTML → CSS → Responsive → JavaScript → Project',skills:['HTML','JavaScript'],sk:['html','js','git','react'],match:83},
{id:8,title:'Quản lý dự án Agile',icon:'🧩',level:'Trung cấp',duration:'5 tuần',desc:'Hiểu Scrum, lập kế hoạch sprint và phối hợp nhóm phát triển sản phẩm.',route:'Agile → Scrum → Backlog → Sprint → Retrospective',skills:['Agile','Scrum'],sk:['agile','team'],match:82},
{id:9,title:'Python cho phân tích dữ liệu',icon:'🐍',level:'Cơ bản',duration:'8 tuần',desc:'Sử dụng Python, Pandas và trực quan hóa dữ liệu cho bài toán thực tế.',route:'Python → Pandas → Cleaning → Visualization → Project',skills:['Python','Pandas'],sk:['python','data','viz'],match:90},
{id:10,title:'Data Storytelling',icon:'🧠',level:'Nâng cao',duration:'4 tuần',desc:'Chuyển insight dữ liệu thành câu chuyện rõ ràng và có sức thuyết phục.',route:'Insight → Narrative → Visual → Presentation → Review',skills:['Storytelling','Data'],sk:['viz','present','data'],match:81},
{id:11,title:'UX Research căn bản',icon:'🔎',level:'Cơ bản',duration:'5 tuần',desc:'Nghiên cứu người dùng, phỏng vấn và tổng hợp insight cho thiết kế sản phẩm.',route:'Planning → Interview → Synthesis → Persona → Report',skills:['UX','Research'],sk:['ux','figma'],match:79},
{id:12,title:'E-commerce Operations',icon:'🛒',level:'Trung cấp',duration:'6 tuần',desc:'Quản trị vận hành sàn, đơn hàng, tồn kho và chỉ số thương mại điện tử.',route:'Catalog → Order → Inventory → Promotion → KPI',skills:['E-commerce','Operations'],sk:['ecom','ops','report'],match:84},
{id:13,title:'Tiếng Anh phỏng vấn',icon:'🌐',level:'Trung cấp',duration:'4 tuần',desc:'Luyện giới thiệu bản thân, trả lời câu hỏi và giao tiếp trong phỏng vấn.',route:'Introduction → STAR → Technical → Mock interview',skills:['English','Interview'],sk:['english','bizeng','comm'],match:88},
{id:14,title:'Viết CV chuẩn ATS',icon:'📄',level:'Cơ bản',duration:'2 tuần',desc:'Tối ưu nội dung CV theo mô tả công việc và hệ thống sàng lọc ATS.',route:'Target job → Keywords → Achievement → Format → Review',skills:['CV','ATS'],sk:['recruit'],match:94},
{id:15,title:'Product Management Essentials',icon:'🚀',level:'Nâng cao',duration:'8 tuần',desc:'Khám phá người dùng, xây Roadmap và đo lường sản phẩm bằng dữ liệu.',route:'Discovery → MVP → Roadmap → Metrics → Product case',skills:['Product','Roadmap'],sk:['roadmap','agile','ux'],match:78},
{id:16,title:'Kỹ năng làm việc nhóm',icon:'🤝',level:'Cơ bản',duration:'3 tuần',desc:'Cải thiện phối hợp, phản hồi, giải quyết xung đột và trách nhiệm nhóm.',route:'Role → Communication → Feedback → Conflict → Practice',skills:['Teamwork','Feedback'],sk:['team','comm','problem'],match:86},
{id:17,title:'Machine Learning nhập môn',icon:'🤖',level:'Nâng cao',duration:'10 tuần',desc:'Hiểu quy trình xây dựng mô hình dự đoán và đánh giá kết quả cơ bản.',route:'Math → Preprocessing → Model → Evaluation → Project',skills:['ML','Python'],sk:['python','data'],match:76}
];
COURSES.forEach(c=>{c.weeks=parseInt(c.duration,10)||4});

/* ---------- Công ty và mẫu tin tuyển dụng (dữ liệu mẫu) ---------- */
const COMP={
 'DigiFlow':{industry:'Công nghệ & phần mềm',size:'50 - 200 nhân sự',email:'hr@digiflow.vn',about:'Đơn vị phát triển giải pháp chuyển đổi số và tự động hóa quy trình cho doanh nghiệp vừa và nhỏ.'},
 'Maven Commerce':{industry:'Thương mại điện tử',size:'200 - 1000 nhân sự',email:'talent@maven.vn',about:'Nền tảng bán hàng đa kênh, kết nối nhà bán với hàng triệu người mua trực tuyến.'},
 'Nova Retail':{industry:'Bán lẻ & FMCG',size:'200 - 1000 nhân sự',email:'recruitment@novaretail.vn',about:'Chuỗi bán lẻ hiện đại đang mở rộng các kênh online và ứng dụng dữ liệu vào vận hành.'},
 'CloudNova':{industry:'Công nghệ & phần mềm',size:'50 - 200 nhân sự',email:'jobs@cloudnova.vn',about:'Công ty cung cấp dịch vụ hạ tầng đám mây và phần mềm doanh nghiệp.'},
 'Orbit Logistics':{industry:'Logistics',size:'200 - 1000 nhân sự',email:'hr@orbitlogistics.vn',about:'Doanh nghiệp giao nhận và kho vận với mạng lưới trung chuyển trên toàn quốc.'},
 'FinBridge':{industry:'Tài chính & ngân hàng',size:'50 - 200 nhân sự',email:'careers@finbridge.example',about:'Công ty công nghệ tài chính phát triển sản phẩm thanh toán và cho vay trực tuyến.'},
 'GreenLeaf Foods':{industry:'Bán lẻ & FMCG',size:'Trên 1000 nhân sự',email:'hr@greenleaf.example',about:'Nhà sản xuất thực phẩm sạch với hệ thống phân phối tại các thành phố lớn.'},
 'PixelWorks Studio':{industry:'Truyền thông & thiết kế',size:'Dưới 50 nhân sự',email:'jobs@pixelworks.example',about:'Studio thiết kế sản phẩm số và nhận diện thương hiệu cho khách hàng khởi nghiệp.'},
 'Saigon EduTech':{industry:'Giáo dục',size:'Dưới 50 nhân sự',email:'hr@saigonedutech.example',about:'Đơn vị công nghệ giáo dục phát triển nền tảng học trực tuyến cho học sinh, sinh viên.'}
};
const TPL={
 ba:{skills:['sql','bpmn','brd','excel','ba','powerbi'],desc:'Thu thập yêu cầu, mô hình hóa quy trình và phối hợp cùng đội phát triển sản phẩm.',
  reqs:['Sinh viên năm cuối hoặc mới tốt nghiệp khối kinh tế, quản trị, hệ thống thông tin','Hiểu quy trình nghiệp vụ, biết vẽ BPMN là lợi thế','Sử dụng tốt Excel, biết SQL cơ bản','Viết tài liệu và thuyết trình rõ ràng'],
  benefits:['Được mentor kèm cặp trực tiếp','Tham gia dự án thực tế ngay từ tuần đầu','Thưởng theo hiệu quả công việc','Đào tạo nội bộ về phân tích nghiệp vụ']},
 mkt:{skills:['ga4','seo','content','ads','excel','mkt'],desc:'Lập kế hoạch nội dung, theo dõi chiến dịch và tối ưu hiệu quả chuyển đổi.',
  reqs:['Ưu tiên sinh viên ngành Marketing, Truyền thông, Kinh doanh','Biết đọc số liệu chiến dịch trên GA4 hoặc Facebook Ads','Viết nội dung tốt, có tư duy sáng tạo','Chủ động và chịu được áp lực deadline'],
  benefits:['Ngân sách thử nghiệm chiến dịch thực tế','Học cách đo lường hiệu quả marketing','Thưởng KPI hằng tháng','Môi trường trẻ, phản hồi nhanh']},
 da:{skills:['sql','python','powerbi','excel','viz','data'],desc:'Làm sạch dữ liệu, xây dashboard và trình bày insight hỗ trợ kinh doanh.',
  reqs:['Sinh viên khối kinh tế, thống kê, CNTT hoặc tương đương','Biết SQL hoặc Python ở mức cơ bản','Dùng Excel hoặc Power BI để làm báo cáo','Tư duy logic, biết kể chuyện bằng dữ liệu'],
  benefits:['Làm việc với dữ liệu kinh doanh thật','Được hướng dẫn xây dashboard chuẩn doanh nghiệp','Lộ trình lên nhân viên chính thức rõ ràng','Hỗ trợ chi phí học chứng chỉ phân tích dữ liệu']},
 fe:{skills:['html','js','react','git','english'],desc:'Phát triển giao diện web responsive và phối hợp kiểm thử tính năng.',
  reqs:['Nắm chắc HTML, CSS, JavaScript','Đã làm ít nhất một dự án web cá nhân hoặc nhóm','Biết dùng Git, ưu tiên có kinh nghiệm với React','Đọc hiểu tài liệu tiếng Anh kỹ thuật'],
  benefits:['Code review thường xuyên từ kỹ sư senior','Làm việc linh hoạt, có thể từ xa','Thiết bị làm việc do công ty cấp','Ngân sách học tập hằng năm']},
 eco:{skills:['ecom','ops','excel','report','data'],desc:'Theo dõi đơn hàng, tối ưu vận hành sàn và lập báo cáo tuần.',
  reqs:['Sinh viên khối kinh tế, thương mại, logistics','Hiểu cơ bản về quy trình đơn hàng, tồn kho','Thành thạo Excel, pivot table','Cẩn thận, có trách nhiệm với số liệu'],
  benefits:['Tiếp xúc trực tiếp với vận hành sàn thương mại điện tử','Thưởng theo doanh số và hiệu suất','Lịch làm việc linh hoạt cho sinh viên','Cơ hội thăng tiến lên quản lý ngành hàng']},
 fin:{skills:['fin','excel','powerbi','report','english'],desc:'Hỗ trợ lập báo cáo tài chính, phân tích chi phí và theo dõi ngân sách của đơn vị.',
  reqs:['Sinh viên ngành Tài chính, Kế toán, Kinh tế','Thành thạo Excel, hiểu các chỉ số tài chính cơ bản','Ưu tiên biết Power BI','Đọc hiểu báo cáo tiếng Anh'],
  benefits:['Học mô hình tài chính từ chuyên viên phân tích','Tham gia họp ngân sách hằng quý','Phụ cấp ăn trưa và đi lại','Cơ hội nhận offer chính thức sau thực tập']},
 pm:{skills:['agile','roadmap','data','present','ux'],desc:'Phối hợp thu thập nhu cầu người dùng, theo dõi backlog và đo lường hiệu quả sản phẩm.',
  reqs:['Hiểu quy trình phát triển sản phẩm và Agile/Scrum','Biết đọc số liệu sản phẩm cơ bản','Giao tiếp tốt với đội thiết kế và kỹ thuật','Thuyết trình và viết tài liệu rõ ràng'],
  benefits:['Tham gia họp sprint và roadmap cùng sản phẩm','Được mentor bởi Product Manager','Thưởng dự án','Môi trường làm việc mở, khuyến khích đề xuất ý tưởng']},
 cs:{skills:['comm','crm','english','problem','report'],desc:'Tiếp nhận yêu cầu khách hàng, hướng dẫn sử dụng sản phẩm và phối hợp xử lý sự cố.',
  reqs:['Giao tiếp tốt, kiên nhẫn và thái độ tích cực','Biết dùng công cụ CRM hoặc sẵn sàng học nhanh','Tiếng Anh đọc hiểu tốt','Có tư duy giải quyết vấn đề'],
  benefits:['Đào tạo sản phẩm bài bản','Thưởng theo mức độ hài lòng khách hàng','Làm việc theo ca linh hoạt','Lộ trình lên Customer Success Manager']},
 ux:{skills:['ux','figma','present','data','comm'],desc:'Thực hiện phỏng vấn người dùng, tổng hợp insight và hỗ trợ đội thiết kế cải thiện sản phẩm.',
  reqs:['Quan tâm nghiên cứu hành vi người dùng','Biết lập kế hoạch và ghi chép phỏng vấn','Có thể dùng Figma ở mức cơ bản','Trình bày insight rõ ràng bằng slide'],
  benefits:['Tham gia dự án thiết kế thật cho khách hàng','Được review portfolio từ designer senior','Làm việc hybrid','Cơ hội tham gia workshop nội bộ']},
 hr:{skills:['recruit','comm','excel','english','team'],desc:'Đăng tin tuyển dụng, sàng lọc hồ sơ, sắp xếp lịch phỏng vấn và hỗ trợ hoạt động nội bộ.',
  reqs:['Sinh viên ngành Quản trị nhân lực, Kinh tế, Tâm lý hoặc tương đương','Giao tiếp tốt qua điện thoại và email','Biết dùng Excel để quản lý danh sách ứng viên','Cẩn thận và giữ bí mật thông tin'],
  benefits:['Học toàn bộ quy trình tuyển dụng','Được tham gia phỏng vấn cùng HR','Phụ cấp thực tập hằng tháng','Cơ hội gia nhập đội nhân sự chính thức']}
};
/* id, công ty, mẫu, chức danh, thành phố, loại hình, hình thức, lương, số giờ trước */
const JOB_ROWS=[
[1,'DigiFlow','ba','Business Analyst','TP.HCM','Full time','Hybrid','12 - 18 triệu',1],
[2,'Maven Commerce','mkt','Digital Marketing Executive','TP.HCM','Part time','Remote','6 - 9 triệu',2],
[3,'Nova Retail','da','Data Analyst Intern','TP.HCM','Intern','On site','4 - 6 triệu',3],
[4,'CloudNova','fe','Frontend Developer','Hà Nội','Full time','Remote','15 - 25 triệu',4],
[5,'Orbit Logistics','eco','E-commerce Operations','Đà Nẵng','Part time','Hybrid','7 - 10 triệu',8],
[6,'FinBridge','fin','Financial Analyst Intern','TP.HCM','Intern','Hybrid','5 - 7 triệu',12],
[7,'GreenLeaf Foods','mkt','Brand Marketing Intern','Hà Nội','Intern','On site','3 - 5 triệu',16],
[8,'PixelWorks Studio','ux','UX Research Intern','TP.HCM','Intern','Hybrid','4 - 6 triệu',20],
[9,'Saigon EduTech','hr','Talent Acquisition Intern','TP.HCM','Intern','On site','3 - 5 triệu',24],
[10,'DigiFlow','da','Data Analyst','TP.HCM','Full time','Hybrid','13 - 20 triệu',28],
[11,'CloudNova','ba','Business Analyst Intern','Toàn quốc','Intern','Remote','5 - 7 triệu',32],
[12,'Maven Commerce','eco','E-commerce Operations Executive','TP.HCM','Full time','On site','9 - 13 triệu',36],
[13,'Nova Retail','cs','Customer Success Associate','Hà Nội','Full time','Hybrid','9 - 14 triệu',40],
[14,'Orbit Logistics','da','Logistics Data Analyst Intern','TP.HCM','Intern','On site','4 - 6 triệu',44],
[15,'FinBridge','pm','Associate Product Manager','TP.HCM','Full time','Hybrid','15 - 22 triệu',48],
[16,'GreenLeaf Foods','eco','Sales Operations Intern','Đà Nẵng','Intern','On site','3 - 5 triệu',52],
[17,'PixelWorks Studio','fe','Frontend Developer Intern','TP.HCM','Intern','Remote','5 - 8 triệu',56],
[18,'Saigon EduTech','mkt','Content Marketing Part-time','Toàn quốc','Part time','Remote','5 - 8 triệu',60],
[19,'DigiFlow','pm','Product Operations Intern','TP.HCM','Intern','Hybrid','4 - 6 triệu',64],
[20,'CloudNova','cs','Technical Support Associate','Hà Nội','Full time','On site','8 - 12 triệu',68],
[21,'Nova Retail','mkt','Social Media Executive','TP.HCM','Full time','On site','8 - 12 triệu',72],
[22,'Maven Commerce','da','Business Intelligence Analyst','TP.HCM','Full time','Hybrid','14 - 22 triệu',80],
[23,'Orbit Logistics','hr','HR Generalist Intern','Đà Nẵng','Intern','Hybrid','3 - 5 triệu',90],
[24,'FinBridge','ba','Business Analyst (Fintech)','Hà Nội','Full time','Hybrid','14 - 20 triệu',100]
];
const UEH_JOB_IDS=new Set([3,6,11,15,19,22]);
function seedJobs(){
  const now=Date.now();
  return JOB_ROWS.map(([id,co,t,title,city,type,work,salary,h])=>{
    const T=TPL[t],C=COMP[co],at=now-h*HOUR;
    return{id:String(id),company:co,title,city,type,workplace:work,salary,skills:[...T.skills],desc:T.desc,reqs:[...T.reqs],
      benefits:[...T.benefits,...(type==='Intern'?['Chứng nhận thực tập, ưu tiên nhận việc chính thức']:[])],
      postedAt:at,deadline:null,email:C.email,ownerId:co==='DigiFlow'?'e_demo':null,industry:C.industry,size:C.size,about:C.about,status:'open',tpl:t,uehOnly:UEH_JOB_IDS.has(id)};
  });
}

/* ---------- Ứng viên mẫu (hiển thị cho tài khoản nhà tuyển dụng demo) ---------- */
const CANDS={
 c1:{name:'Minh Khoa',school:'Đại học Kinh tế TP.HCM (UEH)',major:'Thống kê kinh tế',email:'khoa.demo@example.com',profile:{gpa:3.62,hardSkills:['SQL','Python','Power BI','Excel'],softSkills:['Tư duy phản biện','Giao tiếp'],certs:[{name:'Google Data Analytics'},{name:'IELTS 7.0'}],projects:[{name:'Dashboard bán lẻ bằng Power BI'}],internships:[{role:'Data Analyst Intern',company:'Nova Retail'}],targetRole:'Data Analyst'}},
 c2:{name:'Ngọc Mai',school:'Đại học Kinh tế TP.HCM (UEH)',major:'Marketing',email:'mai.demo@example.com',profile:{gpa:3.4,hardSkills:['GA4','SEO','Content marketing','Excel'],softSkills:['Thuyết trình','Làm việc nhóm'],certs:[{name:'Google Analytics 4'},{name:'TOEIC 780'}],projects:[{name:'Chiến dịch truyền thông cho câu lạc bộ sinh viên'}],internships:[{role:'Marketing Intern',company:'Nova Retail'}],targetRole:'Digital Marketing'}},
 c3:{name:'Hoàng Long',school:'Đại học Công nghệ Thông tin',major:'Kỹ thuật phần mềm',email:'long.demo@example.com',profile:{gpa:3.2,hardSkills:['HTML','CSS','JavaScript','React','Git'],softSkills:['Làm việc nhóm'],certs:[{name:'IELTS 6.0'}],projects:[{name:'Website đặt lịch học nhóm'}],internships:[],targetRole:'Frontend Developer'}},
 c4:{name:'Thu Hà',school:'Đại học Kinh tế TP.HCM (UEH)',major:'Hệ thống thông tin quản lý',email:'ha.demo@example.com',profile:{gpa:3.55,hardSkills:['BPMN','Viết BRD','SQL','Excel'],softSkills:['Thuyết trình','Tư duy phản biện'],certs:[{name:'IELTS 6.5'}],projects:[{name:'Phân tích nghiệp vụ quy trình đặt hàng bằng BPMN'}],internships:[{role:'Business Analyst Intern',company:'CloudNova'}],targetRole:'Business Analyst'}},
 c5:{name:'Đức Anh',school:'Đại học Kinh tế TP.HCM (UEH)',major:'Quản trị kinh doanh',email:'anh.demo@example.com',profile:{gpa:3.3,hardSkills:['Agile','Excel'],softSkills:['Giao tiếp','Quản lý thời gian'],certs:[{name:'Scrum Fundamentals'}],projects:[{name:'Nghiên cứu người dùng cho ứng dụng học tập'}],internships:[],targetRole:'Associate Product Manager'}}
};
const PEOPLE=[{id:'p1',name:'Minh Khoa',title:'Data Analyst'},{id:'p2',name:'Ngọc Mai',title:'Marketing'},{id:'p3',name:'HR DigiFlow',title:'Nhà tuyển dụng'}];

/* ---------- Hồ sơ sinh viên ---------- */
const blankProfile=()=>({school:'Đại học Kinh tế TP.HCM (UEH)',major:'',gradYear:'',targetRole:'Business Analyst',bio:'',gpa:null,transcripts:[],certs:[],hardSkills:[],softSkills:[],projects:[],internships:[]});
const gpaRank=g=>g>=3.6?'Xuất sắc':g>=3.2?'Giỏi':g>=2.5?'Khá':'Trung bình';
function completeness(p){
  const items=[
   {w:5,ok:!!p.school,label:'Trường',act:'p-edit-basic'},
   {w:5,ok:!!p.major,label:'Ngành học',act:'p-edit-basic'},
   {w:5,ok:!!p.gradYear,label:'Năm tốt nghiệp',act:'p-edit-basic'},
   {w:10,ok:!!p.targetRole,label:'Vị trí mục tiêu',act:'p-edit-basic'},
   {w:10,ok:(p.bio||'').trim().length>=30,label:'Giới thiệu bản thân',act:'p-edit-basic'},
   {w:10,ok:p.gpa!=null&&p.gpa!=='',label:'GPA',act:'p-edit-gpa'},
   {w:10,ok:(p.transcripts||[]).length>0,label:'Tải bảng điểm',act:'p-upload-transcript'},
   {w:10,ok:(p.certs||[]).length>0,label:'Thêm chứng chỉ',act:'p-add-cert'},
   {w:7,ok:(p.hardSkills||[]).length>=3,label:'Kỹ năng chuyên môn (từ 3)',act:'p-add-hard'},
   {w:8,ok:(p.softSkills||[]).length>=3,label:'Kỹ năng mềm (từ 3)',act:'p-add-soft'},
   {w:10,ok:(p.projects||[]).length>0,label:'Thêm dự án',act:'p-add-project'},
   {w:10,ok:(p.internships||[]).length>0,label:'Thêm thực tập',act:'p-add-intern'}
  ];
  const pct=items.filter(i=>i.ok).reduce((a,i)=>a+i.w,0);
  return{pct,missing:items.filter(i=>!i.ok)};
}

/* ---------- Lodestar AI: phân tích hồ sơ (quy tắc chạy tại trình duyệt) ---------- */
function skillSet(p){
  const H=norm([...(p.hardSkills||[]),...(p.softSkills||[]),...(p.certs||[]).map(c=>c.name+' '+(c.issuer||'')),...(p.projects||[]).map(x=>x.name+' '+(x.desc||'')),...(p.internships||[]).map(x=>(x.role||'')+' '+(x.company||'')),p.major||'',p.bio||''].join(' | '));
  return new Set(CAT.filter(s=>s.res.some(r=>r.test(H))).map(s=>s.id));
}
function jobMatch(job,have,p){
  const ids=job.skills||[],got=ids.filter(i=>have.has(i)),miss=ids.filter(i=>!have.has(i));
  let score=40+52*(ids.length?got.length/ids.length:.5);
  const g=Number(p.gpa)||0;if(g>=3.2)score+=3;if(g>=3.6)score+=2;
  const role=ROLES[p.targetRole];if(role&&job.tpl&&role.tpl===job.tpl)score+=4;
  if((p.internships||[]).length)score+=2;
  return{score:Math.round(clamp(score,35,98)),got,miss};
}
function buildRoadmap(recs,roleName){
  const n=Math.min(3,recs.length),lens=[[],[7],[4,3],[3,2,2]][n],steps=[];let w=1;
  for(let i=0;i<n;i++){const c=recs[i].course;steps.push({key:'c'+c.id,from:w,to:w+lens[i]-1,title:'Học '+c.title,detail:c.route,courseId:c.id});w+=lens[i]}
  if(!n)steps.push({key:'base',from:1,to:7,title:'Củng cố kỹ năng nền tảng',detail:'Ôn lại Excel, tư duy phân tích và cập nhật kiến thức ngành'});
  steps.push({key:'case',from:8,to:10,title:'Hoàn thành 1 case study cho vị trí '+roleName,detail:'Áp dụng kỹ năng vừa học vào dự án thực tế rồi đưa vào hồ sơ và CV'});
  steps.push({key:'cv',from:11,to:12,title:'Hoàn thiện CV chuẩn ATS và luyện phỏng vấn',detail:'Dùng mục Phỏng vấn mô phỏng và ứng tuyển các tin có mức phù hợp cao'});
  return steps;
}
function analyze(u){
  const p=u.profile,roleName=ROLES[p.targetRole]?p.targetRole:'Business Analyst',role=ROLES[roleName],have=skillSet(p);
  const strengths=role.skills.filter(i=>have.has(i)),gaps=role.skills.filter(i=>!have.has(i));
  const recs=COURSES.map(c=>({course:c,fill:c.sk.filter(i=>gaps.includes(i))})).filter(x=>x.fill.length)
    .sort((a,b)=>b.fill.length-a.fill.length||b.course.match-a.course.match).slice(0,4)
    .map(x=>({course:x.course,fill:x.fill,pct:Math.min(98,x.course.match+3*x.fill.length)}));
  const coverage=Math.round(strengths.length/role.skills.length*100);
  const a={role:roleName,have,strengths,gaps,recs,coverage,roadmap:buildRoadmap(recs,roleName)};
  const S_=strengths.map(labelOf),G_=gaps.map(labelOf);
  const rec0=recs[0]?`, bắt đầu với khóa “${esc(recs[0].course.title)}”`:'';
  const core=G_.length
   ?`Với mục tiêu <b>${esc(roleName)}</b>, hồ sơ của bạn khớp ${coverage}% kỹ năng cốt lõi${S_.length?`, mạnh ở ${esc(S_.slice(0,3).join(', '))}`:''}. Nên ưu tiên bổ sung ${esc(G_.slice(0,3).join(', '))}${G_.length>3?` và ${G_.length-3} kỹ năng khác`:''}`
   :`Hồ sơ của bạn đã bao phủ các kỹ năng cốt lõi của vị trí <b>${esc(roleName)}</b>. Hãy tập trung làm một dự án nổi bật, luyện phỏng vấn và ứng tuyển các tin có mức phù hợp trên 85%`;
  a.summaryBase=core+'.';
  a.summary=core+(G_.length?rec0:'')+'.';
  return a;
}
const courseBoost=(c,a)=>{if(!a||!a.gaps.length)return c.match;const f=c.sk.filter(i=>a.gaps.includes(i)).length;return f?Math.min(99,c.match+3*f):Math.max(55,c.match-15)};

/* ---------- Dữ liệu mẫu lần chạy đầu tiên ---------- */
async function seedIfNeeded(){
  if(store.get('seeded'))return;
  const now=Date.now();
  const mk=async(o,pw)=>{const salt=uid();return{...o,salt,pw:await hashPw(pw,salt),createdAt:now}};
  S.users=[
    await mk({id:'u_demo',role:'student',name:'Trần Thiện An',email:'tranthienanpct@gmail.com',courses:[],saved:[],connections:[],interviews:[],roadmapDone:{},
      profile:{school:'Đại học Kinh tế TP.HCM (UEH)',major:'',gradYear:'2026',targetRole:'Business Analyst',bio:'',gpa:3.46,transcripts:[],
        certs:[{id:uid(),name:'Google Data Analytics'},{id:uid(),name:'MOS Excel Associate'},{id:uid(),name:'IELTS 6.5'}],
        hardSkills:['Excel','Phân tích dữ liệu','BPMN'],softSkills:['Thuyết trình','Làm việc nhóm','Tư duy phản biện','Quản lý thời gian'],
        projects:[{id:uid(),name:'Nghiên cứu hành vi mua sắm xanh của sinh viên'},{id:uid(),name:'Dashboard phân tích doanh thu thương mại điện tử'},{id:uid(),name:'Thiết kế quy trình tuyển dụng bằng BPMN'}],
        internships:[{id:uid(),role:'Marketing Intern',company:'Nova Retail',from:'2025-06',to:'2025-09'},{id:uid(),role:'Business Analyst Intern',company:'DigiFlow',from:'2026-01',to:'2026-04'}]}},'123456'),
    await mk({id:'e_demo',role:'employer',name:'DigiFlow',email:'hr@digiflow.vn',company:{industry:COMP.DigiFlow.industry,size:COMP.DigiFlow.size,about:COMP.DigiFlow.about}},'123456'),
    await mk({id:'u_ueh',role:'student',name:'Bảo Ngọc',email:'ngoc.bao@st.ueh.edu.vn',courses:[],saved:[],connections:[],interviews:[],roadmapDone:{},
      profile:{school:'Đại học Kinh tế TP.HCM (UEH)',major:'Hệ thống thông tin quản lý',gradYear:'2026',targetRole:'Data Analyst',bio:'Sinh viên UEH quan tâm phân tích dữ liệu và tự động hóa báo cáo.',gpa:3.3,transcripts:[],
        certs:[{id:uid(),name:'IELTS 6.0'}],hardSkills:['SQL','Excel'],softSkills:['Làm việc nhóm'],projects:[],internships:[]}},'123456')
  ];
  S.users.forEach(ensureUserDefaults);
  S.jobs=seedJobs();
  const A=(jobId,cand,h,status='submitted')=>({id:uid(),jobId:String(jobId),cand,at:now-h*HOUR,status,history:[{s:status,at:now-h*HOUR}]});
  S.apps=[A(1,'c4',5),A(1,'c1',9,'viewed'),A(1,'c2',20),A(10,'c1',12),A(10,'c4',30,'interview'),A(19,'c5',14),A(19,'c2',40)];
  S.posts=[
    {id:'s1',authorId:null,author:'Cộng đồng UEH Professional',role:'community',at:now-20*60e3,tag:'Chia sẻ',body:'Chia sẻ 5 câu hỏi phỏng vấn Business Analyst thường gặp. Mọi người có thể bình luận cách trả lời theo STAR nhé!',likesBase:42,likedBy:[],comments:[{id:uid(),author:'Thu Hà',at:now-12*60e3,body:'Mình hay gặp câu hỏi về cách xử lý yêu cầu thay đổi liên tục. Trả lời theo STAR khá hiệu quả.'}]},
    {id:'s2',authorId:'e_demo',author:'HR DigiFlow',role:'employer',at:now-HOUR,tag:'Tuyển dụng',body:'DigiFlow đang tuyển Business Analyst Intern. Ưu tiên sinh viên có dự án BPMN hoặc SQL cơ bản.',likesBase:31,likedBy:[],comments:[]},
    {id:'s3',authorId:null,author:'Minh Khoa',role:'student',at:now-3*HOUR,tag:'Hỏi đáp',body:'Mình vừa xong khóa SQL cơ bản. Mọi người có bộ bài tập JOIN nào hay để luyện thêm không?',likesBase:12,likedBy:[],comments:[]},
    {id:'s4',authorId:null,author:'Ngọc Mai',role:'student',at:now-5*HOUR,tag:'Chia sẻ',body:'Mẹo viết CV chuẩn ATS: dùng đúng từ khóa trong mô tả công việc, mỗi kinh nghiệm nêu một con số kết quả, xuất PDF một cột.',likesBase:27,likedBy:[],comments:[]}
  ];
  S.notifs={};
  persist('users','jobs','apps','posts','notifs');store.set('seeded',1);
}
function loadState(){['users','jobs','apps','posts'].forEach(k=>{S[k]=store.get(k,[])});S.notifs=store.get('notifs',{});S.users.forEach(ensureUserDefaults)}
function notify(userId,text){
  if(!userId)return;
  const l=S.notifs[userId]||(S.notifs[userId]=[]);
  l.unshift({id:uid(),text,at:Date.now(),read:false});if(l.length>30)l.length=30;persist('notifs');
}

/* ---------- Điều hướng ---------- */
const VIEWS={home:{t:'Trang chủ'},profile:{t:'Hồ sơ',auth:'student'},learning:{t:'Học tập'},cv:{t:'Tạo CV',auth:'student'},jobs:{t:'Việc làm'},interview:{t:'Phỏng vấn',auth:'student'},community:{t:'Cộng đồng'},employer:{t:'Tuyển dụng',auth:'employer'},pricing:{t:'Bảng giá'},rewards:{t:'Điểm thưởng',auth:'student'}};
const RENDER={};
let skipHash=false;
const hashView=()=>{const v=(location.hash||'').replace(/^#\/?/,'');return VIEWS[v]?v:'home'};
function setHash(v){const h='#/'+v;if(location.hash!==h){skipHash=true;location.hash=h}}
function go(v,{fromHash=false}={}){
  if(!VIEWS[v])v='home';
  const need=VIEWS[v].auth,u=me();
  if(need){
    if(!u){requireLogin(`dùng mục ${VIEWS[v].t}`,()=>go(v));if(fromHash)setHash(view);return}
    if(u.role!==need){toast(need==='employer'?'Mục này dành cho tài khoản nhà tuyển dụng.':'Mục này dành cho tài khoản sinh viên.','warn');v='home'}
  }
  show(v);
}
function show(v){
  if(view==='interview'&&v!=='interview')stopCamera();
  view=v;
  qsa('.view').forEach(x=>x.classList.toggle('active',x.id===v));
  setHash(v);renderNav();closeDropdown();
  if(RENDER[v])RENDER[v]();
  document.title=(v==='home'?'':VIEWS[v].t+' · ')+'UEH Professional';
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',()=>{if(skipHash){skipHash=false;return}go(hashView(),{fromHash:true})});
const refresh=()=>{renderNav();if(RENDER[view])RENDER[view]()};

/* ---------- Thanh điều hướng, tài khoản, thông báo ---------- */
const themeBtnHtml=()=>`<button type="button" class="icon-btn theme-btn" data-act="theme-menu" aria-label="Đổi màu nền" aria-haspopup="true" aria-expanded="false">🎨</button>`;
function renderNav(){
  const u=me(),role=u?u.role:'guest';
  qsa('#tabs button').forEach(b=>{b.classList.toggle('hide',!b.dataset.roles.split(' ').includes(role));b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  const box=$('hdrBtns');
  if(!u){box.innerHTML=`${themeBtnHtml()}<button type="button" class="btn ghost sm" data-act="emp-cta">Doanh nghiệp</button><button type="button" class="btn outline sm" data-act="login">Đăng nhập</button><button type="button" class="btn primary sm" data-act="register">Đăng ký</button>`;return}
  const unread=(S.notifs[u.id]||[]).filter(n=>!n.read).length;
  const points=u.role==='student'?`<button type="button" class="pts-badge" data-act="go-rewards" aria-label="Điểm thưởng: ${u.points||0} điểm">🎁 ${u.points||0}</button>`:'';
  const uehTag=isUEH(u)?'<small class="ueh-tag">🎓 UEH</small>':'';
  box.innerHTML=`${themeBtnHtml()}${points}<button type="button" class="bell" data-act="bell" aria-label="Thông báo${unread?`, ${unread} chưa đọc`:''}" aria-haspopup="true" aria-expanded="false">🔔${unread?`<span class="dot">${unread}</span>`:''}</button><button type="button" class="user-account" data-act="usermenu" aria-haspopup="true" aria-expanded="false" aria-label="Tài khoản ${esc(u.name)}"><span class="user-avatar" aria-hidden="true">${esc(initials(u.name))}</span><span class="user-info"><strong>${esc(u.name)}</strong><small>${u.role==='employer'?'Nhà tuyển dụng':uehTag||'Sinh viên'}</small></span></button>`;
  updateChatMeta();
}
function closeDropdown(){$('ddRoot').innerHTML='';qsa('#hdrBtns [aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false'))}
function openDropdown(kind,btn,html){
  const same=qs('#ddRoot .dropdown')?.dataset.k===kind;closeDropdown();if(same)return;
  $('ddRoot').innerHTML=`<div class="dropdown" data-k="${kind}" role="menu">${html}</div>`;btn.setAttribute('aria-expanded','true');
}
function userMenuHtml(u){
  const st=u.role==='student';
  return `<div class="dh"><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div><hr>`+
   (st?`<button class="mi" role="menuitem" data-go="profile">👤 Hồ sơ của tôi</button><button class="mi" role="menuitem" data-go="cv">📄 CV của tôi</button><button class="mi" role="menuitem" data-act="jobs-tab" data-tab="saved">♥ Việc đã lưu</button><button class="mi" role="menuitem" data-act="jobs-tab" data-tab="applied">📨 Đơn ứng tuyển</button><button class="mi" role="menuitem" data-act="courses-mine">📚 Khóa học của tôi</button><button class="mi" role="menuitem" data-act="go-rewards">🎁 Điểm thưởng (${u.points||0})</button><button class="mi" role="menuitem" data-act="my-plan">${isUEH(u)?'🎓 Quyền lợi UEH':'💳 Gói của tôi'}</button>`
      :`<button class="mi" role="menuitem" data-go="employer">🏢 Quản lý tuyển dụng</button><button class="mi" role="menuitem" data-act="post-job">➕ Đăng tin mới</button><button class="mi" role="menuitem" data-act="my-plan">💳 Gói của tôi</button>`)+
   `<button class="mi" role="menuitem" data-act="settings">⚙ Cài đặt tài khoản</button><hr><button class="mi" role="menuitem" data-act="logout">↩ Đăng xuất</button>`;
}
function notifHtml(u){
  const l=S.notifs[u.id]||[];
  return `<div class="dh"><b>Thông báo</b></div><div class="notif-list">${l.length?l.slice(0,10).map(n=>`<div class="notif-item ${n.read?'':'unread'}">${esc(n.text)}<small>${ago(n.at)}</small></div>`).join(''):'<div class="notif-item muted">Chưa có thông báo nào.</div>'}</div>`;
}

/* ---------- Xác thực ---------- */
const auth={pending:null,reset:null,fails:{n:0,until:0}};
function requireLogin(reason,cb){openAuth('login',{msg:`Đăng nhập để ${reason}.`,pending:cb})}
function needStudent(reason,cb){
  const u=me();
  if(!u){requireLogin(reason,cb);return false}
  if(u.role!=='student'){toast('Tính năng này dành cho tài khoản sinh viên.','warn');return false}
  return true;
}
function openAuth(mode='login',{msg='',role='student',pending=null}={}){
  auth.pending=pending;closeDropdown();
  setAuthMode(mode);
  const m=$('authMsg');m.textContent=msg;m.classList.toggle('hide',!msg);
  if(mode==='register'){qs(`#registerForm input[name=role][value=${role}]`).checked=true;syncRegRole()}
  if(!stack.includes($('auth')))openEl($('auth'));
}
function setAuthMode(mode){
  const map={login:'loginForm',register:'registerForm',forgot:'forgotForm',reset:'resetForm'};
  Object.entries(map).forEach(([k,id])=>$(id).classList.toggle('hide',k!==mode));
  $('authTabs').classList.toggle('hide',mode==='forgot'||mode==='reset');
  qsa('#authTabs button').forEach(b=>{const on=b.dataset.auth===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
  qsa('#auth .field').forEach(f=>setFieldErr(f,''));qsa('#auth [data-form-err]').forEach(p=>p.classList.add('hide'));$('registerForm').querySelector('[data-terms-err]').textContent='';
  if(!$('auth').classList.contains('hide')){const f=$(map[mode]).querySelector('input:not([type=checkbox]):not([type=radio])');f&&setTimeout(()=>f.focus(),20)}
}
function formErr(form,msg){const p=qs('[data-form-err]',form);p.textContent=msg;p.classList.toggle('hide',!msg)}
function syncRegRole(){
  const emp=qs('#registerForm input[name=role]:checked').value==='employer';
  $('empExtra').classList.toggle('hide',!emp);$('rgNameLbl').textContent=emp?'Tên công ty':'Họ và tên';
  $('rgName').autocomplete=emp?'organization':'name';
  $('rgEmailHint').classList.toggle('hide',emp);
}
const pwScore=p=>{let s=0;if(p.length>=6)s++;if(p.length>=10)s++;if(/[A-Z]/.test(p)&&/[a-z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return Math.min(4,s)};
function loginSuccess(u,remember){
  meId=u.id;writeSession(u.id,remember);ensureUserDefaults(u);
  closeEl($('auth'));
  const cb=auth.pending;auth.pending=null;
  toast(`Chào mừng ${u.role==='employer'?u.name:'trở lại, '+u.name}!`);
  award('login');renderNav();
  if(cb)cb();else refresh();
}
function initAuth(){
  qsa('#auth [data-auth]').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.auth)));
  qsa('#registerForm input[name=role]').forEach(r=>r.addEventListener('change',syncRegRole));
  $('auth').addEventListener('click',e=>{
    const eye=e.target.closest('[data-eye]');
    if(eye){const i=$(eye.dataset.eye),show=i.type==='password';i.type=show?'text':'password';eye.textContent=show?'Ẩn':'Hiện';eye.setAttribute('aria-pressed',show);eye.setAttribute('aria-label',show?'Ẩn mật khẩu':'Hiện mật khẩu')}
    const demo=e.target.closest('[data-demo]');
    if(demo){const f=$('loginForm'),map={student:'tranthienanpct@gmail.com',ueh:'ngoc.bao@st.ueh.edu.vn',employer:'hr@digiflow.vn'};f.elements.email.value=map[demo.dataset.demo];f.elements.password.value='123456';f.requestSubmit()}
  });
  $('rgPw').addEventListener('input',e=>{
    const v=e.target.value,s=v?pwScore(v):0,bar=$('pwBar');
    bar.style.width=(s/4*100)+'%';bar.style.background=['#e0b0ad','#d9534f','#e59a2f','#2f9c8f','#1f7a45'][s];
    $('pwHint').textContent=v?`Độ mạnh: ${['Rất yếu','Yếu','Trung bình','Khá','Mạnh'][s]}. Tối thiểu 6 ký tự.`:'Tối thiểu 6 ký tự. Dùng chữ hoa, số và ký tự đặc biệt để mạnh hơn.';
  });

  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target,el=f.elements;
    qsa('.field',f).forEach(x=>setFieldErr(x,''));formErr(f,'');
    const email=el.email.value.trim().toLowerCase(),pw=el.password.value;let ok=true;
    if(!validEmail(email)){setFieldErr(el.email,'Nhập email đúng định dạng, ví dụ ten@email.com');ok=false}
    if(!pw){setFieldErr(el.password,'Nhập mật khẩu');ok=false}
    if(!ok)return;
    if(Date.now()<auth.fails.until){formErr(f,`Bạn đã nhập sai nhiều lần. Thử lại sau ${Math.ceil((auth.fails.until-Date.now())/1000)} giây hoặc chọn Quên mật khẩu.`);return}
    const u=S.users.find(x=>x.email===email);
    if(!u||await hashPw(pw,u.salt)!==u.pw){
      if(++auth.fails.n>=5){auth.fails.until=Date.now()+30e3;auth.fails.n=0}
      formErr(f,'Email hoặc mật khẩu chưa đúng. Kiểm tra lại hoặc chọn Quên mật khẩu.');return;
    }
    auth.fails.n=0;loginSuccess(u,el.remember.checked);f.reset();
  });

  $('registerForm').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target,el=f.elements;
    qsa('.field',f).forEach(x=>setFieldErr(x,''));formErr(f,'');qs('[data-terms-err]',f).textContent='';
    const role=el.role.value,name=el.fullname.value.trim().replace(/\s+/g,' '),email=el.email.value.trim().toLowerCase(),pw=el.password.value,pw2=el.password2.value;let ok=true;
    if(name.length<2){setFieldErr(el.fullname,role==='employer'?'Nhập tên công ty':'Nhập họ và tên (ít nhất 2 ký tự)');ok=false}
    if(!validEmail(email)){setFieldErr(el.email,'Nhập email đúng định dạng, ví dụ ten@email.com');ok=false}
    else if(S.users.some(x=>x.email===email)){setFieldErr(el.email,'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');ok=false}
    if(pw.length<6){setFieldErr(el.password,'Mật khẩu cần tối thiểu 6 ký tự');ok=false}
    if(pw2!==pw){setFieldErr(el.password2,'Mật khẩu nhập lại chưa khớp');ok=false}
    if(!el.terms.checked){qs('[data-terms-err]',f).textContent='Bạn cần đồng ý với điều khoản để tiếp tục';ok=false}
    if(!ok){const bad=qs('.field.invalid input',f);bad&&bad.focus();return}
    const salt=uid(),base={id:(role==='employer'?'e_':'u_')+uid(),role,name,email,salt,pw:await hashPw(pw,salt),createdAt:Date.now()};
    const ueh=role==='student'&&isUEHEmail(email);
    const user=role==='employer'
      ?{...base,company:{industry:el.industry.value,size:el.size.value,about:''}}
      :{...base,profile:{...blankProfile(),bio:''},courses:[],saved:[],connections:[],interviews:[],roadmapDone:{}};
    ensureUserDefaults(user);
    S.users.push(user);persist('users');
    notify(user.id,role==='employer'?'Chào mừng đến UEH Professional! Bạn có 6 tháng đầu miễn phí, hãy đăng tin tuyển dụng đầu tiên của công ty.':ueh?'Chào mừng đến UEH Professional! Email UEH của bạn đã được mở toàn bộ chức năng, không giới hạn.':'Chào mừng đến UEH Professional! Hãy hoàn thiện hồ sơ để Lodestar AI phân tích và gợi ý việc làm.');
    auth.pending=null;
    meId=user.id;writeSession(user.id,true);closeEl($('auth'));f.reset();syncRegRole();award('login');renderNav();
    toast(role==='employer'?'Đã tạo tài khoản nhà tuyển dụng. Bạn được dùng miễn phí 6 tháng đầu.':ueh?'Đã tạo tài khoản bằng email UEH. Toàn bộ chức năng đã được mở khóa.':'Đã tạo tài khoản. Hoàn thiện hồ sơ để nhận gợi ý từ Lodestar AI.');
    go(role==='employer'?'employer':'profile');
  });

  $('forgotForm').addEventListener('submit',e=>{
    e.preventDefault();const f=e.target,el=f.elements;setFieldErr(el.email,'');formErr(f,'');
    const email=el.email.value.trim().toLowerCase();
    if(!validEmail(email)){setFieldErr(el.email,'Nhập email đúng định dạng, ví dụ ten@email.com');return}
    if(!S.users.some(x=>x.email===email)){setFieldErr(el.email,'Không tìm thấy tài khoản với email này. Kiểm tra lại hoặc đăng ký mới.');return}
    const code=String(Math.floor(100000+Math.random()*900000));
    auth.reset={email,code,exp:Date.now()+10*60e3};
    $('resetDemo').innerHTML=`Bản demo không gửi email thật. Mã xác nhận cho <b style="font-size:inherit;letter-spacing:0">${esc(email)}</b> là: <b>${code}</b><br><small>Mã có hiệu lực trong 10 phút.</small>`;
    $('resetForm').reset();setAuthMode('reset');
  });
  $('resetForm').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target,el=f.elements;
    qsa('.field',f).forEach(x=>setFieldErr(x,''));formErr(f,'');
    const r=auth.reset,code=el.code.value.trim(),pw=el.password.value,pw2=el.password2.value;let ok=true;
    if(!r||Date.now()>r.exp){formErr(f,'Mã xác nhận đã hết hạn. Chọn "Gửi lại mã" để nhận mã mới.');return}
    if(code!==r.code){setFieldErr(el.code,'Mã xác nhận chưa đúng');ok=false}
    if(pw.length<6){setFieldErr(el.password,'Mật khẩu cần tối thiểu 6 ký tự');ok=false}
    if(pw2!==pw){setFieldErr(el.password2,'Mật khẩu nhập lại chưa khớp');ok=false}
    if(!ok)return;
    const u=S.users.find(x=>x.email===r.email);if(!u){formErr(f,'Không tìm thấy tài khoản.');return}
    u.salt=uid();u.pw=await hashPw(pw,u.salt);persist('users');auth.reset=null;auth.fails={n:0,until:0};
    setAuthMode('login');$('loginForm').elements.email.value=u.email;$('loginForm').elements.password.focus();
    toast('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
  });
}
function logout(){
  usageStop();meId=null;writeSession(null);closeDropdown();stopCamera();
  toast('Bạn đã đăng xuất.');
  if(VIEWS[view].auth)go('home');else refresh();
}

/* ---------- Cài đặt tài khoản ---------- */
function openSettings(){
  const u=me();if(!u){requireLogin('mở cài đặt tài khoản',openSettings);return}
  closeDropdown();
  const m=modal(`<h2>Cài đặt tài khoản</h2><p class="muted">${esc(u.email)}</p>
  <form data-f="name" novalidate><div class="field"><label for="stName">${u.role==='employer'?'Tên công ty':'Họ và tên'}</label><input id="stName" name="n" value="${esc(u.name)}" maxlength="80"><small class="err"></small></div><button class="btn primary sm">Lưu tên</button></form>
  <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
  <form data-f="pw" novalidate><h3 style="margin-bottom:0">Đổi mật khẩu</h3>
  <div class="field"><label for="stOld">Mật khẩu hiện tại</label><input id="stOld" name="old" type="password" autocomplete="current-password"><small class="err"></small></div>
  <div class="field"><label for="stNew">Mật khẩu mới</label><input id="stNew" name="pw" type="password" autocomplete="new-password"><small class="err"></small></div>
  <div class="field"><label for="stNew2">Nhập lại mật khẩu mới</label><input id="stNew2" name="pw2" type="password" autocomplete="new-password"><small class="err"></small></div>
  <button class="btn primary sm">Đổi mật khẩu</button></form>
  <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
  <h3 style="margin-bottom:6px">Dữ liệu demo</h3><p class="muted">Xóa toàn bộ tài khoản, hồ sơ, tin đăng và bài viết lưu trong trình duyệt này và trả về dữ liệu mẫu ban đầu.</p>
  <button type="button" class="btn danger sm" data-reset>Đặt lại dữ liệu demo</button>`);
  qs('[data-f=name]',m).addEventListener('submit',e=>{
    e.preventDefault();const inp=e.target.elements.n,v=inp.value.trim().replace(/\s+/g,' ');
    if(v.length<2){setFieldErr(inp,'Nhập ít nhất 2 ký tự');return}
    setFieldErr(inp,'');u.name=v;persist('users');renderNav();refresh();toast('Đã cập nhật tên.');
  });
  qs('[data-f=pw]',m).addEventListener('submit',async e=>{
    e.preventDefault();const el=e.target.elements;let ok=true;qsa('.field',e.target).forEach(x=>setFieldErr(x,''));
    if(await hashPw(el.old.value,u.salt)!==u.pw){setFieldErr(el.old,'Mật khẩu hiện tại chưa đúng');ok=false}
    if(el.pw.value.length<6){setFieldErr(el.pw,'Mật khẩu cần tối thiểu 6 ký tự');ok=false}
    if(el.pw2.value!==el.pw.value){setFieldErr(el.pw2,'Mật khẩu nhập lại chưa khớp');ok=false}
    if(!ok)return;
    u.salt=uid();u.pw=await hashPw(el.pw.value,u.salt);persist('users');e.target.reset();toast('Đã đổi mật khẩu.');
  });
  qs('[data-reset]',m).addEventListener('click',async()=>{
    if(await confirmBox('Đặt lại toàn bộ dữ liệu demo?','Đặt lại',true)){store.clearAll();location.hash='#/home';location.reload()}
  });
}

/* ---------- Bảng lệnh cho các nút data-act ---------- */
const ACT={};
const fmtMonth=m=>/^\d{4}-\d{2}$/.test(m||'')?m.slice(5)+'/'+m.slice(0,4):(m||'');
const monthOk=v=>!v||/^\d{4}-(0[1-9]|1[0-2])$/.test(v)?'':'Nhập theo dạng YYYY-MM, ví dụ 2025-06';
let aiBusy=false;

/* ---------- Trang Hồ sơ ---------- */
function renderProfile(){
  const u=me();if(!u||u.role!=='student')return;
  const p=u.profile,c=completeness(p),a=analyze(u),regs=new Set(u.courses||[]),done=u.roadmapDone||{};
  const skillChip=(t,act,i)=>`<span class="chip">${esc(t)}<button type="button" data-act="${act}" data-i="${i}" aria-label="Xóa ${esc(t)}">×</button></span>`;
  const acts=(edit,del,id)=>`<div class="acts">${edit?`<button type="button" class="icon-btn" data-act="${edit}" data-id="${id}" aria-label="Sửa">✎</button>`:''}<button type="button" class="icon-btn del" data-act="${del}" data-id="${id}" aria-label="Xóa">×</button></div>`;
  const gpa=p.gpa!=null&&p.gpa!==''?Number(p.gpa):null;
  const dn=a.roadmap.filter(s=>done[s.key]).length;
  const roadPct=Math.round(dn/a.roadmap.length*100);
  const coursesOK=can(u,'courses')||isUEH(u),roadmapOK=can(u,'roadmap')||isUEH(u);
  $('profileRoot').innerHTML=`
  <div class="card"><div class="profile-head">
    <div class="avatar-lg" aria-hidden="true">${esc(initials(u.name))}</div>
    <div class="who"><small class="eyebrow">HỒ SƠ NĂNG LỰC</small><h1>${esc(u.name)}</h1>
      <p class="muted" style="margin:0">${esc(u.email)}${p.school?' · '+esc(p.school):''}${p.major?' · '+esc(p.major):''}${p.gradYear?' · Tốt nghiệp '+esc(p.gradYear):''}</p>
      ${p.bio?`<p style="margin:10px 0 0;max-width:640px">${esc(p.bio)}</p>`:''}</div>
    <div class="pbar"><div class="side-row"><small class="muted">Độ hoàn thiện hồ sơ</small><b>${c.pct}%</b></div><div class="progress" role="progressbar" aria-label="Độ hoàn thiện hồ sơ" aria-valuenow="${c.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${c.pct}%"></i></div></div>
    <button type="button" class="btn primary" data-act="p-edit-basic">Chỉnh sửa hồ sơ</button>
  </div>
  ${c.missing.length?`<div class="todo" role="group" aria-label="Việc cần làm để hoàn thiện hồ sơ">${c.missing.map(m=>`<button type="button" data-act="${m.act}">+ ${esc(m.label)}</button>`).join('')}</div>`:`<p class="notice" style="margin:14px 0 0">Hồ sơ của bạn đã đầy đủ. Lodestar AI sẽ dùng toàn bộ thông tin này để chấm mức độ phù hợp.</p>`}
  </div>

  <div class="profile-grid">
    <div class="card"><small class="muted">GPA</small><p class="big-num" style="color:var(--tx)">${gpa!=null?gpa.toFixed(2)+'/4.00':'Chưa có'}</p><p class="muted">${gpa!=null?'Xếp loại '+gpaRank(gpa):'Thêm GPA để tăng độ chính xác khi chấm phù hợp'}</p><button type="button" class="btn outline sm" data-act="p-edit-gpa">${gpa!=null?'Cập nhật GPA':'Thêm GPA'}</button></div>
    <div class="card span2"><div class="row-head"><h3>Chứng chỉ</h3><button type="button" class="btn outline sm" data-act="p-add-cert">+ Thêm chứng chỉ</button></div>
      ${p.certs.length?`<div class="list">${p.certs.map(x=>`<div class="item"><div class="grow"><b>${esc(x.name)}</b>${(x.issuer||x.year||x.file)?`<small class="muted" style="display:block">${[x.issuer,x.year,x.file?'📎 '+x.file.name:''].filter(Boolean).map(esc).join(' · ')}</small>`:''}</div>${acts('p-edit-cert','p-del-cert',x.id)}</div>`).join('')}</div>`:`<div class="empty-state"><b>Chưa có chứng chỉ</b>Thêm chứng chỉ ngoại ngữ, tin học hoặc chuyên môn để Lodestar AI ghi nhận kỹ năng của bạn.</div>`}
    </div>
    <div class="card"><div class="row-head"><h3>Kỹ năng chuyên môn</h3><button type="button" class="btn outline sm" data-act="p-add-hard">+ Thêm</button></div>
      ${p.hardSkills.length?`<div class="chips">${p.hardSkills.map((s,i)=>skillChip(s,'p-del-hard',i)).join('')}</div>`:`<p class="muted">Ví dụ: Excel, SQL, Python, Power BI.</p>`}</div>
    <div class="card"><div class="row-head"><h3>Kỹ năng mềm</h3><button type="button" class="btn outline sm" data-act="p-add-soft">+ Thêm</button></div>
      ${p.softSkills.length?`<div class="chips">${p.softSkills.map((s,i)=>skillChip(s,'p-del-soft',i)).join('')}</div>`:`<p class="muted">Ví dụ: Thuyết trình, Làm việc nhóm.</p>`}</div>
    <div class="card"><div class="row-head"><h3>Bảng điểm</h3><button type="button" class="btn outline sm" data-act="p-upload-transcript">Tải lên</button></div>
      ${p.transcripts.length?`<div class="list">${p.transcripts.map(t=>`<div class="item"><div class="grow"><b style="word-break:break-all">📄 ${esc(t.name)}</b><small class="muted" style="display:block">${fmtSize(t.size)} · ${fmtDate(t.at)}</small></div>${acts('','p-del-transcript',t.id)}</div>`).join('')}</div>`:`<p class="muted">Tải bảng điểm (PDF hoặc ảnh, tối đa 5 MB).</p>`}
      <p class="notice" style="margin:10px 0 0">Bản demo chỉ lưu tên tệp trong trình duyệt của bạn, không tải nội dung lên máy chủ.</p>
      <input type="file" id="fileTranscript" class="hide" accept=".pdf,.jpg,.jpeg,.png" multiple>
    </div>
    <div class="card span2"><div class="row-head"><h3>Dự án khoa học</h3><button type="button" class="btn outline sm" data-act="p-add-project">+ Thêm dự án</button></div>
      ${p.projects.length?`<div class="list">${p.projects.map(x=>`<div class="item"><div class="grow"><b>${esc(x.name)}</b>${x.desc?`<small class="muted" style="display:block">${esc(x.desc)}</small>`:''}</div>${acts('p-edit-project','p-del-project',x.id)}</div>`).join('')}</div>`:`<div class="empty-state"><b>Chưa có dự án</b>Thêm nghiên cứu, đồ án hoặc dự án nhóm bạn đã tham gia.</div>`}</div>
    <div class="card"><div class="row-head"><h3>Lịch sử thực tập</h3><button type="button" class="btn outline sm" data-act="p-add-intern">+ Thêm</button></div>
      ${p.internships.length?`<div class="list">${p.internships.map(x=>`<div class="item"><div class="grow"><b>${esc(x.role)}, ${esc(x.company)}</b>${(x.from||x.to)?`<small class="muted" style="display:block">${esc(fmtMonth(x.from))}${x.to?' - '+esc(fmtMonth(x.to)):''}</small>`:''}</div>${acts('p-edit-intern','p-del-intern',x.id)}</div>`).join('')}</div>`:`<div class="empty-state"><b>Chưa có thực tập</b>Thêm kỳ thực tập hoặc công việc bán thời gian.</div>`}</div>
  </div>

  <div class="card ai-card" style="margin-top:16px" id="aiCard">
    <div class="ai-head"><div><h2>✦ Lodestar AI phân tích hồ sơ</h2><p class="muted" style="margin:4px 0 0">Đối chiếu hồ sơ của bạn với kỹ năng cốt lõi của vị trí mục tiêu.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><label class="muted">Vị trí mục tiêu <select class="select-inline" data-change="ai-role" aria-label="Vị trí mục tiêu">${Object.keys(ROLES).map(r=>`<option ${r===a.role?'selected':''}>${esc(r)}</option>`).join('')}</select></label><button type="button" class="btn primary sm" data-act="ai-run" ${aiBusy?'disabled':''}>Phân tích lại</button></div></div>
    ${aiBusy?`<div class="ai-loading" role="status"><span class="spin"></span>Lodestar AI đang phân tích hồ sơ của bạn...</div>`:`
    <div class="ai-summary">${coursesOK?a.summary:a.summaryBase}</div>
    <div class="two" style="margin-top:0">
      <div>
        <h3 style="margin-bottom:8px">Điểm mạnh hiện có</h3>
        ${a.strengths.length?`<div class="chips">${a.strengths.map(i=>`<span class="chip ok">✓ ${esc(labelOf(i))}</span>`).join('')}</div>`:`<p class="muted">Chưa ghi nhận kỹ năng nào khớp. Hãy thêm kỹ năng, chứng chỉ hoặc dự án.</p>`}
        <h3 style="margin:18px 0 8px">Kỹ năng cần bổ sung</h3>
        ${a.gaps.length?`<div class="chips">${a.gaps.map(i=>`<span class="chip warn">${esc(labelOf(i))}</span>`).join('')}</div>`:`<p class="muted">Bạn đã có đủ các kỹ năng cốt lõi cho vị trí này.</p>`}
      </div>
      <div>
        <h3 style="margin-bottom:8px">Khóa học được gợi ý</h3>
        ${!coursesOK?`<div class="lock-panel" style="padding:20px 16px"><div class="lock-ico" aria-hidden="true">🔒</div><p class="muted" style="margin:0 0 12px">Mở khóa để Lodestar AI đề xuất và đăng ký khóa học theo kỹ năng còn thiếu.</p><button type="button" class="btn orange sm" data-go="pricing">Xem gói nâng cấp</button></div>`
          :a.recs.length?`<div class="list">${a.recs.map(r=>`<div class="rec"><div><b>${esc(r.course.title)}</b><small>${r.pct}% phù hợp · ${esc(r.course.duration)} · bổ sung ${esc(r.fill.map(labelOf).join(', '))}</small></div><button type="button" class="btn ${regs.has(r.course.id)?'registered':'orange'} sm" data-act="course-reg" data-id="${r.course.id}">${regs.has(r.course.id)?'Đã đăng ký':'Đăng ký'}</button></div>`).join('')}</div>`:`<p class="muted">Không có khóa học cần bổ sung ở mục tiêu này.</p>`}
      </div>
    </div>`}
  </div>

  ${aiBusy?'':roadmapOK?`<div class="card" style="margin-top:16px"><div class="row-head"><h3>Lộ trình 12 tuần dành riêng cho bạn</h3><span class="chip">${dn}/${a.roadmap.length} giai đoạn hoàn thành</span></div>
    <div class="progress" role="progressbar" aria-label="Tiến độ lộ trình" aria-valuenow="${roadPct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${roadPct}%"></i></div>
    <ol class="road" style="margin-top:14px">${a.roadmap.map(s=>`<li class="${done[s.key]?'done':''}"><input type="checkbox" id="rd_${s.key}" data-change="road" data-key="${s.key}" ${done[s.key]?'checked':''}><label for="rd_${s.key}"><b>Tuần ${s.from===s.to?s.from:s.from+'-'+s.to}: ${esc(s.title)}</b><small>${esc(s.detail)}</small></label>${s.courseId?`<button type="button" class="btn ${regs.has(s.courseId)?'registered':'outline'} sm" data-act="course-reg" data-id="${s.courseId}">${regs.has(s.courseId)?'Đã đăng ký':'Đăng ký khóa'}</button>`:''}</li>`).join('')}</ol></div>`
    :`<div style="margin-top:16px">${lockPanel('roadmap')}</div>`}`;
}
RENDER.profile=renderProfile;
const refreshProfile=()=>{if(view==='profile')renderProfile()};
const P=()=>me().profile;
const save=()=>{persist('users');checkMilestones();refreshProfile()};
const uniqAdd=(arr,v)=>{const t=v.trim();if(t&&!arr.some(x=>norm(x)===norm(t)))arr.push(t)};
const delItem=async(key,id,msg)=>{if(!await confirmBox(msg,'Xóa',true))return;const p=P();p[key]=p[key].filter(x=>x.id!==id);save();toast('Đã xóa.')};

ACT['p-edit-basic']=()=>{
  const p=P();
  openForm({title:'Chỉnh sửa hồ sơ',values:p,submit:'Lưu hồ sơ',fields:[
    {name:'school',label:'Trường / đơn vị đào tạo',req:true,maxlength:100},
    {name:'major',label:'Ngành học',ph:'Ví dụ: Hệ thống thông tin quản lý',maxlength:100},
    {name:'gradYear',label:'Năm tốt nghiệp (dự kiến)',type:'number',min:2015,max:2040,ph:'2026',validate:v=>(Number(v)<2015||Number(v)>2040)?'Nhập năm từ 2015 đến 2040':''},
    {name:'targetRole',label:'Vị trí mục tiêu',type:'select',options:Object.keys(ROLES),hint:'Lodestar AI dùng vị trí này để tìm kỹ năng còn thiếu và dựng lộ trình.'},
    {name:'bio',label:'Giới thiệu bản thân',type:'textarea',rows:4,maxlength:500,hint:'2-3 câu về điểm mạnh và định hướng nghề nghiệp (từ 30 ký tự sẽ được tính vào độ hoàn thiện).'}],
    onSubmit:d=>{Object.assign(p,{school:d.school,major:d.major,gradYear:d.gradYear,targetRole:d.targetRole,bio:d.bio});save();toast('Đã cập nhật hồ sơ.')}});
};
ACT['p-edit-gpa']=()=>{
  const p=P();
  openForm({title:'Cập nhật GPA',sub:'Nhập GPA tích lũy theo thang điểm 4.0.',values:{gpa:p.gpa??''},fields:[{name:'gpa',label:'GPA (thang 4.0)',type:'number',step:'0.01',min:0,max:4,req:true,validate:v=>{const n=Number(v);return isNaN(n)||n<0||n>4?'Nhập GPA từ 0 đến 4.00':''}}],
    onSubmit:d=>{p.gpa=Math.round(Number(d.gpa)*100)/100;save();toast('Đã cập nhật GPA.')}});
};
function certForm(id){
  const p=P(),ex=id?p.certs.find(x=>x.id===id):null;
  openForm({title:ex?'Sửa chứng chỉ':'Thêm chứng chỉ',values:ex||{},fields:[
    {name:'name',label:'Tên chứng chỉ',req:true,ph:'Ví dụ: IELTS 6.5',maxlength:100},
    {name:'issuer',label:'Đơn vị cấp',ph:'Không bắt buộc',maxlength:80},
    {name:'year',label:'Năm cấp',type:'number',min:1990,max:2100,validate:v=>(Number(v)<1990||Number(v)>2100)?'Nhập năm hợp lệ':''},
    {name:'file',type:'file',label:'Tệp chứng chỉ (PDF, ảnh)',accept:'.pdf,.jpg,.jpeg,.png',hint:'Bản demo chỉ lưu tên tệp trong trình duyệt của bạn.',validate:f=>f.size>5*1048576?'Tệp tối đa 5 MB':''}],
    onSubmit:d=>{const o={name:d.name,issuer:d.issuer,year:d.year,file:d.file||ex?.file||null};if(ex)Object.assign(ex,o);else p.certs.push({id:uid(),...o});save();toast(ex?'Đã cập nhật chứng chỉ.':'Đã thêm chứng chỉ.')}});
}
ACT['p-add-cert']=()=>certForm();
ACT['p-edit-cert']=t=>certForm(t.dataset.id);
ACT['p-del-cert']=t=>delItem('certs',t.dataset.id,'Xóa chứng chỉ này?');
const skillForm=(key,title,ph)=>{
  const p=P();
  openForm({title,sub:'Có thể nhập nhiều kỹ năng, cách nhau bằng dấu phẩy.',fields:[{name:'skill',label:'Tên kỹ năng',req:true,ph,list:'skillList',maxlength:120}],submit:'Thêm',
    onSubmit:d=>{const before=p[key].length;d.skill.split(',').forEach(s=>uniqAdd(p[key],s.slice(0,40)));if(p[key].length===before)return 'Kỹ năng này đã có trong hồ sơ.';save();toast('Đã thêm kỹ năng.')}});
};
ACT['p-add-hard']=()=>skillForm('hardSkills','Thêm kỹ năng chuyên môn','Ví dụ: SQL, Power BI');
ACT['p-add-soft']=()=>skillForm('softSkills','Thêm kỹ năng mềm','Ví dụ: Thuyết trình');
ACT['p-del-hard']=t=>{P().hardSkills.splice(+t.dataset.i,1);save()};
ACT['p-del-soft']=t=>{P().softSkills.splice(+t.dataset.i,1);save()};
function projectForm(id){
  const p=P(),ex=id?p.projects.find(x=>x.id===id):null;
  openForm({title:ex?'Sửa dự án':'Thêm dự án khoa học',values:ex||{},fields:[
    {name:'name',label:'Tên dự án',req:true,maxlength:140},
    {name:'desc',label:'Mô tả ngắn',type:'textarea',rows:3,maxlength:400,hint:'Vai trò, công cụ đã dùng và kết quả đạt được.'}],
    onSubmit:d=>{if(ex)Object.assign(ex,{name:d.name,desc:d.desc});else p.projects.push({id:uid(),name:d.name,desc:d.desc});save();toast(ex?'Đã cập nhật dự án.':'Đã thêm dự án.')}});
}
ACT['p-add-project']=()=>projectForm();
ACT['p-edit-project']=t=>projectForm(t.dataset.id);
ACT['p-del-project']=t=>delItem('projects',t.dataset.id,'Xóa dự án này?');
function internForm(id){
  const p=P(),ex=id?p.internships.find(x=>x.id===id):null;
  openForm({title:ex?'Sửa thực tập':'Thêm thực tập / kinh nghiệm',values:ex||{},fields:[
    {name:'role',label:'Vị trí',req:true,ph:'Ví dụ: Marketing Intern',maxlength:80},
    {name:'company',label:'Công ty',req:true,maxlength:80},
    {name:'from',label:'Từ tháng',type:'month',ph:'YYYY-MM',validate:monthOk},
    {name:'to',label:'Đến tháng',type:'month',ph:'YYYY-MM',hint:'Để trống nếu đang thực tập.',validate:(v,d)=>monthOk(v)||(d.from&&v&&v<d.from?'Tháng kết thúc phải sau tháng bắt đầu':'')}],
    onSubmit:d=>{const o={role:d.role,company:d.company,from:d.from,to:d.to};if(ex)Object.assign(ex,o);else p.internships.push({id:uid(),...o});save();toast(ex?'Đã cập nhật thực tập.':'Đã thêm thực tập.')}});
}
ACT['p-add-intern']=()=>internForm();
ACT['p-edit-intern']=t=>internForm(t.dataset.id);
ACT['p-del-intern']=t=>delItem('internships',t.dataset.id,'Xóa mục thực tập này?');
ACT['p-upload-transcript']=()=>{
  if(view!=='profile')go('profile');
  const i=$('fileTranscript');if(i){i.value='';i.click()}
};
ACT['p-del-transcript']=t=>delItem('transcripts',t.dataset.id,'Xóa bảng điểm này?');
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='fileTranscript'){
    const ok=/\.(pdf|jpe?g|png)$/i,p=P();let added=0;
    [...t.files].forEach(f=>{
      if(!ok.test(f.name)){toast(`"${f.name}": chỉ nhận PDF, JPG hoặc PNG.`,'bad');return}
      if(f.size>5*1048576){toast(`"${f.name}" vượt quá 5 MB.`,'bad');return}
      p.transcripts.push({id:uid(),name:f.name,size:f.size,at:Date.now()});added++;
    });
    if(added){save();toast(added>1?`Đã thêm ${added} bảng điểm.`:'Đã thêm bảng điểm.')}
  }
  if(t.dataset.change==='ai-role'){P().targetRole=t.value;persist('users');ACT['ai-run']()}
  if(t.dataset.change==='road'){const u=me();u.roadmapDone=u.roadmapDone||{};u.roadmapDone[t.dataset.key]=t.checked;persist('users');renderProfile();const n=$('rd_'+t.dataset.key);n&&n.focus()}
});
ACT['ai-run']=()=>{
  if(aiBusy)return;aiBusy=true;renderProfile();
  setTimeout(()=>{aiBusy=false;if(view==='profile')renderProfile();toast('Lodestar AI đã cập nhật phân tích và lộ trình.')},900);
};
function toggleCourse(id){
  if(!needStudent('đăng ký khóa học',()=>toggleCourse(id)))return;
  const u=me();
  if(!can(u,'courses')&&!isUEH(u)){openUpsell('courses');return}
  const set=new Set(u.courses||[]);
  if(set.has(id)){set.delete(id);toast('Đã hủy đăng ký khóa học.')}else{set.add(id);toast('Đã đăng ký khóa học. Chúc bạn học tốt!')}
  u.courses=[...set];persist('users');refresh();
}
ACT['course-reg']=t=>toggleCourse(+t.dataset.id);

/* =====================================================================
   Gói dịch vụ, phân quyền theo email UEH, điểm thưởng, giao diện
   (Thanh toán trong bản demo chỉ mô phỏng, không thu tiền và không lưu thông tin thẻ)
   ===================================================================== */
const HOTLINE={raw:'0965036567',text:'0965 036 567'};
const hotlineLink=()=>`<a href="tel:${HOTLINE.raw}">${HOTLINE.text}</a>`;
const Email={raw:'tranthienanpct@gmail.com',text:'tranthienanpct@gmail.com'};
const emailLink=()=>`<a href="mailto:${Email.raw}">${Email.text}</a>`;
const PLANS={
  base:{name:'Base',price:{month:0,year:0},limitH:5},
  pro:{name:'Pro',price:{month:50000,year:500000},limitH:30},
  promax:{name:'Pro Max',price:{month:100000,year:1000000},limitH:null}
};
const EMP={month:5000000,year:50000000,promoYear:20000000,trialMonths:6,promoMonths:12};
const RANK={base:0,pro:1,promax:2};
const NEED={interview:'pro',courses:'pro',roadmap:'promax'};
const FEATURE_NAME={interview:'Phòng mô phỏng phỏng vấn',courses:'Đề xuất và đăng ký khóa học',roadmap:'Lộ trình 12 tuần'};
const isUEHEmail=e=>/@st\.ueh\.edu\.vn$/i.test(String(e||'').trim());
const isUEH=u=>!!u&&u.role==='student'&&isUEHEmail(u.email);
function tierOf(u){
  if(!u||u.role!=='student')return 'none';
  if(isUEH(u))return 'promax';
  const now=Date.now();let t='base';const up=x=>{if(RANK[x]>RANK[t])t=x};
  if(u.sub&&u.sub.paidUntil>now)up(u.sub.tier);
  const g=u.grants||{};if(g.pro>now)up('pro');if(g.promax>now)up('promax');
  return t;
}
const can=(u,f)=>!!u&&u.role==='student'&&RANK[tierOf(u)]>=RANK[NEED[f]];
const tierLabel=u=>isUEH(u)?'Sinh viên UEH · Toàn quyền':'Gói '+PLANS[tierOf(u)].name;
const limitSec=u=>{if(!u||u.role!=='student'||isUEH(u))return Infinity;const h=PLANS[tierOf(u)].limitH;return h==null?Infinity:h*3600};
const usageSec=u=>(u&&u.usage&&u.usage[monthKey()])||0;
const remainingSec=u=>limitSec(u)-usageSec(u);
const jobLocked=(j,u)=>!!j.uehOnly&&!isUEH(u)&&!(u&&u.id===j.ownerId);
const empActive=u=>!!u&&u.role==='employer'&&!!u.empPlan&&(Date.now()<u.empPlan.trialEnd||Date.now()<(u.empPlan.paidUntil||0));

function ensureUserDefaults(u){
  if(u.role==='student'){
    u.points=u.points||0;u.pointLog=u.pointLog||[];u.daily=u.daily||{d:'',c:{}};u.once=u.once||[];u.vouchers=u.vouchers||[];
    u.grants=u.grants||{};u.usage=u.usage||{};u.billing=u.billing||[];u.savedPosts=u.savedPosts||[];u.cvs=u.cvs||[];u.trialUsed=!!u.trialUsed;
  }else if(u.role==='employer'&&!u.empPlan){
    const t=u.createdAt||Date.now();
    u.empPlan={trialEnd:addMonths(t,EMP.trialMonths),promoUntil:addMonths(t,EMP.promoMonths),paidUntil:0,period:null,promoUsed:false,billing:[]};
  }
}
const newEmpPlan=(t=Date.now())=>({trialEnd:addMonths(t,EMP.trialMonths),promoUntil:addMonths(t,EMP.promoMonths),paidUntil:0,period:null,promoUsed:false,billing:[]});

/* ---------- Khóa tính năng ---------- */
function lockPanel(f){
  return `<div class="card lock-panel"><div class="lock-ico" aria-hidden="true">🔒</div><h2>${FEATURE_NAME[f]} đang bị khóa</h2><p class="muted" style="max-width:520px;margin:0 auto 16px">Tính năng này dành cho sinh viên UEH (đăng ký bằng email @st.ueh.edu.vn) hoặc gói <b>${PLANS[NEED[f]].name}</b> trở lên.</p><div class="lock-actions"><button type="button" class="btn orange" data-go="pricing">Xem gói nâng cấp</button><button type="button" class="btn outline" data-act="ueh-info">Tôi là sinh viên UEH</button></div></div>`;
}
function openUpsell(f){
  const u=me();
  if(!u){requireLogin('dùng tính năng này',()=>openUpsell(f));return}
  modal(`<h2>🔒 ${FEATURE_NAME[f]}</h2><p class="muted">Tính năng này mở cho sinh viên UEH (email @st.ueh.edu.vn) hoặc gói <b>${PLANS[NEED[f]].name}</b> trở lên. Dùng thử miễn phí tháng đầu.</p><div class="modal-actions"><button type="button" class="btn outline" data-close>Để sau</button><button type="button" class="btn orange" data-go="pricing" data-close>Xem gói nâng cấp</button></div>`,{small:true});
}
ACT['upsell']=t=>openUpsell(t.dataset.f);
function openUehInfo(){
  const u=me(),guest=!u,emp=u&&u.role==='employer',ueh=isUEH(u);
  modal(`<h2>Quyền lợi sinh viên UEH</h2>
  <p class="muted">Đăng ký bằng email dạng <b>tên@st.ueh.edu.vn</b> để mở toàn bộ chức năng, không mất phí: Lodestar không giới hạn, phòng mô phỏng phỏng vấn, đề xuất khóa học, lộ trình 12 tuần và các tin tuyển dụng dành riêng cho sinh viên UEH.</p>
  ${ueh?`<div class="info-box">Tài khoản của bạn đang dùng email UEH nên đã được mở toàn bộ chức năng.</div>`
    :emp?`<div class="info-box">Bạn đang dùng tài khoản nhà tuyển dụng. Bạn có thể đăng tin dành riêng cho sinh viên UEH khi tạo tin.</div>`
    :guest?`<div class="info-box">Bạn chưa đăng nhập, nên các tin dành riêng cho sinh viên UEH đang bị che mờ.</div>`
    :`<div class="info-box">Email hiện tại của bạn (${esc(u.email)}) không phải email UEH. Gói Pro và Pro Max mở các tính năng học tập nhưng không mở các tin tuyển dụng dành riêng cho sinh viên UEH.</div>`}
  <p class="notice" style="margin:12px 0 0">Bản demo chưa xác minh hộp thư. Bản chính thức cần gửi mã xác nhận tới email UEH trước khi mở quyền.</p>
  <div class="modal-actions"><button type="button" class="btn outline" data-close>Đóng</button>${guest?`<button type="button" class="btn primary" data-act="register" data-close>Đăng ký bằng email UEH</button>`:(ueh||emp)?'':`<button type="button" class="btn primary" data-go="pricing" data-close>Xem bảng giá</button>`}</div>`);
}
ACT['ueh-info']=()=>openUehInfo();

/* ---------- Hạn mức sử dụng Lodestar ---------- */
const LU={t:null,last:0,n:0,dirty:false};
function usageStart(){
  usageStop();const u=me();
  if(u&&u.role==='student'&&limitSec(u)!==Infinity&&remainingSec(u)>0){LU.last=Date.now();LU.t=setInterval(usageTick,5000)}
  updateChatMeta();
}
function usageStop(){
  if(LU.t){usageTick();clearInterval(LU.t);LU.t=null}
  if(LU.dirty){persist('users');LU.dirty=false}
}
function usageTick(){
  const u=me();if(!u)return;
  const now=Date.now(),el=Math.min(15,(now-LU.last)/1000);LU.last=now;
  if(document.hidden||el<=0)return;
  u.usage=u.usage||{};const k=monthKey();u.usage[k]=(u.usage[k]||0)+el;LU.dirty=true;
  if(++LU.n%6===0){persist('users');LU.dirty=false}
  updateChatMeta();
  if(remainingSec(u)<=0){clearInterval(LU.t);LU.t=null;persist('users');LU.dirty=false;chatLimitNotice()}
}
function chatLimitNotice(){
  const u=me();if(!u)return;
  const h=PLANS[tierOf(u)].limitH;
  chat.hist.push({me:false,html:`Bạn đã dùng hết ${h} giờ Lodestar trong tháng này. Nâng cấp gói để tiếp tục trò chuyện.${bub('Xem gói nâng cấp','chat-go',{view:'pricing'})}`});
  renderChat();updateChatMeta();
}
function updateChatMeta(){
  const u=me(),el=$('lodestarMeta');if(!el)return;
  if(u&&u.role==='student'&&limitSec(u)!==Infinity){
    const rem=remainingSec(u);
    el.textContent=rem>0?`Còn ${fmtHM(rem)} tháng này`:'Đã hết hạn mức tháng này';
    $('lodestarInput').disabled=rem<=0;$('lodestarForm').querySelector('button').disabled=rem<=0;
  }else{
    el.textContent=u&&u.role==='student'?'Không giới hạn':'';
    $('lodestarInput').disabled=false;$('lodestarForm').querySelector('button').disabled=false;
  }
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)usageStop();else if(!$('lodestarChat').classList.contains('hide'))usageStart()});

/* ---------- Thanh toán mô phỏng: sinh viên ---------- */
const PAY_METHODS=[['qr','Chuyển khoản QR ngân hàng'],['momo','Ví điện tử'],['card','Thẻ ATM / Visa / Mastercard']];
function payMethodsHtml(){
  return `<fieldset class="field"><legend>Phương thức thanh toán</legend><div class="role-pick" style="grid-template-columns:1fr">${PAY_METHODS.map(([k,l],i)=>`<label><input type="radio" name="pm" value="${k}" ${i?'':'checked'}>${l}</label>`).join('')}</div></fieldset><div class="demo-box">Bản demo: giao dịch chỉ được mô phỏng, hệ thống không thu tiền thật và không hỏi hay lưu số thẻ.</div>`;
}
function openCheckout(tier,period){
  const u=me();
  if(!u){openAuth('register',{msg:'Tạo tài khoản sinh viên để nâng cấp gói.'});return}
  if(u.role!=='student'){toast('Gói Pro và Pro Max dành cho sinh viên. Doanh nghiệp xem gói ở mục Bảng giá.','warn');return}
  if(isUEH(u)){toast('Email @st.ueh.edu.vn đã được mở toàn bộ chức năng, bạn không cần nâng cấp.');return}
  const pl=PLANS[tier],price=pl.price[period],trial=!u.trialUsed,now=Date.now();
  const trialEnd=trial?addMonths(now,1):now,paidUntil=addMonths(trialEnd,period==='year'?12:1);
  const m=modal(`<h2>Nâng cấp lên ${pl.name}</h2>
   <div class="sumbox">
    <div><span>Gói</span><b>${pl.name} · ${period==='year'?'theo năm':'theo tháng'}</b></div>
    <div><span>Giá</span><b>${vnd(price)}/${period==='year'?'năm':'tháng'}</b></div>
    ${trial?`<div><span>Ưu đãi</span><b style="color:var(--ok)">Miễn phí tháng đầu tiên</b></div>`:''}
    <div><span>Thanh toán hôm nay</span><b>${trial?'0 VND':vnd(price)}</b></div>
    <div><span>${trial?'Thanh toán lần đầu':'Gia hạn tiếp theo'}</span><b>${fmtDate(trial?trialEnd:paidUntil)}${trial?' · '+vnd(price):''}</b></div>
    <div><span>Dùng được đến</span><b>${fmtDate(paidUntil)}</b></div>
   </div>${payMethodsHtml()}
   <p class="notice">Bạn có thể hủy gia hạn bất cứ lúc nào trong mục Gói của tôi. Cần hỗ trợ: hotline ${hotlineLink()}.</p>
   <div class="modal-actions"><button type="button" class="btn outline" data-close>Hủy</button><button type="button" class="btn orange" data-pay>${trial?'Bắt đầu dùng thử miễn phí':'Xác nhận thanh toán'}</button></div>`);
  qs('[data-pay]',m).addEventListener('click',e=>{
    const b=e.currentTarget;b.disabled=true;b.textContent='Đang xử lý...';
    const method=qs('input[name=pm]:checked',m).value;
    setTimeout(()=>{
      u.sub={tier,period,at:now,trialEnd:trial?trialEnd:null,paidUntil,price,method,cancelled:false};
      u.trialUsed=true;u.billing.unshift({at:now,text:`${pl.name} (${period==='year'?'năm':'tháng'})`,amount:trial?0:price,note:trial?'Dùng thử miễn phí tháng đầu':'Đã thanh toán (mô phỏng)'});
      persist('users');notify(u.id,`Bạn đã nâng cấp lên gói ${pl.name}, dùng được đến ${fmtDate(paidUntil)}.`);
      closeEl(m);toast(`Nâng cấp thành công: bạn đang dùng gói ${pl.name} đến ${fmtDate(paidUntil)}.`);
      usageStart();renderNav();refresh();
    },1100);
  });
}
ACT['buy-plan']=t=>{
  const u=me(),tier=t.dataset.tier,period=PR.period;
  if(!u){openAuth('register',{msg:'Tạo tài khoản sinh viên để dùng thử gói.'});return}
  openCheckout(tier,period);
};

/* ---------- Thanh toán mô phỏng: doanh nghiệp ---------- */
function empPrice(u,period){
  const promo=period==='year'&&Date.now()<u.empPlan.promoUntil&&!u.empPlan.promoUsed;
  return{promo,price:period==='year'?(promo?EMP.promoYear:EMP.year):EMP.month};
}
function openEmpCheckout(period){
  const u=me();
  if(!u){openAuth('register',{role:'employer',msg:'Tạo tài khoản nhà tuyển dụng để đăng ký gói.'});return}
  if(u.role!=='employer'){toast('Gói doanh nghiệp dành cho tài khoản nhà tuyển dụng.','warn');return}
  const ep=u.empPlan,{promo,price}=empPrice(u,period),now=Date.now();
  const start=Math.max(now,ep.trialEnd,ep.paidUntil||0),until=addMonths(start,period==='year'?12:1);
  const m=modal(`<h2>Đăng ký gói doanh nghiệp</h2>
   <div class="sumbox">
    <div><span>Gói</span><b>${period==='year'?'Theo năm':'Theo tháng'}</b></div>
    <div><span>Giá</span><b>${promo?`<s style="color:var(--faint);font-weight:500">${vnd(EMP.year)}</s> `:''}${vnd(price)}/${period==='year'?'năm':'tháng'}</b></div>
    ${promo?`<div><span>Ưu đãi năm đầu</span><b style="color:var(--ok)">Tiết kiệm ${vnd(EMP.year-EMP.promoYear)}</b></div>`:''}
    <div><span>Bắt đầu tính từ</span><b>${fmtDate(start)}${start>now?' (sau thời gian miễn phí)':''}</b></div>
    <div><span>Sử dụng đến</span><b>${fmtDate(until)}</b></div>
    <div><span>Thanh toán hôm nay</span><b>${vnd(price)}</b></div>
   </div>
   <fieldset class="field"><legend>Phương thức thanh toán</legend><div class="role-pick" style="grid-template-columns:1fr">${[['bank','Chuyển khoản ngân hàng doanh nghiệp'],['card','Thẻ doanh nghiệp']].map(([k,l],i)=>`<label><input type="radio" name="pm" value="${k}" ${i?'':'checked'}>${l}</label>`).join('')}</div></fieldset>
   <div class="demo-box">Bản demo: giao dịch chỉ được mô phỏng, hệ thống không thu tiền thật. Cần xuất hóa đơn VAT hoặc tư vấn gói: hotline ${hotlineLink()}.</div>
   <div class="modal-actions"><button type="button" class="btn outline" data-close>Hủy</button><button type="button" class="btn orange" data-pay>Xác nhận thanh toán</button></div>`);
  qs('[data-pay]',m).addEventListener('click',e=>{
    const b=e.currentTarget;b.disabled=true;b.textContent='Đang xử lý...';
    setTimeout(()=>{
      ep.paidUntil=until;ep.period=period;if(promo)ep.promoUsed=true;
      ep.billing.unshift({at:now,text:`Gói doanh nghiệp (${period==='year'?'năm':'tháng'})${promo?' · ưu đãi năm đầu':''}`,amount:price,note:'Đã thanh toán (mô phỏng)'});
      persist('users');notify(u.id,`Gói doanh nghiệp đã được gia hạn đến ${fmtDate(until)}.`);
      closeEl(m);toast(`Đăng ký thành công. Gói dùng được đến ${fmtDate(until)}.`);renderNav();refresh();
    },1100);
  });
}
ACT['emp-buy']=t=>{
  if(!me()){openAuth('register',{role:'employer',msg:'Tạo tài khoản nhà tuyển dụng để đăng ký gói.'});return}
  openEmpCheckout(t.dataset.period);
};
function empBanner(u){
  const ep=u.empPlan,now=Date.now();
  const trialLeft=Math.ceil((ep.trialEnd-now)/DAY),paid=(ep.paidUntil||0)>now,promo=now<ep.promoUntil&&!ep.promoUsed;
  if(paid&&now>=ep.trialEnd)return `<div class="plan-banner ok"><div><b>Gói doanh nghiệp đang hoạt động</b><span>Dùng được đến ${fmtDate(ep.paidUntil)}.</span></div><button type="button" class="btn outline sm" data-act="my-plan">Xem chi tiết</button></div>`;
  if(now<ep.trialEnd)return `<div class="plan-banner ${trialLeft<=14?'warn':''}"><div><b>Đang dùng thử miễn phí, còn ${trialLeft} ngày (đến ${fmtDate(ep.trialEnd)})</b><span>${promo?`Ưu đãi năm đầu: gói năm chỉ ${vnd(EMP.promoYear)} (giá gốc ${vnd(EMP.year)}).`:'Chọn gói để tiếp tục đăng tin sau khi hết dùng thử.'}</span></div><button type="button" class="btn orange sm" data-go="pricing">Xem gói</button></div>`;
  return `<div class="plan-banner bad"><div><b>Gói doanh nghiệp đã hết hạn</b><span>Bạn chưa thể đăng hoặc sửa tin. Gia hạn để tiếp tục tuyển dụng${promo?`, gói năm ưu đãi chỉ ${vnd(EMP.promoYear)}`:''}.</span></div><button type="button" class="btn orange sm" data-go="pricing">Gia hạn ngay</button></div>`;
}

/* ---------- Gói của tôi ---------- */
function openMyPlan(){
  const u=me();if(!u){requireLogin('xem gói của bạn',openMyPlan);return}
  closeDropdown();
  if(u.role==='employer'){
    const ep=u.empPlan;
    modal(`<h2>Gói doanh nghiệp</h2>${empBanner(u)}
    <div class="sumbox" style="margin-top:14px"><div><span>Miễn phí đến</span><b>${fmtDate(ep.trialEnd)}</b></div><div><span>Gói trả phí đến</span><b>${ep.paidUntil?fmtDate(ep.paidUntil):'Chưa đăng ký'}</b></div><div><span>Ưu đãi năm đầu</span><b>${Date.now()<ep.promoUntil&&!ep.promoUsed?`Còn hiệu lực đến ${fmtDate(ep.promoUntil)}`:'Không còn'}</b></div></div>
    <h3 style="margin:16px 0 8px">Lịch sử thanh toán</h3>${ep.billing.length?`<div class="list">${ep.billing.map(b=>`<div class="item"><div class="grow"><b>${esc(b.text)}</b><small class="muted" style="display:block">${fmtDate(b.at)} · ${esc(b.note)}</small></div><b>${vnd(b.amount)}</b></div>`).join('')}</div>`:'<p class="muted">Chưa có giao dịch.</p>'}
    <p class="notice" style="margin:12px 0 0">Hotline hỗ trợ doanh nghiệp: ${hotlineLink()}</p>
    <div class="modal-actions"><button type="button" class="btn outline" data-close>Đóng</button><button type="button" class="btn orange" data-go="pricing" data-close>Xem gói</button></div>`);
    return;
  }
  const t=tierOf(u),ueh=isUEH(u),rem=remainingSec(u),lim=limitSec(u);
  const srcs=[];if(u.sub&&u.sub.paidUntil>Date.now())srcs.push(`Gói ${PLANS[u.sub.tier].name} ${u.sub.period==='year'?'theo năm':'theo tháng'}${u.sub.cancelled?' (đã hủy gia hạn)':''}, đến ${fmtDate(u.sub.paidUntil)}`);
  ['pro','promax'].forEach(k=>{if((u.grants[k]||0)>Date.now())srcs.push(`Quà đổi điểm: ${PLANS[k].name} đến ${fmtDate(u.grants[k])}`)});
  const m=modal(`<h2>Gói của tôi</h2>
   <div class="fitbox" style="margin-top:8px"><div class="top"><div><small class="muted">Đang sử dụng</small><br><b style="font-size:24px">${ueh?'Sinh viên UEH':PLANS[t].name}</b></div>${ueh?'<span class="chip ok">Toàn quyền, miễn phí</span>':''}</div>
    ${ueh?'<p style="margin:0">Email @st.ueh.edu.vn được mở toàn bộ chức năng, không giới hạn Lodestar.</p>':srcs.length?`<ul style="margin:0;padding-left:18px">${srcs.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:'<p style="margin:0">Bạn đang dùng gói Base miễn phí.</p>'}</div>
   <h3 style="margin:16px 0 6px">Lodestar tháng này</h3>
   ${lim===Infinity?'<p class="muted" style="margin:0">Không giới hạn thời gian sử dụng.</p>':`<div class="progress" role="progressbar" aria-valuenow="${Math.round(usageSec(u)/lim*100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${clamp(usageSec(u)/lim*100,0,100)}%"></i></div><p class="muted" style="margin:6px 0 0">Đã dùng ${fmtHM(usageSec(u))} trên ${PLANS[t].limitH} giờ. Còn ${fmtHM(rem)}.</p>`}
   ${u.billing.length?`<h3 style="margin:16px 0 8px">Lịch sử thanh toán</h3><div class="list">${u.billing.map(b=>`<div class="item"><div class="grow"><b>${esc(b.text)}</b><small class="muted" style="display:block">${fmtDate(b.at)} · ${esc(b.note)}</small></div><b>${vnd(b.amount)}</b></div>`).join('')}</div>`:''}
   <div class="modal-actions">${u.sub&&u.sub.paidUntil>Date.now()&&!u.sub.cancelled?`<button type="button" class="btn danger" data-cancel>Hủy gia hạn</button>`:''}<button type="button" class="btn outline" data-close>Đóng</button>${ueh?'':`<button type="button" class="btn orange" data-go="pricing" data-close>Xem bảng giá</button>`}</div>`);
  const c=qs('[data-cancel]',m);
  if(c)c.addEventListener('click',async()=>{if(await confirmBox('Hủy gia hạn gói? Bạn vẫn dùng được đến hết thời hạn đã đăng ký.','Hủy gia hạn',true)){u.sub.cancelled=true;persist('users');closeEl(m);toast('Đã hủy gia hạn. Bạn vẫn dùng gói đến '+fmtDate(u.sub.paidUntil)+'.')}});
}
ACT['my-plan']=()=>openMyPlan();

/* ---------- Trang Bảng giá ---------- */
const PR={period:'month'};
const PLAN_FEATS={
  base:[[1,'Hồ sơ năng lực và phân tích kỹ năng'],[1,'Tìm việc, ứng tuyển, lưu tin'],[1,'Tạo CV online với 5 mẫu'],[1,'Cộng đồng và điểm thưởng'],[1,'Lodestar AI: 5 giờ mỗi tháng'],[0,'Phòng mô phỏng phỏng vấn'],[0,'Đề xuất và đăng ký khóa học'],[0,'Lộ trình 12 tuần']],
  pro:[[1,'Toàn bộ quyền lợi gói Base'],[1,'Lodestar AI: 30 giờ mỗi tháng'],[1,'Phòng mô phỏng phỏng vấn và chấm điểm'],[1,'Đề xuất và đăng ký khóa học'],[0,'Lộ trình 12 tuần cá nhân hóa']],
  promax:[[1,'Toàn bộ quyền lợi gói Pro'],[1,'Lodestar AI không giới hạn'],[1,'Lộ trình 12 tuần cá nhân hóa'],[1,'Mở khóa toàn bộ chức năng hiện có']]
};
const feats=list=>`<ul class="plan-feats">${list.map(([on,t])=>on?`<li class="on"><span aria-hidden="true">✓</span> ${esc(t)}</li>`:`<li class="off"><span aria-hidden="true">—</span> <span class="sr">Không có: </span>${esc(t)}</li>`).join('')}</ul>`;
function renderPricing(){
  const u=me(),st=!!u&&u.role==='student',emp=!!u&&u.role==='employer',ueh=isUEH(u),cur=st?tierOf(u):null,per=PR.period,trial=st&&!ueh&&!u.trialUsed;
  const priceHtml=t=>{
    const p=PLANS[t].price[per];
    if(!p)return `<p class="plan-price"><b>Miễn phí</b></p><p class="muted plan-sub">Dành cho mọi sinh viên</p>`;
    const save=per==='year'?PLANS[t].price.month*12-p:0;
    return `<p class="plan-price"><b>${vnd(p).replace(' VND','')}</b> VND<small>/${per==='year'?'năm':'tháng'}</small></p><p class="muted plan-sub">${per==='year'?`Tiết kiệm ${vnd(save)} so với trả theo tháng`:`Hoặc ${vnd(PLANS[t].price.year)}/năm`}</p>`;
  };
  const cta=t=>{
    if(emp)return `<button type="button" class="btn outline block" disabled>Dành cho sinh viên</button>`;
    if(ueh)return `<button type="button" class="btn registered block" disabled>Đã mở toàn bộ bằng email UEH</button>`;
    if(st&&cur===t)return `<button type="button" class="btn registered block" disabled>Gói hiện tại</button>`;
    if(t==='base')return st?`<button type="button" class="btn outline block" disabled>Đã bao gồm</button>`:`<button type="button" class="btn outline block" data-act="register">Đăng ký miễn phí</button>`;
    if(st&&RANK[cur]>RANK[t])return `<button type="button" class="btn outline block" disabled>Bạn đang dùng gói cao hơn</button>`;
    return `<button type="button" class="btn ${t==='pro'?'orange':'primary'} block" data-act="buy-plan" data-tier="${t}">${trial?'Dùng thử miễn phí tháng đầu':'Nâng cấp lên '+PLANS[t].name}</button>`;
  };
  const planCard=(t,badge)=>`<article class="card plan${badge?' featured':''}">${badge?`<span class="plan-badge">${badge}</span>`:''}<h3>${PLANS[t].name}</h3>${priceHtml(t)}${feats(PLAN_FEATS[t])}${cta(t)}</article>`;
  const ep=emp?u.empPlan:null,promo=emp?(Date.now()<ep.promoUntil&&!ep.promoUsed):true;
  const empCta=p=>emp?`<button type="button" class="btn ${p==='year'?'orange':'primary'} block" data-act="emp-buy" data-period="${p}">Đăng ký gói ${p==='year'?'năm':'tháng'}</button>`:st?`<button type="button" class="btn outline block" disabled>Dành cho doanh nghiệp</button>`:`<button type="button" class="btn ${p==='year'?'orange':'primary'} block" data-act="emp-buy" data-period="${p}">Đăng ký doanh nghiệp</button>`;
  const yes='<td class="on"><span aria-hidden="true">✓</span><span class="sr">Có</span></td>',no='<td class="off"><span aria-hidden="true">—</span><span class="sr">Không</span></td>';
  $('pricingRoot').innerHTML=`
  <div class="topline"><div><small class="eyebrow">BẢNG GIÁ</small><h1>Chọn gói phù hợp với bạn</h1><p class="muted">Dùng thử miễn phí tháng đầu tiên. Thanh toán trong bản demo chỉ mang tính mô phỏng.</p></div></div>
  <div class="card ueh-banner"><div class="ueh-ico" aria-hidden="true">🎓</div><div><h2>Sinh viên UEH được dùng toàn bộ chức năng miễn phí</h2><p class="muted" style="margin:4px 0 0">Đăng ký bằng email <b>tên@st.ueh.edu.vn</b> để mở Lodestar không giới hạn, phòng phỏng vấn, khóa học, lộ trình và các tin tuyển dụng dành riêng cho sinh viên UEH.</p></div>${ueh?'<span class="chip ok">Bạn đang dùng email UEH</span>':`<button type="button" class="btn primary" data-act="${st||emp?'ueh-info':'register'}">${st||emp?'Tìm hiểu thêm':'Đăng ký bằng email UEH'}</button>`}</div>
  <h2 class="section-title" style="margin-top:34px">Dành cho sinh viên ngoài UEH</h2>
  <div class="seg" role="group" aria-label="Chu kỳ thanh toán"><button type="button" data-act="pricing-period" data-p="month" class="${per==='month'?'active':''}" aria-pressed="${per==='month'}">Theo tháng</button><button type="button" data-act="pricing-period" data-p="year" class="${per==='year'?'active':''}" aria-pressed="${per==='year'}">Theo năm</button></div>
  <div class="plan-grid" style="margin-top:16px">${planCard('base')}${planCard('pro','Phổ biến')}${planCard('promax')}</div>
  <p class="notice" style="margin:12px 2px 0">Tin tuyển dụng dành riêng cho sinh viên UEH chỉ mở với email @st.ueh.edu.vn, không mở bằng gói trả phí.</p>
  <div class="card" style="margin-top:20px;overflow:auto"><table class="cmp"><caption class="sr">So sánh các gói dành cho sinh viên</caption><thead><tr><th scope="col">Tính năng</th><th scope="col">Base</th><th scope="col">Pro</th><th scope="col">Pro Max</th><th scope="col">Email UEH</th></tr></thead><tbody>
   <tr><th scope="row">Thời gian dùng Lodestar mỗi tháng</th><td>5 giờ</td><td>30 giờ</td><td>Không giới hạn</td><td>Không giới hạn</td></tr>
   <tr><th scope="row">Hồ sơ, tìm việc, ứng tuyển, tạo CV, cộng đồng</th>${yes}${yes}${yes}${yes}</tr>
   <tr><th scope="row">Phòng mô phỏng phỏng vấn và chấm điểm</th>${no}${yes}${yes}${yes}</tr>
   <tr><th scope="row">Đề xuất và đăng ký khóa học</th>${no}${yes}${yes}${yes}</tr>
   <tr><th scope="row">Lộ trình 12 tuần cá nhân hóa</th>${no}${no}${yes}${yes}</tr>
   <tr><th scope="row">Tin tuyển dụng dành riêng sinh viên UEH</th>${no}${no}${no}${yes}</tr>
   <tr><th scope="row">Giá</th><td>Miễn phí</td><td>${vnd(50000)}/tháng<br>${vnd(500000)}/năm</td><td>${vnd(100000)}/tháng<br>${vnd(1000000)}/năm</td><td>Miễn phí</td></tr></tbody></table></div>
  <h2 class="section-title" style="margin-top:44px">Dành cho doanh nghiệp</h2>
  <div class="card promo"><div class="ueh-ico" aria-hidden="true">🎉</div><div><h3 style="margin:0 0 4px">Ưu đãi doanh nghiệp đăng ký mới</h3><p class="muted" style="margin:0">Miễn phí 6 tháng đầu. Trong năm đầu tiên, gói năm chỉ <b>${vnd(EMP.promoYear)}</b> thay vì ${vnd(EMP.year)}.${emp?(promo?'':' Ưu đãi của tài khoản bạn đã kết thúc.'):''}</p></div></div>
  <div class="plan-grid two" style="margin-top:16px">
   <article class="card plan"><h3>Gói tháng</h3><p class="plan-price"><b>${vnd(EMP.month).replace(' VND','')}</b> VND<small>/tháng</small></p><p class="muted plan-sub">Linh hoạt, không ràng buộc</p>${feats([[1,'Đăng và quản lý tin tuyển dụng'],[1,'Ứng viên xếp hạng theo mức độ phù hợp'],[1,'Đăng tin dành riêng cho sinh viên UEH'],[1,'Chia sẻ tin lên cộng đồng']])}${empCta('month')}</article>
   <article class="card plan featured"><span class="plan-badge">Tiết kiệm nhất</span><h3>Gói năm</h3><p class="plan-price">${promo?`<s>${vnd(EMP.year).replace(' VND','')}</s> `:''}<b>${vnd(promo?EMP.promoYear:EMP.year).replace(' VND','')}</b> VND<small>/năm</small></p><p class="muted plan-sub">${promo?'Ưu đãi năm đầu tiên':`Tiết kiệm ${vnd(EMP.month*12-EMP.year)} so với trả theo tháng`}</p>${feats([[1,'Toàn bộ quyền lợi gói tháng'],[1,'Ưu tiên hỗ trợ qua hotline'],[1,'Giá cố định trong 12 tháng']])}${empCta('year')}</article>
  </div>
  <div class="card contact-card"><div><h3 style="margin:0 0 4px">Cần tư vấn gói doanh nghiệp?</h3><p class="muted" style="margin:0">Gọi hotline để được hỗ trợ đăng ký, xuất hóa đơn VAT hoặc chọn gói phù hợp.</p></div><a class="btn primary" href="tel:${HOTLINE.raw}">📞 Hotline ${HOTLINE.text}</a></div>
  <div class="band faq"><h2 class="section-title">Câu hỏi về gói dịch vụ</h2>
   <details><summary>Miễn phí tháng đầu tiên hoạt động thế nào?</summary><p>Lần nâng cấp đầu tiên của mỗi tài khoản sinh viên được dùng thử 30 ngày trước khi tính phí. Bạn có thể hủy gia hạn trong mục Gói của tôi.</p></details>
   <details><summary>Điểm thưởng đổi được gì?</summary><p>Bạn đổi điểm lấy voucher của các doanh nghiệp tuyển dụng hoặc 1, 2, 5, 7, 12 tháng gói Pro và Pro Max. Mức đổi cao nhất là 1.000 điểm. Xem chi tiết ở mục Điểm thưởng.</p></details>
   <details><summary>Vì sao gói trả phí không mở tin dành riêng cho sinh viên UEH?</summary><p>Những tin này do doanh nghiệp đăng riêng cho sinh viên UEH nên chỉ hiển thị với tài khoản dùng email @st.ueh.edu.vn.</p></details>
   <details><summary>Thanh toán có thật không?</summary><p>Chưa. Đây là bản demo nên giao dịch chỉ được mô phỏng, hệ thống không thu tiền và không lưu thông tin thẻ.</p></details>
  </div>`;
}
RENDER.pricing=renderPricing;
ACT['pricing-period']=t=>{PR.period=t.dataset.p;renderPricing()};

/* ---------- Điểm thưởng ---------- */
const EARN={
  login:{pts:5,cap:1,text:'Đăng nhập hằng ngày'},
  post:{pts:10,cap:3,text:'Đăng bài trong cộng đồng'},
  comment:{pts:2,cap:5,text:'Bình luận'},
  apply:{pts:10,cap:3,text:'Ứng tuyển việc làm'},
  interview:{pts:5,cap:4,text:'Luyện phỏng vấn có chấm điểm'},
  p50:{pts:20,once:true,text:'Hồ sơ đạt 50%'},
  p80:{pts:30,once:true,text:'Hồ sơ đạt 80%'},
  p100:{pts:50,once:true,text:'Hồ sơ đạt 100%'},
  cv:{pts:20,once:true,text:'Tạo CV đầu tiên'}
};
const REDEEM_PLAN={pro:{1:50,2:100,5:250,7:350,12:500},promax:{1:100,2:200,5:500,7:700,12:1000}};
const MAX_POINTS=1000;
const VOUCHERS=[
  {id:'v1',brand:'Orbit Logistics',title:'Giảm 20% phí vận chuyển',cost:80,icon:'🚚'},
  {id:'v2',brand:'Nova Retail',title:'Giảm 10% hóa đơn mua sắm',cost:100,icon:'🛍️'},
  {id:'v3',brand:'GreenLeaf Foods',title:'Giảm 15% thực phẩm sạch',cost:120,icon:'🥬'},
  {id:'v4',brand:'Maven Commerce',title:'Giảm 50.000 VND cho đơn từ 300.000 VND',cost:150,icon:'📦'},
  {id:'v5',brand:'Saigon EduTech',title:'Giảm 20% khóa học trực tuyến',cost:200,icon:'🎓'},
  {id:'v6',brand:'PixelWorks Studio',title:'Giảm 25% dịch vụ thiết kế',cost:250,icon:'🎨'}
];
function award(key){
  const u=me(),r=EARN[key];if(!u||u.role!=='student'||!r)return 0;
  const today=dayKey();if(!u.daily||u.daily.d!==today)u.daily={d:today,c:{}};
  if(r.once){if(u.once.includes(key))return 0;u.once.push(key)}
  else{if((u.daily.c[key]||0)>=r.cap)return 0;u.daily.c[key]=(u.daily.c[key]||0)+1}
  u.points+=r.pts;u.pointLog.unshift({at:Date.now(),text:r.text,pts:r.pts});if(u.pointLog.length>40)u.pointLog.length=40;
  persist('users');renderNav();toast(`+${r.pts} điểm thưởng · ${r.text}`,'pts');
  if(view==='rewards')renderRewards();
  return r.pts;
}
function checkMilestones(){
  const u=me();if(!u||u.role!=='student')return;
  const pct=completeness(u.profile).pct;
  if(pct>=50)award('p50');if(pct>=80)award('p80');if(pct>=100)award('p100');
}
function renderRewards(){
  const u=me();if(!u||u.role!=='student')return;
  const ueh=isUEH(u),pts=u.points,today=dayKey(),dc=(u.daily&&u.daily.d===today)?u.daily.c:{};
  const planCost=(tier)=>Object.entries(REDEEM_PLAN[tier]).map(([mo,c])=>`<div class="redeem"><b>${mo} tháng</b><span>${c} điểm</span><button type="button" class="btn ${pts>=c&&!ueh?'orange':'outline'} sm" data-act="redeem-plan" data-tier="${tier}" data-m="${mo}" ${pts<c||ueh?'disabled':''}>${ueh?'Đã toàn quyền':pts>=c?'Đổi':'Thiếu '+(c-pts)}</button></div>`).join('');
  $('rewardsRoot').innerHTML=`
  <div class="topline"><div><small class="eyebrow">ĐIỂM THƯỞNG</small><h1>Điểm thưởng của bạn</h1><p class="muted">Tích điểm khi hoạt động trên nền tảng, đổi lấy voucher của doanh nghiệp hoặc miễn phí gói Pro, Pro Max. 1 điểm tương đương 1.000 VND giá trị gói.</p></div></div>
  <div class="two" style="margin-top:0">
   <div class="card"><small class="muted">Số dư hiện tại</small><p class="big-num" style="margin:4px 0 10px">${pts} <span style="font-size:18px;color:var(--mut);font-weight:700">điểm</span></p>
    <div class="progress" role="progressbar" aria-label="Tiến độ tới mốc đổi tối đa" aria-valuenow="${Math.min(pts,MAX_POINTS)}" aria-valuemin="0" aria-valuemax="${MAX_POINTS}"><i style="width:${clamp(pts/MAX_POINTS*100,0,100)}%"></i></div>
    <p class="notice" style="margin:8px 0 0">Mốc đổi thưởng cao nhất là ${MAX_POINTS} điểm (12 tháng Pro Max).</p></div>
   <div class="card"><h3>Cách kiếm điểm</h3><table class="cmp earn"><tbody>${Object.entries(EARN).map(([k,r])=>`<tr><th scope="row">${esc(r.text)}</th><td><b>+${r.pts}</b></td><td class="muted">${r.once?(u.once.includes(k)?'Đã nhận':'Một lần'):`${dc[k]||0}/${r.cap} hôm nay`}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <h2 class="section-title" style="margin-top:32px">Đổi gói Pro và Pro Max</h2>
  ${ueh?`<div class="info-box" style="margin-bottom:12px">Tài khoản email UEH đã được mở toàn bộ chức năng nên không cần đổi gói. Bạn vẫn đổi được voucher bên dưới.</div>`:''}
  <div class="two" style="margin-top:0"><div class="card"><h3>Gói Pro</h3><div class="redeem-list">${planCost('pro')}</div></div><div class="card"><h3>Gói Pro Max</h3><div class="redeem-list">${planCost('promax')}</div></div></div>
  <h2 class="section-title" style="margin-top:32px">Voucher từ doanh nghiệp tuyển dụng</h2>
  <div class="grid3">${VOUCHERS.map(v=>`<article class="card voucher"><div class="ico" aria-hidden="true">${v.icon}</div><small class="muted">${esc(v.brand)}</small><h3>${esc(v.title)}</h3><div class="side-row"><b>${v.cost} điểm</b><button type="button" class="btn ${pts>=v.cost?'orange':'outline'} sm" data-act="redeem-voucher" data-id="${v.id}" ${pts<v.cost?'disabled':''}>${pts>=v.cost?'Đổi':'Thiếu '+(v.cost-pts)}</button></div></article>`).join('')}</div>
  <p class="notice" style="margin:10px 2px 0">Voucher là dữ liệu minh họa của các doanh nghiệp mẫu trong bản demo.</p>
  <div class="two"><div class="card"><h3>Ví voucher của tôi</h3>${u.vouchers.length?`<div class="list">${u.vouchers.map(v=>`<div class="item"><div class="grow"><b>${esc(v.brand)}: ${esc(v.title)}</b><small class="muted" style="display:block">Mã <b>${esc(v.code)}</b> · hết hạn ${fmtDate(v.exp)}</small></div><button type="button" class="btn outline sm" data-act="copy-code" data-code="${esc(v.code)}">Sao chép</button></div>`).join('')}</div>`:'<p class="muted">Bạn chưa đổi voucher nào.</p>'}</div>
   <div class="card"><h3>Lịch sử điểm</h3>${u.pointLog.length?`<div class="list">${u.pointLog.slice(0,10).map(l=>`<div class="item side-row" style="align-items:center"><span><b>${esc(l.text)}</b><small class="muted" style="display:block">${ago(l.at)}</small></span><b style="color:${l.pts>0?'var(--ok)':'var(--bad)'}">${l.pts>0?'+':''}${l.pts}</b></div>`).join('')}</div>`:'<p class="muted">Chưa có hoạt động nào.</p>'}</div></div>`;
}
RENDER.rewards=renderRewards;
ACT['go-rewards']=()=>{closeDropdown();go('rewards')};
ACT['redeem-plan']=async t=>{
  const u=me(),tier=t.dataset.tier,mo=+t.dataset.m,cost=REDEEM_PLAN[tier][mo];
  if(!u||u.points<cost)return;
  if(!await confirmBox(`Đổi ${cost} điểm lấy ${mo} tháng gói ${PLANS[tier].name}?`,'Đổi điểm'))return;
  if(u.points<cost)return;
  u.points-=cost;u.grants[tier]=addMonths(Math.max(Date.now(),u.grants[tier]||0),mo);
  u.pointLog.unshift({at:Date.now(),text:`Đổi ${mo} tháng ${PLANS[tier].name}`,pts:-cost});
  persist('users');notify(u.id,`Bạn đã đổi ${mo} tháng gói ${PLANS[tier].name}, dùng được đến ${fmtDate(u.grants[tier])}.`);
  toast(`Đã đổi ${mo} tháng gói ${PLANS[tier].name}, dùng đến ${fmtDate(u.grants[tier])}.`);renderNav();renderRewards();
};
ACT['redeem-voucher']=async t=>{
  const u=me(),v=VOUCHERS.find(x=>x.id===t.dataset.id);if(!u||!v||u.points<v.cost)return;
  if(!await confirmBox(`Đổi ${v.cost} điểm lấy voucher "${v.title}" của ${v.brand}?`,'Đổi điểm'))return;
  if(u.points<v.cost)return;
  const rnd=()=>Math.random().toString(36).slice(2,6).toUpperCase();
  u.points-=v.cost;u.vouchers.unshift({id:uid(),brand:v.brand,title:v.title,code:`UEH-${rnd()}-${rnd()}`,exp:Date.now()+90*DAY,at:Date.now()});
  u.pointLog.unshift({at:Date.now(),text:`Đổi voucher ${v.brand}`,pts:-v.cost});
  persist('users');toast('Đã đổi voucher. Mã nằm trong Ví voucher của bạn.');renderNav();renderRewards();
};
ACT['copy-code']=async t=>{try{await navigator.clipboard.writeText(t.dataset.code);toast('Đã sao chép mã voucher.')}catch(e){toast('Không thể sao chép tự động. Hãy chọn và sao chép mã thủ công.','warn')}};

/* ---------- Giao diện (màu nền) ---------- */
const THEMES=[{id:'light',name:'Sáng',sw:'#f6f9f8'},{id:'dark',name:'Tối',sw:'#0e1a1c'},{id:'warm',name:'Kem ấm',sw:'#f8f2e8'},{id:'mint',name:'Xanh mint',sw:'#dff1ec'}];
const curTheme=()=>document.documentElement.dataset.theme||'light';
function applyTheme(t){
  if(!THEMES.some(x=>x.id===t))t='light';
  document.documentElement.dataset.theme=t;store.set('theme',t);
}
ACT['theme-menu']=t=>{
  const cur=curTheme();
  openDropdown('theme',t,`<div class="dh"><b>Màu nền</b><small>Lưu trên thiết bị này</small></div>${THEMES.map(x=>`<button type="button" class="mi" role="menuitemradio" aria-checked="${x.id===cur}" data-act="set-theme" data-t="${x.id}"><span class="swatch" style="background:${x.sw}"></span>${x.name}${x.id===cur?'<span style="margin-left:auto">✓</span>':''}</button>`).join('')}`);
};
ACT['set-theme']=t=>{applyTheme(t.dataset.t);closeDropdown();toast('Đã đổi màu nền: '+THEMES.find(x=>x.id===t.dataset.t).name+'.')};

/* =====================================================================
   Tạo CV online: mẫu có sẵn, chỉnh sửa nội dung và thiết kế, xem trước trực tiếp
   ===================================================================== */
const CV_TPL=[
  {id:'classic',name:'Cổ điển',desc:'Một cột, tiêu đề có đường kẻ, dễ đọc',layout:'single'},
  {id:'modern',name:'Hiện đại',desc:'Cột màu bên trái chứa ảnh, liên hệ và kỹ năng',layout:'side'},
  {id:'minimal',name:'Tối giản',desc:'Nhiều khoảng trắng, tiêu đề nhỏ gọn',layout:'single'},
  {id:'creative',name:'Sáng tạo',desc:'Banner màu ở đầu trang, hai cột nội dung',layout:'banner'},
  {id:'ats',name:'ATS gọn',desc:'Chữ đen, không hình, tối ưu cho hệ thống lọc CV',layout:'single'}
];
const CV_COLORS=['#006b70','#bd5514','#1f4e9c','#7a3e9d','#2f7d4f','#b3261e','#374151','#0f766e'];
const CV_FONTS={sans:{name:'Không chân',css:'Inter,system-ui,"Segoe UI",Roboto,Arial,sans-serif'},serif:{name:'Có chân',css:'Georgia,"Times New Roman",serif'},round:{name:'Mềm mại',css:'"Trebuchet MS","Segoe UI",Candara,sans-serif'}};
const CV_SEC={summary:'Giới thiệu',experience:'Kinh nghiệm',education:'Học vấn',projects:'Dự án',skills:'Kỹ năng',certs:'Chứng chỉ',languages:'Ngôn ngữ',activities:'Hoạt động'};
const CV_ORDER=['summary','experience','education','projects','skills','certs','languages','activities'];
const CV_SIDE=['skills','languages','certs'];
const CV_SCHEMA={
  experience:{add:'Thêm kinh nghiệm',blank:'Kinh nghiệm mới',key:'role',fields:[['role','Vị trí'],['company','Công ty / tổ chức'],['from','Từ (ví dụ 06/2025)'],['to','Đến (bỏ trống nếu đang làm)'],['desc','Mô tả, mỗi dòng một ý','textarea']]},
  education:{add:'Thêm học vấn',blank:'Học vấn mới',key:'school',fields:[['school','Trường'],['degree','Ngành / bằng cấp'],['from','Từ'],['to','Đến'],['note','Ghi chú (GPA, học bổng)','textarea']]},
  projects:{add:'Thêm dự án',blank:'Dự án mới',key:'name',fields:[['name','Tên dự án'],['role','Vai trò / công nghệ'],['desc','Mô tả, mỗi dòng một ý','textarea']]},
  certs:{add:'Thêm chứng chỉ',blank:'Chứng chỉ mới',key:'name',fields:[['name','Tên chứng chỉ'],['year','Năm']]},
  languages:{add:'Thêm ngôn ngữ',blank:'Ngôn ngữ mới',key:'name',fields:[['name','Ngôn ngữ'],['level','Trình độ','select',['Cơ bản','Trung cấp','Thành thạo','Bản ngữ']]]},
  activities:{add:'Thêm hoạt động',blank:'Hoạt động mới',key:'title',fields:[['title','Hoạt động / vai trò'],['org','Tổ chức'],['from','Từ'],['to','Đến'],['desc','Mô tả','textarea']]}
};
const CVS={id:null,tab:'content',open:new Set(['basics']),saveT:null,status:'Đã lưu'};
const curCV=()=>{const u=me();return u&&u.cvs?u.cvs.find(c=>c.id===CVS.id)||null:null};
const safeColor=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:'#006b70';
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const bullets=t=>String(t||'').split(/\n+/).map(x=>x.replace(/^\s*[-•*]\s*/,'').trim()).filter(Boolean);
const dateRange=(a,b)=>a&&b?`${a} - ${b}`:a?`${a} - Hiện tại`:(b||'');

function cvFromProfile(u){
  const p=u.profile||{};
  return{fullName:u.name,title:p.targetRole||'',email:u.email,phone:'',address:'',website:'',summary:p.bio||'',
    experience:(p.internships||[]).map(x=>({id:uid(),role:x.role,company:x.company,from:fmtMonth(x.from),to:fmtMonth(x.to),desc:''})),
    education:p.school?[{id:uid(),school:p.school,degree:p.major||'',from:'',to:p.gradYear||'',note:p.gpa?`GPA ${Number(p.gpa).toFixed(2)}/4.00`:''}]:[],
    projects:(p.projects||[]).map(x=>({id:uid(),name:x.name,role:'',desc:x.desc||''})),
    skills:[...(p.hardSkills||[]),...(p.softSkills||[])],
    certs:(p.certs||[]).map(x=>({id:uid(),name:x.name,year:x.year||''})),languages:[],activities:[]};
}
function sampleData(u){
  const d=cvFromProfile(u);
  if(!d.summary)d.summary='Sinh viên năm cuối định hướng phân tích nghiệp vụ, có nền tảng về dữ liệu và làm việc nhóm, mong muốn đóng góp trong môi trường thực tế.';
  if(!d.experience.length)d.experience=[{id:'s1',role:'Thực tập sinh',company:'Công ty mẫu',from:'06/2025',to:'09/2025',desc:'Hỗ trợ lập báo cáo tuần, giảm 20% thời gian tổng hợp số liệu\nPhối hợp cùng nhóm sản phẩm trong 3 dự án'}];
  if(!d.education.length)d.education=[{id:'s2',school:'Đại học Kinh tế TP.HCM',degree:'Kinh doanh',from:'2022',to:'2026',note:'GPA 3.4/4.0'}];
  if(!d.skills.length)d.skills=['Excel','SQL','Thuyết trình','Làm việc nhóm','Power BI'];
  if(!d.languages.length)d.languages=[{id:'s3',name:'Tiếng Anh',level:'Trung cấp'}];
  if(!d.phone)d.phone='0900 000 000';
  return d;
}
function newCV(u,tpl,data){
  const n=(u.cvs||[]).length+1;
  return{id:uid(),name:`CV ${n}`,tpl,color:CV_COLORS[0],font:tpl==='classic'?'serif':'sans',size:'m',showPhoto:true,photo:null,order:[...CV_ORDER],hidden:{},data:data||cvFromProfile(u),updated:Date.now()};
}

/* ---------- Hiển thị tờ CV (dùng chung cho xem trước, ảnh thu nhỏ và in) ---------- */
const secHas=(cv,k)=>{const d=cv.data;return k==='summary'?!!(d.summary||'').trim():(d[k]||[]).length>0};
function cvSec(cv,k){
  const d=cv.data,ats=cv.tpl==='ats';let body='';
  const item=(a,b,c,desc)=>`<div class="cvp-item"><div class="cvp-row"><b>${esc(a)}</b><span class="cvp-date">${esc(b)}</span></div>${c?`<div class="cvp-sub">${esc(c)}</div>`:''}${desc}</div>`;
  const bl=t=>{const l=bullets(t);return l.length>1?`<ul>${l.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:l.length?`<p>${esc(l[0])}</p>`:''};
  if(k==='summary')body=`<p>${esc(d.summary)}</p>`;
  else if(k==='experience')body=d.experience.map(x=>item(x.role,dateRange(x.from,x.to),x.company,bl(x.desc))).join('');
  else if(k==='education')body=d.education.map(x=>item(x.school,dateRange(x.from,x.to),x.degree,bl(x.note))).join('');
  else if(k==='projects')body=d.projects.map(x=>item(x.name,'',x.role,bl(x.desc))).join('');
  else if(k==='activities')body=d.activities.map(x=>item(x.title,dateRange(x.from,x.to),x.org,bl(x.desc))).join('');
  else if(k==='skills')body=ats?`<p>${esc(d.skills.join(', '))}</p>`:`<div class="cvp-tags">${d.skills.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`;
  else if(k==='certs')body=`<ul class="cvp-plain">${d.certs.map(x=>`<li>${esc(x.name)}${x.year?` <span class="cvp-date">(${esc(x.year)})</span>`:''}</li>`).join('')}</ul>`;
  else if(k==='languages')body=`<ul class="cvp-plain">${d.languages.map(x=>`<li>${esc(x.name)}${x.level?`: ${esc(x.level)}`:''}</li>`).join('')}</ul>`;
  return `<section class="cvp-sec cvp-${k}"><h3>${CV_SEC[k]}</h3>${body}</section>`;
}
function cvPaper(cv){
  const d=cv.data,tpl=CV_TPL.find(t=>t.id===cv.tpl)||CV_TPL[0],accent=safeColor(cv.color),[r,g,b]=hexRgb(accent);
  const style=`--cv-accent:${accent};--cv-soft:rgba(${r},${g},${b},.13);--cv-font:${(CV_FONTS[cv.font]||CV_FONTS.sans).css};--cv-fs:${{s:12.5,m:13.5,l:14.5}[cv.size]||13.5}px`;
  const hidden=cv.hidden||{},secs=cv.order.filter(k=>!hidden[k]&&secHas(cv,k));
  const photo=cv.showPhoto&&cv.photo&&cv.tpl!=='ats'?`<img class="cvp-photo" src="${cv.photo}" alt="">`:'';
  const contact=[d.email,d.phone,d.address,d.website].filter(Boolean);
  const contactH=`<div class="cvp-contact">${contact.map(c=>`<span>${esc(c)}</span>`).join('')}</div>`;
  const name=`<h1>${esc(d.fullName||'Họ và tên')}</h1>${d.title?`<div class="cvp-title">${esc(d.title)}</div>`:''}`;
  let inner;
  if(tpl.layout==='side'){
    inner=`<aside class="cvp-side">${photo}${name}${contactH}${secs.filter(k=>CV_SIDE.includes(k)).map(k=>cvSec(cv,k)).join('')}</aside><main class="cvp-main">${secs.filter(k=>!CV_SIDE.includes(k)).map(k=>cvSec(cv,k)).join('')}</main>`;
  }else if(tpl.layout==='banner'){
    inner=`<header class="cvp-banner">${photo}<div class="cvp-bn">${name}${contactH}</div></header><div class="cvp-cols"><aside>${secs.filter(k=>CV_SIDE.includes(k)).map(k=>cvSec(cv,k)).join('')}</aside><main>${secs.filter(k=>!CV_SIDE.includes(k)).map(k=>cvSec(cv,k)).join('')}</main></div>`;
  }else{
    inner=`<header class="cvp-head">${photo}<div>${name}</div>${contactH}</header>${secs.map(k=>cvSec(cv,k)).join('')}`;
  }
  return `<div class="cv cv-${tpl.id} cv-${tpl.layout}" style="${style}">${inner}</div>`;
}

/* ---------- Ảnh: nén trước khi lưu (dùng cho CV và cộng đồng) ---------- */
function compressImage(file,{max=1000,q=.72,square=false,limit=260000}={}){
  return new Promise((res,rej)=>{
    if(!/^image\//.test(file.type)){rej(new Error('type'));return}
    if(file.size>12*1048576){rej(new Error('big'));return}
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let sw=img.naturalWidth,sh=img.naturalHeight,sx=0,sy=0;
      if(square){const s=Math.min(sw,sh);sx=(sw-s)/2;sy=(sh-s)/2;sw=sh=s}
      const k=Math.min(1,max/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*k)),h=Math.max(1,Math.round(sh*k));
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,sx,sy,sw,sh,0,0,w,h);
      let qq=q,out=c.toDataURL('image/jpeg',qq);
      while(out.length>limit&&qq>.35){qq-=.1;out=c.toDataURL('image/jpeg',qq)}
      res(out);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('decode'))};
    img.src=url;
  });
}

/* ---------- Danh sách CV ---------- */
function renderCV(){
  const u=me();if(!u||u.role!=='student')return;
  if(CVS.id&&curCV())return renderEditor();
  CVS.id=null;
  const gal=CV_TPL.map(t=>{const c=newCV(u,t.id,sampleData(u));return `<article class="card cv-card"><div class="cv-thumb" aria-hidden="true"><div class="cv-thumb-in">${cvPaper(c)}</div></div><h3>${t.name}</h3><p class="muted" style="margin:0 0 12px;font-size:14px">${t.desc}</p><button type="button" class="btn orange block" data-act="cv-new" data-t="${t.id}">Dùng mẫu này</button></article>`}).join('');
  $('cvRoot').innerHTML=`
  <div class="topline"><div><small class="eyebrow">TẠO CV ONLINE</small><h1>Thiết kế CV của bạn</h1><p class="muted">Chọn một mẫu có sẵn, chỉnh nội dung và màu sắc, xem trước ngay và tải PDF. Nội dung được điền tự động từ hồ sơ của bạn.</p></div></div>
  ${u.cvs.length?`<h2 class="section-title">CV của tôi</h2><div class="cv-cards">${u.cvs.map(c=>`<article class="card cv-card"><div class="cv-thumb" aria-hidden="true"><div class="cv-thumb-in">${cvPaper(c)}</div></div><h3>${esc(c.name)}</h3><p class="muted" style="margin:0 0 12px;font-size:14px">Mẫu ${esc(CV_TPL.find(t=>t.id===c.tpl)?.name||'')} · sửa ${ago(c.updated)}</p><div class="cv-card-acts"><button type="button" class="btn primary sm" data-act="cv-edit" data-id="${c.id}">Chỉnh sửa</button><button type="button" class="btn outline sm" data-act="cv-dup" data-id="${c.id}">Nhân bản</button><button type="button" class="btn danger sm" data-act="cv-del" data-id="${c.id}">Xóa</button></div></article>`).join('')}</div>`:''}
  <h2 class="section-title" style="margin-top:${u.cvs.length?'36':'0'}px">Mẫu CV có sẵn</h2><p class="section-sub">Mẫu xem trước dùng dữ liệu từ hồ sơ của bạn, phần còn trống được điền ví dụ.</p>
  <div class="cv-cards">${gal}</div>`;
  fitThumbs();
}
function fitThumbs(){
  qsa('.cv-thumb').forEach(t=>{const k=t.clientWidth/794,i=t.firstElementChild;if(k>0)i.style.transform=`scale(${k})`});
}
ACT['cv-new']=t=>{
  const u=me();if(!u)return;
  const c=newCV(u,t.dataset.t);u.cvs.unshift(c);CVS.id=c.id;CVS.tab='content';CVS.open=new Set(['basics']);
  if(persist('users'))award('cv');
  renderCV();window.scrollTo(0,0);
};
ACT['cv-edit']=t=>{CVS.id=t.dataset.id;CVS.tab='content';CVS.open=new Set(['basics']);renderCV();window.scrollTo(0,0)};
ACT['cv-dup']=t=>{
  const u=me(),c=u.cvs.find(x=>x.id===t.dataset.id);if(!c)return;
  const n=JSON.parse(JSON.stringify(c));n.id=uid();n.name=c.name+' (bản sao)';n.updated=Date.now();u.cvs.unshift(n);persist('users');renderCV();toast('Đã nhân bản CV.');
};
ACT['cv-del']=async t=>{
  const u=me();if(!await confirmBox('Xóa CV này? Thao tác không thể hoàn tác.','Xóa CV',true))return;
  u.cvs=u.cvs.filter(c=>c.id!==t.dataset.id);persist('users');renderCV();toast('Đã xóa CV.');
};
ACT['cv-back']=()=>{flushSave();CVS.id=null;renderCV();window.scrollTo(0,0)};

/* ---------- Trình chỉnh sửa ---------- */
function renderEditor(){
  const cv=curCV();
  $('cvRoot').innerHTML=`
  <div class="cv-bar">
    <button type="button" class="btn ghost sm" data-act="cv-back">‹ Danh sách CV</button>
    <input class="cv-name" data-cvname value="${esc(cv.name)}" maxlength="60" aria-label="Tên CV">
    <span class="muted" id="cvStatus" role="status">${esc(CVS.status)}</span>
    <span style="flex:1"></span>
    <button type="button" class="btn outline sm" data-act="cv-sync">Đồng bộ từ hồ sơ</button>
    <button type="button" class="btn orange sm" data-act="cv-print">⬇ Tải PDF</button>
  </div>
  <div class="cv-editor">
    <div class="card cv-panel">
      <div class="seg" role="group" aria-label="Khu vực chỉnh sửa">${[['content','Nội dung'],['design','Thiết kế'],['check','Kiểm tra']].map(([k,l])=>`<button type="button" data-act="cv-tab" data-k="${k}" class="${CVS.tab===k?'active':''}" aria-pressed="${CVS.tab===k}">${l}</button>`).join('')}</div>
      <div id="cvPanelBody"></div>
    </div>
    <div class="cv-stage" id="cvStage"><div class="cv-stage-in" id="cvStageIn"><div class="cv-scaler" id="cvScaler"></div></div></div>
  </div>
  <input type="file" id="cvPhotoInput" class="hide" accept="image/*">`;
  renderPanel();renderPaper();
}
function renderPaper(){
  const cv=curCV(),sc=$('cvScaler');if(!cv||!sc)return;
  sc.innerHTML=cvPaper(cv);fitPreview();
  if(CVS.tab==='check')renderChecks();
}
function fitPreview(){
  const st=$('cvStage'),sc=$('cvScaler'),si=$('cvStageIn');if(!st||!sc)return;
  const cs=getComputedStyle(st),padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
  const avail=st.clientWidth-padX-6;
  const k=Math.min(1,avail/794)||1;
  sc.style.transform=`scale(${k})`;si.style.height=Math.ceil(sc.offsetHeight*k)+'px';si.style.width=Math.ceil(794*k)+'px';
}
window.addEventListener('resize',()=>{if(view==='cv'){fitPreview();fitThumbs()}});
function scheduleSave(){
  const cv=curCV();if(!cv)return;
  cv.updated=Date.now();CVS.status='Đang lưu...';const s=$('cvStatus');if(s)s.textContent=CVS.status;
  clearTimeout(CVS.saveT);
  CVS.saveT=setTimeout(()=>{persist('users');CVS.status='Đã lưu';const s2=$('cvStatus');if(s2)s2.textContent=CVS.status;CVS.saveT=null},600);
}
function flushSave(){if(CVS.saveT){clearTimeout(CVS.saveT);CVS.saveT=null;persist('users');CVS.status='Đã lưu'}}
const fld=(label,attrs,val,type,opts)=>{
  const id='cf'+Math.random().toString(36).slice(2,7);
  const ctl=type==='textarea'?`<textarea id="${id}" rows="3" ${attrs}>${esc(val)}</textarea>`
    :type==='select'?`<select id="${id}" ${attrs}>${opts.map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`
    :`<input id="${id}" ${attrs} value="${esc(val)}" autocomplete="off">`;
  return `<div class="field"><label for="${id}">${esc(label)}</label>${ctl}</div>`;
};
function panelContent(cv){
  const d=cv.data;
  if(CVS.tab==='design'){
    return `<h3 class="cv-h">Mẫu CV</h3><div class="cv-tplgrid">${CV_TPL.map(t=>{const c={...cv,tpl:t.id};return `<button type="button" class="cv-tplbtn ${cv.tpl===t.id?'on':''}" data-act="cv-tpl" data-t="${t.id}" aria-pressed="${cv.tpl===t.id}"><div class="cv-thumb" aria-hidden="true"><div class="cv-thumb-in">${cvPaper(c)}</div></div><span>${t.name}</span></button>`}).join('')}</div>
    <h3 class="cv-h">Màu nhấn</h3><div class="cv-swatches">${CV_COLORS.map(c=>`<button type="button" class="cv-sw ${safeColor(cv.color)===c?'on':''}" style="background:${c}" data-act="cv-color" data-c="${c}" aria-label="Màu ${c}" aria-pressed="${safeColor(cv.color)===c}"></button>`).join('')}<label class="cv-sw custom" title="Chọn màu khác"><input type="color" data-cvset="color" value="${safeColor(cv.color)}" aria-label="Chọn màu tùy chỉnh"></label></div>
    <h3 class="cv-h">Phông chữ</h3><div class="seg" role="group" aria-label="Phông chữ">${Object.entries(CV_FONTS).map(([k,f])=>`<button type="button" data-act="cv-font" data-k="${k}" class="${cv.font===k?'active':''}" aria-pressed="${cv.font===k}">${f.name}</button>`).join('')}</div>
    <h3 class="cv-h">Cỡ chữ</h3><div class="seg" role="group" aria-label="Cỡ chữ">${[['s','Nhỏ'],['m','Vừa'],['l','Lớn']].map(([k,l])=>`<button type="button" data-act="cv-size" data-k="${k}" class="${cv.size===k?'active':''}" aria-pressed="${cv.size===k}">${l}</button>`).join('')}</div>
    <h3 class="cv-h">Ảnh đại diện</h3><label class="inline-check"><input type="checkbox" data-cvset="showPhoto" ${cv.showPhoto?'checked':''}> Hiện ảnh trên CV (mẫu ATS không dùng ảnh)</label>
    <div class="cv-photo-row">${cv.photo?`<img src="${cv.photo}" alt="Ảnh đại diện hiện tại" class="cv-photo-prev">`:''}<button type="button" class="btn outline sm" data-act="cv-photo">${cv.photo?'Đổi ảnh':'Tải ảnh lên'}</button>${cv.photo?`<button type="button" class="btn ghost sm" data-act="cv-photo-del">Xóa ảnh</button>`:''}</div>`;
  }
  if(CVS.tab==='check')return `<div id="cvChecks"></div>`;
  const basics=`<section class="cv-sec"><div class="cv-sec-h"><button type="button" class="cv-sec-t" data-act="cv-open" data-k="basics" aria-expanded="${CVS.open.has('basics')}">Thông tin cá nhân</button></div><div class="cv-sec-b ${CVS.open.has('basics')?'':'hide'}">
    ${fld('Họ và tên','data-f="fullName" maxlength="80"',d.fullName)}${fld('Chức danh mục tiêu','data-f="title" maxlength="80"',d.title)}
    <div class="row2">${fld('Email','data-f="email" type="email" maxlength="80"',d.email)}${fld('Số điện thoại','data-f="phone" maxlength="30"',d.phone)}</div>
    <div class="row2">${fld('Địa chỉ','data-f="address" maxlength="80"',d.address)}${fld('Website / LinkedIn','data-f="website" maxlength="80"',d.website)}</div></div></section>`;
  return basics+cv.order.map((k,idx)=>{
    const open=CVS.open.has(k),sch=CV_SCHEMA[k];let body='';
    if(k==='summary')body=fld('Giới thiệu bản thân','data-f="summary" maxlength="600" rows="5"',d.summary,'textarea');
    else if(k==='skills')body=`<div class="chips" style="margin-bottom:10px">${d.skills.map((s,i)=>`<span class="chip">${esc(s)}<button type="button" data-act="cv-skill-del" data-i="${i}" aria-label="Xóa ${esc(s)}">×</button></span>`).join('')||'<span class="muted">Chưa có kỹ năng.</span>'}</div><div class="field"><label for="cvSkillIn">Thêm kỹ năng (Enter để thêm, có thể nhập nhiều, cách nhau bằng dấu phẩy)</label><input id="cvSkillIn" list="skillList" maxlength="120" autocomplete="off"></div>`;
    else body=d[k].map((it,i)=>`<div class="cv-item"><div class="cv-item-h"><b>${esc(it[sch.key]||sch.blank)}</b><span><button type="button" class="icon-btn" data-act="cv-move-item" data-k="${k}" data-i="${i}" data-d="-1" aria-label="Lên" ${i===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-act="cv-move-item" data-k="${k}" data-i="${i}" data-d="1" aria-label="Xuống" ${i===d[k].length-1?'disabled':''}>↓</button><button type="button" class="icon-btn del" data-act="cv-del-item" data-k="${k}" data-i="${i}" aria-label="Xóa mục">×</button></span></div>${sch.fields.map(([f,l,t,o])=>fld(l,`data-sec="${k}" data-i="${i}" data-f="${f}" maxlength="400"`,it[f]||'',t,o)).join('')}</div>`).join('')+`<button type="button" class="btn outline sm" data-act="cv-add" data-k="${k}">+ ${sch.add}</button>`;
    return `<section class="cv-sec"><div class="cv-sec-h"><button type="button" class="cv-sec-t" data-act="cv-open" data-k="${k}" aria-expanded="${open}">${CV_SEC[k]}${secHas(cv,k)?'':' <small class="muted">(trống)</small>'}</button><label class="cv-vis"><input type="checkbox" data-cvvis="${k}" ${cv.hidden[k]?'':'checked'}> Hiện</label><button type="button" class="icon-btn" data-act="cv-move-sec" data-k="${k}" data-d="-1" aria-label="Đưa ${CV_SEC[k]} lên" ${idx===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-act="cv-move-sec" data-k="${k}" data-d="1" aria-label="Đưa ${CV_SEC[k]} xuống" ${idx===cv.order.length-1?'disabled':''}>↓</button></div><div class="cv-sec-b ${open?'':'hide'}">${body}</div></section>`;
  }).join('');
}
function renderPanel(){const cv=curCV();if(!cv)return;$('cvPanelBody').innerHTML=panelContent(cv);if(CVS.tab==='check')renderChecks()}

/* ---------- Kiểm tra CV (Lodestar) ---------- */
function cvChecks(cv,u){
  const d=cv.data,list=[];const add=(ok,t,tip)=>list.push({ok:!!ok,t,tip});
  add(d.fullName&&d.title,'Có họ tên và chức danh mục tiêu','Thêm họ tên và vị trí bạn nhắm tới ngay đầu CV.');
  add(d.email&&d.phone,'Có email và số điện thoại','Nhà tuyển dụng cần cách liên hệ nhanh nhất.');
  const sl=(d.summary||'').trim().length;
  add(sl>=60&&sl<=450,'Phần giới thiệu dài 60-450 ký tự',sl<60?'Viết 2-3 câu về điểm mạnh và mục tiêu nghề nghiệp.':'Rút gọn còn 2-3 câu để dễ đọc.');
  const all=[...d.experience.map(x=>x.desc),...d.projects.map(x=>x.desc),...d.education.map(x=>x.note)].join(' ');
  add((all.match(/\d+([.,]\d+)?\s?%?/g)||[]).length>=2,'Có số liệu cụ thể trong kinh nghiệm và dự án','Thêm con số (%, số lượng, thời gian) vào các ý mô tả.');
  add(d.skills.length>=5,'Có ít nhất 5 kỹ năng','Liệt kê thêm kỹ năng chuyên môn và kỹ năng mềm bạn thật sự có.');
  add(d.experience.length+d.projects.length>=1,'Có kinh nghiệm hoặc dự án','Thêm ít nhất một kỳ thực tập, dự án hoặc hoạt động.');
  add(d.education.length>=1,'Có thông tin học vấn','Thêm trường, ngành và thời gian học.');
  const emptyVis=cv.order.filter(k=>!cv.hidden[k]&&!secHas(cv,k));
  add(!emptyVis.length,'Không có mục trống bị hiển thị',emptyVis.length?'Điền hoặc ẩn: '+emptyVis.map(k=>CV_SEC[k]).join(', ')+'.':'');
  const p=cv.paperPages||1;
  add(p<=1,`CV dài ${p} trang`,'CV sinh viên nên gọn trong 1 trang. Thử giảm cỡ chữ hoặc rút ngắn mô tả.');
  const role=ROLES[u.profile.targetRole];
  if(role){
    const pseudo={hardSkills:d.skills,softSkills:[],certs:d.certs.map(c=>({name:c.name})),projects:[...d.projects.map(x=>({name:x.name,desc:x.desc})),...d.experience.map(x=>({name:'',desc:x.desc}))],internships:d.experience.map(x=>({role:x.role,company:x.company})),major:'',bio:d.summary};
    const have=skillSet(pseudo),miss=role.skills.filter(i=>!have.has(i));
    add(!miss.length,`Từ khóa cho vị trí ${u.profile.targetRole}`,'Còn thiếu: '+miss.map(labelOf).join(', ')+'. Chỉ thêm nếu bạn thật sự có kỹ năng này.');
  }
  return list;
}
function renderChecks(){
  const cv=curCV(),u=me(),box=$('cvChecks');if(!cv||!box)return;
  const pap=$('cvScaler')&&$('cvScaler').firstElementChild;cv.paperPages=pap?Math.max(1,Math.ceil((pap.offsetHeight-2)/1123)):1;
  const l=cvChecks(cv,u),ok=l.filter(x=>x.ok).length,pct=Math.round(ok/l.length*100);
  box.innerHTML=`<div class="fitbox" style="margin-top:12px"><div class="top"><div><small class="muted">Lodestar chấm CV của bạn</small><br><b>${pct}%</b></div><div class="progress" style="flex:1;max-width:200px"><i style="width:${pct}%"></i></div></div><p class="notice" style="margin:0">Chấm theo quy tắc thông dụng khi viết CV, chưa phải đánh giá của nhà tuyển dụng.</p></div>
  <ul class="cv-checks">${l.map(x=>`<li class="${x.ok?'ok':'no'}"><span aria-hidden="true">${x.ok?'✓':'!'}</span><div><b>${esc(x.t)}</b>${x.ok?'':`<small>${esc(x.tip)}</small>`}</div></li>`).join('')}</ul>`;
}

/* ---------- Sự kiện trong trình chỉnh sửa ---------- */
const cvChanged=()=>{renderPaper();scheduleSave()};
document.addEventListener('input',e=>{
  const t=e.target;if(!t.closest||!t.closest('#cvRoot'))return;
  const cv=curCV();if(!cv)return;
  if(t.hasAttribute('data-cvname')){cv.name=t.value;scheduleSave();return}
  if(t.dataset.f){
    if(t.dataset.sec){const it=cv.data[t.dataset.sec][+t.dataset.i];if(it)it[t.dataset.f]=t.value}
    else cv.data[t.dataset.f]=t.value;
    if(t.dataset.sec&&(t.dataset.f===CV_SCHEMA[t.dataset.sec].key)){const h=t.closest('.cv-item');const b=h&&h.querySelector('.cv-item-h b');if(b)b.textContent=t.value||CV_SCHEMA[t.dataset.sec].blank}
    cvChanged();
  }
});
document.addEventListener('change',e=>{
  const t=e.target;if(!t.closest||!t.closest('#cvRoot'))return;
  const cv=curCV();if(!cv)return;
  if(t.dataset.f&&t.tagName==='SELECT'){const it=cv.data[t.dataset.sec][+t.dataset.i];if(it)it[t.dataset.f]=t.value;cvChanged()}
  if(t.dataset.cvvis){cv.hidden[t.dataset.cvvis]=!t.checked;cvChanged()}
  if(t.dataset.cvset==='color'){cv.color=safeColor(t.value);renderPanel();cvChanged()}
  if(t.dataset.cvset==='showPhoto'){cv.showPhoto=t.checked;cvChanged()}
  if(t.id==='cvPhotoInput'&&t.files[0]){
    compressImage(t.files[0],{max:240,q:.85,square:true,limit:60000}).then(url=>{cv.photo=url;cv.showPhoto=true;renderPanel();cvChanged();toast('Đã cập nhật ảnh đại diện.')})
      .catch(()=>toast('Không đọc được ảnh này. Hãy chọn tệp JPG hoặc PNG.','bad'));
    t.value='';
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='cvSkillIn'){
    e.preventDefault();const cv=curCV();if(!cv)return;
    let n=0;e.target.value.split(',').map(s=>s.trim().slice(0,40)).filter(Boolean).forEach(s=>{if(!cv.data.skills.some(x=>norm(x)===norm(s))){cv.data.skills.push(s);n++}});
    if(n){renderPanel();cvChanged();const i=$('cvSkillIn');i&&i.focus()}else e.target.value='';
  }
});
ACT['cv-tab']=t=>{CVS.tab=t.dataset.k;renderPanel();qsa('.cv-panel .seg button').forEach(b=>{const on=b.dataset.k===CVS.tab;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)})};
ACT['cv-open']=t=>{const k=t.dataset.k;CVS.open.has(k)?CVS.open.delete(k):CVS.open.add(k);renderPanel()};
ACT['cv-add']=t=>{const cv=curCV(),k=t.dataset.k;cv.data[k].push({id:uid()});CVS.open.add(k);renderPanel();cvChanged();const ins=qsa(`[data-sec="${k}"][data-i="${cv.data[k].length-1}"]`)[0];ins&&ins.focus()};
ACT['cv-del-item']=t=>{const cv=curCV();cv.data[t.dataset.k].splice(+t.dataset.i,1);renderPanel();cvChanged()};
ACT['cv-move-item']=t=>{const cv=curCV(),a=cv.data[t.dataset.k],i=+t.dataset.i,j=i+ +t.dataset.d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];renderPanel();cvChanged()};
ACT['cv-move-sec']=t=>{const cv=curCV(),a=cv.order,i=a.indexOf(t.dataset.k),j=i+ +t.dataset.d;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];renderPanel();cvChanged()};
ACT['cv-skill-del']=t=>{const cv=curCV();cv.data.skills.splice(+t.dataset.i,1);renderPanel();cvChanged()};
ACT['cv-tpl']=t=>{const cv=curCV();cv.tpl=t.dataset.t;renderPanel();cvChanged()};
ACT['cv-color']=t=>{const cv=curCV();cv.color=safeColor(t.dataset.c);renderPanel();cvChanged()};
ACT['cv-font']=t=>{const cv=curCV();cv.font=t.dataset.k;renderPanel();cvChanged()};
ACT['cv-size']=t=>{const cv=curCV();cv.size=t.dataset.k;renderPanel();cvChanged()};
ACT['cv-photo']=()=>{const i=$('cvPhotoInput');i&&i.click()};
ACT['cv-photo-del']=()=>{const cv=curCV();cv.photo=null;renderPanel();cvChanged()};
ACT['cv-sync']=async()=>{
  const u=me(),cv=curCV();if(!cv)return;
  if(!await confirmBox('Điền lại nội dung từ hồ sơ? Nội dung đang chỉnh trong CV này sẽ bị thay thế (mẫu và màu sắc được giữ nguyên).','Đồng bộ'))return;
  cv.data=cvFromProfile(u);renderPanel();cvChanged();toast('Đã đồng bộ nội dung từ hồ sơ.');
};
function printCV(){
  const cv=curCV();if(!cv)return;
  flushSave();
  const root=$('cvPrintRoot');root.innerHTML=cvPaper(cv);
  root.style.cssText='display:block;position:absolute;left:-10000px;top:0;visibility:hidden;width:794px';
  const h=root.firstElementChild.offsetHeight;root.style.cssText='';
  const multi=h>1130;
  $('pageStyle').textContent=`@page{size:A4;margin:${multi?'12mm 0':'0'}}`;
  document.body.classList.add('print-cv');document.body.classList.toggle('print-multi',multi);
  const done=()=>{document.body.classList.remove('print-cv','print-multi');root.innerHTML='';window.removeEventListener('afterprint',done)};
  window.addEventListener('afterprint',done);
  setTimeout(()=>{try{window.print()}catch(e){done();toast('Không mở được hộp thoại in. Hãy dùng Ctrl+P.','warn')}},60);
  toast('Trong hộp thoại in, chọn "Lưu dưới dạng PDF" ở mục Máy in.');
}
ACT['cv-print']=()=>printCV();
RENDER.cv=renderCV;

/* ---------- Việc làm ---------- */
const J={page:1,tab:'all'};
const STATUS={submitted:'Đã nộp',viewed:'HR đã xem',interview:'Mời phỏng vấn',offer:'Nhận việc',rejected:'Không phù hợp'};
const INDUSTRIES=['Công nghệ & phần mềm','Thương mại điện tử','Bán lẻ & FMCG','Tài chính & ngân hàng','Logistics','Giáo dục','Truyền thông & thiết kế','Khác'];
const SIZES=['Dưới 50 nhân sự','50 - 200 nhân sự','200 - 1000 nhân sự','Trên 1000 nhân sự'];
const findJob=id=>S.jobs.find(j=>j.id===String(id));
const jobExpired=j=>!!j.deadline&&Date.now()>j.deadline+DAY;
const jobOpen=j=>j.status!=='closed'&&!jobExpired(j);
const deadlineText=j=>j.deadline?(jobExpired(j)?'Đã quá hạn nộp':'Hạn nộp '+fmtDate(j.deadline)):'Nhận hồ sơ liên tục';
const myApps=u=>S.apps.filter(a=>a.userId===u.id);
const lines=t=>String(t||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
function jobCtx(){
  const u=me(),st=!!u&&u.role==='student',have=st?skillSet(u.profile):null,cache=new Map();
  return{u,st,saved:new Set(st?(u.saved||[]):[]),applied:new Set(st?myApps(u).map(a=>a.jobId):[]),
    match:j=>{if(!st)return null;if(!cache.has(j.id))cache.set(j.id,jobMatch(j,have,u.profile));return cache.get(j.id)}};
}
const matchChip=(j,ctx)=>ctx.st?`<span class="chip match" title="Lodestar AI tính từ hồ sơ của bạn">${ctx.match(j).score}% phù hợp</span>`:(!ctx.u?`<button type="button" class="chip lock" data-act="login-match" data-id="${j.id}">🔒 Đăng nhập để xem % phù hợp</button>`:'');
function jobCard(j,ctx){
  const {u,st}=ctx,own=u&&u.id===j.ownerId,closed=!jobOpen(j),saved=ctx.saved.has(j.id),applied=ctx.applied.has(j.id),locked=jobLocked(j,u);
  if(locked)return `<article class="card job job-locked" data-act="ueh-job-lock" data-id="${j.id}" tabindex="0" role="button" aria-label="Tin dành riêng cho sinh viên UEH, bấm để xem thêm"><div class="job-blur"><div class="logoBox" aria-hidden="true">${esc(j.company[0])}</div><div class="jobmain"><h3>${esc(j.title)}</h3><span class="co">${esc(j.company)}</span><div class="job-meta"><span>📍 ${esc(j.city)}</span><span>💰 ${esc(j.salary)}</span></div><p>${esc(j.desc.slice(0,90))}</p></div></div><div class="job-lock-ov"><span aria-hidden="true">🔒</span><b>Dành riêng cho sinh viên UEH</b><small>Đăng ký bằng email @st.ueh.edu.vn để xem tin này</small></div></article>`;
  const sk=j.skills.slice(0,3).map(i=>`<span class="chip" style="background:var(--chipn);color:var(--ink2)">${esc(labelOf(i))}</span>`).join('');
  const acts=u&&u.role==='employer'
    ?`<button type="button" class="btn outline" data-act="job-open" data-id="${j.id}">Xem chi tiết</button>`
    :`<button type="button" class="btn ghost sm" data-act="job-save" data-id="${j.id}" aria-pressed="${saved}">${saved?'♥ Đã lưu':'♡ Lưu'}</button><button type="button" class="btn outline" data-act="hr-chat" data-id="${j.id}">Chat HR</button><button type="button" class="btn ${applied?'registered':'orange'}" data-act="job-apply" data-id="${j.id}" ${applied||closed?'disabled':''}>${applied?'Đã ứng tuyển':closed?'Đã đóng':'Ứng tuyển'}</button>`;
  return `<article class="card job"><div class="logoBox" aria-hidden="true">${esc(j.company[0])}</div><div class="jobmain"><h3><button type="button" data-act="job-open" data-id="${j.id}">${esc(j.title)}</button></h3><span class="co">${esc(j.company)}</span>
  <div class="job-meta"><span>📍 ${esc(j.city)}</span><span>💰 ${esc(j.salary)}</span><span>🕒 Đăng ${ago(j.postedAt)}</span><span>${esc(deadlineText(j))}</span></div>
  <p>${esc(j.desc.length>150?j.desc.slice(0,147)+'...':j.desc)}</p>
  <div class="chips"><span class="chip">${esc(j.type)}</span><span class="chip">${esc(j.workplace)}</span>${sk}${matchChip(j,ctx)}${j.uehOnly?'<span class="chip ok">🎓 Dành cho SV UEH</span>':''}${own?'<span class="chip ok">Tin của bạn</span>':''}</div></div>
  <div class="jobactions">${acts}</div></article>`;
}
function miniJobCard(j,ctx){
  const {u}=ctx;
  if(jobLocked(j,u))return `<article class="card job-locked" data-act="ueh-job-lock" data-id="${j.id}" tabindex="0" role="button" aria-label="Tin dành riêng cho sinh viên UEH, bấm để xem thêm"><div class="job-blur"><div style="display:flex;gap:12px;align-items:center"><div class="logoBox" aria-hidden="true">${esc(j.company[0])}</div><div><h3 style="margin:0;font-size:16px">${esc(j.title)}</h3><span style="color:var(--tx);font-weight:800;font-size:14px">${esc(j.company)}</span></div></div></div><div class="job-lock-ov"><span aria-hidden="true">🔒</span><b>Dành riêng cho SV UEH</b></div></article>`;
  return `<article class="card"><div style="display:flex;gap:12px;align-items:center"><div class="logoBox" aria-hidden="true">${esc(j.company[0])}</div><div style="min-width:0"><h3 style="margin:0;font-size:16px"><button type="button" class="linkbtn" style="color:var(--ink);text-decoration:none;text-align:left" data-act="job-open" data-id="${j.id}">${esc(j.title)}</button></h3><span style="color:var(--tx);font-weight:800;font-size:14px">${esc(j.company)}</span></div></div>
  <div class="job-meta" style="margin:12px 0 8px"><span>📍 ${esc(j.city)}</span><span>💰 ${esc(j.salary)}</span></div>
  <div class="chips"><span class="chip">${esc(j.type)}</span><span class="chip">${esc(j.workplace)}</span>${matchChip(j,ctx)}${j.uehOnly?'<span class="chip ok">🎓 SV UEH</span>':''}</div><p class="notice" style="margin:10px 0 0">Đăng ${ago(j.postedAt)}</p></article>`;
}
function renderJobs(){
  const ctx=jobCtx(),{u,st}=ctx,apps=st?myApps(u):[];
  const tabs=[['all','Tất cả việc làm']];
  if(st)tabs.push(['saved',`Đã lưu (${ctx.saved.size})`],['applied',`Đã ứng tuyển (${apps.length})`]);
  if(!tabs.some(t=>t[0]===J.tab))J.tab='all';
  $('jobTabs').innerHTML=tabs.map(([k,l])=>`<button type="button" data-act="jobs-tab" data-tab="${k}" class="${J.tab===k?'active':''}" aria-pressed="${J.tab===k}">${l}</button>`).join('');
  $('jobTabs').classList.toggle('hide',tabs.length===1);
  const sortSel=$('jobSort');sortSel.querySelector('option[value=match]').disabled=!st;if(!st&&sortSel.value==='match')sortSel.value='new';
  const applied=J.tab==='applied';
  $('jobFilter').classList.toggle('hide',applied);qs('#jobs .result-line').classList.toggle('hide',applied);$('jobPager').classList.toggle('hide',applied);
  if(applied)return renderApplied(apps,ctx);
  const q=norm($('jobSearch').value.trim()),city=$('jobCity').value,sch=$('jobSchedule').value,wp=$('jobWorkplace').value,sort=sortSel.value;
  const list=S.jobs.filter(j=>{
    if(J.tab==='saved'){if(!ctx.saved.has(j.id))return false}else if(!jobOpen(j))return false;
    const hay=norm([j.company,j.title,j.desc,j.type,j.city,...j.skills.map(labelOf)].join(' '));
    return hay.includes(q)&&(!city||j.city===city)&&(sch==='Tất cả loại công việc'||j.type===sch)&&(wp==='Tất cả hình thức làm việc'||j.workplace===wp);
  }).sort(sort==='match'&&st?(a,b)=>ctx.match(b).score-ctx.match(a).score||b.postedAt-a.postedAt:(a,b)=>b.postedAt-a.postedAt);
  const pages=Math.max(1,Math.ceil(list.length/10));J.page=clamp(J.page,1,pages);
  $('jobResult').textContent=list.length?`Tìm thấy ${list.length} việc làm`:'Không có kết quả';
  $('jobList').innerHTML=list.slice((J.page-1)*10,J.page*10).map(j=>jobCard(j,ctx)).join('')||
    (J.tab==='saved'?`<div class="card empty-state"><b>Bạn chưa lưu việc làm nào</b>Bấm ♡ Lưu trên tin bạn quan tâm để xem lại tại đây.</div>`
     :`<div class="card empty-state"><b>Không tìm thấy công việc phù hợp</b>Thử đổi từ khóa hoặc xóa bộ lọc.<p style="margin:12px 0 0"><button type="button" class="btn outline sm" data-act="jobs-reset">Xóa bộ lọc</button></p></div>`);
  $('pageText').textContent=`Trang ${J.page}/${pages}`;$('prev').disabled=J.page===1;$('next').disabled=J.page===pages;
}
function renderApplied(apps,ctx){
  $('jobResult').textContent='';
  if(!apps.length){$('jobList').innerHTML=`<div class="card empty-state"><b>Bạn chưa ứng tuyển vị trí nào</b>Chọn một việc làm và bấm Ứng tuyển để bắt đầu.<p style="margin:12px 0 0"><button type="button" class="btn primary sm" data-act="jobs-tab" data-tab="all">Xem việc làm</button></p></div>`;return}
  $('jobList').innerHTML=[...apps].sort((a,b)=>b.at-a.at).map(a=>{
    const j=findJob(a.jobId);
    if(!j)return `<article class="card"><b>Tin tuyển dụng đã được gỡ</b><p class="muted" style="margin:4px 0 0">Bạn đã nộp đơn ngày ${fmtDate(a.at)}.</p></article>`;
    const reached=new Set(a.history.map(h=>h.s)),rej=a.status==='rejected';
    const steps=[['submitted','Đã nộp'],['viewed','HR đã xem'],['interview','Mời phỏng vấn'],[rej?'rejected':'offer',rej?'Không phù hợp':'Nhận việc']];
    const idx=['submitted','viewed','interview','offer'].indexOf(a.status);
    const tl=steps.map(([k,l],i)=>`<span class="${rej&&k==='rejected'?'rej':(reached.has(k)||(!rej&&idx>=i)?'on':'')}">${l}</span>`).join('<i></i>');
    return `<article class="card job"><div class="logoBox" aria-hidden="true">${esc(j.company[0])}</div><div class="jobmain"><h3><button type="button" data-act="job-open" data-id="${j.id}">${esc(j.title)}</button></h3><span class="co">${esc(j.company)}</span>
    <div class="job-meta"><span>📍 ${esc(j.city)}</span><span>📨 Nộp ngày ${fmtDate(a.at)}</span></div><div class="timeline" aria-label="Tiến trình đơn ứng tuyển">${tl}</div></div>
    <div class="jobactions"><span class="status ${a.status}">${STATUS[a.status]}</span>${a.status==='submitted'||a.status==='viewed'?`<button type="button" class="btn danger sm" data-act="app-withdraw" data-id="${a.id}">Rút đơn</button>`:''}</div></article>`;
  }).join('');
}
RENDER.jobs=renderJobs;

function initJobsUI(){
  const rr=()=>{J.page=1;renderJobs()};
  $('jobSearch').addEventListener('input',rr);['jobCity','jobSchedule','jobWorkplace','jobSort'].forEach(id=>$(id).addEventListener('change',rr));
  $('prev').addEventListener('click',()=>{J.page--;renderJobs();window.scrollTo(0,0)});
  $('next').addEventListener('click',()=>{J.page++;renderJobs();window.scrollTo(0,0)});
  $('jobReset').addEventListener('click',()=>ACT['jobs-reset']());
}
ACT['jobs-reset']=()=>{$('jobSearch').value='';$('jobCity').value='';$('jobSchedule').selectedIndex=0;$('jobWorkplace').selectedIndex=0;$('jobSort').value='new';J.page=1;renderJobs()};
ACT['jobs-tab']=t=>{J.tab=t.dataset.tab;J.page=1;closeDropdown();if(view!=='jobs')go('jobs');else renderJobs()};
ACT['login-match']=t=>{const id=t.dataset.id;requireLogin('xem mức độ phù hợp với hồ sơ của bạn',()=>{qsa('.modalBG[data-job]').forEach(closeEl);refresh();if(id)openJob(id)})};

/* ---------- Chi tiết tin ---------- */
function openJob(id){
  const j=findJob(id);if(!j)return;
  const ctx=jobCtx(),{u,st}=ctx;
  if(jobLocked(j,u)){openUehInfo();return}
  const m=ctx.match(j),closed=!jobOpen(j),applied=ctx.applied.has(j.id),saved=ctx.saved.has(j.id);
  const fit=st?`<div class="fitbox"><div class="top"><div><small class="muted">Mức độ phù hợp với hồ sơ của bạn</small><br><b>${m.score}%</b></div><div class="progress" style="flex:1;max-width:260px"><i style="width:${m.score}%"></i></div></div>
    ${m.got.length?`<p style="margin:8px 0 6px"><b>Bạn đã có</b></p><div class="chips">${m.got.map(i=>`<span class="chip ok">✓ ${esc(labelOf(i))}</span>`).join('')}</div>`:''}
    ${m.miss.length?`<p style="margin:12px 0 6px"><b>Còn thiếu</b></p><div class="chips">${m.miss.map(i=>`<span class="chip warn">${esc(labelOf(i))}</span>`).join('')}</div><p style="margin:12px 0 0"><button type="button" class="btn outline sm" data-act="job-courses" data-id="${j.id}">Tìm khóa học cho kỹ năng còn thiếu</button></p>`:`<p style="margin:8px 0 0">Hồ sơ của bạn đáp ứng đủ kỹ năng yêu cầu.</p>`}
    <p class="notice" style="margin:10px 0 0">Điểm do Lodestar AI tính từ kỹ năng, chứng chỉ, dự án, thực tập và GPA trong hồ sơ.</p></div>`
    :!u?`<div class="fitbox"><b>Lodestar AI có thể chấm mức độ phù hợp của bạn với vị trí này.</b><p class="muted" style="margin:6px 0 10px">Đăng nhập và hoàn thiện hồ sơ để xem kỹ năng bạn đã có và còn thiếu.</p><button type="button" class="btn primary sm" data-act="login-match" data-id="${j.id}">Đăng nhập</button></div>`:'';
  const acts=u&&u.role==='employer'?`<button type="button" class="btn outline" data-close>Đóng</button>`
    :`<button type="button" class="btn ghost" data-act="job-save" data-id="${j.id}" aria-pressed="${saved}">${saved?'♥ Đã lưu':'♡ Lưu tin'}</button><button type="button" class="btn outline" data-act="hr-chat" data-id="${j.id}">Chat HR</button><button type="button" class="btn ${applied?'registered':'orange'}" data-act="job-apply" data-id="${j.id}" ${applied||closed?'disabled':''}>${applied?'Đã ứng tuyển':closed?'Đã đóng':'Ứng tuyển'}</button>`;
  const md=modal(`<div class="detail-head"><div class="logoBox" aria-hidden="true">${esc(j.company[0])}</div><div><h2 style="padding:0">${esc(j.title)}</h2><span class="co" style="color:var(--tx);font-weight:800">${esc(j.company)}</span> <span class="muted">· ${esc(j.city)}</span></div></div>
  <div class="chips"><span class="chip">💰 ${esc(j.salary)}</span><span class="chip">${esc(j.type)}</span><span class="chip">${esc(j.workplace)}</span><span class="chip ${jobExpired(j)?'bad':''}">${esc(deadlineText(j))}</span></div>${fit}
  <div class="detail-sec"><h3>Mô tả công việc</h3><p style="white-space:pre-wrap;margin:0;color:var(--ink2)">${esc(j.desc)}</p></div>
  ${j.reqs.length?`<div class="detail-sec"><h3>Yêu cầu</h3><ul>${j.reqs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
  ${j.benefits.length?`<div class="detail-sec"><h3>Quyền lợi</h3><ul>${j.benefits.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
  <div class="detail-sec"><h3>Kỹ năng yêu cầu</h3><div class="chips">${j.skills.map(i=>`<span class="chip">${esc(labelOf(i))}</span>`).join('')}</div></div>
  <div class="detail-sec"><h3>Về ${esc(j.company)}</h3><p style="margin:0;color:var(--ink2)">${esc(j.about||'Doanh nghiệp chưa cập nhật giới thiệu.')}</p><p class="notice" style="margin:6px 0 0">${esc(j.industry||'')}${j.size?' · '+esc(j.size):''}<br>Liên hệ: ${esc(j.email)} · Đăng ${ago(j.postedAt)}</p></div>
  <div class="modal-actions sticky-actions">${acts}</div>`,{wide:true});
  md.dataset.job=j.id;
}
ACT['job-open']=t=>openJob(t.dataset.id);
ACT['ueh-job-lock']=()=>openUehInfo();
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('.job-locked')){e.preventDefault();openUehInfo()}});
ACT['job-courses']=t=>{
  const j=findJob(t.dataset.id),u=me();if(!j||!u)return;
  const miss=jobMatch(j,skillSet(u.profile),u.profile).miss;
  qsa('.modalBG[data-job]').forEach(closeEl);
  $('courseSearch').value=miss[0]?labelOf(miss[0]):'';coursePage=1;go('learning');
};
function toggleSave(id){
  if(!needStudent('lưu việc làm',()=>toggleSave(id)))return;
  const u=me(),s=new Set(u.saved||[]),on=!s.has(id);on?s.add(id):s.delete(id);u.saved=[...s];persist('users');
  toast(on?'Đã lưu việc làm.':'Đã bỏ lưu việc làm.');
  qsa(`[data-act="job-save"][data-id="${id}"]`).forEach(b=>{b.textContent=b.closest('.modal')?(on?'♥ Đã lưu':'♡ Lưu tin'):(on?'♥ Đã lưu':'♡ Lưu');b.setAttribute('aria-pressed',on)});
  if(view==='jobs')renderJobs();
}
ACT['job-save']=t=>toggleSave(t.dataset.id);

/* ---------- Ứng tuyển ---------- */
function draftLetter(u,j){
  const p=u.profile,a=analyze(u),m=jobMatch(j,a.have,p),got=m.got.map(labelOf).slice(0,3);
  const last=p.internships[p.internships.length-1];
  return `Kính gửi Bộ phận Tuyển dụng ${j.company},\n\nTôi là ${u.name}, ${p.major?`sinh viên ngành ${p.major}`:'sinh viên'} tại ${p.school||'trường đại học'}. Tôi quan tâm đến vị trí ${j.title} và mong muốn được đóng góp cho đội ngũ của quý công ty.\n\n${got.length?`Tôi có nền tảng về ${got.join(', ')}. `:''}${last?`Tôi từng thực tập với vai trò ${last.role} tại ${last.company}, nơi tôi học cách làm việc theo quy trình và phối hợp với nhiều bộ phận. `:''}${Number(p.gpa)?`Điểm GPA tích lũy của tôi là ${Number(p.gpa).toFixed(2)}/4.00.`:''}\n\nTôi rất mong có cơ hội trao đổi thêm về vị trí này.\n\nTrân trọng,\n${u.name}`;
}
function applyJob(id){
  if(!needStudent('ứng tuyển vị trí này',()=>applyJob(id)))return;
  const u=me(),j=findJob(id);if(!j)return;
  if(myApps(u).some(a=>a.jobId===j.id)){toast('Bạn đã ứng tuyển vị trí này rồi.','warn');return}
  if(!jobOpen(j)){toast('Tin tuyển dụng này đã đóng.','warn');return}
  const c=completeness(u.profile).pct;
  const m=modal(`<h2>Ứng tuyển ${esc(j.title)}</h2><p class="muted">${esc(j.company)}</p>
   <div class="info-box">Hồ sơ UEH Professional của bạn (hoàn thiện <b>${c}%</b>) sẽ được gửi kèm đơn.${c<60?' Hoàn thiện thêm hồ sơ giúp doanh nghiệp đánh giá bạn tốt hơn.':''}</div>
   <form novalidate><div class="field"><label for="apLetter">Thư giới thiệu (không bắt buộc)</label><textarea id="apLetter" name="letter" rows="8" maxlength="1500" placeholder="Giới thiệu ngắn về bạn và lý do quan tâm đến vị trí này"></textarea></div>
   <button type="button" class="btn ghost sm" data-draft>✦ Lodestar AI soạn nháp thư</button>
   <div class="modal-actions"><button type="button" class="btn outline" data-close>Hủy</button><button class="btn orange">Gửi đơn ứng tuyển</button></div></form>`);
  const f=qs('form',m);
  qs('[data-draft]',m).addEventListener('click',()=>{f.elements.letter.value=draftLetter(u,j);f.elements.letter.focus()});
  f.addEventListener('submit',e=>{
    e.preventDefault();
    if(myApps(u).some(a=>a.jobId===j.id))return;
    const now=Date.now();
    S.apps.push({id:uid(),jobId:j.id,userId:u.id,at:now,status:'submitted',letter:f.elements.letter.value.trim(),history:[{s:'submitted',at:now}]});
    persist('apps');notify(j.ownerId,`${u.name} vừa ứng tuyển vị trí ${j.title}.`);award('apply');
    closeEl(m);qsa('.modalBG[data-job]').forEach(closeEl);
    toast(`Đã gửi đơn ứng tuyển tới ${j.company}.`);renderNav();refresh();
  });
}
ACT['job-apply']=t=>applyJob(t.dataset.id);
ACT['app-withdraw']=async t=>{
  if(!await confirmBox('Rút đơn ứng tuyển này?','Rút đơn',true))return;
  S.apps=S.apps.filter(a=>a.id!==t.dataset.id);persist('apps');toast('Đã rút đơn ứng tuyển.');renderJobs();
};

/* ---------- Chat HR ---------- */
let hrJob=null;
function hrReply(text,j){
  const s=norm(text);
  if(/luong|thu nhap|salary/.test(s))return `Mức lương vị trí này là ${j.salary}, có thể trao đổi thêm theo năng lực khi phỏng vấn.`;
  if(/phong van|interview/.test(s))return 'Quy trình gồm sàng lọc hồ sơ, một vòng phỏng vấn với trưởng nhóm và thông báo kết quả trong 3-5 ngày làm việc.';
  if(/han|deadline|nop/.test(s))return `${deadlineText(j)}. Bạn nên nộp sớm để được xem xét trước.`;
  if(/ky nang|yeu cau|can gi/.test(s))return `Chúng tôi ưu tiên bạn có ${j.skills.slice(0,4).map(labelOf).join(', ')}.`;
  return 'HR đã nhận tin nhắn và sẽ phản hồi chi tiết trong ít phút.';
}
function openHr(id){
  if(!needStudent('nhắn tin với HR',()=>openHr(id)))return;
  const j=findJob(id);if(!j)return;hrJob=j;
  $('hrTitle').textContent=`HR ${j.company} · ${j.title}`;
  $('hrMessages').innerHTML=`<div class="msg"><span>Chào ${esc(firstName(me().name))}, HR ${esc(j.company)} có thể hỗ trợ thông tin về vị trí ${esc(j.title)}.</span></div>`;
  openEl($('hrModal'));
}
ACT['hr-chat']=t=>openHr(t.dataset.id);
function initHr(){
  $('hrForm').addEventListener('submit',e=>{
    e.preventDefault();const t=$('hrInput').value.trim();if(!t||!hrJob)return;
    const box=$('hrMessages');box.insertAdjacentHTML('beforeend',`<div class="msg me"><span>${esc(t)}</span></div>`);$('hrInput').value='';box.scrollTop=box.scrollHeight;
    const j=hrJob;setTimeout(()=>{box.insertAdjacentHTML('beforeend',`<div class="msg"><span>${esc(hrReply(t,j))}</span></div>`);box.scrollTop=box.scrollHeight},650);
  });
}

/* ---------- Nhà tuyển dụng ---------- */
const E={open:null};
function candOf(app){
  if(app.userId){const cu=S.users.find(x=>x.id===app.userId);if(cu)return{name:cu.name,email:cu.email,school:cu.profile.school,major:cu.profile.major,profile:cu.profile,real:true}}
  const c=CANDS[app.cand];
  return c?{name:c.name,email:c.email,school:c.school,major:c.major,profile:c.profile,real:false}:{name:'Ứng viên đã xóa hồ sơ',email:'',school:'',major:'',profile:{hardSkills:[],softSkills:[],certs:[],projects:[],internships:[]},real:false};
}
const toDateInput=ts=>{const d=new Date(ts);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
function renderEmployer(){
  const u=me();if(!u||u.role!=='employer')return;
  const mine=S.jobs.filter(j=>j.ownerId===u.id).sort((a,b)=>b.postedAt-a.postedAt);
  const apps=S.apps.filter(a=>mine.some(j=>j.id===a.jobId));
  const openN=mine.filter(jobOpen).length;
  $('employerRoot').innerHTML=`
  <div class="topline"><div><small class="eyebrow">QUẢN LÝ TUYỂN DỤNG</small><h1>${esc(u.name)}</h1><p class="muted">${esc(u.company?.industry||'')}${u.company?.size?' · '+esc(u.company.size):''}</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn outline" data-act="company-edit">Hồ sơ công ty</button><button type="button" class="btn outline" data-act="my-plan">Gói của tôi</button><button type="button" class="btn orange" data-act="post-job">+ Đăng tin mới</button></div></div>
  ${empBanner(u)}
  <div class="tiles">
    <div class="card tile"><b>${openN}</b><span>Tin đang tuyển</span></div>
    <div class="card tile"><b>${apps.length}</b><span>Ứng viên nhận được</span></div>
    <div class="card tile"><b>${apps.filter(a=>a.status==='submitted').length}</b><span>Chưa xem</span></div>
    <div class="card tile"><b>${apps.filter(a=>a.status==='interview').length}</b><span>Mời phỏng vấn</span></div></div>
  ${mine.length?mine.map(j=>{
    const ja=apps.filter(a=>a.jobId===j.id),closed=!jobOpen(j),open=E.open===j.id;
    const rows=open?ja.map(a=>{const c=candOf(a),p=c.profile,mt=jobMatch(j,skillSet(p),p);return{a,c,p,mt}}).sort((x,y)=>y.mt.score-x.mt.score):[];
    return `<article class="card emp-job"><div class="head"><div><h3>${esc(j.title)}</h3><div class="job-meta"><span>📍 ${esc(j.city)}</span><span>💰 ${esc(j.salary)}</span><span>${esc(j.type)} · ${esc(j.workplace)}</span><span>Đăng ${ago(j.postedAt)}</span><span>${esc(deadlineText(j))}</span></div><div class="chips"><span class="status ${closed?'closed':''}">${closed?(jobExpired(j)?'Hết hạn':'Đã đóng'):'Đang tuyển'}</span><span class="chip">${ja.length} ứng viên</span>${j.uehOnly?'<span class="chip ok">🎓 Dành cho SV UEH</span>':''}</div></div>
      <div class="jobactions"><button type="button" class="btn primary sm" data-act="emp-toggle" data-id="${j.id}" aria-expanded="${open}">${open?'Ẩn ứng viên':'Xem ứng viên ('+ja.length+')'}</button><button type="button" class="btn outline sm" data-act="job-edit" data-id="${j.id}">Sửa</button><button type="button" class="btn outline sm" data-act="job-close" data-id="${j.id}">${j.status==='closed'?'Mở lại':'Đóng tin'}</button><button type="button" class="btn ghost sm" data-act="job-share" data-id="${j.id}">Chia sẻ lên Cộng đồng</button><button type="button" class="btn danger sm" data-act="job-del" data-id="${j.id}">Xóa</button></div></div>
      ${open?`<div class="applicants">${rows.length?rows.map(({a,c,p,mt})=>`<div class="cand"><div class="avatar" aria-hidden="true">${esc(initials(c.name))}</div><div class="grow"><b>${esc(c.name)}</b>${c.real?' <span class="chip ok" style="padding:2px 8px">Tài khoản thật</span>':''}<small class="muted" style="display:block">${esc(c.school||'')}${p.gpa?' · GPA '+Number(p.gpa).toFixed(2):''} · Nộp ${ago(a.at)}</small><div class="chips" style="margin-top:6px">${(p.hardSkills||[]).slice(0,4).map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div></div><span class="chip match">${mt.score}% phù hợp</span><select data-change="app-status" data-id="${a.id}" aria-label="Trạng thái đơn của ${esc(c.name)}">${Object.entries(STATUS).map(([k,l])=>`<option value="${k}" ${a.status===k?'selected':''}>${l}</option>`).join('')}</select><button type="button" class="btn outline sm" data-act="cand-view" data-id="${a.id}">Xem hồ sơ</button></div>`).join(''):`<div class="empty-state"><b>Chưa có ứng viên</b>Chia sẻ tin lên Cộng đồng để tiếp cận thêm sinh viên.</div>`}</div>`:''}
    </article>`;}).join(''):`<div class="card empty-state"><b>Công ty chưa đăng tin tuyển dụng nào</b>Tin mới đăng luôn hiển thị đầu danh sách Việc làm.<p style="margin:12px 0 0"><button type="button" class="btn orange" data-act="post-job">Đăng tin đầu tiên</button></p></div>`}`;
}
RENDER.employer=renderEmployer;
ACT['emp-toggle']=t=>{E.open=E.open===t.dataset.id?null:t.dataset.id;renderEmployer()};
ACT['emp-cta']=()=>{
  const u=me();
  if(!u)openAuth('register',{role:'employer',msg:'Tạo tài khoản nhà tuyển dụng để đăng tin và nhận ứng viên.'});
  else if(u.role==='employer')go('employer');
  else toast('Bạn đang dùng tài khoản sinh viên. Hãy đăng xuất và tạo tài khoản nhà tuyển dụng.','warn');
};
ACT['post-job']=()=>{
  closeDropdown();if(!isEmployer()){ACT['emp-cta']();return}
  const u=me();
  if(!empActive(u)){toast('Gói doanh nghiệp đã hết hạn. Hãy gia hạn để đăng tin mới.','warn');go('pricing');return}
  openJobForm();
};
function openJobForm(id){
  const u=me(),ex=id?findJob(id):null;
  if(!ex&&!empActive(u)){toast('Gói doanh nghiệp đã hết hạn. Hãy gia hạn để đăng tin mới.','warn');go('pricing');return}
  const vals=ex?{title:ex.title,type:ex.type,workplace:ex.workplace,city:ex.city,salary:ex.salary,deadline:ex.deadline?toDateInput(ex.deadline):'',skills:ex.skills,desc:ex.desc,reqs:ex.reqs.join('\n'),benefits:ex.benefits.join('\n'),uehOnly:ex.uehOnly?['yes']:[]}:{type:'Intern',workplace:'Hybrid',city:'TP.HCM',salary:'Thỏa thuận',skills:[]};
  openForm({title:ex?'Sửa tin tuyển dụng':'Đăng tin tuyển dụng',sub:`Tin sẽ hiển thị với tên ${esc(u.name)} và nằm đầu danh sách Việc làm.`,wide:true,values:vals,submit:ex?'Lưu thay đổi':'Đăng tin',fields:[
    {name:'title',label:'Chức danh',req:true,ph:'Ví dụ: Business Analyst Intern',maxlength:100},
    {name:'type',label:'Loại công việc',type:'select',options:['Intern','Part time','Full time']},
    {name:'workplace',label:'Hình thức làm việc',type:'select',options:['On site','Hybrid','Remote']},
    {name:'city',label:'Địa điểm',type:'select',options:CITIES},
    {name:'salary',label:'Mức lương',req:true,ph:'Ví dụ: 5 - 8 triệu hoặc Thỏa thuận',maxlength:40},
    {name:'deadline',label:'Hạn nộp hồ sơ',type:'date',hint:'Để trống nếu nhận hồ sơ liên tục.',validate:v=>(!ex&&new Date(v+'T23:59:59')<new Date())?'Hạn nộp phải từ hôm nay trở đi':''},
    {name:'skills',label:'Kỹ năng yêu cầu',type:'checks',req:true,options:CAT.map(s=>({v:s.id,l:s.label})),hint:'Lodestar AI dùng các kỹ năng này để chấm mức độ phù hợp của ứng viên.'},
    {name:'uehOnly',label:'Đối tượng ứng tuyển',type:'checks',options:[{v:'yes',l:'Chỉ dành cho sinh viên UEH (email @st.ueh.edu.vn)'}],hint:'Sinh viên trường khác sẽ thấy tin này ở dạng bị làm mờ.'},
    {name:'desc',label:'Mô tả công việc',type:'textarea',req:true,rows:4,maxlength:1200},
    {name:'reqs',label:'Yêu cầu ứng viên',type:'textarea',rows:4,hint:'Mỗi dòng một yêu cầu.',maxlength:1200},
    {name:'benefits',label:'Quyền lợi',type:'textarea',rows:3,hint:'Mỗi dòng một quyền lợi.',maxlength:1200}],
    onSubmit:d=>{
      const o={title:d.title,type:d.type,workplace:d.workplace,city:d.city,salary:d.salary,skills:d.skills,desc:d.desc,reqs:lines(d.reqs),benefits:lines(d.benefits),deadline:d.deadline?new Date(d.deadline+'T00:00:00').getTime():null,uehOnly:d.uehOnly.includes('yes')};
      if(ex){Object.assign(ex,o);toast('Đã cập nhật tin tuyển dụng.')}
      else{
        const j={id:'j_'+uid(),company:u.name,email:u.email,ownerId:u.id,industry:u.company?.industry||'',size:u.company?.size||'',about:u.company?.about||'',postedAt:Date.now(),status:'open',tpl:null,custom:true,...o};
        S.jobs.push(j);E.open=j.id;toast('Đã đăng tin tuyển dụng. Tin hiển thị đầu danh sách Việc làm.');
      }
      persist('jobs');renderEmployer();
    }});
}
ACT['job-edit']=t=>openJobForm(t.dataset.id);
ACT['job-close']=t=>{const j=findJob(t.dataset.id);if(!j)return;j.status=j.status==='closed'?'open':'closed';persist('jobs');toast(j.status==='closed'?'Đã đóng tin. Sinh viên sẽ không thấy tin này nữa.':'Đã mở lại tin tuyển dụng.');renderEmployer()};
ACT['job-del']=async t=>{
  const j=findJob(t.dataset.id);if(!j)return;
  if(!await confirmBox(`Xóa tin "${j.title}" và toàn bộ đơn ứng tuyển của tin này?`,'Xóa tin',true))return;
  S.jobs=S.jobs.filter(x=>x.id!==j.id);S.apps=S.apps.filter(a=>a.jobId!==j.id);persist('jobs','apps');if(E.open===j.id)E.open=null;toast('Đã xóa tin tuyển dụng.');renderEmployer();
};
ACT['job-share']=t=>{
  const j=findJob(t.dataset.id),u=me();if(!j||!u)return;
  S.posts.unshift({id:uid(),authorId:u.id,author:u.name,role:'employer',at:Date.now(),tag:'Tuyển dụng',body:`${u.name} đang tuyển ${j.title} (${j.type} · ${j.workplace} · ${j.city}). Mức lương: ${j.salary}. Xem chi tiết và ứng tuyển ở mục Việc làm.`,likesBase:0,likedBy:[],comments:[]});
  persist('posts');toast('Đã chia sẻ tin lên Cộng đồng.');
};
ACT['company-edit']=()=>{
  const u=me(),c=u.company||(u.company={});
  openForm({title:'Hồ sơ công ty',values:{name:u.name,industry:c.industry,size:c.size,about:c.about},fields:[
    {name:'name',label:'Tên công ty',req:true,maxlength:80},
    {name:'industry',label:'Lĩnh vực',type:'select',options:INDUSTRIES},
    {name:'size',label:'Quy mô',type:'select',options:SIZES},
    {name:'about',label:'Giới thiệu công ty',type:'textarea',rows:4,maxlength:500,hint:'Nội dung này hiển thị trong trang chi tiết các tin bạn đăng.'}],
    onSubmit:d=>{u.name=d.name;Object.assign(c,{industry:d.industry,size:d.size,about:d.about});
      S.jobs.filter(j=>j.ownerId===u.id).forEach(j=>Object.assign(j,{company:d.name,industry:d.industry,size:d.size,about:d.about}));
      persist('users','jobs');renderNav();renderEmployer();toast('Đã cập nhật hồ sơ công ty.')}});
};
function setAppStatus(id,status,quiet){
  const a=S.apps.find(x=>x.id===id);if(!a||a.status===status)return;
  a.status=status;a.history.push({s:status,at:Date.now()});persist('apps');
  const j=findJob(a.jobId);
  if(a.userId&&j)notify(a.userId,`${j.company} cập nhật đơn ứng tuyển ${j.title}: ${STATUS[status]}.`);
  if(!quiet)toast(`Đã chuyển trạng thái: ${STATUS[status]}.`);
}
function openCand(id){
  const a=S.apps.find(x=>x.id===id);if(!a)return;
  const j=findJob(a.jobId),c=candOf(a),p=c.profile;
  if(a.status==='submitted'){setAppStatus(a.id,'viewed',true)}
  const mt=j?jobMatch(j,skillSet(p),p):{score:0,got:[],miss:[]};
  const sec=(t,h)=>h?`<div class="detail-sec"><h3>${t}</h3>${h}</div>`:'';
  const md=modal(`<div class="detail-head"><div class="avatar" style="width:52px;height:52px;font-size:18px" aria-hidden="true">${esc(initials(c.name))}</div><div><h2 style="padding:0">${esc(c.name)}</h2><span class="muted">${esc(c.school||'')}${c.major?' · '+esc(c.major):''}</span></div></div>
   <div class="chips">${p.gpa?`<span class="chip">GPA ${Number(p.gpa).toFixed(2)}/4.00</span>`:''}${c.email?`<span class="chip">✉ ${esc(c.email)}</span>`:''}<span class="chip">Trạng thái: ${STATUS[a.status==='submitted'?'viewed':a.status]}</span></div>
   ${j?`<div class="fitbox"><div class="top"><div><small class="muted">Mức độ phù hợp với ${esc(j.title)}</small><br><b>${mt.score}%</b></div><div class="progress" style="flex:1;max-width:260px"><i style="width:${mt.score}%"></i></div></div>
   ${mt.got.length?`<div class="chips">${mt.got.map(i=>`<span class="chip ok">✓ ${esc(labelOf(i))}</span>`).join('')}</div>`:''}${mt.miss.length?`<div class="chips" style="margin-top:8px">${mt.miss.map(i=>`<span class="chip warn">${esc(labelOf(i))}</span>`).join('')}</div>`:''}</div>`:''}
   ${sec('Thư giới thiệu',a.letter?`<p style="white-space:pre-wrap;margin:0;color:var(--ink2)">${esc(a.letter)}</p>`:'')}
   ${sec('Kỹ năng chuyên môn',(p.hardSkills||[]).length?`<div class="chips">${p.hardSkills.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`:'')}
   ${sec('Kỹ năng mềm',(p.softSkills||[]).length?`<div class="chips">${p.softSkills.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`:'')}
   ${sec('Chứng chỉ',(p.certs||[]).length?`<ul>${p.certs.map(x=>`<li>${esc(x.name)}</li>`).join('')}</ul>`:'')}
   ${sec('Dự án khoa học',(p.projects||[]).length?`<ul>${p.projects.map(x=>`<li>${esc(x.name)}</li>`).join('')}</ul>`:'')}
   ${sec('Thực tập',(p.internships||[]).length?`<ul>${p.internships.map(x=>`<li>${esc(x.role)}, ${esc(x.company)}</li>`).join('')}</ul>`:'')}
   <div class="modal-actions sticky-actions"><button type="button" class="btn danger" data-app-set="rejected">Không phù hợp</button><button type="button" class="btn primary" data-app-set="interview">Mời phỏng vấn</button></div>`,{wide:true});
  md.addEventListener('click',e=>{const b=e.target.closest('[data-app-set]');if(b){setAppStatus(a.id,b.dataset.appSet);closeEl(md);renderEmployer()}});
  renderEmployer();
}
ACT['cand-view']=t=>openCand(t.dataset.id);
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.change==='app-status'){setAppStatus(t.dataset.id,t.value);renderEmployer()}
});

/* ---------- Học tập ---------- */
let coursePage=1;
function renderCourses(){
  const u=me(),st=!!u&&u.role==='student',a=st?analyze(u):null,regs=new Set(st?(u.courses||[]):[]);
  const coursesOK=st&&(can(u,'courses')||isUEH(u));
  const query=norm($('courseSearch').value.trim()),level=$('courseLevel').value,show=$('courseShow').value,sort=$('courseSort').value;
  $('learnTip').innerHTML=st&&!coursesOK
    ?`<div class="tip-strip"><span>🔒 Nâng cấp gói hoặc dùng email @st.ueh.edu.vn để Lodestar AI xếp khóa học theo kỹ năng còn thiếu và mở đăng ký.</span><button type="button" class="btn orange sm" data-go="pricing">Xem gói nâng cấp</button></div>`
    :st&&a.gaps.length
    ?`<div class="tip-strip"><b>✦ Lodestar AI ưu tiên cho mục tiêu ${esc(a.role)}:</b>${a.gaps.slice(0,5).map(i=>`<button type="button" class="chip warn" style="border:0;cursor:pointer" data-act="course-filter" data-q="${esc(labelOf(i))}">${esc(labelOf(i))}</button>`).join('')}<small class="muted">Bấm để lọc khóa học theo kỹ năng còn thiếu.</small></div>`
    :(!u?`<div class="tip-strip"><span>🔒 Đăng nhập để Lodestar AI xếp khóa học theo kỹ năng bạn còn thiếu.</span><button type="button" class="btn primary sm" data-act="login">Đăng nhập</button></div>`:'');
  const score=c=>coursesOK?courseBoost(c,a):c.match;
  const list=COURSES.filter(c=>norm([c.title,c.desc,c.route,c.skills.join(' '),c.sk.map(labelOf).join(' ')].join(' ')).includes(query)&&(level==='Tất cả cấp độ'||c.level===level)&&(show==='all'||regs.has(c.id)))
    .sort(sort==='short'?(x,y)=>x.weeks-y.weeks||score(y)-score(x):(x,y)=>score(y)-score(x));
  const pages=Math.max(1,Math.ceil(list.length/8));coursePage=clamp(coursePage,1,pages);
  $('courseList').innerHTML=list.slice((coursePage-1)*8,coursePage*8).map(c=>{
    const on=regs.has(c.id),fills=coursesOK&&a&&a.gaps.length&&c.sk.some(i=>a.gaps.includes(i));
    const btn=!st?`<button type="button" class="btn orange" data-act="login">Đăng nhập</button>`
      :!coursesOK?`<button type="button" class="btn outline" data-act="upsell" data-f="courses">🔒 Nâng cấp</button>`
      :`<button type="button" class="btn ${on?'registered':'orange'}" data-act="course-reg" data-id="${c.id}" aria-pressed="${on}">${on?'Đã đăng ký':'Đăng ký'}</button>`;
    return `<article class="card course-card"><div class="course-cover"><div><small>${esc(c.level)} · ${esc(c.duration)}</small><div><b>${coursesOK?score(c)+'% phù hợp':'Khóa học nổi bật'}</b></div></div><span class="course-icon" aria-hidden="true">${c.icon}</span></div><h3>${esc(c.title)}</h3><p class="course-desc">${esc(c.desc)}</p><div class="chips">${c.skills.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}${fills?'<span class="chip ok">✦ Bổ sung kỹ năng còn thiếu</span>':''}</div><div class="course-route"><b>Lộ trình tổng quát</b><br>${esc(c.route)}</div><div class="course-footer"><small>${esc(c.duration)}</small>${btn}</div></article>`;
  }).join('')||`<div class="card empty-state" style="grid-column:1/-1"><b>${show==='mine'?'Bạn chưa đăng ký khóa học nào':'Không tìm thấy khóa học phù hợp'}</b>${show==='mine'?'Chọn "Tất cả khóa học" để xem và đăng ký.':'Thử đổi từ khóa hoặc cấp độ.'}</div>`;
  $('coursePageText').textContent=`Trang ${coursePage}/${pages}`;$('coursePrev').disabled=coursePage===1;$('courseNext').disabled=coursePage===pages;
  $('registeredCount').textContent=`${regs.size} khóa đã đăng ký`;
}
RENDER.learning=renderCourses;
function initCourses(){
  const rr=()=>{coursePage=1;renderCourses()};
  $('courseSearch').addEventListener('input',rr);['courseLevel','courseShow','courseSort'].forEach(id=>$(id).addEventListener('change',rr));
  $('coursePrev').addEventListener('click',()=>{coursePage--;renderCourses();window.scrollTo(0,0)});
  $('courseNext').addEventListener('click',()=>{coursePage++;renderCourses();window.scrollTo(0,0)});
}
ACT['course-filter']=t=>{$('courseSearch').value=t.dataset.q;coursePage=1;renderCourses()};
ACT['courses-mine']=()=>{closeDropdown();$('courseShow').value='mine';coursePage=1;go('learning')};

/* ---------- Phỏng vấn mô phỏng ---------- */
const TRACKS={
 'Tổng hợp':[
  {q:'Hãy giới thiệu ngắn gọn về bản thân và định hướng nghề nghiệp.',kw:['dinh huong','muc tieu','ban than','kinh nghiem']},
  {q:'Hãy kể về một dự án mà bạn đã dùng dữ liệu để giải quyết vấn đề.',kw:['du lieu','phan tich','ket qua','cong cu']},
  {q:'Bạn xử lý bất đồng trong nhóm như thế nào?',kw:['lang nghe','thao luan','muc tieu chung','thong nhat']},
  {q:'Vì sao doanh nghiệp nên chọn bạn cho vị trí này?',kw:['ky nang','dong gop','gia tri','phu hop']},
  {q:'Điểm yếu lớn nhất của bạn là gì và bạn đang cải thiện nó ra sao?',kw:['cai thien','hoc','khac phuc','ke hoach']}],
 'Business Analyst':[
  {q:'Bạn sẽ làm gì khi khách hàng đưa ra yêu cầu mơ hồ hoặc liên tục thay đổi?',kw:['lam ro','cau hoi','uu tien','xac nhan','tai lieu']},
  {q:'Hãy mô tả cách bạn vẽ quy trình nghiệp vụ (BPMN) cho một quy trình đặt hàng.',kw:['bpmn','quy trinh','buoc','tac nhan','luong']},
  {q:'Bạn ưu tiên yêu cầu như thế nào khi nguồn lực có hạn?',kw:['uu tien','gia tri','chi phi','rui ro','moscow']},
  {q:'Kể về một lần bạn phải thuyết phục stakeholder đồng ý với giải pháp của mình.',kw:['stakeholder','thuyet phuc','bang chung','so lieu','loi ich']},
  {q:'Bạn kiểm tra đội phát triển đã hiểu đúng yêu cầu bằng cách nào?',kw:['review','kiem tra','tai lieu','demo','test']}],
 'Data Analyst':[
  {q:'Bạn làm gì khi nhận bộ dữ liệu có nhiều giá trị thiếu và trùng lặp?',kw:['lam sach','thieu','trung','kiem tra','xu ly']},
  {q:'Hãy giải thích sự khác nhau giữa INNER JOIN và LEFT JOIN, cho ví dụ.',kw:['join','bang','khop','null','ket qua']},
  {q:'Bạn chọn biểu đồ nào để trình bày xu hướng doanh thu theo thời gian, vì sao?',kw:['bieu do','duong','xu huong','thoi gian','de doc']},
  {q:'Kể về một insight từ dữ liệu đã giúp thay đổi quyết định kinh doanh.',kw:['insight','quyet dinh','du lieu','ket qua','de xuat']},
  {q:'Bạn giải thích kết quả phân tích cho người không có nền tảng kỹ thuật như thế nào?',kw:['de hieu','vi du','cau chuyen','doi tuong','don gian']}],
 'Digital Marketing':[
  {q:'Bạn đo lường hiệu quả một chiến dịch quảng cáo bằng những chỉ số nào?',kw:['ctr','cpc','chuyen doi','roas','chi so']},
  {q:'Nếu ngân sách giảm 30% giữa chiến dịch, bạn điều chỉnh ra sao?',kw:['uu tien','kenh','hieu qua','toi uu','ngan sach']},
  {q:'Kể về một nội dung bạn tạo ra và cách bạn biết nó hiệu quả.',kw:['noi dung','tuong tac','so lieu','doi tuong','ket qua']},
  {q:'Bạn xây dựng chân dung khách hàng mục tiêu bằng cách nào?',kw:['khach hang','nghien cuu','khao sat','hanh vi','phan khuc']},
  {q:'Bạn sẽ A/B test tiêu đề email như thế nào?',kw:['a/b','bien the','mau','ket qua','gia thuyet']}],
 'Frontend Developer':[
  {q:'Bạn làm thế nào để một trang web hiển thị tốt trên cả điện thoại và máy tính?',kw:['responsive','media query','flex','grid','mobile']},
  {q:'Sự khác nhau giữa let, const và var trong JavaScript là gì?',kw:['scope','khai bao','gan lai','hoisting','khoi']},
  {q:'Bạn tối ưu tốc độ tải của một trang web bằng những cách nào?',kw:['anh','nen','cache','tai','toi uu']},
  {q:'Kể về một lỗi khó bạn đã gặp và cách bạn tìm ra nguyên nhân.',kw:['debug','console','nguyen nhan','tai hien','sua']},
  {q:'Bạn phối hợp với designer và backend như thế nào trong một tính năng mới?',kw:['thong nhat','api','design','trao doi','tai lieu']}]
};
const I={track:'Tổng hợp',q:0,stream:null,mic:true,tick:null,rec:null,listening:false};
const curQ=()=>TRACKS[I.track][I.q];
function showQ(){$('qNum').textContent=`CÂU HỎI ${I.q+1}/${TRACKS[I.track].length}`;$('question').textContent=curQ().q}
function renderInterview(){
  const u=me();if(!u||u.role!=='student')return;
  if(!can(u,'interview')&&!isUEH(u)){
    stopCamera();$('interviewMain').classList.add('hide');$('interviewLock').innerHTML=lockPanel('interview');return;
  }
  $('interviewLock').innerHTML='';$('interviewMain').classList.remove('hide');
  showQ();
  const h=u.interviews||[];
  $('histAvg').textContent=h.length?`Trung bình ${(h.reduce((s,x)=>s+x.score,0)/h.length).toFixed(1)}/10`:'Chưa có buổi luyện tập';
  $('histList').innerHTML=h.length?h.slice(0,5).map(x=>`<div class="item"><div class="grow"><b>${esc(x.track)}</b><small class="muted" style="display:block">${esc(x.q.length>70?x.q.slice(0,67)+'...':x.q)} · ${fmtDate(x.at)}</small></div><span class="chip match">${x.score.toFixed(1)}/10</span></div>`).join(''):`<p class="muted" style="margin:0">Điểm các lần chấm sẽ được lưu tại đây để bạn theo dõi tiến bộ.</p>`;
}
RENDER.interview=renderInterview;
function gradeAnswer(text){
  const qo=curQ(),words=text.split(/\s+/).filter(Boolean).length,s=norm(text);
  const star={S:/tinh huong|boi canh|khi do|luc do|du an|thoi diem/.test(s),T:/nhiem vu|muc tieu|trach nhiem|vai tro|yeu cau/.test(s),A:/toi da|minh da|hanh dong|thuc hien|trien khai|de xuat|phan tich|xay dung/.test(s),R:/ket qua|dat duoc|tang|giam|hoan thanh|hieu qua|\d\s?%/.test(s)};
  const starHits=Object.values(star).filter(Boolean).length,kwHits=qo.kw.filter(k=>s.includes(k)).length,hasNum=/\d/.test(text);
  const fillers=(s.match(/\b(um|kieu nhu|thi la|nhu la)\b/g)||[]).length;
  const content=clamp(3+Math.min(3,words/35)+Math.min(2,kwHits*.8)+(hasNum?1:0),0,10);
  const structure=clamp(2.5+starHits*1.9,0,10);
  const flu=clamp((words<25?3+words/12:8-Math.max(0,words-200)/50)-fillers*.6,0,10);
  const presence=I.stream?8:5,total=(content+structure+flu+presence)/4;
  const tips=[];
  if(words<40)tips.push('Câu trả lời còn ngắn. Hãy triển khai thành 4-6 câu kèm ví dụ cụ thể.');
  if(words>220)tips.push('Câu trả lời khá dài. Hãy rút gọn còn khoảng 1-2 phút nói.');
  if(!hasNum)tips.push('Thêm số liệu cụ thể (%, số lượng, thời gian) để tăng sức thuyết phục.');
  const miss=Object.entries({S:'Tình huống',T:'Nhiệm vụ',A:'Hành động',R:'Kết quả'}).filter(([k])=>!star[k]).map(([,v])=>v);
  if(words>=40&&starHits<3)tips.push(`Thử áp dụng khung STAR, hiện còn thiếu: ${miss.join(', ')}.`);
  if(kwHits===0)tips.push('Bám sát câu hỏi hơn: nêu rõ khái niệm, công cụ hoặc bước làm liên quan.');
  if(fillers>=3)tips.push('Hạn chế từ đệm như "kiểu như", "thì là" khi trả lời.');
  if(!I.stream)tips.push('Bật camera để luyện tư thế và giao tiếp ánh mắt (điểm Hiện diện đang là 5).');
  return{content,structure,flu,presence,total,tips};
}
const bar=(l,v)=>`<div><span>${l}</span><div class="progress"><i style="width:${v*10}%"></i></div><b>${v.toFixed(1)}</b></div>`;
function stopCamera(){
  if(I.stream){I.stream.getTracks().forEach(t=>t.stop());I.stream=null}
  clearInterval(I.tick);I.tick=null;
  const v=$('video');if(!v)return;v.srcObject=null;v.classList.add('hide');$('videoPlaceholder').classList.remove('hide');$('startCam').classList.remove('hide');$('stopCam').classList.add('hide');$('muteBtn').classList.add('hide');$('timer').classList.add('hide');
}
async function startCamera(){
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw Object.assign(new Error('unsupported'),{name:'NotSupportedError'});
    I.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    $('video').srcObject=I.stream;$('video').classList.remove('hide');$('videoPlaceholder').classList.add('hide');$('startCam').classList.add('hide');$('stopCam').classList.remove('hide');$('muteBtn').classList.remove('hide');
    I.mic=true;$('muteBtn').textContent='Tắt mic';
    const t0=Date.now();$('timer').classList.remove('hide');clearInterval(I.tick);
    const tk=()=>{const s=Math.floor((Date.now()-t0)/1000);$('timer').textContent=`${pad(Math.floor(s/60))}:${pad(s%60)}`};tk();I.tick=setInterval(tk,1000);
  }catch(e){
    toast(e.name==='NotAllowedError'?'Bạn chưa cấp quyền camera hoặc micro. Hãy cho phép trong thanh địa chỉ của trình duyệt rồi thử lại.':e.name==='NotFoundError'?'Không tìm thấy camera hoặc micro trên thiết bị này.':'Không thể truy cập camera/micro. Hãy mở bằng Chrome/Edge, cấp quyền, hoặc chạy bằng localhost/HTTPS.','bad');
  }
}
function initInterview(){
  $('qTrack').innerHTML=Object.keys(TRACKS).map(t=>`<option>${esc(t)}</option>`).join('');
  $('qTrack').addEventListener('change',e=>{I.track=e.target.value;I.q=0;$('answer').value='';$('score').classList.add('hide');showQ()});
  $('startCam').addEventListener('click',startCamera);
  $('stopCam').addEventListener('click',stopCamera);
  $('muteBtn').addEventListener('click',()=>{I.mic=!I.mic;I.stream&&I.stream.getAudioTracks().forEach(t=>t.enabled=I.mic);$('muteBtn').textContent=I.mic?'Tắt mic':'Bật mic'});
  $('nextQ').addEventListener('click',()=>{I.q=(I.q+1)%TRACKS[I.track].length;$('answer').value='';$('score').classList.add('hide');showQ()});
  $('grade').addEventListener('click',()=>{
    const text=$('answer').value.trim();
    if(!text){toast('Hãy nhập câu trả lời trước khi chấm điểm.','warn');$('answer').focus();return}
    const g=gradeAnswer(text),u=me();
    $('score').innerHTML=`<h2>${g.total.toFixed(1)}/10</h2><div class="bars">${bar('Nội dung',g.content)}${bar('Cấu trúc STAR',g.structure)}${bar('Trôi chảy',g.flu)}${bar('Hiện diện',g.presence)}</div><b>Gợi ý cải thiện</b><ul class="tips">${(g.tips.length?g.tips:['Câu trả lời tốt. Hãy luyện thêm câu tiếp theo để giữ phong độ.']).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><small class="muted">Điểm demo dựa trên độ dài, từ khóa, cấu trúc câu trả lời và trạng thái camera, không phân tích cảm xúc hay danh tính.</small>`;
    $('score').classList.remove('hide');
    if(u){u.interviews=u.interviews||[];u.interviews.unshift({at:Date.now(),track:I.track,q:curQ().q,score:g.total});u.interviews.length=Math.min(u.interviews.length,30);persist('users');award('interview');renderInterview()}
  });
  $('speakQ').addEventListener('click',()=>{
    if(!('speechSynthesis' in window)){toast('Trình duyệt này chưa hỗ trợ đọc câu hỏi.','warn');return}
    speechSynthesis.cancel();const ut=new SpeechSynthesisUtterance(curQ().q);ut.lang='vi-VN';speechSynthesis.speak(ut);
  });
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition,dict=$('dictate');
  if(SR){
    dict.classList.remove('hide');
    dict.addEventListener('click',()=>{
      if(I.listening){I.rec&&I.rec.stop();return}
      try{
        const r=new SR();r.lang='vi-VN';r.continuous=true;r.interimResults=false;I.rec=r;
        r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal){const a=$('answer');a.value+=(a.value&&!/\s$/.test(a.value)?' ':'')+e.results[i][0].transcript.trim()}};
        r.onerror=e=>{toast(e.error==='not-allowed'?'Bạn chưa cấp quyền micro để nhập bằng giọng nói.':'Không thể nhận giọng nói lúc này. Bạn có thể gõ câu trả lời.','warn')};
        r.onend=()=>{I.listening=false;dict.textContent='🎙 Nói để nhập'};
        r.start();I.listening=true;dict.textContent='⏹ Dừng nhập';
      }catch(e){toast('Không thể bật nhập bằng giọng nói.','warn')}
    });
  }
}

/* ---------- Cộng đồng ---------- */
const C={filter:'Tất cả',open:new Set(),photo:null};
function renderCommunity(){
  const u=me(),savedSet=new Set(u?(u.savedPosts||[]):[]);
  const tags=['Tất cả','Chia sẻ','Hỏi đáp','Tuyển dụng'];
  $('postFilter').innerHTML=tags.map(t=>`<button type="button" data-act="post-filter" data-tag="${t}" class="${C.filter===t?'active':''}" aria-pressed="${C.filter===t}">${t}</button>`).join('')
    +(u?`<button type="button" data-act="post-filter" data-tag="__saved__" class="${C.filter==='__saved__'?'active':''}" aria-pressed="${C.filter==='__saved__'}">🔖 Đã lưu (${savedSet.size})</button>`:'');
  const list=(C.filter==='__saved__'?S.posts.filter(p=>savedSet.has(p.id)):S.posts.filter(p=>C.filter==='Tất cả'||p.tag===C.filter)).sort((a,b)=>b.at-a.at);
  $('posts').innerHTML=list.map(p=>{
    const likes=p.likesBase+p.likedBy.length,liked=!!u&&p.likedBy.includes(u.id),own=!!u&&p.authorId===u.id,open=C.open.has(p.id),saved=savedSet.has(p.id);
    return `<article class="card post"><div class="posthead"><div class="avatar ${p.role==='employer'?'emp':''}" aria-hidden="true">${esc(p.author[0])}</div><div class="grow"><b>${esc(p.author)}</b>${p.role==='employer'?' <span class="chip" style="padding:2px 8px;background:var(--warnbg);color:var(--warn)">Doanh nghiệp</span>':''}<small class="muted" style="display:block">${ago(p.at)}</small></div><span class="chip">${esc(p.tag)}</span>${own?`<button type="button" class="icon-btn del" data-act="post-del" data-id="${p.id}" aria-label="Xóa bài viết">×</button>`:''}</div>
    <p class="post-body">${esc(p.body)}</p>${p.img?`<img class="post-img" src="${p.img}" alt="" loading="lazy">`:''}
    <div class="post-actions"><button type="button" class="${liked?'on':''}" data-act="post-like" data-id="${p.id}" aria-pressed="${liked}">${liked?'♥':'♡'} ${likes}</button><button type="button" data-act="post-comments" data-id="${p.id}" aria-expanded="${open}">💬 ${p.comments.length?p.comments.length+' bình luận':'Bình luận'}</button><button type="button" class="${saved?'on':''}" data-act="post-save" data-id="${p.id}" aria-pressed="${saved}">${saved?'🔖 Đã lưu':'🔖 Lưu'}</button><button type="button" data-act="post-share" data-id="${p.id}">↗ Chia sẻ</button></div>
    ${open?`<div class="comments">${p.comments.map(c=>`<div class="comment"><b>${esc(c.author)}</b><small>${ago(c.at)}</small><div style="overflow-wrap:anywhere">${esc(c.body)}</div></div>`).join('')}<form class="comment-form" data-comment="${p.id}"><input name="c" maxlength="300" aria-label="Viết bình luận" placeholder="Viết bình luận..." autocomplete="off"><button class="btn primary sm">Gửi</button></form></div>`:''}</article>`;
  }).join('')||`<div class="card empty-state"><b>${C.filter==='__saved__'?'Bạn chưa lưu bài viết nào':'Chưa có bài viết trong chủ đề này'}</b>${C.filter==='__saved__'?'Bấm 🔖 Lưu trên bài viết bạn muốn xem lại.':'Hãy là người đầu tiên chia sẻ.'}</div>`;
  const conn=new Set(u?(u.connections||[]):[]);
  $('friendCount').textContent=128+conn.size;
  $('suggestions').innerHTML=PEOPLE.map(p=>`<div class="item side-row" style="align-items:center"><span><b>${esc(p.name)}</b><small class="muted" style="display:block">${esc(p.title)}</small></span><button type="button" class="btn ${conn.has(p.id)?'registered':'outline'} sm" data-act="connect" data-id="${p.id}" aria-pressed="${conn.has(p.id)}">${conn.has(p.id)?'Đã kết nối':'Kết bạn'}</button></div>`).join('');
  const pt=$('postTag');if(u&&u.role==='employer'&&!pt.dataset.set){pt.value='Tuyển dụng';pt.dataset.set='1'}
}
RENDER.community=renderCommunity;
function renderPhotoPrev(){
  const box=$('postPhotoPrev');
  box.classList.toggle('hide',!C.photo);
  box.innerHTML=C.photo?`<div class="photo-prev-wrap"><img src="${C.photo}" alt=""><button type="button" class="icon-btn del" id="postPhotoDel" aria-label="Bỏ ảnh">×</button></div>`:'';
}
function initCommunity(){
  $('postBtn').addEventListener('click',()=>{
    const u=me(),ta=$('postText');
    if(!u){requireLogin('đăng bài trong cộng đồng',()=>{refresh();$('postText').focus()});return}
    const body=ta.value.trim();if(!body&&!C.photo){toast('Hãy nhập nội dung hoặc thêm ảnh.','warn');ta.focus();return}
    S.posts.unshift({id:uid(),authorId:u.id,author:u.name,role:u.role,at:Date.now(),tag:$('postTag').value,body,img:C.photo,likesBase:0,likedBy:[],comments:[]});
    persist('posts');ta.value='';C.photo=null;renderPhotoPrev();if(C.filter!=='Tất cả'&&C.filter!==$('postTag').value)C.filter='Tất cả';
    award('post');renderCommunity();toast('Đã đăng bài.');
  });
  $('postPhotoBtn').addEventListener('click',()=>$('postPhotoInput').click());
  $('postPhotoInput').addEventListener('change',e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    compressImage(f,{max:1000,q:.72}).then(url=>{C.photo=url;renderPhotoPrev()}).catch(()=>toast('Không đọc được ảnh này. Hãy chọn tệp JPG hoặc PNG dưới 12 MB.','bad'));
  });
  $('postPhotoPrev').addEventListener('click',e=>{if(e.target.closest('#postPhotoDel')){C.photo=null;renderPhotoPrev()}});
  document.addEventListener('submit',e=>{
    const f=e.target.closest('[data-comment]');if(!f)return;e.preventDefault();
    const u=me(),v=f.elements.c.value.trim();
    if(!u){requireLogin('bình luận',()=>refresh());return}
    if(!v)return;
    const p=S.posts.find(x=>x.id===f.dataset.comment);if(!p)return;
    p.comments.push({id:uid(),author:u.name,at:Date.now(),body:v});persist('posts');award('comment');renderCommunity();
    const inp=qs(`[data-comment="${p.id}"] input`);inp&&inp.focus();
  });
}
ACT['post-filter']=t=>{C.filter=t.dataset.tag;renderCommunity()};
ACT['post-save']=t=>{
  const u=me(),id=t.dataset.id;
  if(!u){requireLogin('lưu bài viết',()=>refresh());return}
  const s=new Set(u.savedPosts||[]);s.has(id)?s.delete(id):s.add(id);u.savedPosts=[...s];persist('users');renderCommunity();
  const b=qs(`[data-act="post-save"][data-id="${id}"]`);b&&b.focus();
};
ACT['post-like']=t=>{
  const u=me(),id=t.dataset.id;
  if(!u){requireLogin('thích bài viết',()=>refresh());return}
  const p=S.posts.find(x=>x.id===id);if(!p)return;
  const i=p.likedBy.indexOf(u.id);i>-1?p.likedBy.splice(i,1):p.likedBy.push(u.id);persist('posts');renderCommunity();
  const b=qs(`[data-act="post-like"][data-id="${id}"]`);b&&b.focus();
};
ACT['post-comments']=t=>{const id=t.dataset.id;C.open.has(id)?C.open.delete(id):C.open.add(id);renderCommunity();const i=qs(`[data-comment="${id}"] input`);i&&i.focus()};
ACT['post-del']=async t=>{
  if(!await confirmBox('Xóa bài viết này?','Xóa',true))return;
  S.posts=S.posts.filter(p=>!(p.id===t.dataset.id&&p.authorId===me()?.id));persist('posts');renderCommunity();toast('Đã xóa bài viết.');
};
ACT['post-share']=async t=>{
  const p=S.posts.find(x=>x.id===t.dataset.id);if(!p)return;
  try{await navigator.clipboard.writeText(`${p.author}: ${p.body}`);toast('Đã sao chép nội dung bài viết.')}catch(e){toast('Không thể sao chép tự động. Hãy chọn và sao chép nội dung thủ công.','warn')}
};
ACT['connect']=t=>{
  const u=me();if(!u){requireLogin('kết nối với mọi người',()=>refresh());return}
  const s=new Set(u.connections||[]),id=t.dataset.id;s.has(id)?s.delete(id):s.add(id);u.connections=[...s];persist('users');renderCommunity();
  toast(s.has(id)?'Đã gửi kết nối.':'Đã hủy kết nối.');
};

/* ---------- Lodestar AI chat ---------- */
const chat={hist:[{me:false,html:'Xin chào! Mình hỗ trợ tìm việc, khóa học và lộ trình nghề nghiệp.'}],busy:false};
const salaryRange=type=>{const v=S.jobs.filter(j=>j.type===type&&jobOpen(j)).flatMap(j=>(j.salary.match(/\d+/g)||[]).map(Number));return v.length?`${Math.min(...v)} - ${Math.max(...v)} triệu`:null};
const bub=(label,act,data)=>`<button type="button" class="bub-btn" data-act="${act}" ${Object.entries(data).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ')}>${esc(label)}</button>`;
function lodestarAnswer(text){
  const s=norm(text),u=me(),st=!!u&&u.role==='student',has=re=>re.test(s);
  if(has(/^(chao|hello|hi|xin chao|alo)\b/))return `Chào ${u?esc(firstName(u.name)):'bạn'}! Bạn muốn hỏi về việc làm, khóa học, lộ trình hay phỏng vấn?`;
  if(has(/lo trinh|ke hoach/)){
    if(st&&(can(u,'roadmap')||isUEH(u))){const a=analyze(u);return `Lộ trình 12 tuần cho mục tiêu <b>${esc(a.role)}</b>:<br>${a.roadmap.map(r=>`Tuần ${r.from===r.to?r.from:r.from+'-'+r.to}: ${esc(r.title)}`).join('<br>')}${bub('Mở lộ trình trong Hồ sơ','chat-go',{view:'profile'})}`}
    if(st)return `Lộ trình cá nhân hóa cần gói Pro Max hoặc email @st.ueh.edu.vn.${bub('Xem gói nâng cấp','chat-go',{view:'pricing'})}`;
    return `Lộ trình mẫu 12 tuần: SQL, BPMN/BRD, case study, CV và phỏng vấn.${u?'':' Đăng nhập và hoàn thiện hồ sơ để Lodestar dựng lộ trình riêng cho bạn.'}`;
  }
  if(has(/khoa|hoc|course/)){
    if(st&&(can(u,'courses')||isUEH(u))){const a=analyze(u);if(a.recs.length)return `Với mục tiêu <b>${esc(a.role)}</b>, Lodestar đề xuất:${a.recs.slice(0,3).map(r=>bub(`${r.course.title} · ${r.pct}% phù hợp`,'chat-go',{view:'learning',q:r.course.title})).join('')}`}
    if(st&&!can(u,'courses')&&!isUEH(u))return `Đề xuất và đăng ký khóa học cần gói Pro trở lên hoặc email @st.ueh.edu.vn.${bub('Xem gói nâng cấp','chat-go',{view:'pricing'})}`;
    return `Lodestar đề xuất SQL for Data Analysis, Business Analysis Foundations và Digital Marketing Analytics.${u?'':' Đăng nhập để mình xếp theo kỹ năng bạn còn thiếu.'}${bub('Xem khóa học','chat-go',{view:'learning'})}`;
  }
  if(has(/viec|tuyen|job|ung tuyen/)){
    if(isEmployer())return `Bạn có thể đăng tin ở mục Tuyển dụng. Ứng viên nộp đơn sẽ được xếp hạng theo mức độ phù hợp.${bub('Đăng tin mới','post-job',{})}`;
    const ctx=jobCtx(),open=S.jobs.filter(jobOpen);
    const top=st?[...open].sort((a,b)=>ctx.match(b).score-ctx.match(a).score).slice(0,3):[...open].sort((a,b)=>b.postedAt-a.postedAt).slice(0,3);
    return `${st?'Các việc phù hợp nhất với hồ sơ của bạn:':'Một số việc mới đăng:'}${top.map(j=>bub(`${j.title} · ${j.company}${st?' · '+ctx.match(j).score+'%':''}`,'job-open',{id:j.id})).join('')}${u?'':'<br>Đăng nhập để Lodestar chấm mức độ phù hợp theo hồ sơ của bạn.'}`;
  }
  if(has(/thieu|ky nang|diem manh|diem yeu/)){
    if(st){const a=analyze(u);return `Điểm mạnh: ${a.strengths.length?esc(a.strengths.map(labelOf).join(', ')):'chưa ghi nhận'}.<br>Cần bổ sung: ${a.gaps.length?esc(a.gaps.map(labelOf).join(', ')):'không có, bạn đã đủ kỹ năng cốt lõi'}.`}
    return 'Đăng nhập và cập nhật hồ sơ, Lodestar sẽ chỉ ra kỹ năng bạn còn thiếu so với vị trí mục tiêu.';
  }
  if(has(/\bcv\b|ho so|resume/)){
    const c=st?completeness(u.profile):null;
    return `Mẹo CV chuẩn ATS: dùng đúng từ khóa trong mô tả công việc, mỗi kinh nghiệm nêu một con số kết quả và xuất PDF một cột.${c&&c.missing.length?`<br>Hồ sơ của bạn đang hoàn thiện ${c.pct}%, còn thiếu: ${esc(c.missing.slice(0,3).map(m=>m.label).join(', '))}.`:''}`;
  }
  if(has(/phong van|interview/))return `Khi trả lời hãy dùng khung STAR: Tình huống, Nhiệm vụ, Hành động, Kết quả, kèm một con số cụ thể.${bub('Luyện phỏng vấn mô phỏng','chat-go',{view:'interview'})}`;
  if(has(/luong|thu nhap|salary/)){const i=salaryRange('Intern'),f=salaryRange('Full time');return `Trong các tin đang đăng (dữ liệu mẫu), thực tập khoảng ${i||'chưa có dữ liệu'}/tháng và toàn thời gian khoảng ${f||'chưa có dữ liệu'}/tháng.`}
  if(has(/ung vien|dang tin|nha tuyen dung/))return 'Doanh nghiệp đăng tin ở mục Tuyển dụng. Mỗi ứng viên được chấm mức độ phù hợp theo kỹ năng bạn chọn cho tin đó.';
  return 'Bạn có thể hỏi Lodestar AI về việc làm, khóa học, kỹ năng còn thiếu, lộ trình, CV hoặc phỏng vấn.';
}
function renderChat(){
  const box=$('lodestarMessages');
  box.innerHTML=chat.hist.map(m=>`<div class="msg ${m.me?'me':''}"><span>${m.html}</span></div>`).join('')+(chat.busy?'<div class="msg"><span class="typing" aria-label="Lodestar AI đang trả lời"><i></i><i></i><i></i></span></div>':'');
  box.scrollTop=box.scrollHeight;
}
function openChat(open=true){
  $('lodestarChat').classList.toggle('hide',!open);$('lodestarFab').setAttribute('aria-expanded',open);
  if(open){renderChat();updateChatMeta();usageStart();setTimeout(()=>$('lodestarInput').focus(),30)}
  else usageStop();
}
function sendChat(text){
  if(!text||chat.busy)return;
  const u=me();
  if(u&&u.role==='student'&&remainingSec(u)<=0){chatLimitNotice();return}
  chat.hist.push({me:true,html:esc(text)});chat.busy=true;renderChat();
  setTimeout(()=>{chat.hist.push({me:false,html:lodestarAnswer(text)});chat.busy=false;renderChat()},600);
}
function initChat(){
  $('lodestarQuick').innerHTML=['Việc làm phù hợp','Khóa học nên học','Lộ trình 12 tuần','Kỹ năng còn thiếu','Mẹo viết CV','Mẹo phỏng vấn'].map(t=>`<button type="button" data-q="${t}">${t}</button>`).join('');
  $('lodestarQuick').addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(b)sendChat(b.dataset.q)});
  $('lodestarFab').addEventListener('click',()=>openChat($('lodestarChat').classList.contains('hide')));
  $('closeLodestar').addEventListener('click',()=>{openChat(false);$('lodestarFab').focus()});
  $('lodestarForm').addEventListener('submit',e=>{e.preventDefault();const t=$('lodestarInput').value.trim();$('lodestarInput').value='';sendChat(t)});
  $('lodestarChat').addEventListener('keydown',e=>{if(e.key==='Escape'){openChat(false);$('lodestarFab').focus()}});
}
ACT['chat-open']=()=>openChat(true);
ACT['chat-go']=t=>{if(t.dataset.q&&t.dataset.view==='learning'){$('courseSearch').value=t.dataset.q;coursePage=1}go(t.dataset.view)};

/* ---------- Trang chủ ---------- */
function renderHome(){
  const u=me(),st=!!u&&u.role==='student',emp=!!u&&u.role==='employer',ctx=jobCtx(),open=S.jobs.filter(jobOpen);
  const lead=$('heroLead'),cta=$('heroCta'),card=$('heroCard');
  if(st){
    const a=analyze(u),c=completeness(u.profile),good=open.filter(j=>ctx.match(j).score>=70).length;
    lead.textContent=`Chào ${firstName(u.name)}! Lodestar AI đã chấm mức độ phù hợp của ${open.length} việc làm với hồ sơ của bạn.`;
    cta.innerHTML=`<button type="button" class="btn orange" data-act="jobs-best">Xem việc phù hợp</button><button type="button" class="btn light" data-go="profile">Cập nhật hồ sơ</button>`;
    const ueh=isUEH(u),tier=tierOf(u),lim=limitSec(u);
    card.innerHTML=`<div class="side-row" style="margin-bottom:2px"><small class="muted">Độ hoàn thiện hồ sơ</small><span class="chip ${ueh?'ok':''}" style="font-size:11px">${ueh?'🎓 SV UEH':'Gói '+PLANS[tier].name}</span></div><div class="pct">${c.pct}%</div><div class="progress" role="progressbar" aria-label="Độ hoàn thiện hồ sơ" aria-valuenow="${c.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${c.pct}%"></i></div><div class="stats"><div><b>${good}</b><small>Việc phù hợp</small></div><div><b>${a.recs.length}</b><small>Khóa học</small></div><div><b>12 tuần</b><small>Lộ trình</small></div></div>${c.missing.length?`<p class="notice" style="margin:12px 0 0">Bổ sung <button type="button" class="linkbtn" data-act="${c.missing[0].act}">${esc(c.missing[0].label.toLowerCase())}</button> để tăng độ chính xác.</p>`:lim!==Infinity?`<p class="notice" style="margin:12px 0 0">Còn ${fmtHM(remainingSec(u))} Lodestar tháng này. <button type="button" class="linkbtn" data-go="pricing">Nâng cấp</button></p>`:''}`;
  }else if(emp){
    const mine=S.jobs.filter(j=>j.ownerId===u.id),apps=S.apps.filter(x=>mine.some(j=>j.id===x.jobId));
    lead.textContent='Đăng tin tuyển dụng và nhận ứng viên được Lodestar AI xếp hạng theo mức độ phù hợp.';
    cta.innerHTML=`<button type="button" class="btn orange" data-act="post-job">Đăng tin mới</button><button type="button" class="btn light" data-go="employer">Quản lý tuyển dụng</button>`;
    card.innerHTML=`<small class="muted">Tin đang tuyển của ${esc(u.name)}</small><div class="pct">${mine.filter(jobOpen).length}</div><div class="stats"><div><b>${apps.length}</b><small>Ứng viên</small></div><div><b>${apps.filter(x=>x.status==='submitted').length}</b><small>Chưa xem</small></div><div><b>${apps.filter(x=>x.status==='interview').length}</b><small>Phỏng vấn</small></div></div>`;
  }else{
    lead.textContent='Hồ sơ năng lực, việc làm mới nhất, phỏng vấn mô phỏng và cộng đồng nghề nghiệp trong cùng một nền tảng.';
    cta.innerHTML=`<button type="button" class="btn orange" data-act="register">Tạo hồ sơ miễn phí</button><button type="button" class="btn light" data-go="jobs">Xem việc làm</button>`;
    card.innerHTML=`<small class="muted">Hồ sơ minh họa · Độ hoàn thiện</small><div class="pct">86%</div><div class="progress"><i style="width:86%"></i></div><div class="stats"><div><b>23</b><small>Việc phù hợp</small></div><div><b>3</b><small>Khóa học</small></div><div><b>12 tuần</b><small>Lộ trình</small></div></div><p class="notice" style="margin:12px 0 0">Đây là ví dụ. <button type="button" class="linkbtn" data-act="register">Tạo hồ sơ của bạn</button> để Lodestar AI phân tích thật.</p>`;
  }
  const questions=Object.values(TRACKS).reduce((s,t)=>s+t.length,0);
  $('strip').innerHTML=`<div><b>${open.length}</b><span>Việc làm đang mở</span></div><div><b>${new Set(open.map(j=>j.company)).size}</b><span>Doanh nghiệp tuyển dụng</span></div><div><b>${COURSES.length}</b><span>Khóa học phát triển kỹ năng</span></div><div><b>${questions}</b><span>Câu hỏi phỏng vấn mô phỏng</span></div>`;
  const pick=st?[...open].sort((a,b)=>ctx.match(b).score-ctx.match(a).score||b.postedAt-a.postedAt):[...open].sort((a,b)=>b.postedAt-a.postedAt);
  $('homeJobs').innerHTML=pick.slice(0,3).map(j=>miniJobCard(j,ctx)).join('');
  $('ctaBand').innerHTML=emp?`<div><h2>Đăng thêm tin để nhận nhiều ứng viên hơn</h2><p>Tin mới luôn hiển thị đầu danh sách Việc làm và có thể chia sẻ lên Cộng đồng.</p></div><button type="button" class="btn orange" data-act="post-job">Đăng tin mới</button>`
    :st?(can(me(),'interview')||isUEH(me())?`<div><h2>Sẵn sàng cho buổi phỏng vấn đầu tiên?</h2><p>Chọn chủ đề, trả lời từng câu hỏi và nhận điểm cùng gợi ý cải thiện từ Lodestar AI.</p></div><button type="button" class="btn orange" data-go="interview">Luyện phỏng vấn mô phỏng</button>`
        :`<div><h2>Mở khóa phòng phỏng vấn mô phỏng</h2><p>Nâng cấp gói Pro hoặc dùng email @st.ueh.edu.vn để luyện phỏng vấn và nhận điểm từ Lodestar AI.</p></div><button type="button" class="btn orange" data-go="pricing">Xem gói nâng cấp</button>`)
    :`<div><h2>Bạn đang tìm sinh viên và nhân sự trẻ?</h2><p>Đăng tin tuyển dụng miễn phí, nhận ứng viên đã được Lodestar AI xếp hạng theo mức độ phù hợp với vị trí.</p></div><button type="button" class="btn orange" data-act="emp-cta">Đăng ký nhà tuyển dụng</button>`;
}
RENDER.home=renderHome;
function initHome(){
  $('heroSearch').addEventListener('submit',e=>{
    e.preventDefault();$('jobSearch').value=$('hsQ').value.trim();$('jobCity').value=$('hsCity').value;
    $('jobSchedule').selectedIndex=0;$('jobWorkplace').selectedIndex=0;J.tab='all';J.page=1;go('jobs');
  });
  qs('.quick').addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(!b)return;$('hsQ').value=b.dataset.q;$('heroSearch').requestSubmit()});
}
ACT['jobs-best']=()=>{ACT['jobs-reset']();$('jobSort').value='match';J.tab='all';go('jobs');renderJobs()};

/* ---------- Sự kiện chung ---------- */
ACT.login=()=>openAuth('login');
ACT.register=()=>openAuth('register');
ACT.bell=t=>{
  const u=me();if(!u)return;
  openDropdown('bell',t,notifHtml(u));
  const l=S.notifs[u.id]||[];
  if(l.some(n=>!n.read)){l.forEach(n=>{n.read=true});persist('notifs');const d=qs('.bell .dot');d&&d.remove();t.setAttribute('aria-label','Thông báo')}
};
ACT.usermenu=t=>{const u=me();if(u)openDropdown('user',t,userMenuHtml(u))};
ACT.settings=()=>openSettings();
ACT.logout=()=>logout();
ACT.faq=()=>{go('home');setTimeout(()=>{const f=qs('.faq');f&&f.scrollIntoView({behavior:'smooth',block:'start'})},60)};
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-act]');
  if(a&&ACT[a.dataset.act]){ACT[a.dataset.act](a,e)}
  const g=e.target.closest('[data-go]');if(g)go(g.dataset.go);
  const v=e.target.closest('#tabs [data-view]');if(v)go(v.dataset.view);
  if(!e.target.closest('.dropdown')&&!e.target.closest('[data-act=bell],[data-act=usermenu],[data-act=theme-menu]'))closeDropdown();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDropdown()});

/* ---------- Khởi động ---------- */
async function boot(){
  applyTheme(store.get('theme','light'));
  const src=$('brandLogo').src;qsa('img[data-logo]').forEach(i=>{i.src=src});
  $('brand').addEventListener('click',()=>go('home'));
  $('hdrActions').innerHTML='<div class="hdr-btns" id="hdrBtns"></div><div id="ddRoot"></div>';
  document.body.insertAdjacentHTML('beforeend',`<datalist id="skillList">${CAT.map(s=>`<option value="${esc(s.label)}"></option>`).join('')}</datalist>`);
  loadState();await seedIfNeeded();
  const sid=readSession();if(sid&&S.users.some(u=>u.id===sid)){meId=sid;ensureUserDefaults(me());award('login')}
  initAuth();initJobsUI();initHr();initCourses();initInterview();initCommunity();initChat();initHome();
  window.addEventListener('beforeunload',()=>{stopCamera();usageStop()});
  go(hashView(),{fromHash:true});
}
boot().catch(err=>{console.error(err);document.body.insertAdjacentHTML('afterbegin','<div class="error" style="margin:20px" role="alert">Không thể khởi động trang. Hãy tải lại trang hoặc xóa dữ liệu trình duyệt của tệp này rồi thử lại.</div>')});


})();
