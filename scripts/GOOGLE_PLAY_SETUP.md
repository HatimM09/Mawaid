# Google Play Console Automated Upload Setup

This guide walks through the **one-time manual setup** to enable automated AAB uploads
to Google Play Console using a service account.

---

## Prerequisites

- A [Google Play Console](https://play.google.com/console/) developer account
- Your app (`com.almawaid.myapp`) already created in Google Play Console
- Access to [Google Cloud Console](https://console.cloud.google.com/)

---

## Step 1: Create a Google Cloud Project & Enable the API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services > Library**.
4. Search for **"Google Play Developer API"** and click **Enable**.

---

## Step 2: Create a Service Account

1. In Google Cloud Console, go to **IAM & Admin > Service Accounts**.
2. Click **+ Create Service Account**.
3. Give it a meaningful name, e.g.:
   - **Service account name:** `Al-Mawaid Play Publisher`
   - **Service account ID:** auto-generated (e.g., `al-mawaid-play-publisher`)
   - **Description:** `Automated releases for Al-Mawaid Android app`
4. Click **Create and Continue**.
5. **Skip** the "Grant this service account access to project" step (permissions are managed in Play Console) — click **Done**.
6. Click on the newly created service account.
7. Go to the **Keys** tab > **Add Key** > **Create New Key**.
8. Choose **JSON** format and click **Create**.
9. The key file will automatically download. **Save it securely** — this is your authentication credential.

---

## Step 3: Grant Access in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console/).
2. Navigate to **Users & permissions** (under Settings).
3. Click **Invite new users**.
4. Enter the **service account email address** from Step 2
   (looks like `al-mawaid-play-publisher@<project-id>.iam.gserviceaccount.com`).
5. Assign the following permissions (minimum for automated releases):
   - ✅ **App access** — Select your app (`com.almawaid.myapp`)
   - ✅ **Admin** (or at minimum: *Release > View app release info + Release production*)
     - For **internal testing**: *Release > Create/manage releases*
     - For **production**: *Release > Release to production*
6. Click **Invite user**.

---

## Step 4: Place the Service Account Key

1. Copy the downloaded JSON key file to:
   ```
   android/fastlane/play-service-account.json
   ```
2. This path is already in `.gitignore` and will not be committed to version control.

> **⚠️ Security warning:** Never commit this JSON key to your repository!
> The `.gitignore` already excludes it, but double-check before committing.

---

## Step 5: Install Fastlane

On your development machine (or CI server), install fastlane:

```bash
# Requires Ruby
gem install fastlane
```

Or install Ruby via [RubyInstaller](https://rubyinstaller.org/) on Windows, then:

```bash
gem install fastlane -N
```

Verify installation:

```bash
fastlane --version
```

---

## Usage

### Build the signed AAB only

```powershell
.\scripts\deploy-android.ps1
```

### Build and upload to Internal Testing track

```powershell
.\scripts\deploy-android.ps1 -Upload -Track internal
```

### Build and upload to Production

```powershell
.\scripts\deploy-android.ps1 -Upload -Track production
```

### Use fastlane directly

```bash
cd android
fastlane deploy
# or for specific tracks:
fastlane deploy track:internal
fastlane deploy track:production
fastlane production
```

---

## CI/CD (GitHub Actions / GitLab CI)

For CI/CD pipelines, **use environment variables** instead of a file:

1. Encode the service account JSON as a base64 string:
   ```bash
   base64 android/fastlane/play-service-account.json
   ```
2. Store the output in a CI secret called `PLAY_SERVICE_ACCOUNT_KEY`.
3. In your CI workflow, decode and save it before running fastlane:
   ```yaml
   - name: Decode service account key
     run: echo "${{ secrets.PLAY_SERVICE_ACCOUNT_KEY }}" | base64 -d > android/fastlane/play-service-account.json
   - name: Deploy
     run: cd android && fastlane deploy
   ```

You'll also need to store these CI secrets:
- `KEYSTORE_PASSWORD`
- `KEY_PASSWORD`
- `KEY_ALIAS` (optional, defaults to `almawaid`)
- The keystore file itself (via base64 encoding or as a CI artifact)

---

## Troubleshooting

| Error | Likely cause | Fix |
|-------|-------------|-----|
| `Google Cloud authentication failed` | Service account not invited in Play Console | Repeat Step 3 |
| `APK was not signed` | Keystore misconfigured | Check `android/app/release.keystore.jks` and signing config in `build.gradle` |
| `Version code XX already exists` | Version not bumped | Increment `versionCode` in `android/app/build.gradle` |
| `fastlane command not found` | Ruby/fastlane not installed | Run `gem install fastlane` |

---

## Resources

- [Fastlane supply documentation](https://docs.fastlane.tools/actions/supply/)
- [Google Play Developer API](https://developers.google.com/android-publisher)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
