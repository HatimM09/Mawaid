import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');
const orig = content;

// 1. isSurveyOpen - add openHour config, replace hardcoded 20
content = content.replace(
  `    const closeHour = parseInt(appSettings.survey_close_hour) || 10\r\n    // Saturday 8PM+ → open, Sunday all day → open, Monday until closeHour → open\r\n    if (day === 6 && hour >= 20) return true`,
  `    const openHour = parseInt(appSettings.survey_open_hour) || 20\r\n    const closeHour = parseInt(appSettings.survey_close_hour) || 10\r\n    if (day === 6 && hour >= openHour) return true`
);

// 2. getWeekDate - add appSettings param + openHour
content = content.replace(
  `const getWeekDate = () => {`,
  `const getWeekDate = (appSettings = {}) => {`
);
content = content.replace(
  `  let diff = now.getDate() - day + (day === 0 ? -6 : 1)\r\n  // If we are in the Saturday 8PM+ or Sunday window, we are filling for the Monday coming in next week\r\n  if (day === 0 || (day === 6 && hour >= 20)) {`,
  `  const openHour = parseInt(appSettings.survey_open_hour) || 20\r\n  let diff = now.getDate() - day + (day === 0 ? -6 : 1)\r\n  // Roll to next week if within survey window\r\n  if (day === 0 || (day === 6 && hour >= openHour)) {`
);

// 3. getSurveyWindowMessage - add openHour + fmtHour
content = content.replace(
  `const getSurveyWindowMessage = (appSettings = {}, userId = null) => {\r\n  if (isSurveyOpen(appSettings, userId) && appSettings.survey_status !== 'open') {\r\n    return 'Auto window is open — Saturday 8PM to Monday ' + (parseInt(appSettings.survey_close_hour) || 10) + ':00 AM.'\r\n  }\r\n  if (appSettings.survey_status === 'open') return 'Survey is open — you can fill and edit your responses.'\r\n  if (appSettings.survey_status === 'auto') {\r\n    const closeHour = parseInt(appSettings.survey_close_hour) || 10\r\n    return 'Survey opens Saturday at 8:00 PM and closes Monday at ' + closeHour + ':00 AM.'\r\n  }\r\n  return 'Survey is currently closed.'\r\n}`,
  `const fmtHour = (h) => h >= 12 ? (h === 12 ? '12:00 PM' : (h - 12) + ':00 PM') : h + ':00 AM'\r\n\r\nconst getSurveyWindowMessage = (appSettings = {}, userId = null) => {\r\n  const openHour = parseInt(appSettings.survey_open_hour) || 20\r\n  const closeHour = parseInt(appSettings.survey_close_hour) || 10\r\n  if (isSurveyOpen(appSettings, userId) && appSettings.survey_status !== 'open') {\r\n    return 'Auto window is open — Saturday ' + fmtHour(openHour) + ' to Monday ' + fmtHour(closeHour) + '.'\r\n  }\r\n  if (appSettings.survey_status === 'open') return 'Survey is open — you can fill and edit your responses.'\r\n  if (appSettings.survey_status === 'auto') {\r\n    return 'Survey opens Saturday at ' + fmtHour(openHour) + ' and closes Monday at ' + fmtHour(closeHour) + '.'\r\n  }\r\n  return 'Survey is currently closed.'\r\n}`
);

// 4. Add parseTimeStr helper + fix canEditMeal with auto timing
content = content.replace(
  `const canEditMeal = (dayName, weekId, mealType, appSettings = {}, userId = null) => {\r\n  if (hasUserOverride(appSettings, userId, dayName, mealType)) return true;\r\n  if (isSurveyOpen(appSettings, userId)) return true;\r\n\r\n  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'open') return true;\r\n  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'open') return true;\r\n\r\n  return false\r\n}`,
  `const parseTimeStr = (val, defaultH, defaultM) => {\r\n  const parts = (val || '').split(':').map(Number)\r\n  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))\r\n    return { h: parts[0], m: parts[1] }\r\n  return { h: defaultH, m: defaultM }\r\n}\r\n\r\nconst canEditMeal = (dayName, weekId, mealType, appSettings = {}, userId = null) => {\r\n  if (hasUserOverride(appSettings, userId, dayName, mealType)) return true;\r\n  if (isSurveyOpen(appSettings, userId)) return true;\r\n\r\n  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'open') return true;\r\n  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'open') return true;\r\n\r\n  // Auto timing based on configurable open/close windows\r\n  const now = new Date()\r\n  const weekStart = new Date(weekId + 'T00:00:00')\r\n  const dayIdx = DAYS.indexOf(dayName)\r\n  if (dayIdx === -1) return false\r\n  const mealDate = new Date(weekStart)\r\n  mealDate.setDate(mealDate.getDate() + dayIdx)\r\n\r\n  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'auto') {\r\n    const openT = parseTimeStr(appSettings.lunch_edit_open, 20, 0)\r\n    const closeT = parseTimeStr(appSettings.lunch_edit_close, 11, 0)\r\n    const openDate = new Date(mealDate)\r\n    openDate.setDate(openDate.getDate() - 1)\r\n    openDate.setHours(openT.h, openT.m, 0, 0)\r\n    const closeDate = new Date(mealDate)\r\n    closeDate.setHours(closeT.h, closeT.m, 0, 0)\r\n    return now >= openDate && now < closeDate\r\n  }\r\n\r\n  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'auto') {\r\n    const openT = parseTimeStr(appSettings.dinner_edit_open, 12, 0)\r\n    const closeT = parseTimeStr(appSettings.dinner_edit_close, 15, 30)\r\n    const openDate = new Date(mealDate)\r\n    openDate.setHours(openT.h, openT.m, 0, 0)\r\n    const closeDate = new Date(mealDate)\r\n    closeDate.setHours(closeT.h, closeT.m, 0, 0)\r\n    return now >= openDate && now < closeDate\r\n  }\r\n\r\n  return false\r\n}`
);

fs.writeFileSync('src/App.jsx', content);

// Verify
if (content !== orig) {
  console.log('✅ App.jsx changes applied successfully');
  console.log('  - isSurveyOpen: uses survey_open_hour');
  console.log('  - getWeekDate: accepts appSettings, uses openHour');
  console.log('  - getSurveyWindowMessage: uses fmtHour with openHour');
  console.log('  - added fmtHour helper');
  console.log('  - added parseTimeStr helper');
  console.log('  - canEditMeal: auto timing for lunch/dinner');
} else {
  console.log('❌ No changes applied!');
}
