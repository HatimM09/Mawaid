// src/admin/feedbackReportPdf.js
// Generates a printable weekly meal-feedback PDF report for the admin.
// Columns: Thali #, Name, Day, Lunch (stars + comment), Dinner (stars + comment).
import { jsPDF } from 'jspdf'

export const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Palette (light, print-friendly)
const GOLD = [197, 160, 89]
const GOLD_SOFT = [222, 200, 158]
const GOLD_DEEP = [150, 116, 46]
const NAVY = [26, 31, 41]
const TEXT = [40, 44, 54]
const TEXT_SUB = [110, 116, 128]
const BORDER = [216, 213, 205]
const ROW_ALT = [247, 245, 240]
const WHITE = [255, 255, 255]

const cap = (s = '') => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Cap very long comments so a single row can never overflow a page
const MAX_COMMENT_CHARS = 400
const clip = (s) => (s && s.length > MAX_COMMENT_CHARS ? s.slice(0, MAX_COMMENT_CHARS) + '...' : s)

/** Returns the Monday (YYYY-MM-DD) of the calendar week containing a timestamp. */
export const getFeedbackWeekId = (ts) => {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  const day = d.getDay()
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + (day === 0 ? -6 : 1))
  return mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0')
}

const fmtShort = (d) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const weekRangeLabel = (weekId) => {
  const mon = new Date(weekId + 'T00:00:00')
  const sat = new Date(mon)
  sat.setDate(sat.getDate() + 5)
  return fmtShort(mon) + ' - ' + fmtShort(sat)
}

const starPoints = (cx, cy, r) => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)])
  }
  return pts
}

const drawStar = (doc, cx, cy, r, filled) => {
  const pts = starPoints(cx, cy, r)
  const commands = [{ c: 'm', x: pts[0][0], y: pts[0][1] }]
  pts.slice(1).forEach(([x, y]) => commands.push({ c: 'l', x, y }))
  commands.push({ c: 'h' })
  doc.path(commands)
  if (filled) {
    doc.setFillColor.apply(doc, GOLD)
    doc.fill()
  }
  doc.setDrawColor.apply(doc, filled ? GOLD_DEEP : [204, 200, 192])
  doc.setLineWidth(0.22)
  doc.stroke()
}

/** Draws 5 stars, the first n filled (n = 0 -> all empty). */
const drawStars = (doc, x, y, n) => {
  const r = 1.55
  for (let i = 1; i <= 5; i++) {
    drawStar(doc, x + i * (r * 2 + 0.8), y, r, i <= n)
  }
}

/**
 * Builds the jsPDF document for a week of feedback.
 * Exposed separately so it can be unit-tested / reused.
 */
export const buildWeeklyFeedbackPdf = ({ weekId, feedbacks = [], users = {} }) => {
  const rows = (feedbacks || [])
    .filter((r) => getFeedbackWeekId(r.created_at) === weekId)
    .map((r) => {
      const u = users[r.user_id] || {}
      return {
        thali: u.thali_number != null && u.thali_number !== '' ? String(u.thali_number) : '-',
        name: u.name || '-',
        day: cap(r.day),
        lunchStars: r.lunch_stars || 0,
        lunchComment: clip(r.lunch_comment || ''),
        dinnerStars: r.dinner_stars || 0,
        dinnerComment: clip(r.dinner_comment || ''),
      }
    })
    .sort((a, b) => {
      const d = DAY_ORDER.indexOf(a.day.toLowerCase()) - DAY_ORDER.indexOf(b.day.toLowerCase())
      if (d !== 0) return d
      const na = parseInt(a.thali, 10)
      const nb = parseInt(b.thali, 10)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return String(a.thali).localeCompare(String(b.thali))
    })

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2

  // Header band
  doc.setFillColor.apply(doc, NAVY)
  doc.rect(0, 0, pageW, 34, 'F')
  doc.setFillColor.apply(doc, GOLD)
  doc.rect(0, 34, pageW, 0.9, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor.apply(doc, GOLD)
  doc.text('AL-MAWAID', margin, 12)

  doc.setFontSize(20)
  doc.setTextColor.apply(doc, WHITE)
  doc.text('Weekly Meal Feedback Report', margin, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor.apply(doc, GOLD_SOFT)
  doc.text('Week of ' + weekRangeLabel(weekId) + '  |  ' + rows.length + ' response' + (rows.length === 1 ? '' : 's'), margin, 29.5)

  doc.setFontSize(8)
  doc.setTextColor(170, 176, 188)
  doc.text(
    'Generated ' + new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    pageW - margin,
    12,
    { align: 'right' }
  )

  // Summary chips
  const avg = (arr) => (arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0)
  const lunchVals = rows.filter((r) => r.lunchStars).map((r) => r.lunchStars)
  const dinnerVals = rows.filter((r) => r.dinnerStars).map((r) => r.dinnerStars)
  const avgLunch = avg(lunchVals)
  const avgDinner = avg(dinnerVals)

  const chip = (label, value, x) => {
    doc.setFillColor.apply(doc, ROW_ALT)
    doc.setDrawColor.apply(doc, GOLD_SOFT)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, 41, contentW / 2 - 5, 12, 2.5, 2.5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor.apply(doc, TEXT_SUB)
    doc.text(label.toUpperCase(), x + 6, 46)
    doc.setFontSize(13)
    doc.setTextColor.apply(doc, GOLD_DEEP)
    doc.text(value === '-' ? '-' : value + ' / 5', x + 6, 51.5)
    const starVal = Math.round(parseFloat(value))
    if (!isNaN(starVal)) drawStars(doc, x + contentW / 2 - 22, 47.2, starVal)
  }

  chip('Avg Lunch Rating', avgLunch ? avgLunch.toFixed(1) : '-', margin)
  chip('Avg Dinner Rating', avgDinner ? avgDinner.toFixed(1) : '-', margin + contentW / 2)

  let y = 62

  // Table
  const cols = [
    { key: 'thali', label: 'Thali #', w: 20 },
    { key: 'name', label: 'Name', w: 46 },
    { key: 'day', label: 'Day', w: 26 },
    { key: 'lunch', label: 'Lunch', w: (contentW - 92) / 2 },
    { key: 'dinner', label: 'Dinner', w: (contentW - 92) / 2 },
  ]

  const drawHeader = (yPos) => {
    doc.setFillColor.apply(doc, NAVY)
    doc.rect(margin, yPos, contentW, 9, 'F')
    let x = margin
    cols.forEach((c) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor.apply(doc, GOLD_SOFT)
      doc.text(c.label.toUpperCase(), x + 4, yPos + 5.8)
      x += c.w
    })
  }

  const lineHeight = 3.9
  const rowPad = 3.4

  const rowHeight = (r) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const lunchLines = r.lunchComment
      ? doc.splitTextToSize(r.lunchComment, cols[3].w - 12).length
      : 0
    const dinnerLines = r.dinnerComment
      ? doc.splitTextToSize(r.dinnerComment, cols[4].w - 12).length
      : 0
    return Math.max(9, rowPad * 2 + lineHeight * Math.max(lunchLines, dinnerLines, 1))
  }

  const drawRow = (r, yPos, isAlt) => {
    if (isAlt) {
      doc.setFillColor.apply(doc, ROW_ALT)
      doc.rect(margin, yPos, contentW, rowHeight(r), 'F')
    }
    doc.setDrawColor.apply(doc, BORDER)
    doc.setLineWidth(0.25)
    doc.line(margin, yPos, margin + contentW, yPos)

    let x = margin
    const cell = (text, w, font = 'normal', size = 9, color = TEXT) => {
      doc.setFont('helvetica', font)
      doc.setFontSize(size)
      doc.setTextColor.apply(doc, color)
      doc.text(String(text), x + 4, yPos + 6)
    }
    const fitText = (text, w, size, maxLines = 2) => {
      doc.setFontSize(size)
      const lines = doc.splitTextToSize(String(text), w - 8).slice(0, maxLines)
      const last = lines[lines.length - 1]
      if (lines.length && doc.getTextWidth(last) > w - 8) {
        let t = last
        while (t.length > 1 && doc.getTextWidth(t + '...') > w - 8) t = t.slice(0, -1)
        lines[lines.length - 1] = t + '...'
      }
      return lines
    }
    const wrapCell = (text, w, font = 'normal', size = 9, color = TEXT, maxLines = 2) => {
      doc.setFont('helvetica', font)
      doc.setTextColor.apply(doc, color)
      fitText(text, w, size, maxLines).forEach((ln, i) => doc.text(ln, x + 4, yPos + 6 + i * (size * 0.5)))
    }

    wrapCell(r.thali, cols[0].w, 'bold', 8, GOLD_DEEP, 1)
    x += cols[0].w

    wrapCell(r.name, cols[1].w, 'normal', 9, TEXT, 2)
    x += cols[1].w

    cell(r.day, cols[2].w, 'normal', 8.5, TEXT_SUB)
    x += cols[2].w

    const mealCell = (stars, comment, w) => {
      if (stars) {
        drawStars(doc, x + 4, yPos + 5.6, stars)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor.apply(doc, TEXT_SUB)
        doc.text(stars + '/5', x + 30, yPos + 6)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(176, 178, 184)
        doc.text('-', x + 4, yPos + 6)
      }
      if (comment) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor.apply(doc, TEXT)
        const lines = doc.splitTextToSize(comment, w - 12)
        lines.forEach((ln, i) => doc.text(ln, x + 4, yPos + 10.5 + i * lineHeight))
      } else if (stars) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(176, 178, 184)
        doc.text('-', x + 4, yPos + 11)
      }
      x += w
    }

    mealCell(r.lunchStars, r.lunchComment, cols[3].w)
    mealCell(r.dinnerStars, r.dinnerComment, cols[4].w)
  }

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(11)
    doc.setTextColor.apply(doc, TEXT_SUB)
    doc.text('No feedback responses were recorded for this week.', pageW / 2, pageH / 2, { align: 'center' })
  } else {
    drawHeader(y)
    y += 9
    rows.forEach((r, i) => {
      const rh = rowHeight(r)
      if (y + rh > pageH - margin) {
        doc.addPage()
        y = 14
        drawHeader(y)
        y += 9
      }
      drawRow(r, y, i % 2 === 1)
      y += rh
    })
    doc.setDrawColor.apply(doc, BORDER)
    doc.setLineWidth(0.25)
    doc.line(margin, y, margin + contentW, y)
  }

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor.apply(doc, TEXT_SUB)
    doc.text(
      'Al-Mawaid | Weekly Feedback Report | Page ' + i + ' of ' + pages,
      pageW / 2,
      pageH - 7,
      { align: 'center' }
    )
  }

  return doc
}

/** Builds and downloads the weekly feedback PDF. */
export const downloadWeeklyFeedbackPdf = (opts) => {
  const doc = buildWeeklyFeedbackPdf(opts)
  const weekId = opts.weekId || getFeedbackWeekId(new Date().toISOString())
  doc.save('Al-Mawaid_Feedback_' + weekId + '.pdf')
}
