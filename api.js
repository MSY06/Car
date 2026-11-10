window.ANEQ = (function () {
  const USE_SB = !!(window.SUPABASE_URL && window.SUPABASE_KEY && window.supabase);
  const sb = USE_SB ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY) : null;
  const K = { products: 'aneq_products', orders: 'aneq_orders', settings: 'aneq_settings', cart: 'aneq_cart' };
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const DEF_SET = { storeName: 'ANEQ STORE', currency: 'ر.س', whatsapp: '966500000000', password: 'admin123' };
  const DEF_PRODS = [
    { id:1, name:'سماعات لاسلكية احترافية', price:199, oldPrice:299, cat:'إلكترونيات', stock:45, emoji:'🎧', desc:'عزل ضوضاء نشط + بطارية 40 ساعة', rate:4.8, img:'' },
    { id:2, name:'ساعة ذكية Sport', price:349, oldPrice:0, cat:'إلكترونيات', stock:12, emoji:'⌚', desc:'تتبع صحة ولياقة ومقاومة للماء', rate:4.9, img:'' },
    { id:3, name:'حقيبة ظهر مقاومة للماء', price:129, oldPrice:0, cat:'حقائب', stock:30, emoji:'🎒', desc:'تصميم عملي مع جيب لابتوب', rate:4.5, img:'' },
    { id:4, name:'حذاء رياضي خفيف', price:249, oldPrice:320, cat:'أحذية', stock:22, emoji:'👟', desc:'مثالي للجري والاستخدام اليومي', rate:4.7, img:'' },
    { id:5, name:'نظارة شمسية UV400', price:89, oldPrice:0, cat:'اكسسوارات', stock:50, emoji:'🕶️', desc:'حماية كاملة من أشعة الشمس', rate:4.3, img:'' },
    { id:6, name:'زجاجة ستانلس 750ml', price:59, oldPrice:0, cat:'اكسسوارات', stock:67, emoji:'🧴', desc:'تحفظ الحرارة 24 ساعة', rate:4.6, img:'' },
    { id:7, name:'كيبورد ميكانيكي RGB', price:289, oldPrice:359, cat:'إلكترونيات', stock:8, emoji:'⌨️', desc:'سويتش أحمر + إضاءة قابلة للتخصيص', rate:4.7, img:'' },
    { id:8, name:'شاحن لاسلكي 15W', price:79, oldPrice:0, cat:'إلكترونيات', stock:3, emoji:'🔌', desc:'شحن سريع متوافق مع كل الأجهزة', rate:4.4, img:'' }
  ];

  if (!USE_SB) {
    if (lsGet(K.products) == null) lsSet(K.products, DEF_PRODS);
    if (lsGet(K.orders) == null) lsSet(K.orders, []);
    if (lsGet(K.settings) == null) lsSet(K.settings, DEF_SET);
  }

  const products = {
    async list() {
      if (USE_SB) { const { data, error } = await sb.from('products').select('*').order('id', { ascending: false }); if (error) throw error; return data || []; }
      return lsGet(K.products, []);
    },
    async create(p) {
      const row = { name:p.name, price:+p.price, oldPrice:+(p.oldPrice||0), cat:p.cat||'عام', stock:+(p.stock||0), emoji:p.emoji||'📦', desc:p.desc||'', rate:+(p.rate||4.5), img:p.img||'' };
      if (USE_SB) { const { data, error } = await sb.from('products').insert(row).select().single(); if (error) throw error; return data; }
      const arr = lsGet(K.products, []); const item = { ...row, id: Date.now() }; arr.unshift(item); lsSet(K.products, arr); return item;
    },
    async update(id, patch) {
      const row = { name:patch.name, price:+patch.price, oldPrice:+(patch.oldPrice||0), cat:patch.cat||'عام', stock:+(patch.stock||0), emoji:patch.emoji||'📦', desc:patch.desc||'', rate:+(patch.rate||4.5), img:patch.img||'' };
      if (USE_SB) { const { data, error } = await sb.from('products').update(row).eq('id', id).select().single(); if (error) throw error; return data; }
      const arr = lsGet(K.products, []); const i = arr.findIndex(x => x.id == id); if (i < 0) throw new Error('غير موجود'); arr[i] = { ...arr[i], ...row }; lsSet(K.products, arr); return arr[i];
    },
    async remove(id) {
      if (USE_SB) { const { error } = await sb.from('products').delete().eq('id', id); if (error) throw error; return; }
      lsSet(K.products, lsGet(K.products, []).filter(x => x.id != id));
    }
  };

  const orders = {
    async list() {
      if (USE_SB) {
        const { data, error } = await sb.from('orders').select('*').order('id', { ascending: false }); if (error) throw error;
        return (data || []).map(o => ({ ...o, total: Number(o.total), date: o.date || (o.created_at ? new Date(o.created_at).toLocaleString('ar-EG') : '') }));
      }
      return lsGet(K.orders, []);
    },
    async create(payload) {
      if (USE_SB) {
        const { data, error } = await sb.rpc('create_order', {
          p_customer: payload.customer, p_phone: payload.phone,
          p_address: payload.address || '', p_notes: payload.notes || '',
          p_items: payload.items.map(i => ({ id: i.id, qty: i.qty }))
        }); if (error) throw error; return data;
      }
      const total = payload.items.reduce((s, i) => s + i.price * i.qty, 0);
      const order = { id: Date.now(), customer: payload.customer, phone: payload.phone, address: payload.address||'', notes: payload.notes||'', items: payload.items, total, status:'جديد', date: new Date().toLocaleString('ar-EG') };
      const arr = lsGet(K.orders, []); arr.unshift(order); lsSet(K.orders, arr);
      const prods = lsGet(K.products, []); payload.items.forEach(it => { const p = prods.find(x => x.id == it.id); if (p) p.stock = Math.max(0, p.stock - it.qty); }); lsSet(K.products, prods);
      return order;
    },
    async update(id, patch) {
      if (USE_SB) { const { data, error } = await sb.from('orders').update(patch).eq('id', id).select().single(); if (error) throw error; return data; }
      const arr = lsGet(K.orders, []); const i = arr.findIndex(x => x.id == id); if (i < 0) throw new Error('غير موجود'); arr[i] = { ...arr[i], ...patch }; lsSet(K.orders, arr); return arr[i];
    },
    async remove(id) {
      if (USE_SB) { const { error } = await sb.from('orders').delete().eq('id', id); if (error) throw error; return; }
      lsSet(K.orders, lsGet(K.orders, []).filter(x => x.id != id));
    }
  };

  const settings = {
    async get() {
      if (USE_SB) { const { data, error } = await sb.from('settings').select('data').eq('id', 1).maybeSingle(); if (error) throw error; return { ...DEF_SET, ...(data?.data || {}) }; }
      return { ...DEF_SET, ...lsGet(K.settings, {}) };
    },
    async save(patch) {
      if (USE_SB) { const cur = await this.get(); const next = { ...cur, ...patch }; const { data, error } = await sb.from('settings').update({ data: next }).eq('id', 1).select().single(); if (error) throw error; return { ...DEF_SET, ...data.data }; }
      const s = { ...DEF_SET, ...lsGet(K.settings, {}), ...patch }; lsSet(K.settings, s); return s;
    }
  };

  async function stats() {
    if (USE_SB) { const { data, error } = await sb.rpc('aneq_stats'); if (error) throw error; return data; }
    const p = lsGet(K.products, []), o = lsGet(K.orders, []); const v = o.filter(x => x.status !== 'ملغي');
    return { sales: v.reduce((s,x)=>s+(+x.total||0),0), orders: o.length, products: p.length, lowStock: p.filter(x=>+x.stock<=5).length, pending: o.filter(x=>x.status==='جديد').length };
  }

  const auth = {
    async signIn(email, password) {
      if (USE_SB) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return data; }
      const s = await settings.get();
      if (password === s.password) { sessionStorage.setItem('aneq_admin','1'); return { user: { id:'local', email:'local' } }; }
      throw new Error('كلمة المرور غير صحيحة');
    },
    async signOut() { if (USE_SB) return sb.auth.signOut(); sessionStorage.removeItem('aneq_admin'); },
    async getUser() {
      if (USE_SB) { const { data } = await sb.auth.getUser(); return data.user || null; }
      return sessionStorage.getItem('aneq_admin') === '1' ? { id:'local', email:'local' } : null;
    },
    onChange(cb) { if (USE_SB) sb.auth.onAuthStateChange((_e, s) => cb(s?.user || null)); }
  };

  const cart = { get: () => lsGet(K.cart, []), set: v => lsSet(K.cart, v), clear: () => lsSet(K.cart, []) };

  return { ONLINE: USE_SB, products, orders, settings, stats, auth, cart };
})();