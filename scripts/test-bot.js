import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function startBot() {
    console.log('🤖 Test Bot is starting...');

    try {
        // 1. Login as Bot
        await pb.collection('users').authWithPassword('testbot', 'password123');
        const botId = pb.authStore.model.id;
        console.log(`✅ Bot logged in as ${pb.authStore.model.username} (ID: ${botId})`);

        // 2. Subscribe to new messages
        pb.collection('messages').subscribe('*', async (e) => {
            if (e.action === 'create' && e.record.sender !== botId) {
                console.log(`📩 Received message from ${e.record.sender}. Replying...`);
                
                // Wait a bit to simulate "typing"
                setTimeout(async () => {
                    await pb.collection('messages').create({
                        conversation: e.record.conversation,
                        sender: botId,
                        body: 'Ваше сообщение получено и защищено эпохой шифрования 🛡️',
                        type: 'text',
                        counter: 0 // Simplification for bot
                    });
                    console.log('📤 Reply sent.');
                }, 1000);
            }
        });

        // 3. Handle calls (if signaling is via PB)
        // Since signaling is now part of the messages or a custom event collection
        pb.collection('calls').subscribe('*', async (e) => {
            if (e.action === 'create' && e.record.to === botId) {
                console.log('📞 Incoming call detected. Auto-answering...');
                await pb.collection('calls').update(e.record.id, {
                    status: 'answered',
                    answeredAt: new Date().toISOString()
                });
            }
        });

        console.log('🌟 Bot is active and listening for your messages!');
        
        // Keep alive
        setInterval(() => {}, 1000);

    } catch (err) {
        console.error('❌ Bot error:', err);
    }
}

startBot();
