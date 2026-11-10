window.ANEQ = (function () {
  const USE_SB = !!(window.SUPABASE_URL && window.SUPABASE_KEY && window.supabase);
  const sb = USE_SB ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY) : null;
  const K = { cart: 'aneq_cart' };
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v==null?d:v; } catch { return d; } };
  const lsSet = (k,v) => localStorage.setItem(k, JSON.stringify(v));

  const normalize = (p) => {
    let images = p.images;
    if (typeof images === 'string') { try { images = JSON.parse(images); } catch { images = []; } }
    if (!Array.isArray(images)) images = [];
    return { ...p, images, img: images[0] || '' };
  };

  return {
    ONLINE: USE_SB,
    async uploadImage(file) {
      if (!USE_SB) throw new Error('لا يوجد اتصال');
      const ext = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `prod_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await sb.storage.from('images').upload(fileName, file);
      if (error) throw error;
      const { data } = sb.storage.from('images').getPublicUrl(fileName);
      return data.publicUrl;
    },
    products: {
      async list() {
        const { data, error } = await sb.from('products').select('*').order('id', { ascending: false });
        if (error) throw error;
        return (data || []).map(normalize);
      },
      async create(p) {
        const row = { ...p, images: p.images || [] };
        const { data, error } = await sb.from('products').insert(row).select().single();
        if (error) throw error;
        return normalize(data);
      },
      async update(id, p) {
        const row = { ...p, images: p.images || [] };
        const { data, error } = await sb.from('products').update(row).eq('id', id).select().single();
        if (error) throw error;
        return normalize(data);
      },
      async remove(id) {
        const { error } = await sb.from('products').delete().eq('id', id);
        if (error) throw error;
      }
    },
    orders: {
      async list() {
        const { data, error } = await sb.from('orders').select('*').order('id', { ascending: false });
        if (error) throw error;
        return (data||[]).map(o => ({ ...o, total:Number(o.total), date: o.created_at ? new Date(o.created_at).toLocaleString('ar-EG') : '' }));
      },
      async updateStatus(id, status) {
        const { error } = await sb.from('orders').update({ status }).eq('id', id);
        if (error) throw error;
      },
      async create(payload) {
        const { data, error } = await sb.rpc('create_order', {
          p_customer: payload.customer, p_phone: payload.phone,
          p_address: payload.address||'', p_notes: payload.notes||'',
          p_items: payload.items.map(i => ({ id: i.id, qty: i.qty }))
        });
        if (error) throw error;
        return data;
      },
      async remove(id) {
        const { error } = await sb.from('orders').delete().eq('id', id);
        if (error) throw error;
      }
    },
    settings: {
      async get() {
        const { data } = await sb.from('settings').select('data').eq('id', 1).maybeSingle();
        return data?.data || { storeName:'ANEQ', currency:'أوقية', whatsapp:'' };
      },
      async save(patch) {
        const cur = await this.get();
        const { data, error } = await sb.from('settings').update({ data: { ...cur, ...patch } }).eq('id', 1).select().single();
        if (error) throw error;
        return data.data;
      }
    },
    stats: async () => {
      const { count: p } = await sb.from('products').select('*', { count:'exact', head:true });
      const { data: o } = await sb.from('orders').select('total, status');
      const valid = o.filter(x => x.status !== 'ملغي');
      return { products: p, orders: o.length, sales: valid.reduce((s,x)=>s+(+x.total||0),0), pending: o.filter(x=>x.status==='جديد').length };
    },
    auth: {
      signIn: async (email, pw) => { const { data, error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw error; return data; },
      signOut: async () => await sb.auth.signOut(),
      getUser: async () => { const { data } = await sb.auth.getUser(); return data.user; },
      onChange: (cb) => sb.auth.onAuthStateChange((_e, s) => cb(s?.user || null))
    },
    cart: { get: () => lsGet(K.cart, []), set: v => lsSet(K.cart, v) }
  };
})();
