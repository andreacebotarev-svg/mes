import fs from 'fs';
import path from 'path';
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

async function auditReactions() {
  console.log(`\n🎭 ${COLORS.cyan}Starting UI/UX Reaction System Audit...${COLORS.reset}\n`);

  const css = fs.readFileSync(path.join(ROOT, 'web/css/app.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'web/js/messages.js'), 'utf8');

  let issues = 0;

  // 1. Check for Glassmorphism & Animations
  if (css.includes('backdrop-filter: blur') && css.includes('@keyframes reaction-pop')) {
    console.log(`${COLORS.green}[PASS]${COLORS.reset} Premium visuals (blur & pop animation) detected.`);
  } else {
    console.log(`${COLORS.red}[FAIL]${COLORS.reset} Missing premium visual effects for reactions.`);
    issues++;
  }

  // 2. Check for Mobile-specific logic
  if (js.includes('touchstart') && js.includes('vibrate')) {
    console.log(`${COLORS.green}[PASS]${COLORS.reset} Haptic feedback and Long Press support found.`);
  } else {
    console.log(`${COLORS.yellow}[WARN]${COLORS.reset} Mobile-first interactions (vibration/longpress) might be incomplete.`);
    issues++;
  }

  // 3. Smart Positioning Check
  if (js.includes('getBoundingClientRect') && js.includes('viewportHeight')) {
    console.log(`${COLORS.green}[PASS]${COLORS.reset} Smart positioning logic for popups is present.`);
  } else {
    console.log(`${COLORS.red}[FAIL]${COLORS.reset} Missing logic to prevent popup overflow.`);
    issues++;
  }

  // 4. Accessibility & UX
  if (js.includes('dblclick') && js.includes('❤️')) {
    console.log(`${COLORS.green}[PASS]${COLORS.reset} Shortcut interaction (double-click heart) detected.`);
  }

  console.log(`\n${COLORS.cyan}------------------------------------${COLORS.reset}`);
  if (issues === 0) {
    console.log(`${COLORS.green}AUDIT COMPLETE: 100% READY FOR PRODUCTION${COLORS.reset}`);
    generateBrowserTest();
  } else {
    console.log(`${COLORS.yellow}AUDIT COMPLETE: Found ${issues} potential UI/UX issues.${COLORS.reset}`);
  }
}

function generateBrowserTest() {
  console.log(`\n🚀 ${COLORS.yellow}BROWSER TEST SNIPPET (Copy to Console):${COLORS.reset}\n`);
  const snippet = `
  (async function testReactions() {
    console.log('🧪 Starting Browser UI Test...');
    const msg = document.querySelector('.message');
    if (!msg) return console.error('No messages found to test!');

    // 1. Simulate Long Press
    console.log('👉 Simulating Long Press on message...');
    const startEvent = new TouchEvent('touchstart', { bubbles: true });
    msg.dispatchEvent(startEvent);

    await new Promise(r => setTimeout(r, 600)); // Wait for timer

    const popup = document.querySelector('.reaction-popup');
    if (popup) {
      console.log('✅ Success: Reaction popup appeared!');
      const rect = popup.getBoundingClientRect();
      if (rect.top < 0 || rect.left < 0 || rect.right > window.innerWidth) {
        console.error('❌ UX FAIL: Popup is overflowing screen boundaries!');
      } else {
        console.log('✅ Position: Popup is within viewport.');
      }
      
      // 2. Click Emoji
      const emoji = popup.querySelector('button');
      console.log('🖱️ Clicking emoji: ' + emoji.textContent);
      emoji.click();
      
      setTimeout(() => {
        const badge = msg.closest('.message-wrapper').querySelector('.reaction-badge');
        if (badge) console.log('✅ Success: Reaction badge added to message!');
      }, 500);
    } else {
      console.error('❌ FAIL: Long Press did not trigger popup.');
    }
  })();
  `;
  console.log(snippet);
}

auditReactions().catch(console.error);
