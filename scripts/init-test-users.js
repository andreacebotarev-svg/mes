import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function initTestData() {
    console.log('🚀 Initializing Test Data...');

    try {
        // 1. Create User 1
        const user1 = await pb.collection('users').create({
            username: 'user1',
            password: 'password123',
            passwordConfirm: 'password123',
            display_name: 'You (Tester)',
            handle: 'user1'
        }).catch(e => console.log('User1 already exists'));

        // 2. Create Test Bot
        const bot = await pb.collection('users').create({
            username: 'testbot',
            password: 'password123',
            passwordConfirm: 'password123',
            display_name: '🛡️ Security Bot',
            handle: 'testbot'
        }).catch(e => console.log('Bot already exists'));

        console.log('✅ Test users created. Login with: user1 / password123');
        
        // 3. Create a conversation between them
        // In PocketBase, we'd typically create a 'conversations' record
        const conv = await pb.collection('conversations').create({
            type: 'direct',
            members: [
                (await pb.collection('users').getFirstListItem('username="user1"')).id,
                (await pb.collection('users').getFirstListItem('username="testbot"')).id
            ]
        }).catch(e => console.log('Conversation already exists'));

        console.log('✅ Test conversation established.');
    } catch (err) {
        console.error('❌ Error initializing data:', err);
    }
}

initTestData();
