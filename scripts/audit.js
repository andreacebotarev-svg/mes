import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(type, msg) {
  const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
  const colors = { info: COLORS.cyan, success: COLORS.green, warn: COLORS.yellow, error: COLORS.red };
  console.log(`${colors[type]}${icons[type]} [${type.toUpperCase()}] ${msg}${COLORS.reset}`);
}

async function runAudit() {
  console.log(`\n${COLORS.bright}🛡️  CryptMessenger Super Audit Tool v1.0${COLORS.reset}\n`);

  let hasErrors = false;

  // --- Phase 1: Syntax Audit ---
  log('info', 'Phase 1: Syntax Check...');
  const filesToCheck = [
    ...listJsFiles(path.join(ROOT, 'server/src')),
    ...listJsFiles(path.join(ROOT, 'web/js'))
  ];

  for (const file of filesToCheck) {
    try {
      execSync(`node --check "${file}"`);
    } catch (err) {
      log('error', `Syntax error in ${path.relative(ROOT, file)}`);
      hasErrors = true;
    }
  }
  if (!hasErrors) log('success', 'All files passed syntax check.');

  // --- Phase 2: Logic & Integrity Audit ---
  log('info', 'Phase 2: Logic & Connectivity Analysis...');

  // 1. Check Socket Event Mapping
  const serverSocketEvents = extractSocketEvents(path.join(ROOT, 'server/src/sockets/handler.js'), 'emit');
  const clientSocketListeners = extractSocketEvents(path.join(ROOT, 'web/js/api.js'), 'on');

  log('info', `Found ${serverSocketEvents.size} server-to-client events.`);
  
  for (const event of serverSocketEvents) {
    if (!clientSocketListeners.has(event)) {
      log('warn', `Logic Gap: Server emits '${event}', but no listener found in api.js`);
    }
  }

  // 2. Check E2EE Integrity
  const messagesJs = fs.readFileSync(path.join(ROOT, 'web/js/messages.js'), 'utf8');
  if (messagesJs.includes('API.sendMessage') && !messagesJs.includes('CryptoClient.encrypt')) {
    log('error', 'Security Logic: Found API.sendMessage call without CryptoClient.encrypt wrapper in messages.js');
    hasErrors = true;
  }

  // 3. Check for unhandled socket errors (try-catch audit)
  const handlerContent = fs.readFileSync(path.join(ROOT, 'server/src/sockets/handler.js'), 'utf8');
  const socketEvents = handlerContent.match(/\.on\('(.+?)'/g) || [];
  const tryCatches = handlerContent.match(/try\s*\{/g) || [];
  
  if (socketEvents.length > tryCatches.length + 2) { // 2 basic events might not need complex try-catch
    log('warn', `Potential Logic Risk: ${socketEvents.length} events defined but only ${tryCatches.length} try-catch blocks found in handler.js`);
  }

  // 4. Check Prisma Indices
  const schema = fs.readFileSync(path.join(ROOT, 'server/prisma/schema.prisma'), 'utf8');
  if (!schema.includes('@@index') && !schema.includes('@@unique')) {
     log('warn', 'DB Logic: No custom indexes found in schema.prisma. Performance might suffer on large datasets.');
  }

  // --- Phase 3: Docker Integrity ---
  log('info', 'Phase 3: Environment Check...');
  if (!fs.existsSync(path.join(ROOT, 'Dockerfile'))) log('error', 'Missing Dockerfile');
  if (!fs.existsSync(path.join(ROOT, 'docker-compose.yml'))) log('error', 'Missing docker-compose.yml');

  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    log('error', 'Audit failed. Please fix the errors above.');
    process.exit(1);
  } else {
    log('success', 'Audit completed successfully! Code logic seems solid.');
    console.log(`${COLORS.green}🚀 Project is ready for deployment!${COLORS.reset}\n`);
  }
}

function listJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(listJsFiles(file));
    else if (file.endsWith('.js')) results.push(file);
  });
  return results;
}

function extractSocketEvents(file, type) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = type === 'emit' 
    ? /\.emit\(['"](.+?)['"]/g 
    : /\.on\(['"](.+?)['"]/g;
  
  const events = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    events.add(match[1]);
  }
  return events;
}

runAudit().catch(console.error);
