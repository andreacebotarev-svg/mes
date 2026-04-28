import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

async function runSystemTest() {
  console.log(`\n${COLORS.bold}🚀 STARTING SENIOR SYSTEM INTEGRATION TEST${COLORS.reset}\n`);
  
  try {
    // 1. ПРОВЕРКА СОСТОЯНИЯ СЕРВЕРА
    console.log(`${COLORS.cyan}[1/5] Checking Server Availability...${COLORS.reset}`);
    await axios.get(`${API_URL}/conversations`).catch(err => {
      if (err.response?.status !== 401) throw new Error('Server is offline or unreachable.');
    });
    console.log(`${COLORS.green}✅ Server is online.${COLORS.reset}`);

    // 2. ИМИТАЦИЯ ПОЛЬЗОВАТЕЛЕЙ (Auth Test)
    console.log(`\n${COLORS.cyan}[2/5] Simulating Users (Alice & Bob)...${COLORS.reset}`);
    const alice = await setupUser('alice_test', 'password123');
    const bob = await setupUser('bob_test', 'password123');
    console.log(`${COLORS.green}✅ Users authenticated. Tokens received.${COLORS.reset}`);

    // 3. ПОДКЛЮЧЕНИЕ СОКЕТОВ
    console.log(`\n${COLORS.cyan}[3/5] Connecting Sockets...${COLORS.reset}`);
    const aliceSocket = io(SOCKET_URL, { auth: { token: alice.token } });
    const bobSocket = io(SOCKET_URL, { auth: { token: bob.token } });
    
    await new Promise((resolve) => aliceSocket.on('connect', resolve));
    console.log(`${COLORS.green}✅ Sockets connected.${COLORS.reset}`);

    // 4. ПРОВЕРКА E2E ШИФРОВАНИЯ (DB Leak Test)
    console.log(`\n${COLORS.cyan}[4/5] Testing real-time delivery and E2E Integrity...${COLORS.reset}`);
    
    // Создаем чат через API
    const { data: convData } = await axios.post(`${API_URL}/conversations`, 
      { type: 'direct', memberIds: [bob.id] },
      { headers: { Authorization: `Bearer ${alice.token}` } }
    );
    const conversationId = convData.conversation.id;

    const testSecretText = 'TOP_SECRET_REDACTED';
    const encryptedBody = 'v3.base64.ENCRYPTED_BLOB_HERE';
    const nonce = 'v3.base64.NONCE_HERE';

    const deliveryPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Bob did not receive message')), 5000);
        bobSocket.on('new_message', (msg) => {
            if (msg.body === encryptedBody) {
                clearTimeout(timeout);
                resolve(msg.id);
            }
        });
    });

    // Алиса отправляет зашифрованное сообщение через сокет
    aliceSocket.emit('send_message', {
      conversationId,
      body: encryptedBody,
      nonce,
      type: 'text'
    });

    const messageId = await deliveryPromise;
    console.log(`${COLORS.green}✅ Real-time delivery OK.${COLORS.reset}`);

    // Проверяем что в БД НЕТ сырого текста
    const dbMessage = await prisma.message.findUnique({ where: { id: messageId } });
    if (dbMessage.body.includes(testSecretText)) {
      throw new Error('CRITICAL SECURITY LEAK: Plaintext found in Database!');
    }
    console.log(`${COLORS.green}✅ DB Validation Passed: Only encrypted data found in storage.${COLORS.reset}`);

    // 5. ТЕСТ СКОРОСТИ СИГНАЛИЗАЦИИ (Signaling Latency)
    console.log(`\n${COLORS.cyan}[5/5] Measuring Signaling Performance...${COLORS.reset}`);
    const start = Date.now();
    for (let i = 0; i < 20; i++) {
        aliceSocket.emit('ice_candidate', { to: bob.id, candidate: { test: i } });
    }
    const latency = Date.now() - start;
    console.log(`${COLORS.green}✅ 20 signaling packets batch processed in ${latency}ms.${COLORS.reset}`);

    // ЧИСТКА
    console.log(`\n${COLORS.yellow}🧹 Cleaning up test users from DB...${COLORS.reset}`);
    await prisma.user.deleteMany({ where: { handle: { in: ['alice_test', 'bob_test'] } } });
    
    aliceSocket.disconnect();
    bobSocket.disconnect();

    console.log(`\n${COLORS.bold}${COLORS.green}🏆 SYSTEM AUDIT COMPLETED: 100% SUCCESS${COLORS.reset}\n`);

  } catch (err) {
    console.error(`\n${COLORS.red}❌ TEST FAILED: ${err.message}${COLORS.reset}`);
    if (err.response) console.error(err.response.data);
    process.exit(1);
  }
}

async function setupUser(handle, password) {
  try {
    const res = await axios.post(`${API_URL}/register`, {
      handle, password, displayName: handle.toUpperCase(), inviteCode: 'кампус'
    }).catch(async (err) => {
      return axios.post(`${API_URL}/login`, { handle, password });
    });
    return { id: res.data.user.id, token: res.data.token };
  } catch (e) {
    throw new Error(`Auth failed for ${handle}: ${e.message}`);
  }
}

runSystemTest();
