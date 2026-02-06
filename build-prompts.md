# Electron Dashboard — Build Prompts for Claude CLI

## How to Use This Doc

1. Open your terminal
2. Navigate to the folder where you want the project built:
   ```bash
   cd ~/electron-docs
   ```
3. Start Claude CLI:
   ```bash
   claude
   ```
4. Copy and paste **Prompt 1** into Claude CLI and hit Enter
5. Wait for it to finish building. It will create files and may run commands.
6. Follow the **"You Do"** steps after each prompt to test what was built
7. If something breaks, paste the error message into the same Claude CLI session — it's great at fixing its own work
8. Once everything is working, move on to the next prompt (you can stay in the same session or start a new one)

> **Tip**: You can stay in the same Claude CLI session for all prompts. If it starts getting confused or you want a fresh start, type `/exit` and run `claude` again.

---

## Before You Start: Create Your .env File

Before running any prompts, create a `.env` file in your `electron-docs` folder. Open any text editor, paste the following, and fill in your real values:

```
GOOGLE_SERVICE_ACCOUNT_PATH=/full/path/to/your/service-account.json
SPREADSHEET_ID=your_spreadsheet_id_here
DOC_ID=your_doc_id_here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**How to find the full path to your service account JSON:**
- **Mac**: Right-click the file in Finder → Hold Option → Click "Copy as Pathname"
- **Windows**: Hold Shift → Right-click the file → "Copy as path"
- **Either**: If you saved it in electron-docs, it's something like `/Users/yourname/electron-docs/service-account.json`

Save this file as `.env` (yes, starting with a dot) in your `electron-docs` folder.

> **Note about the dot**: Files starting with `.` are hidden by default on Mac/Linux. That's normal. In your terminal you can see it with `ls -a`.

---

## Prompt 1: Scaffold the Electron + React App

Copy and paste this entire block into Claude CLI:

```
Create an Electron app with React in the current directory. Use electron-forge 
with Vite + React. Set up the project with this structure:

- src/main/ — Electron main process files
- src/renderer/ — React app (the UI)  
- src/preload/ — preload script using contextBridge

Set up an IPC bridge in the preload script that exposes these channels 
to the renderer via contextBridge under window.electronAPI:
- 'get-sheet-tabs' — will return array of tab names
- 'get-sheet-data' — takes a tab name, will return rows
- 'get-doc-content' — will return parsed doc content  
- 'update-cell' — takes tab, range, value — will write to sheet
- 'analyze-data' — will trigger LLM analysis

For now, create PLACEHOLDER handlers in the main process that return 
mock/fake data so we can test the app runs. Example mock data:
- get-sheet-tabs returns ['Pipeline', 'Approved', 'Rejected']
- get-sheet-data returns some fake rows with headers
- analyze-data returns a fake summary and recommendations array

Install these dependencies: googleapis, @anthropic-ai/sdk, dotenv

Load the .env file from the project root in the main process using dotenv.

Set the window size to 900x700.

Make sure the app builds and runs with: npm start
```

### You Do After Prompt 1:

1. Claude CLI will create a bunch of files and probably run some install commands
2. When it's done, run:
   ```bash
   npm start
   ```
3. A window should open showing the React app with some placeholder content
4. If you get errors, paste them back into Claude CLI and say "I got this error when running npm start" — let it fix things
5. Once the window opens successfully, you're ready for Prompt 2

> **Note**: The first `npm start` might take 30-60 seconds as it compiles everything. That's normal.

---

## Prompt 2: Connect to Google Sheets

```
Now replace the mock Google Sheets handlers with real ones. 

In the main process:
- Load the service account JSON from the path in the GOOGLE_SERVICE_ACCOUNT_PATH 
  environment variable
- Authenticate with the googleapis library using google.auth.GoogleAuth 
  with scopes for sheets and docs
- The SPREADSHEET_ID comes from the .env file

Implement these IPC handlers for real:

'get-sheet-tabs': 
- Call sheets.spreadsheets.get to fetch spreadsheet metadata
- Return an array of sheet/tab names

'get-sheet-data' (receives a tab name as argument):
- Call sheets.spreadsheets.values.get for that tab (range: 'TabName')  
- First row should be treated as headers
- Return { headers: string[], rows: string[][] }

Add error handling:
- If auth fails, log a clear error message and return { error: 'Auth failed...' }
- If the sheet isn't found, return { error: 'Sheet not found...' }
- Keep the mock data as a fallback if SPREADSHEET_ID is not set

Put the Google Sheets logic in a separate file: src/main/google-sheets.js
```

### You Do After Prompt 2:

1. Make sure your `.env` file has the correct values filled in
2. Run `npm start`
3. Open the DevTools console in the Electron window (if Claude didn't add a menu for this, use `Ctrl+Shift+I` on Windows or `Cmd+Option+I` on Mac)
4. You should see your real spreadsheet tab names loading (or in the UI if Prompt 1 built out a basic display)
5. If you see auth errors, double-check:
   - Is the path to your service account JSON correct in `.env`?
   - Did you share the spreadsheet with the service account email?
   - Did you enable the Google Sheets API in your GCP project?

---

## Prompt 3: Connect to Google Docs

```
Add Google Docs support in the main process.

Create src/main/google-docs.js and implement the 'get-doc-content' 
IPC handler:

- Use the same auth instance from the Google Sheets setup (share it 
  or create a shared auth module)
- The DOC_ID comes from the .env file
- Call docs.documents.get to fetch the document
- Parse the doc body into a simple array of objects:
  { type: 'heading' | 'paragraph' | 'list' | 'table', 
    content: string, 
    level: number (for headings) }
- Handle nested content in paragraphs (textRun elements)
- If DOC_ID is not set in .env, return null gracefully (not an error)

Make sure the shared auth module works for both Sheets and Docs.
```

### You Do After Prompt 3:

1. Run `npm start`
2. If you have a DOC_ID in your `.env`, check the console for doc content loading
3. If you don't have a doc to test with, that's fine — it should gracefully return null
4. This is a quick one — move on to Prompt 4 when ready

---

## Prompt 4: Build the Dashboard UI

This is the big visual one. Copy and paste this entire block into Claude CLI:

```
Build out the React renderer UI as a clean dashboard using the CSS variables theme I'm providing below.

First, set up the CSS variables. Create a styles file that includes:

@layer base {
  :root {
    --background: 240 5% 95%;
    --foreground: 240 5% 10%;
    --card: 240 5% 95%;
    --card-foreground: 240 5% 10%;
    --popover: 240 5% 95%;
    --popover-foreground: 240 5% 10%;
    --primary: 220 80% 50%;
    --primary-foreground: 220 90% 95%;
    --secondary: 260 25% 85%;
    --secondary-foreground: 240 20% 20%;
    --muted: 260 15% 90%;
    --muted-foreground: 260 10% 40%;
    --accent: 260 15% 90%;
    --accent-foreground: 240 5% 10%;
    --destructive: 0 70% 55%;
    --destructive-foreground: 0 0% 98%;
    --border: 260 25% 85%;
    --input: 260 25% 85%;
    --ring: 220 80% 50%;
    --radius: 0.5rem;
    --sidebar-background: 240 5% 92%;
    --sidebar-foreground: 240 5% 38%;
    --sidebar-primary: 220 80% 50%;
    --sidebar-primary-foreground: 220 90% 95%;
    --sidebar-accent: 260 15% 87%;
    --sidebar-accent-foreground: 240 5% 10%;
    --sidebar-border: 260 25% 82%;
    --sidebar-ring: 220 80% 47%;
  }
  .dark {
    --background: 240 10% 5%;
    --foreground: 220 50% 90%;
    --card: 240 10% 5%;
    --card-foreground: 220 50% 90%;
    --popover: 240 10% 5%;
    --popover-foreground: 220 50% 90%;
    --primary: 220 80% 50%;
    --primary-foreground: 220 90% 95%;
    --secondary: 260 25% 25%;
    --secondary-foreground: 220 50% 85%;
    --muted: 260 15% 15%;
    --muted-foreground: 220 60% 70%;
    --accent: 260 15% 15%;
    --accent-foreground: 220 50% 90%;
    --destructive: 0 80% 50%;
    --destructive-foreground: 220 90% 95%;
    --border: 260 25% 25%;
    --input: 260 25% 25%;
    --ring: 220 80% 50%;
    --sidebar-background: 0 0% 0%;
    --sidebar-foreground: 220 50% 63%;
    --sidebar-primary: 220 80% 42%;
    --sidebar-primary-foreground: 220 90% 95%;
    --sidebar-accent: 260 15% 7%;
    --sidebar-accent-foreground: 220 50% 90%;
    --sidebar-border: 260 25% 17%;
    --sidebar-ring: 220 80% 42%;
  }
}

Use these variables throughout the UI with hsl(), e.g.:
- background-color: hsl(var(--background));
- color: hsl(var(--foreground));
- border-color: hsl(var(--border));
- Buttons: background hsl(var(--primary)), text hsl(var(--primary-foreground))
- Muted text: hsl(var(--muted-foreground))
- Use border-radius: var(--radius) for buttons and cards

Layout:
- Header bar at the top with:
  - App title "Dashboard" on the left
  - A "Refresh" button on the right
  - An "Analyze" button next to Refresh (disabled for now, we'll
    wire it up later)

- Tab bar below the header:
  - One tab per spreadsheet sheet/tab (loaded from get-sheet-tabs)
  - Plus a "Document" tab at the end if doc content is available
  - Active tab uses --primary colors, inactive uses --muted

- Main content area (use --card for background):
  - When a sheet tab is selected: show the data in a clean HTML table
    with the headers row styled differently (bold, --muted background)
  - When the Document tab is selected: render the parsed doc content
    with appropriate styling (headings larger, paragraphs as text, etc.)
  - Show a loading spinner/message while data is being fetched

- Status bar at the bottom showing "Last refreshed: [timestamp]"
  using --muted-foreground for text

Behavior:
- On app load, fetch the tab list, then auto-select and load the first tab
- Clicking a tab fetches and displays that tab's data
- Refresh button re-fetches the current tab's data
- Window title should show "Dashboard" for now

Make sure it looks polished — this will be demoed.
```

### You Do After Prompt 4:

1. Run `npm start`
2. You should see a real dashboard with your spreadsheet tabs across the top
3. Click each tab — your actual data should appear in tables
4. Click the Document tab if you have a doc connected
5. Try the Refresh button
6. **This is a key checkpoint** — take a moment to make sure you're happy with how it looks. If you want changes (different colors, layout tweaks, etc.), just tell Claude CLI what you want, e.g.:
   - "Make the table rows alternate colors using --muted and --background"
   - "Make the font size smaller in the table"
   - "Add borders between the table cells using --border"

---

## Prompt 5: Add LLM Analysis with Haiku

```
Now wire up the Analyze button with Claude Haiku.

Create src/main/llm.js and implement the 'analyze-data' IPC handler:

1. When triggered, gather ALL data:
   - Fetch data from every sheet tab (reuse the get-sheet-data logic)
   - Fetch the doc content if available
   
2. Build a prompt for Claude:
   - System prompt: "You are a data analyst. You will receive 
     spreadsheet data from multiple tabs and optionally a document. 
     Analyze the data and provide actionable recommendations. 
     Respond ONLY with valid JSON in this exact format:
     {
       \"summary\": \"Brief overall analysis\",
       \"recommendations\": [
         {
           \"id\": \"rec_1\",
           \"title\": \"Short title\",
           \"description\": \"What to do and why\",
           \"action\": {
             \"tab\": \"SheetTabName\",
             \"range\": \"B5\",
             \"newValue\": \"Approved\"
           }
         }
       ]
     }
     Provide 2-5 recommendations based on what you see in the data."
   - User message: Include all the spreadsheet data formatted clearly 
     (tab name, headers, then rows) and the doc content

3. Call the Anthropic API:
   - Use the @anthropic-ai/sdk package
   - Model: 'claude-haiku-4-5-20251001' 
   - max_tokens: 1024
   - Parse the JSON response (handle cases where Claude wraps it 
     in markdown code blocks)

4. Update the React UI:
   - The Analyze button in the header should now work
   - When clicked, show a loading state ("Analyzing..." with a spinner)
   - When results come back, show them in a panel/overlay:
     - Summary text at the top
     - Recommendation cards below, each showing:
       - Title (bold)
       - Description
       - An "Apply" button (disabled for now — next prompt)
   - Add a way to close/dismiss the analysis panel
   
   Error handling: if the API call fails, show a friendly error 
   message in the panel instead of crashing.
```

### You Do After Prompt 5:

1. Run `npm start`
2. Click the **Analyze** button
3. Wait a few seconds (Haiku is fast but it still needs to gather data and call the API)
4. You should see a summary and recommendation cards appear
5. If you get API errors, check:
   - Is your `ANTHROPIC_API_KEY` correct in `.env`?
   - Do you have billing set up on your Anthropic account?
6. Read through the recommendations — they should reference your actual data. If they seem generic or off, you can tell Claude CLI:
   - "The recommendations are too generic. Update the system prompt to be more specific about [your domain, e.g., sales pipeline, project tracking, etc.]"

---

## Prompt 6: Wire Up the Write-Back Actions

```
Make the "Apply" buttons on recommendation cards actually work.

Implement the 'update-cell' IPC handler in the main process:
- Takes { tab, range, value } as arguments
- Uses sheets.spreadsheets.values.update to write to the cell
- valueInputOption should be 'USER_ENTERED' so formulas and 
  dates work properly
- Returns { success: true } or { success: false, error: '...' }

Update the React UI:
- Each recommendation card's "Apply" button calls update-cell 
  with the action from the recommendation
- While the update is in progress, show a small loading indicator 
  on that specific card
- On success:
  - Show a green checkmark and "Applied!" on the card
  - Disable the Apply button (prevent double-clicking)
  - Auto-refresh the data in the affected tab (re-fetch it)
- On failure:
  - Show a red error message on the card
  - Keep the Apply button enabled so they can retry

Add a simple toast/notification system: after any successful write, 
show a small notification at the bottom of the screen that says 
"Updated [tab] [range] successfully" that fades out after 3 seconds.
```

### You Do After Prompt 6:

1. Run `npm start`
2. Click **Analyze**, wait for recommendations
3. Click **Apply** on one of the recommendations
4. Open your Google Spreadsheet in a browser and check — the cell should have changed!
5. If the write fails, check:
   - Did you share the spreadsheet with **Editor** permission (not Viewer)?

> **⚠️ Important**: This will actually modify your spreadsheet. If you're testing with real/important data, make a copy of the spreadsheet first (File → Make a copy in Google Sheets) and update the SPREADSHEET_ID in `.env` to point to the copy.

---

## Prompt 7: Polish and Demo Prep

```
Final polish pass on the app:

1. Header improvements:
   - Fetch and display the spreadsheet name from the metadata 
     (replace "Dashboard" with the actual spreadsheet title)
   - Set the window title to match

2. Keyboard shortcuts:
   - Cmd/Ctrl+R to refresh current tab data
   - Escape to close the analysis panel

3. Edge cases:
   - If a tab has no data, show "No data in this tab" instead of 
     an empty table
   - If there are more than 500 rows, only show the first 500 with 
     a note: "Showing first 500 of X rows"
   - If the network is down, show a friendly error instead of crashing

4. Visual polish:
   - Add subtle hover effects on table rows
   - Add a subtle shadow on the analysis panel
   - Make sure the loading states look smooth
   - Add a small footer: "Last refreshed: [time]"

5. Add a .gitignore file that includes:
   - node_modules/
   - .env
   - *.json (to catch the service account file)
   - out/ and dist/
   
6. Make sure everything still runs cleanly with npm start
```

### You Do After Prompt 7:

1. Run `npm start`
2. Walk through the full flow:
   - App opens → tabs load → click through tabs → click Analyze → read recommendations → click Apply → check your spreadsheet
3. Try the keyboard shortcuts
4. This is your **demo-ready** version!

---

## Troubleshooting Cheat Sheet

If anything goes wrong at any point, here are the most common fixes:

| Problem | Fix |
|---|---|
| `npm start` fails with module errors | Run `npm install` then try again |
| Window opens but is blank/white | Open DevTools (Cmd+Option+I / Ctrl+Shift+I) and check the Console tab for errors. Paste the error into Claude CLI |
| "Cannot find module" errors | Ask Claude CLI: "I'm getting this error: [paste error]. Please fix it." |
| Google auth fails | Verify the path in `.env` is correct. Try an absolute path (starting with `/` on Mac or `C:\` on Windows) |
| Sheets data doesn't load | Make sure you shared the sheet with the service account email with Editor permission |
| Analyze button does nothing | Check DevTools console for errors. Common: bad API key or no billing on Anthropic account |
| Apply doesn't update the sheet | Confirm the sheet is shared with Editor (not Viewer) permission |
| App is slow to start | Normal for first launch. Subsequent launches are faster. |
| Claude CLI seems stuck | Press Ctrl+C to cancel, then try the prompt again |
| Want to start fresh | Exit Claude CLI, delete the project folder, and start from Prompt 1 |

---

## What's Next (After the PoC)

Once you have this working, the natural next steps are:

1. **Add Slack integration** — slash command triggers the dashboard, Slack messages confirm write-backs
2. **Custom analysis prompts** — tailor the LLM prompt to your specific domain
3. **Multi-spreadsheet support** — configuration to pick which sheets to analyze
4. **History/audit log** — track what changes were made and when
5. **Package for distribution** — use electron-builder to create an installable .dmg or .exe

But that's all for later. Get this PoC solid first! 🎉
