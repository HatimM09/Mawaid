import fs from 'fs';

let content = fs.readFileSync('src/admin/SettingsPage.jsx', 'utf8');

const oldLunch = `  if (type === 'lunch') {
    const openParts = (appSettings.lunch_edit_open || '20:00').split(':').map(Number)
    const closeParts = (appSettings.lunch_edit_close || '11:00').split(':').map(Number)
    const openMin = ((openParts[0] || 20) * 60 + (openParts[1] || 0))
    const closeMin = ((closeParts[0] || 11) * 60 + (closeParts[1] || 0))
    // Opens previous night at open time, closes same day at close time
    // If current time is before close time, it's within window from yesterday's open
    // Simple check: if curMin < closeMin, window is open (opened prev night)
    if (minute < closeMin) return true
    // If curMin >= openMin, next night's window has opened
    if (minute >= openMin) return true
    return false
  }`;

const newLunch = `  if (type === 'lunch') {
    const openParts = (appSettings.lunch_edit_open || '20:00').split(':').map(Number)
    const closeParts = (appSettings.lunch_edit_close || '11:00').split(':').map(Number)
    const openMin = ((openParts[0] || 20) * 60 + (openParts[1] || 0))
    const closeMin = ((closeParts[0] || 11) * 60 + (closeParts[1] || 0))
    // If openMin > closeMin: prev-night window (e.g., 20:00 prev night to 11:00 same day)
    // If openMin <= closeMin: same-day window (e.g., 06:00 to 11:00)
    if (openMin > closeMin) {
      if (minute < closeMin) return true
      if (minute >= openMin) return true
    } else {
      if (minute >= openMin && minute < closeMin) return true
    }
    return false
  }`;

if (content.includes(oldLunch)) {
  content = content.replace(oldLunch, newLunch);
  fs.writeFileSync('src/admin/SettingsPage.jsx', content);
  console.log('Lunch timing logic fixed');
} else {
  console.log('Could not find the lunch timing section');
}
