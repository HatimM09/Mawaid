const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'src', 'admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.jsx'));

const replacements = [
  { regex: /#D4AF37/g, replacement: 'var(--accent-primary)' },
  { regex: /rgba\(212,175,55,0\.15\)/g, replacement: 'var(--accent-bg)' },
  { regex: /rgba\(212,175,55,0\.1\)/g, replacement: 'var(--accent-bg)' },
  { regex: /rgba\(212,175,55,0\.2\)/g, replacement: 'var(--border-light)' },
  { regex: /rgba\(212,175,55,0\.3\)/g, replacement: 'var(--accent-border)' },
  { regex: /rgba\(212,175,55,0\.4\)/g, replacement: 'var(--border-active)' },
  { regex: /rgba\(212,175,55,0\.5\)/g, replacement: 'var(--border-active)' },
  { regex: /rgba\(212,175,55,0\.08\)/g, replacement: 'var(--border-light)' },
  { regex: /rgba\(212,175,55,0\.05\)/g, replacement: 'var(--border-light)' },
  { regex: /#FFF8E1/g, replacement: 'var(--text-primary)' },
  { regex: /rgba\(255,248,225,0\.[45678]\)/g, replacement: 'var(--text-tertiary)' },
  { regex: /#1a150a/g, replacement: 'var(--bg-surface)' },
  { regex: /#0f0c08/g, replacement: 'var(--bg-deep)' },
  { regex: /rgba\(15,12,8,0\.[56789]\d*\)/g, replacement: 'var(--bg-card)' },
  { regex: /rgba\(35,28,15,0\.7\)/g, replacement: 'var(--bg-card)' },
  { regex: /'radial-gradient[^']+'/g, replacement: "'var(--bg-grad)'" },
  { regex: /'linear-gradient[^']+'/g, replacement: "SharedT.accentGrad || 'var(--accent-grad)'" }
];

files.forEach(file => {
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  replacements.forEach(({ regex, replacement }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      changed = true;
    }
  });

  // Specifically target button backgrounds to make them "filled"
  if (content.includes('<button')) {
    // Replace transparent button backgrounds with solid or semi-solid colors
    content = content.replace(/background:\s*'transparent'/g, "background: 'var(--accent-bg)'");
    content = content.replace(/background:\s*active \? 'var\(--accent-bg\)' : 'var\(--accent-bg\)'/g, "background: active ? 'var(--accent-primary)' : 'var(--accent-bg)'");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});

console.log('Successfully applied professional theme variables and filled buttons to Admin, Inventory, and Khidmat portals!');
