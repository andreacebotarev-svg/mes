import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function debug() {
    await pb.admins.authWithPassword('admin@test.com', 'password123');
    const collections = await pb.collections.getFullList();
    console.log('Collections:', collections.map(c => ({ name: c.name, id: c.id })));
    
    const users = await pb.collection('users').getFullList();
    console.log('Users:', users.map(u => ({ username: u.username, id: u.id, handle: u.handle })));
}

debug();
