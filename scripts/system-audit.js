import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const JS_FILES = [
  'web/js/api.js',
  'web/js/app.js',
  'web/js/chat.js',
  'web/js/messages.js',
  'web/js/crypto-client.js',
  'web/js/calls.js',
  'web/js/toast.js'
];

async function runAudit() {
  console.log(`\n🚀 ${COLORS.cyan}Starting CryptMessenger System Audit...${COLORS.reset}\n`);

  let totalIssues = 0;

  // 1. Syntax Check
  console.log(`${COLORS.yellow}[1/3] Checking Syntax...${COLORS.reset}`);
  for (const file of JS_FILES) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ${COLORS.red}✖ File missing: ${file}${COLORS.reset}`);
      totalIssues++;
      continue;
    }
    try {
      execSync(`node --check "${fullPath}"`);
      console.log(`  ${COLORS.green}✔ ${file} - Syntax OK${COLORS.reset}`);
    } catch (err) {
      console.log(`  ${COLORS.red}✖ ${file} - Syntax Error!${COLORS.reset}`);
      totalIssues++;
    }
  }

  // 2. Dependency & Reference Check
  console.log(`\n${COLORS.yellow}[2/3] Checking Dependencies & References...${COLORS.reset}`);
  const indexHtml = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
  const scriptRegex = /<script src="([^"]+)"><\/script>/g;
  let match;
  while ((match = scriptRegex.exec(indexHtml)) !== null) {
    const src = match[1];
    if (src.startsWith('http')) {
      console.log(`  ${COLORS.cyan}ℹ External: ${src}${COLORS.reset}`);
    } else {
      const localPath = path.join(ROOT, 'web', src);
      if (fs.existsSync(localPath)) {
        console.log(`  ${COLORS.green}✔ Local: ${src}${COLORS.reset}`);
      } else {
        console.log(`  ${COLORS.red}✖ Missing Local Dependency: ${src}${COLORS.reset}`);
        totalIssues++;
      }
    }
  }

  // 3. Memory Leak & Logical Leak Hunt
  console.log(`\n${COLORS.yellow}[3/3] Hunting for Memory Leaks...${COLORS.reset}`);
  for (const file of JS_FILES) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const leaks = [];

    // Pattern: setInterval without clearInterval in the same file
    if (content.includes('setInterval') && !content.includes('clearInterval')) {
      leaks.push('setInterval detected without clearInterval');
    }

    // Pattern: Event listeners added but never removed (heuristic)
    const addCount = (content.match(/addEventListener/g) || []).length;
    const removeCount = (content.match(/removeEventListener/g) || []).length;
    if (addCount > removeCount + 5) { // Allowance for global listeners
      leaks.push(`High addEventListener count (${addCount}) vs remove (${removeCount})`);
    }

    // Pattern: Growing caches
    if (content.includes('.push(') && !content.includes('.shift(') && !content.includes('.length = 0') && !content.includes('.splice(')) {
       if (content.includes('messages') || content.includes('cache')) {
         leaks.push('Array .push() detected without obvious cleanup logic');
       }
    }

    if (leaks.length > 0) {
      console.log(`  ${COLORS.yellow}⚠ ${file}:${COLORS.reset}`);
      leaks.forEach(l => console.log(`    - ${l}`));
      totalIssues++;
    } else {
      console.log(`  ${COLORS.green}✔ ${file} - No obvious leaks found${COLORS.reset}`);
    }
  }

  console.log(`\n${COLORS.cyan}------------------------------------${COLORS.reset}`);
  if (totalIssues === 0) {
    console.log(`${COLORS.green}AUDIT PASSED: System is stable and optimized.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}AUDIT FAILED: Found ${totalIssues} issues to fix.${COLORS.reset}`);
  }
}

runAudit().catch(console.error);
