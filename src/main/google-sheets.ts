import { google } from 'googleapis';
import { readFileSync } from 'fs';

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
let authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

export async function getAuthClient() {
  if (authClient) return authClient;

  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH not set in .env');
  }

  try {
    const credentials = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/documents.readonly',
      ],
    });
    return authClient;
  } catch (err) {
    throw new Error(`Failed to load service account: ${err}`);
  }
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = await getAuthClient();
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export async function getSheetTabs(): Promise<string[] | { error: string }> {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    console.log('[Google Sheets] No SPREADSHEET_ID set, returning mock data');
    return ['Pipeline', 'Approved', 'Rejected'];
  }

  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const tabNames = response.data.sheets?.map(
      (sheet) => sheet.properties?.title || 'Untitled'
    ) || [];

    console.log('[Google Sheets] Fetched tabs:', tabNames);
    return tabNames;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Google Sheets] Error fetching tabs:', message);

    if (message.includes('invalid_grant') || message.includes('401')) {
      return { error: 'Auth failed. Check your service account credentials.' };
    }
    if (message.includes('404') || message.includes('not found')) {
      return { error: 'Spreadsheet not found. Check the SPREADSHEET_ID.' };
    }
    return { error: `Failed to fetch tabs: ${message}` };
  }
}

export async function getSheetData(
  tabName: string
): Promise<{ headers: string[]; rows: string[][] } | { error: string }> {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    console.log('[Google Sheets] No SPREADSHEET_ID set, returning mock data');
    const mockData: Record<string, { headers: string[]; rows: string[][] }> = {
      Pipeline: {
        headers: ['Company', 'Stage', 'Amount', 'Contact'],
        rows: [
          ['Acme Corp', 'Proposal', '$50,000', 'john@acme.com'],
          ['TechStart', 'Negotiation', '$75,000', 'sarah@techstart.io'],
          ['GlobalInc', 'Discovery', '$120,000', 'mike@globalinc.com'],
        ],
      },
      Approved: {
        headers: ['Company', 'Amount', 'Close Date', 'Owner'],
        rows: [
          ['BigCo', '$200,000', '2024-01-15', 'Alice'],
          ['MegaCorp', '$350,000', '2024-02-20', 'Bob'],
        ],
      },
      Rejected: {
        headers: ['Company', 'Reason', 'Date', 'Notes'],
        rows: [['SmallBiz', 'Budget constraints', '2024-01-10', 'May revisit Q3']],
      },
    };
    return mockData[tabName] || { headers: ['No data'], rows: [] };
  }

  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: tabName,
    });

    const values = response.data.values || [];

    if (values.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = values[0] as string[];
    const rows = values.slice(1) as string[][];

    console.log(`[Google Sheets] Fetched ${rows.length} rows from "${tabName}"`);
    return { headers, rows };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google Sheets] Error fetching data from "${tabName}":`, message);

    if (message.includes('invalid_grant') || message.includes('401')) {
      return { error: 'Auth failed. Check your service account credentials.' };
    }
    if (message.includes('404') || message.includes('Unable to parse range')) {
      return { error: `Sheet "${tabName}" not found.` };
    }
    return { error: `Failed to fetch data: ${message}` };
  }
}

export async function appendRow(
  tab: string,
  values: string[]
): Promise<{ success: boolean; error?: string }> {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    return { success: false, error: 'SPREADSHEET_ID not set in .env' };
  }

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tab}'`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [values],
      },
    });

    console.log(`[Google Sheets] Appended row to "${tab}"`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google Sheets] Error appending row:`, message);
    return { success: false, error: `Failed to append row: ${message}` };
  }
}

export async function getCellValue(
  tab: string,
  range: string
): Promise<{ value: string; error?: string }> {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    return { value: '', error: 'SPREADSHEET_ID not set in .env' };
  }

  try {
    const sheets = await getSheetsClient();
    const fullRange = `${tab}!${range}`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
    });

    const value = response.data.values?.[0]?.[0] ?? '';
    console.log(`[Google Sheets] Read ${fullRange} = "${value}"`);
    return { value: String(value) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google Sheets] Error reading cell:`, message);
    return { value: '', error: `Failed to read cell: ${message}` };
  }
}

export async function findReceiptsTab(): Promise<string | null> {
  const tabs = await getSheetTabs();
  if (!Array.isArray(tabs)) return null;
  return tabs.find((t) => t.toLowerCase().replace(/\s/g, '') === 'receipts' || t.toLowerCase().replace(/\s/g, '') === 'reciepts') || null;
}

export async function getNextReceiptId(): Promise<{ receiptId: string; error?: string }> {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    return { receiptId: 'REC-001', error: 'SPREADSHEET_ID not set in .env' };
  }

  try {
    const tabName = await findReceiptsTab();
    if (!tabName) {
      return { receiptId: 'REC-001', error: 'Receipts tab not found in spreadsheet' };
    }

    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A:A`,
    });

    const values = response.data.values || [];
    let maxNum = 0;

    for (const row of values) {
      const cell = row[0];
      if (typeof cell === 'string') {
        const match = cell.match(/^REC-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `REC-${String(maxNum + 1).padStart(3, '0')}`;
    console.log(`[Google Sheets] Next receipt ID: ${nextId}`);
    return { receiptId: nextId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google Sheets] Error getting next receipt ID:`, message);
    return { receiptId: 'REC-001', error: `Failed to get receipt ID: ${message}` };
  }
}

function parseCellRef(range: string): { row: number; col: number } | null {
  const match = range.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const colStr = match[1].toUpperCase();
  const row = parseInt(match[2], 10) - 1; // 0-indexed
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { row, col: col - 1 }; // 0-indexed
}

async function setCellBackgroundGreen(tab: string, range: string): Promise<void> {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) return;

  const cell = parseCellRef(range);
  if (!cell) return;

  try {
    const sheets = await getSheetsClient();

    // Look up the numeric sheetId for this tab
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });
    const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined && sheetId !== 0) return;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: cell.row,
                endRowIndex: cell.row + 1,
                startColumnIndex: cell.col,
                endColumnIndex: cell.col + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 },
                },
              },
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ],
      },
    });

    console.log(`[Google Sheets] Set ${tab}!${range} background to light green`);
  } catch (err) {
    // Non-fatal — log but don't fail the overall update
    console.error(`[Google Sheets] Error setting background:`, err);
  }
}

export async function updateCell(
  tab: string,
  range: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    return { success: false, error: 'SPREADSHEET_ID not set in .env' };
  }

  try {
    const sheets = await getSheetsClient();
    const fullRange = `${tab}!${range}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: fullRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });

    console.log(`[Google Sheets] Updated ${fullRange} to "${value}"`);

    // Set the updated cell's background to light green
    await setCellBackgroundGreen(tab, range);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google Sheets] Error updating cell:`, message);
    return { success: false, error: `Failed to update cell: ${message}` };
  }
}
