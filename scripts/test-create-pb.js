import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function testCreate() {
    console.log('🧪 Testing simple collection creation...');
    try {
        await pb.admins.authWithPassword('admin@test.com', 'password123');
        
        const usersCol = await pb.collections.getOne('users');

        // Simple Conversations without cascade delete for now
        await pb.collections.create({
            name: 'conversations',
            type: 'base',
            schema: [
                { name: 'type', type: 'select', options: { values: ['direct', 'group'] } },
                { name: 'members', type: 'relation', options: { collectionId: usersCol.id } }
            ]
        });
        console.log('✅ Conversations created (simple).');

        const convCol = await pb.collections.getOne('conversations');

        // Simple Messages
        await pb.collections.create({
            name: 'messages',
            type: 'base',
            schema: [
                { name: 'conversation', type: 'relation', options: { collectionId: convCol.id } },
                { name: 'sender', type: 'relation', options: { collectionId: usersCol.id } },
                { name: 'body', type: 'text' }
            ]
        });
        console.log('✅ Messages created (simple).');

    } catch (err) {
        console.error('❌ Error details:', JSON.stringify(err.data, null, 2));
    }
}

testCreate();
