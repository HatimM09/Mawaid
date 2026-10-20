// scripts/html2canvas-stub.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Build-time stub for `html2canvas`.
//
// jsPDF declares html2canvas as a dependency and pulls it in via a *dynamic*
// `import("html2canvas")` that is only ever executed by `jsPDF#html()` — the
// HTML-to-PDF renderer. Every PDF in this app is authored directly with the
// text/table API (`doc.text`, `doc.save`, …) in:
//   - src/lib/payslipPdf.js
//   - src/admin/feedbackReportPdf.js
//   - src/admin/Dashboard.jsx (sticker PDF)
// so `html2canvas` (~200 kB) is dead weight in the bundle AND in the PWA
// precache manifest.
//
// Aliasing it to this stub drops that weight. If `jspdf.html()` is ever called
// in the future it throws immediately and loudly here, rather than silently
// producing a blank PDF — which is the failure mode we want.
// ─────────────────────────────────────────────────────────────────────────────
const NOT_SUPPORTED =
  'jsPDF.html() is unavailable in this build: html2canvas is stubbed out. ' +
  'Build PDFs with the jsPDF text/table API instead.'

function html2canvasStub() {
  throw new Error(NOT_SUPPORTED)
}

export default html2canvasStub
