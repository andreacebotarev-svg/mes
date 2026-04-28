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

function log(type, msg) {
  const colors = { info: COLORS.cyan, success: COLORS.green, warn: COLORS.yellow, error: COLORS.red };
  console.log(`${colors[type]}[MOBILE AUDIT] ${msg}${COLORS.reset}`);
}

async function auditMobile() {
  console.log(`\n📱 ${COLORS.cyan}Running Mobile First Design Audit...${COLORS.reset}\n`);

  const html = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'web/css/app.css'), 'utf8');

  let score = 100;

  // 1. Viewport Meta Check
  if (html.includes('name="viewport"') && html.includes('width=device-width')) {
    log('success', 'Viewport meta tag is present and correct.');
  } else {
    log('error', 'Missing or incorrect viewport meta tag!');
    score -= 30;
  }

  // 2. Mobile First CSS Check (Base styles vs Media Queries)
  const mediaQueries = css.match(/@media\s*\(\s*min-width:/g) || [];
  if (mediaQueries.length > 0) {
    log('success', `Found ${mediaQueries.length} min-width media queries (Mobile First approach).`);
  } else {
    log('warn', 'No min-width media queries found. Ensure base styles are mobile-first.');
    score -= 10;
  }

  // 3. Fixed Width Anti-pattern Check
  const fixedWidths = css.match(/width:\s*\d{3,4}px/g) || [];
  const problematicWidths = fixedWidths.filter(w => parseInt(w.match(/\d+/)[0]) > 400);
  if (problematicWidths.length > 0) {
    log('warn', `Found ${problematicWidths.length} hardcoded large widths (e.g., ${problematicWidths[0]}). Use % or vw/vh.`);
    score -= 20;
  } else {
    log('success', 'No large hardcoded widths found in base CSS.');
  }

  // 4. Touch Target Check (Buttons)
  // This is a rough check of padding/height for buttons
  const smallButtons = css.match(/padding:\s*[1-4]px/g) || [];
  if (smallButtons.length > 10) {
    log('warn', 'Found many elements with very small padding. Ensure touch targets are >= 44px.');
    score -= 10;
  }

  // 5. Overflow Prevention
  if (css.includes('overflow-x: hidden') || css.includes('overflow: hidden')) {
    log('success', 'Overflow prevention rules found.');
  } else {
    log('warn', 'Consider adding overflow-x: hidden to body to prevent horizontal scrolling.');
  }

  console.log(`\n${COLORS.cyan}------------------------------------${COLORS.reset}`);
  console.log(`FINAL MOBILE-READY SCORE: ${score}/100`);
  
  if (score >= 80) {
    console.log(`${COLORS.green}PASS: Your design is solid for mobile devices.${COLORS.reset}\n`);
  } else {
    console.log(`${COLORS.red}FAIL: Design needs mobile-first improvements.${COLORS.reset}\n`);
    process.exit(1);
  }
}

auditMobile().catch(console.error);
