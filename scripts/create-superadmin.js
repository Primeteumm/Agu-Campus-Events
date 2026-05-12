require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const EMAIL    = 'superadmin@agu-campus.dev';
const PASSWORD = 'SuperAdmin@2025!';

(async () => {
    // 1. Create auth user (idempotent)
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: 'Super', last_name: 'Admin', account_type: 'student' },
    });

    if (authErr && !authErr.message?.toLowerCase().includes('already')) {
        console.error('Auth create failed:', authErr.message);
        process.exit(1);
    }

    let userId = authData?.user?.id;
    if (!userId) {
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users?.find(u => u.email === EMAIL);
        if (!found) { console.error('Could not find user.'); process.exit(1); }
        userId = found.id;
    }

    // 2. Upsert profile with Super Admin role
    const { error: profErr } = await admin.from('profiles').upsert({
        id: userId,
        email: EMAIL,
        first_name: 'Super',
        last_name: 'Admin',
        role: 'Super Admin',
    }, { onConflict: 'id' });

    if (profErr) {
        console.error('\n❌ Profile upsert failed:', profErr.message);
        console.error('\n👉 Önce şu SQL\'i Supabase SQL Editor\'da çalıştır:');
        console.error('   sql/add_superadmin_role_constraint.sql');
        console.error('   Ardından bu scripti tekrar çalıştır.\n');
        process.exit(1);
    }

    console.log('\n✅ Super Admin hesabı hazır!');
    console.log('   Email   :', EMAIL);
    console.log('   Password:', PASSWORD);
    console.log('   Role    : Super Admin\n');
})();
