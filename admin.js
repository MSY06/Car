(() => {
"use strict";
const cfg=window.BOURSA_CONFIG||{},$=s=>document.querySelector(s),DEFAULT_IMG="https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=300&q=70";
let db=null,user=null,cars=[],leads=[],cats=[],channel=null,timer;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>Number(n||0).toLocaleString("en-US")+" MRU";
function toast(s,error=false){const el=$("#toast");el.textContent=s;el.className="show"+(error?" error":"");clearTimeout(timer);timer=setTimeout(()=>el.className="",3500);}
function init(){
 if(!window.supabase||!cfg.SUPABASE_URL||cfg.SUPABASE_URL.includes("YOUR_")||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.includes("YOUR_")){$("#loginError").textContent="يرجى إعداد ملف config.js أولاً.";return;}
 db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 $("#loginForm").addEventListener("submit",login);$("#logout").addEventListener("click",logout);
 $("#carForm").addEventListener("submit",saveCar);$("#clearForm").addEventListener("click",resetForm);
 $("#categoryForm").addEventListener("submit",addCategory);$("#carSearch").addEventListener("input",renderCars);
 $("#exportLeads").addEventListener("click",exportLeads);
 document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
 $("#imageFile").addEventListener("change",previewImage);
 db.auth.onAuthStateChange((_event,session)=>{if(session?.user) setTimeout(()=>verifyAdmin(session.user),0);});
 db.auth.getSession().then(({data})=>{if(data.session?.user)verifyAdmin(data.session.user);});
}
async function login(e){e.preventDefault();const btn=$("#loginBtn");btn.disabled=true;$("#loginError").textContent="";
 const {data,error}=await db.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
 btn.disabled=false;if(error){$("#loginError").textContent="تعذر تسجيل الدخول. تحقق من البيانات.";return;}await verifyAdmin(data.user);}
async function verifyAdmin(u){
 const {data,error}=await db.from("admin_users").select("user_id").eq("user_id",u.id).maybeSingle();
 if(error||!data){await db.auth.signOut();$("#loginError").textContent="هذا الحساب غير مخوّل لإدارة المنصة.";return;}
 user=u;$("#loginView").hidden=true;$("#dashboard").hidden=false;$("#logout").hidden=false;$("#adminEmail").textContent=u.email||"مدير";
 await refresh();
 if(channel)db.removeChannel(channel);
 channel=db.channel("boursa-admin-leads").on("postgres_changes",{event:"INSERT",schema:"public",table:"leads"},()=>{toast("وصل طلب اهتمام جديد");refresh();}).subscribe();
}
async function logout(){if(channel)await db.removeChannel(channel);await db.auth.signOut();location.reload();}
async function refresh(){
 const [a,b,c]=await Promise.all([db.from("cars").select("*").order("created_at",{ascending:false}),db.from("leads").select("*").order("created_at",{ascending:false}),db.from("categories").select("*").order("name")]);
 if(a.error||b.error||c.error){toast("تعذر تحميل البيانات. راجع صلاحيات قاعدة البيانات.",true);console.error(a.error,b.error,c.error);return;}
 cars=a.data||[];leads=b.data||[];cats=c.data||[];
 $("#statCars").textContent=cars.length;$("#statLeads").textContent=leads.filter(x=>x.status==="new").length;$("#statCats").textContent=cats.length;
 $("#category").innerHTML=cats.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")||'<option value="">أضف قسماً أولاً</option>';
 renderCars();renderLeads();renderCategories();
}
function showTab(name){document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));["cars","leads","categories"].forEach(n=>$("#"+n+"Tab").hidden=n!==name);}
function renderCars(){const q=$("#carSearch").value.trim().toLowerCase();const list=cars.filter(c=>(c.title+" "+(c.city||"")).toLowerCase().includes(q));
 $("#carsList").innerHTML=list.map(c=>`<div class="item"><img src="${esc(c.image_url||DEFAULT_IMG)}" alt=""><div class="item-main"><b>${esc(c.title)}</b><div class="muted">${money(c.price)} • ${esc(c.city)} ${c.is_active?"":"• مخفية"}</div></div><div class="item-actions"><button class="secondary" data-edit="${esc(c.id)}">تعديل</button><button class="secondary" data-toggle="${esc(c.id)}">${c.is_active?"إخفاء":"إظهار"}</button><button class="danger" data-delete="${esc(c.id)}">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد سيارات.</div>';
 $("#carsList").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editCar(b.dataset.edit));
 $("#carsList").querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleCar(b.dataset.toggle));
 $("#carsList").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteCar(b.dataset.delete));
}
function renderLeads(){$("#leadsList").innerHTML=leads.map(l=>`<div class="item"><div class="lead-details"><b>${esc(l.name)} • ${esc(l.phone)}</b><div class="muted">السيارة: ${esc(l.car_title||"—")} • ${new Date(l.created_at).toLocaleString("ar-MR")}</div></div><select data-status="${esc(l.id)}"><option value="new" ${l.status==="new"?"selected":""}>جديد</option><option value="contacted" ${l.status==="contacted"?"selected":""}>تم التواصل</option><option value="sold" ${l.status==="sold"?"selected":""}>تم البيع</option></select><a class="secondary" href="https://wa.me/${String(l.phone).replace(/\D/g,"")}" target="_blank" rel="noopener">واتساب</a></div>`).join("")||'<div class="empty">لا توجد طلبات اهتمام.</div>';
 $("#leadsList").querySelectorAll("[data-status]").forEach(s=>s.onchange=async()=>{const {error}=await db.from("leads").update({status:s.value}).eq("id",s.dataset.status);if(error)toast("فشل تحديث الحالة",true);else{const l=leads.find(x=>x.id===s.dataset.status);if(l)l.status=s.value;$("#statLeads").textContent=leads.filter(x=>x.status==="new").length;toast("تم تحديث الحالة");}});}
function renderCategories(){$("#categoriesList").innerHTML=cats.map(c=>`<div class="item"><div class="item-main"><b>${esc(c.name)}</b><div class="muted">${cars.filter(x=>x.category_id===c.id).length} سيارة</div></div><button class="danger" data-cat-delete="${esc(c.id)}">حذف</button></div>`).join("")||'<div class="empty">لا توجد أقسام.</div>';
 $("#categoriesList").querySelectorAll("[data-cat-delete]").forEach(b=>b.onclick=()=>deleteCategory(b.dataset.catDelete));}
async function compress(file){if(!file||!file.type.startsWith("image/"))throw Error("الملف ليس صورة");if(file.size>12*1024*1024)throw Error("حجم الصورة أكبر من 12MB");if(file.type==="image/jpeg"&&file.size<500000)return file;
 const bitmap=await createImageBitmap(file),scale=Math.min(1600/bitmap.width,1600/bitmap.height,1),canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.84));return new File([blob],"car.jpg",{type:"image/jpeg"});}
async function upload(file){const image=await compress(file),path=`cars/${user.id}/${crypto.randomUUID()}.jpg`;const {error}=await db.storage.from("car-images").upload(path,image,{contentType:"image/jpeg",cacheControl:"3600",upsert:false});if(error)throw error;return db.storage.from("car-images").getPublicUrl(path).data.publicUrl;}
async function saveCar(e){e.preventDefault();const btn=$("#saveCar");btn.disabled=true;let imageUrl=$("#imageUrl").value.trim()||null;
 try{const f=$("#imageFile").files[0];if(f)imageUrl=await upload(f);}catch(err){toast("تعذر رفع الصورة: "+err.message,true);btn.disabled=false;return;}
 const payload={title:$("#title").value.trim(),price:Number($("#price").value),year:Number($("#year").value),km:Number($("#km").value||0),fuel:$("#fuel").value,city:$("#city").value,category_id:$("#category").value||null,inspection_status:$("#inspection").value,image_url:imageUrl,description:$("#description").value.trim()||null};
 const id=$("#carId").value;const result=id?await db.from("cars").update(payload).eq("id",id):await db.from("cars").insert(payload);
 btn.disabled=false;if(result.error){console.error(result.error);toast("فشل الحفظ: "+result.error.message,true);return;}resetForm();await refresh();toast("تم حفظ السيارة بنجاح");}
function resetForm(){$("#carForm").reset();$("#carId").value="";$("#km").value=0;$("#formHeading").textContent="إضافة سيارة";$("#preview").hidden=true;}
function editCar(id){const c=cars.find(x=>x.id===id);if(!c)return;$("#carId").value=c.id;$("#title").value=c.title;$("#price").value=c.price;$("#year").value=c.year;$("#km").value=c.km;$("#fuel").value=c.fuel;$("#city").value=c.city;$("#category").value=c.category_id||"";$("#inspection").value=c.inspection_status;$("#imageUrl").value=c.image_url||"";$("#description").value=c.description||"";$("#preview").src=c.image_url||"";$("#preview").hidden=!c.image_url;$("#formHeading").textContent="تعديل السيارة";showTab("cars");window.scrollTo({top:0,behavior:"smooth"});}
async function toggleCar(id){const c=cars.find(x=>x.id===id);const {error}=await db.from("cars").update({is_active:!c.is_active}).eq("id",id);if(error)toast("تعذر تحديث السيارة",true);else refresh();}
async function deleteCar(id){if(!confirm("هل تريد حذف السيارة نهائياً؟"))return;const {error}=await db.from("cars").delete().eq("id",id);if(error)toast("تعذر حذف السيارة",true);else{await refresh();toast("تم حذف السيارة");}}
async function addCategory(e){e.preventDefault();const name=$("#newCategory").value.trim();if(!name)return;const {error}=await db.from("categories").insert({name});if(error)toast("تعذر إضافة القسم: "+error.message,true);else{$("#newCategory").value="";await refresh();toast("تمت إضافة القسم");}}
async function deleteCategory(id){if(cars.some(c=>c.category_id===id))return toast("انقل السيارات إلى قسم آخر قبل حذف هذا القسم",true);if(!confirm("حذف القسم؟"))return;const {error}=await db.from("categories").delete().eq("id",id);if(error)toast("تعذر حذف القسم",true);else{await refresh();toast("تم حذف القسم");}}
function previewImage(e){const f=e.target.files[0];if(!f){$("#preview").hidden=true;return;}if(!f.type.startsWith("image/")){toast("اختر ملف صورة صالحاً",true);e.target.value="";return;}$("#preview").src=URL.createObjectURL(f);$("#preview").hidden=false;}
function exportLeads(){if(!leads.length)return toast("لا توجد بيانات للتصدير",true);const rows=[["الاسم","الهاتف","السيارة","الحالة","التاريخ"],...leads.map(l=>[l.name,l.phone,l.car_title||"",l.status,new Date(l.created_at).toLocaleString("ar-MR")])];const csv="\ufeff"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");const a=document.createElement("a"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="boursa-leads.csv";a.click();URL.revokeObjectURL(url);}
init();
})();