// login.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('errorMsg');

    btn.innerText = 'جاري التحقق...';
    btn.disabled = true;
    errorMsg.innerText = '';

    try {
        // 1. تسجيل الدخول
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
        
        if (authError) throw new Error("بيانات الدخول غير صحيحة: " + authError.message);

        // 2. التحقق من أن المستخدم موجود في جدول admin_users
        const { data: adminData, error: adminError } = await supabaseClient
            .from('admin_users')
            .select('*')
            .eq('user_id', authData.user.id)
            .single();

        if (adminError || !adminData) {
            await supabaseClient.auth.signOut();
            throw new Error("هذا الحساب لا يملك صلاحيات المدير.");
        }

        // نجاح - الانتقال للوحة التحكم
        window.location.href = 'dashboard.html';

    } catch (error) {
        errorMsg.innerText = error.message;
    } finally {
        btn.innerText = 'تسجيل الدخول';
        btn.disabled = false;
    }
});