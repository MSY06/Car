(() => {
"use strict";
const cfg = window.BOURSA_CONFIG || {};
const $ = s => document.querySelector(s);
const DEFAULT_IMG = "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80";
const money = n => `${Number(n || 0).toLocaleString("en-US")} MRU`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let client = null, cars = [], categories = [], toastTimer;
function toast(message, error=false){const el=$("#toast");el.textContent=message;el.className="toast show"+(error?" error":"");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className="toast",3500);}
function setup(){
  if(cfg.WHATSAPP_NUMBER && !cfg.WHATSAPP_NUMBER.includes("X")){$("#contactTop").href=`https://wa.me/${cfg.WHATSAPP_NUMBER}`;$("#footerPhone").textContent=cfg.PHONE_DISPLAY||"";}
  if(!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR_") || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes("YOUR_")){
    $("#loading").hidden=true;$("#loadError").hidden=false;$("#resultCount").textContent="الإعداد غير مكتمل";return;
  }
  client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  bind();load();
}
function bind(){
  ["q","category","city","sort","minPrice","maxPrice"].forEach(id=>{$("#"+id).addEventListener("input",render);$("#"+id).addEventListener("change",render);});
  $("#resetFilters").addEventListener("click",()=>{["q","minPrice","maxPrice"].forEach(id=>$("#"+id).value="");$("#category").value="";$("#city").value="";$("#sort").value="newest";render();});
  $("#carModal").addEventListener("click",e=>{if(e.target.matches("[data-close]"))closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
}
async function load(){
  $("#loading").hidden=false;$("#loadError").hidden=true;
  const [catRes,carRes]=await Promise.all([
    client.from("categories").select("id,name").eq("is_active",true).order("name"),
    client.from("cars").select("id,title,price,year,km,fuel,city,inspection_status,description,image_url,category_id,created_at").eq("is_active",true).order("created_at",{ascending:false})
  ]);
  $("#loading").hidden=true;
  if(catRes.error||carRes.error){console.error(catRes.error||carRes.error);$("#loadError").hidden=false;$("#resultCount").textContent="تعذر التحميل";return;}
  categories=catRes.data||[];cars=carRes.data||[];
  $("#category").innerHTML='<option value="">كل الأقسام</option>'+categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  render();
  const id=new URLSearchParams(location.search).get("car");if(id)openCar(id);
}
function render(){
  let list=[...cars],q=$("#q").value.trim().toLowerCase(),cat=$("#category").value,city=$("#city").value;
  if(q)list=list.filter(c=>(c.title+" "+(c.description||"")).toLowerCase().includes(q));
  if(cat)list=list.filter(c=>c.category_id===cat);
  if(city)list=list.filter(c=>c.city===city);
  const min=Number($("#minPrice").value),max=Number($("#maxPrice").value);
  if($("#minPrice").value!=="")list=list.filter(c=>Number(c.price)>=min);
  if($("#maxPrice").value!=="")list=list.filter(c=>Number(c.price)<=max);
  if($("#sort").value==="low")list.sort((a,b)=>a.price-b.price);
  if($("#sort").value==="high")list.sort((a,b)=>b.price-a.price);
  $("#resultCount").textContent=`${list.length} سيارة`;
  $("#empty").hidden=list.length!==0;
  $("#carGrid").innerHTML=list.map(c=>{
    const verified=c.inspection_status==="done",catName=categories.find(x=>x.id===c.category_id)?.name||"";
    return `<article class="car-card" tabindex="0" role="button" aria-label="تفاصيل ${esc(c.title)}" data-car="${esc(c.id)}">
      <img class="car-image" src="${esc(c.image_url||DEFAULT_IMG)}" alt="${esc(c.title)}" loading="lazy" onerror="this.src='${DEFAULT_IMG}'">
      <div class="car-content"><h3>${esc(c.title)}</h3><div class="car-meta">${esc(c.year)} • ${esc(c.fuel)} • ${esc(c.city)} • ${Number(c.km||0).toLocaleString("en-US")} كم ${catName?"• "+esc(catName):""}</div>
      <div class="car-price">${money(c.price)}</div><div class="car-badges"><span class="tag ${verified?"":"pending"}">${verified?"تم الفحص":"بانتظار الفحص"}</span></div></div></article>`;
  }).join("");
  $("#carGrid").querySelectorAll("[data-car]").forEach(el=>{el.addEventListener("click",()=>openCar(el.dataset.car));el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")openCar(el.dataset.car);});});
}
function openCar(id){
  const c=cars.find(x=>x.id===id);if(!c)return;
  const verified=c.inspection_status==="done";
  const share=`${location.origin}${location.pathname}?car=${encodeURIComponent(c.id)}`;
  const message=`مرحباً، أنا مهتم بالسيارة ${c.title} (${c.year}) بسعر ${money(c.price)}. ${share}`;
  const wa=cfg.WHATSAPP_NUMBER&&!cfg.WHATSAPP_NUMBER.includes("X")?`https://wa.me/${cfg.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`:"#";
  $("#carDetail").innerHTML=`<img class="detail-image" src="${esc(c.image_url||DEFAULT_IMG)}" alt="${esc(c.title)}" onerror="this.src='${DEFAULT_IMG}'"><div class="detail-body">
    <span class="eyebrow">تفاصيل السيارة</span><h2 id="detailTitle">${esc(c.title)}</h2><p class="detail-desc">${esc(c.description||"لا يوجد وصف إضافي.")}</p>
    <div class="specs"><div><small>السنة</small><b>${esc(c.year)}</b></div><div><small>المسافة</small><b>${Number(c.km||0).toLocaleString("en-US")} كم</b></div><div><small>الوقود</small><b>${esc(c.fuel)}</b></div><div><small>المدينة</small><b>${esc(c.city)}</b></div><div><small>حالة الفحص</small><b>${verified?"تم الفحص":"بانتظار الفحص"}</b></div><div><small>السعر</small><b>${money(c.price)}</b></div></div>
    <strong class="car-price">${money(c.price)}</strong><a class="button button-dark" style="margin-top:12px" href="${wa}" target="_blank" rel="noopener">التواصل عبر واتساب</a>
    <div id="interestWrap"><h3 style="margin:22px 0 5px;color:var(--green)">اترك بياناتك لنتواصل معك</h3><form class="lead-form" id="leadForm"><input id="leadName" required minlength="2" maxlength="100" placeholder="الاسم"><input id="leadPhone" required maxlength="24" inputmode="tel" placeholder="رقم الهاتف"><button class="button button-dark" type="submit">إرسال الاهتمام</button></form></div>
  </div>`;
  $("#leadForm").addEventListener("submit",e=>submitLead(e,c));
  $("#carModal").classList.add("open");$("#carModal").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";
}
function closeModal(){$("#carModal").classList.remove("open");$("#carModal").setAttribute("aria-hidden","true");document.body.style.overflow="";$("#carDetail").innerHTML="";if(!new URLSearchParams(location.search).has("car"))return;history.replaceState({}, "", location.pathname);}
async function submitLead(e,car){
  e.preventDefault();const name=$("#leadName").value.trim(),phone=$("#leadPhone").value.trim();
  if(name.length<2||phone.replace(/\D/g,"").length<7)return toast("يرجى إدخال اسم ورقم هاتف صحيحين",true);
  const btn=e.submitter;btn.disabled=true;btn.textContent="جارٍ الإرسال…";
  const {error}=await client.from("leads").insert({car_id:car.id,car_title:car.title,name,phone});
  btn.disabled=false;btn.textContent="إرسال الاهتمام";
  if(error){console.error(error);toast("تعذر إرسال الطلب. حاول لاحقاً.",true);return;}
  $("#interestWrap").innerHTML='<div class="notice" style="margin-top:15px;background:#edf4eb;color:#315b39">تم تسجيل اهتمامك بنجاح. سنتواصل معك قريباً.</div>';toast("تم إرسال اهتمامك بنجاح");
}
setup();
})();