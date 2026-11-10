// app.js
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadCars();
    
    document.getElementById('searchBtn').addEventListener('click', loadCars);
});

async function loadCategories() {
    const { data: categories } = await supabaseClient.from('categories').select('*').eq('is_active', true);
    const select = document.getElementById('filterCategory');
    if(categories) {
        categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
}

async function loadCars() {
    const search = document.getElementById('searchInput').value;
    const catId = document.getElementById('filterCategory').value;
    const city = document.getElementById('filterCity').value;

    let query = supabaseClient.from('cars').select('*, categories(name)').eq('is_active', true);

    if (search) query = query.ilike('title', `%${search}%`);
    if (catId) query = query.eq('category_id', catId);
    if (city) query = query.eq('city', city);

    const { data: cars, error } = await query.order('created_at', { ascending: false });

    const grid = document.getElementById('carsGrid');
    grid.innerHTML = '';

    if (error || !cars || cars.length === 0) {
        grid.innerHTML = '<p>لا توجد سيارات متاحة حالياً.</p>';
        return;
    }

    cars.forEach(car => {
        const imgUrl = car.image_url ? car.image_url : 'https://via.placeholder.com/400x300?text=No+Image';
        grid.innerHTML += `
            <div class="car-card">
                <img src="${imgUrl}" class="car-img" alt="${car.title}">
                <div class="car-info">
                    <div class="car-title">${car.title}</div>
                    <div class="car-location">📍 ${car.city} | سنة ${car.year}</div>
                    <div class="car-price">${car.price.toLocaleString()} أوقية</div>
                    <a href="car-details.html?id=${car.id}" class="btn-details">عرض التفاصيل</a>
                </div>
            </div>
        `;
    });
}