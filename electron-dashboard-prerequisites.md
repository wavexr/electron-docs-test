# Electron Dashboard PoC — Prerequisites Guide

This guide walks you through everything you need to set up before we start building. Each section starts with a **test** so you can skip steps you've already done.

---

## Prerequisite 1: Node.js (version 18 or higher)

### Test: Do I already have it?

Open your terminal (on Mac: search for "Terminal" in Spotlight; on Windows: search for "Command Prompt" or "PowerShell") and type:

```bash
node --version
```

**If you see** something like `v18.17.0` or `v20.11.0` or any number **18 or higher** → ✅ You're good, skip to Prerequisite 2.

**If you see** a number lower than 18, or an error like `command not found` → follow the install steps below.

### Install Steps

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button on the left — it will say something like "20.x LTS")
3. Run the installer
   - **Mac**: Open the `.pkg` file, click Continue/Agree through the prompts
   - **Windows**: Open the `.msi` file, click Next through the prompts. Leave all defaults checked (especially "Add to PATH")
4. **Close your terminal completely and reopen it** (this is important — the new install won't be recognized until you do)
5. Test again:
   ```bash
   node --version
   ```
   You should now see a version number 18 or higher.

Also verify npm (Node's package manager) came with it:
```bash
npm --version
```
You should see a version number (any version is fine).

---

## Prerequisite 2: Claude CLI (Claude Code)

### Test: Do I already have it?

In your terminal, type:

```bash
claude --version
```

**If you see** a version number → ✅ Skip to Prerequisite 3.

**If you see** `command not found` → follow the install steps below.

### Install Steps

1. Make sure Node.js is installed first (Prerequisite 1 above)
2. In your terminal, run:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
   - **Mac/Linux**: If you get a permissions error, run: `sudo npm install -g @anthropic-ai/claude-code` and enter your computer password when prompted
   - **Windows**: Make sure you're running Command Prompt or PowerShell as Administrator (right-click → "Run as administrator")
3. Once it finishes installing, test it:
   ```bash
   claude --version
   ```
4. Now authenticate — run:
   ```bash
   claude
   ```
   It will open a browser window to log you in. Follow the prompts to connect your Anthropic account.

> **Note**: Claude CLI requires an Anthropic account with API access. If you don't have one yet, sign up at [https://console.anthropic.com](https://console.anthropic.com).

---

## Prerequisite 3: Anthropic API Key (for Haiku)

### Test: Do I already have one?

1. Go to [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. If you see an existing API key listed → ✅ You're good (but make sure you have the key value saved somewhere — you can't view it again after creation). Skip to Prerequisite 4.

**If you don't have one**, or don't have the key value saved:

### Steps to Create a Key

1. Go to [https://console.anthropic.com](https://console.anthropic.com) and log in (or create an account)
2. You'll need to add billing info if you haven't already:
   - Click **Settings** (gear icon) in the left sidebar
   - Click **Billing**
   - Add a credit card
   - For this PoC, even $5 of credit is more than enough — Haiku is very cheap
3. Now create an API key:
   - Click **API Keys** in the left sidebar
   - Click **Create Key**
   - Give it a name like `electron-dashboard-poc`
   - Click **Create Key**
4. **IMPORTANT**: Copy the key value right now and save it somewhere safe (a password manager, a private note, etc.). It starts with `sk-ant-`. You will **not** be able to see it again after you close this dialog.

---

## Prerequisite 4: Google Cloud Project + Service Account

This is the most involved step. A "service account" is like a robot Google account that your app uses to read/write spreadsheets on your behalf.

### Test: Do I already have one?

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. If you see a project in the top bar, click on **IAM & Admin → Service Accounts** in the left menu
3. If you see a service account listed AND you have its JSON key file saved on your computer → ✅ Skip to Prerequisite 5.

If not, follow the full setup:

### Step 4a: Create a Google Cloud Project

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your Google account
3. At the very top of the page, you'll see a project dropdown (it might say "Select a project" or show an existing project name). Click it.
4. In the popup, click **New Project** (top right)
5. Name it something like `electron-dashboard`
6. Click **Create**
7. Wait a few seconds, then make sure this new project is selected in the top dropdown

### Step 4b: Enable the Google Sheets and Docs APIs

1. In the left sidebar, click **APIs & Services → Library** (or go to [https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library))
2. In the search bar, type **Google Sheets API**
3. Click on it, then click the blue **Enable** button
4. Go back to the API library (click the back arrow or the Library link again)
5. Search for **Google Docs API**
6. Click on it, then click **Enable**

### Step 4c: Create a Service Account

1. In the left sidebar, click **IAM & Admin → Service Accounts** (or go to [https://console.cloud.google.com/iam-admin/serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts))
2. Click **+ Create Service Account** at the top
3. Fill in:
   - **Service account name**: `dashboard-reader` (or anything you like)
   - **Service account ID**: this auto-fills, leave it
   - **Description**: optional, e.g., "Reads spreadsheets for the dashboard app"
4. Click **Create and Continue**
5. For the "Grant this service account access" step — you can **skip this** (click **Continue**)
6. For the "Grant users access" step — you can **skip this too** (click **Done**)

### Step 4d: Download the JSON Key File

1. You should now see your service account in the list. Click on its **email address** (it looks like `dashboard-reader@your-project.iam.gserviceaccount.com`)
2. Click the **Keys** tab at the top
3. Click **Add Key → Create new key**
4. Select **JSON** and click **Create**
5. A `.json` file will download to your computer. This is your credentials file.
6. **Move this file** to a folder you'll remember, like your Desktop or Documents folder. You'll need the full path to it later.
7. **Don't share this file** — it grants access to your Google Cloud resources

### Step 4e: Note the Service Account Email

Look at the JSON file you downloaded (open it in any text editor). Find the `"client_email"` field — it will look something like:

```
dashboard-reader@your-project.iam.gserviceaccount.com
```

**Copy this email address.** You'll need it in the next step.

---

## Prerequisite 5: Share Your Spreadsheet (and Doc) with the Service Account

The service account can only access files that have been explicitly shared with it — just like sharing a Google Sheet with a coworker.

### Test: Is it already shared?

Open your Google Sheet, click **Share** (top right), and look for the service account email in the list of people. If it's there → ✅ Skip to Prerequisite 6.

### Steps to Share

1. Open the Google Spreadsheet you want to use in your browser
2. Click the **Share** button (top right, green/blue button)
3. In the "Add people" field, paste the **service account email** from step 4e (the `...@...iam.gserviceaccount.com` address)
4. Set the permission to **Editor** (since we'll need to write back to the sheet later)
5. **Uncheck** "Notify people" (the service account doesn't have a real email inbox)
6. Click **Send** (or **Share**)

If you also want to pull from a Google Doc:
1. Open that Google Doc
2. Repeat steps 2–6 above with the same service account email (Viewer permission is fine for docs since we're only reading)

### Note Your Spreadsheet ID and Doc ID

You'll need these IDs for the app configuration:

**Spreadsheet ID** — Open your spreadsheet in the browser. The URL looks like:
```
https://docs.google.com/spreadsheets/d/1AbC_dEfGhIjKlMnOpQrStUvWxYz/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       This part is your Spreadsheet ID
```
Copy that long string of letters, numbers, underscores, and hyphens.

**Doc ID** (if using a Google Doc) — Same idea. The URL looks like:
```
https://docs.google.com/document/d/1AbC_dEfGhIjKlMnOpQrStUvWxYz/edit
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    This part is your Doc ID
```

---

## Prerequisite 6: Git (optional but recommended)

### Test: Do I already have it?

```bash
git --version
```

**If you see** a version number → ✅ You're good.

**If you see** `command not found`:
- **Mac**: It may prompt you to install Xcode Command Line Tools. Click **Install** and wait.
- **Windows**: Download from [https://git-scm.com/download/win](https://git-scm.com/download/win) and run the installer with default settings.

---

## Final Checklist

Run this full check in your terminal to confirm everything is ready:

```bash
echo "=== Node.js ===" && node --version && echo "" && \
echo "=== npm ===" && npm --version && echo "" && \
echo "=== Claude CLI ===" && claude --version && echo "" && \
echo "=== Git ===" && git --version && echo ""
```

You should see version numbers for all four. Then manually confirm:

- [ ] I have my **Anthropic API key** saved (starts with `sk-ant-`)
- [ ] I have my **Google service account JSON file** saved and I know the file path
- [ ] I have **shared my Google Spreadsheet** with the service account email
- [ ] I know my **Spreadsheet ID** (from the URL)
- [ ] (Optional) I know my **Doc ID** if I'm using a Google Doc
- [ ] (Optional) I have **shared my Google Doc** with the service account email

---

## Gathering Your Info

Before we start building, collect all of these into one place (a text file, a sticky note, whatever works). You'll paste them into a `.env` file in the first build step:

| Item | Your Value |
|---|---|
| Path to service account JSON | e.g., `/Users/yourname/Desktop/service-account.json` |
| Spreadsheet ID | e.g., `1AbC_dEfGhIjKlMnOpQrStUvWxYz` |
| Doc ID (optional) | e.g., `1XyZ_aBcDeFgHiJkLmNoPqRs` |
| Anthropic API Key | e.g., `sk-ant-api03-...` |

---

## Troubleshooting Common Issues

**"npm: command not found" after installing Node.js**
→ Close your terminal completely and reopen it. If still not working, restart your computer.

**"Permission denied" when installing npm packages globally**
→ On Mac/Linux, put `sudo` in front of the command. On Windows, run your terminal as Administrator.

**Google Sheets API returns "403 Forbidden"**
→ Double-check that you enabled the Google Sheets API (Step 4b) and that you shared the spreadsheet with the service account email (Step 5).

**"Could not load the default credentials"**
→ Make sure the path to your service account JSON file in `.env` is correct and the file actually exists at that location.

**Anthropic API returns "401 Unauthorized"**
→ Double-check your API key. Make sure there are no extra spaces or line breaks when you paste it.

---

## Next Step

Once all checks pass, you're ready to start building! We'll begin with Prompt 1 (scaffolding the Electron + React app) in Claude CLI.
