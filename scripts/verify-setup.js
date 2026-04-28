import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function verify() {
    console.log('🔍 Starting System Verification...');
    let errors = 0;

    try {
        await pb.admins.authWithPassword('admin@test.com', 'password123');
        
        const collections = await pb.collections.getFullList();
        const names = collections.map(c => c.name);

        const check = (name, fields) => {
            if (!names.includes(name)) {
                console.log(`  ❌ Missing collection: ${name}`);
                errors++;
                return;
            }
            const col = collections.find(c => c.name === name);
            fields.forEach(f => {
                if (!col.schema.find(s => s.name === f)) {
                    console.log(`  ❌ ${name}: Missing field "${f}"`);
                    errors++;
                }
            });
            console.log(`  ✅ Collection "${name}" is correct.`);
        };

        check('users', ['handle', 'display_name', 'public_key']);
        check('conversations', ['type', 'members']);
        check('messages', ['conversation', 'sender', 'body', 'nonce', 'counter', 'type', 'media']);

        if (errors === 0) {
            console.log('\n🎉 VERIFICATION PASSED: System is ready for production testing.');
        } else {
            console.log(`\n🚨 VERIFICATION FAILED: Found ${errors} issues.`);
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Verification Error:', err.message);
        process.exit(1);
    }
}

verify();
