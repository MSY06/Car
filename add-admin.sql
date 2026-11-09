-- إضافة حساب المدير الذي زودنا المستخدم بمعرّف UUID الخاص به.
-- يجب إنشاء المستخدم أولاً من Authentication > Users.
-- هذا الاستعلام آمن لإعادة التشغيل ولا يكرر السجل.
INSERT INTO public.admin_users (user_id)
VALUES ('4eab9224-2d5b-4c84-8548-f51487d48869')
ON CONFLICT (user_id) DO NOTHING;
