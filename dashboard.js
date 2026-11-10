// dashboard.js
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق من الجلسة
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // 2. التحقق من صلاحية المدير
    const { data: admin } = await supabaseClient.from('admin_users').select('*').eq('user_id', session.user.id).single();
    if (!admin) {
        alert("غير مصرح لك بالدخول");
        window.location.href = 'index.html';
        return;
    }

    currentUser = session.user;
    showSection('cars');
});

window.logout = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
};

window.showSection = async (section) => {
    const main = document.getElementById('mainContent');
    
    if (section === 'cars') {
        main.innerHTML = `
            <h1>إدارة السيارات</h1>
            <button class="btn-add" onclick="showAddCarForm()">+ إضافة سيارة جديدة</button>
            <div class="card" id="carsListCard">
                <h3>قائمة السيارات</h3>
                <table id="carsTable">
                    <thead>
                        <tr><th>الصورة</th><th>العنوان</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;
        loadAdminCars();
    }
};

// جلب السيارات للوحة التحكم
async function loadAdminCars() {
    const { data: cars } = await supabaseClient.from('cars').select('*').order('created_at', { ascending: false });
    const tbody = document.querySelector('#carsTable tbody');
    tbody.innerHTML = '';
    
    if(!cars) return;
    cars.forEach(car => {
        tbody.innerHTML += `
            <tr>
                <td><img src="${car.image_url || 'https://via.placeholder.com/50'}" width="50" height="50" style="object-fit:cover; border-radius:5px;"></td>
                <td>${car.title}</td>
                <td>${car.price} MRU</td>
                <td>${car.is_active ? '✅ نشط' : '❌ غير نشط'}</td>
                <td>
                    <button class="btn-delete" onclick="deleteCar(${car.id})">حذف</button>
                </td>
            </tr>
        `;
    });
}

// إضافة سيارة جديدة
window.showAddCarForm = () => {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <h1>إضافة سيارة جديدة</h1>
        <div class="card">
            <form id="addCarForm">
                <input type="text" id="carTitle" placeholder="عنوان الإعلان (مثال: تويوتا هايلكس 2020)" required>
                <input type="text" id="carBrand" placeholder="الماركة (مثال: تويوتا)" required>
                <input type="text" id="carModel" placeholder="الموديل (مثال: هايلكس)" required>
                <input type="number" id="carYear" placeholder="سنة الصنع" required>
                <input type="number" id="carPrice" placeholder="السعر بالأوقية" required>
                <input type="text" id="carCity" placeholder="المدينة" required>
                <input type="file" id="carImage" accept="image/*" required>
                <textarea id="carDesc" placeholder="الوصف الكامل" rows="4"></textarea>
                <button type="submit" class="btn-add">حفظ السيارة</button>
            </form>
        </div>
    `;

    document.getElementById('addCarForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button');
        submitBtn.innerText = 'جاري الرفع...';
        submitBtn.disabled = true;

        try {
            // 1. رفع الصورة
            const file = document.getElementById('carImage').files[0];
            const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('car-images')
                .upload(fileName, file);
                
            if (uploadError) throw new Error("فشل رفع الصورة: " + uploadError.message);

            // 2. الحصول على رابط الصورة
            const { data: { publicUrl } } = supabaseClient.storage.from('car-images').getPublicUrl(fileName);

            // 3. حفظ البيانات في الجدول
            const { error: dbError } = await supabaseClient.from('cars').insert([{
                title: document.getElementById('carTitle').value,
                brand: document.getElementById('carBrand').value,
                model: document.getElementById('carModel').value,
                year: parseInt(document.getElementById('carYear').value),
                price: parseFloat(document.getElementById('carPrice').value),
                city: document.getElementById('carCity').value,
                description: document.getElementById('carDesc').value,
                image_url: publicUrl,
                is_active: true
            }]);

            if (dbError) throw new Error("فشل حفظ البيانات: " + dbError.message);

            alert('تمت إضافة السيارة بنجاح!');
            showSection('cars');

        } catch (error) {
            alert(error.message);
            submitBtn.innerText = 'حفظ السيارة';
            submitBtn.disabled = false;
        }
    });
};

// حذف سيارة
window.deleteCar = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه السيارة؟')) return;
    
    const { error } = await supabaseClient.from('cars').delete().eq('id', id);
    if (error) {
        alert("فشل الحذف: " + error.message);
    } else {
        loadAdminCars(); // تحديث الجدول
    }
};