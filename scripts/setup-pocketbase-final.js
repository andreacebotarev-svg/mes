import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function hardReset() {
    console.log('🔥 Starting Hard Reset and Fresh Setup (v0.22 fix)...');
    try {
        await pb.admins.authWithPassword('admin@test.com', 'password123');

        // 1. Delete existing if they exist
        const collections = await pb.collections.getFullList();
        for (const col of collections) {
            if (col.name === 'messages' || col.name === 'conversations') {
                console.log(`🗑️ Deleting collection: ${col.name}`);
                await pb.collections.delete(col.id);
            }
        }

        const usersCol = await pb.collections.getOne('users');

        // 2. Create Conversations
        const conv = await pb.collections.create({
            name: 'conversations',
            type: 'base',
            schema: [
                { name: 'type', type: 'select', options: { values: ['direct', 'group'], maxSelect: 1 } },
                { name: 'members', type: 'relation', options: { collectionId: usersCol.id, cascadeDelete: true, maxSelect: 99 } }
            ],
            listRule: "members.id ?= @request.auth.id",
            viewRule: "members.id ?= @request.auth.id",
            createRule: "@request.auth.id != ''",
            updateRule: "members.id ?= @request.auth.id"
        });
        console.log('✅ Conversations created.');

        // 3. Create Messages
        await pb.collections.create({
            name: 'messages',
            type: 'base',
            schema: [
                { name: 'conversation', type: 'relation', options: { collectionId: conv.id, cascadeDelete: true, maxSelect: 1 } },
                { name: 'sender', type: 'relation', options: { collectionId: usersCol.id, maxSelect: 1 } },
                { name: 'body', type: 'text' },
                { name: 'nonce', type: 'text' },
                { name: 'counter', type: 'number' },
                { name: 'type', type: 'select', options: { values: ['text', 'image'], maxSelect: 1 } },
                { name: 'media', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } }
            ],
            listRule: "conversation.members.id ?= @request.auth.id",
            viewRule: "conversation.members.id ?= @request.auth.id",
            createRule: "@request.auth.id != ''"
        });
        console.log('✅ Messages created.');

        console.log('\n✨ ALL SYSTEMS READY.');
    } catch (err) {
        console.error('❌ Reset failed:', JSON.stringify(err.data, null, 2) || err.message);
    }
}

hardReset();
