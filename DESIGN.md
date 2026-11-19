# Google Stitch Design System — Al-Mawaid Admin Portal

## 1. Visual Atmosphere & Philosophy
- **Density:** Cockpit Balanced (Density 7.5/10) — High-utility community logistics dashboard optimized for kitchen supervisors, packaging teams, and administrators.
- **Variance:** Offset Structured (Variance 6/10) — Asymmetric statistics headers with strict tabular data grids and clear hierarchy.
- **Motion:** Responsive Fluid (Motion 6/10) — Micro-interactions, spring physics for modal drawers, tactile button press feedback (`scale(0.97)`), and staggered list reveals.
- **Design Spirit:** Anti-slop, royal institutional elegance (Bohra community culinary heritage), deep slate/charcoal foundations with calibrated champagne gold accents.

---

## 2. Color Calibration (Single Accent System)
Strictly adheres to the Stitch single-accent rule. Saturation stays strictly below 80%. Neon blue/purple AI glows are strictly **BANNED**.

| Role | Descriptive Name | Hex / CSS Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Neutral Base** | Deep Charcoal | `#0a0d14` | Primary viewport background (`--bg-deep`) |
| **Neutral Surface** | Zinc Obsidian | `rgba(18, 22, 32, 0.7)` | Card backdrops with 24px backdrop blur |
| **Neutral Elevated** | Midnight Slate | `rgba(26, 32, 48, 0.85)` | Slide drawers, command palette, tooltips |
| **Hairline Dividers** | Muted Gold Veil | `rgba(197, 160, 89, 0.12)` | Subtle table dividers, card boundaries |
| **Accent Primary** | Royal Champagne Gold | `#c5a059` | Active states, primary indicators, branding |
| **Accent Gradient** | Royal Aura | `linear-gradient(135deg, #c5a059, #d4af37)` | Active sidebar pills, hero CTAs, live dots |
| **Status Success** | Emerald Mint | `#34d399` | Applied responses, completed counts |
| **Status Danger** | Rose Crimson | `#ef4444` | Skipped thali, failed writes, removals |
| **Status Warning** | Amber Glow | `#f59e0b` | Pending submissions, partial sync |

---

## 3. Typographic Architecture
- **Display & Section Titles:** Track-tight, controlled scale. `clamp(28px, 4vw, 36px)`, weight 800, line-height 1.2.
- **Body & Labels:** `DM Sans` / System Sans-Serif, relaxed leading, never exceeding 65 characters per line.
- **Tabular Numerals & Serial Numbers (`Sr #`):** Monospace font stack (`'Space Grotesk'`, `'JetBrains Mono'`, monospace) with `font-variant-numeric: tabular-nums` for all table rows, metric values, and sequence badges (`#01`, `#02`, `#03`...).
- **Font Ban Enforced:** Generic fonts (`Times New Roman`, `Georgia`, uncalibrated `Inter`) are strictly banned in software UI.

---

## 4. Component Behaviors & Micro-Interactions
- **Serial Badges (`SrBadge`):** Monospace tabular badge with `min-width: 32px`, height `24px`, subtle gold veil background (`rgba(197, 160, 89, 0.08)`), rounded 6px, crisp 1px border.
- **Data Tables (`Table`):**
  - First-class `Sr #` column support across all data tables (`Users`, `Surveys`, `Feedback`, `Requests`, `Staff`, `Inventory`, `Accuracy & Logs`).
  - Uppercase track-wide headers (`0.12em`), subtle hover highlight (`rgba(197, 160, 89, 0.035)`).
  - Responsive horizontal scrolling with custom thin scrollbar.
- **Buttons (`Btn`):**
  - Tactile physical press feedback on active state (`transform: scale(0.97) translateY(1px)`).
  - High-density spacing with minimum 44px mobile touch target.
- **Cards (`AdminCard`):**
  - Subtle hairline inner border (`inset 0 1px 0 rgba(255, 255, 255, 0.06)`).
  - Soft ambient drop shadow (`0 10px 40px rgba(0, 0, 0, 0.3)`).

---

## 5. Layout & Responsive Principles
- **No Overlapping:** Every element has a deterministic spatial zone.
- **Mobile First Collapse:** Side-by-side cockpit columns wrap cleanly on viewports `< 768px`.
- **Full Viewport Standards:** Uses `min-h-[100dvh]` rather than `100vh` to eliminate mobile Safari browser bar jumps.
- **Performance:** Hardware-accelerated animations using `transform` and `opacity` exclusively.
