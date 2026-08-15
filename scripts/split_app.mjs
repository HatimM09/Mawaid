// One-off splitter: slices src/App.jsx into focused member-app modules.
// Each output file gets a `// __IMPORTS__` marker at the top that is later
// replaced with the correct import block.
import fs from 'fs'
import path from 'path'

const src = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n')
const lines = src.split('\n')
const slice = (a, b) => lines.slice(a - 1, b).join('\n')

const files = {
  'src/member/theme.js': [36, 79],
  'src/member/constants.js': [84, 92],
  'src/member/survey.js': [94, 221],
  'src/member/ui.jsx': [231, 525],
  'src/member/ThaliUserApp.jsx': [530, 956],
  'src/member/pages/HomePage.jsx': [961, 1387],
  'src/member/pages/WeeklyMenuPage.jsx': [1389, 1628],
  'src/member/pages/SurveyPage.jsx': [1634, 1935],
  'src/member/pages/PostPage.jsx': [1940, 2410],
  'src/member/pages/ProfilePage.jsx': [2415, 3330],
}

for (const [rel, [a, b]] of Object.entries(files)) {
  const abs = path.join(process.cwd(), rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, '// __IMPORTS__\n\n' + slice(a, b) + '\n')
  console.log('wrote', rel, `${b - a + 1} lines`)
}

// Report the first + last line of each slice so the import wiring can be checked.
for (const [rel, [a, b]] of Object.entries(files)) {
  console.log('---', rel, `[${a}..${b}]`)
  console.log('first:', JSON.stringify(lines[a - 1]))
  console.log('last :', JSON.stringify(lines[b - 1]))
}
