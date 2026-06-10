import { readFileSync, writeFileSync } from 'fs';
const c = readFileSync('src/App.jsx', 'utf8');

// Show all occurrences
const findAll = (str, sub) => {
  const positions = [];
  let pos = -1;
  while ((pos = str.indexOf(sub, pos + 1)) >= 0) {
    positions.push({ pos, ctx: str.substring(Math.max(0, pos - 30), pos + 60).replace(/\r?\n/g, '\\n') });
  }
  return positions;
};

['getDishLimit', 'getDishDefault'].forEach(name => {
  const hits = findAll(c, name);
  console.log(`${name}: ${hits.length} occurrences`);
  hits.forEach(h => console.log(`  at ${h.pos}: ${h.ctx}`));
});
