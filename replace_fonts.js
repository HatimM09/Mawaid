const fs = require('fs');

const filePath = 'c:\\Users\\Hatim Mithai\\Desktop\\al-mawaid\\al-mawaid-fixed\\src\\App.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace google fonts import URLs
content = content.replace(
  /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Playfair\+Display[^']+'\);/g,
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');"
);

content = content.replace(
  /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Cinzel[^']+'\);/g,
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');"
);

// Replace font family usages
content = content.replace(/Playfair Display/g, 'Inter');
content = content.replace(/DM Sans/g, 'Inter');
content = content.replace(/Outfit/g, 'Inter');
content = content.replace(/Cinzel/g, 'Inter');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fonts updated successfully!');
