# Al-Mawaid Releases

## v2.0.7 (versionCode 35) — 2026-08-06

### Admin
- Auto-collapsing sidebar (icon rail) with persisted collapse state on desktop and overlay drawer on mobile; bottom navigation removed.
- Query "Mark In Progress" now notifies the affected user with an in-app + push notification.

### Survey
- Survey form requires all dishes answered before auto-advancing; removed the manual "Save & Continue" button.

### Notifications
- Admin user-name alerts on query/request actions; one-time approval & survey notifications.
- Fixed notifications schema (dropped type CHECK constraint, added member insert policy).

### Native (Android)
- New app icons and splash screen (adaptive icons).
- Added privacy site (privacy-site/) and in-app privacy policy page.
- Removed `READ_MEDIA_IMAGES` permission; scoped `READ_EXTERNAL_STORAGE` to maxSdkVersion 32 per Google Play policy.

### Android AAB
- Signed release AAB: `Al-Mawaid-v2.0.7.aab` (SHA256withRSA, 2048-bit key, cert CN=Al-Mawaid).
