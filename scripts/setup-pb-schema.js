import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function forceSetup() {
    console.log('🔥 Debugging Schema Setup...');
    try {
        await pb.admins.authWithPassword('admin@test.com', 'password123');
        const usersCol = await pb.collections.getOne('users');

        // Create Conversations
        try {
            const convCol = await pb.collections.create({
                name: 'conversations',
                type: 'base',
                schema: [
                    { name: 'type', type: 'select', options: { values: ['direct', 'group'] } },
                    { name: 'members', type: 'relation', options: { collectionId: usersCol.id, cascadeDelete: true } }
                ]
            });
            console.log('✅ Conversations created.');
        } catch (e) {
            console.log('❌ Conversations Error:', JSON.stringify(e.data, null, 2));
        }

        // Create Messages
        try {
            const msgCol = await pb.collections.create({
                name: 'messages',
                type: 'base',
                schema: [
                    { name: 'conversation', type: 'relation', options: { collectionId: 'conversations', cascadeDelete: true } },
                    { name: 'sender', type: 'relation', options: { collectionId: usersCol.id } },
                    { name: 'body', type: 'text' }
                ]
            });
            console.log('✅ Messages created.');
        } catch (e) {
            console.log('❌ Messages Error:', JSON.stringify(e.data, null, 2));
        }

    } catch (err) {
        console.error('Total failure:', err);
    }
}

forceSetup();
