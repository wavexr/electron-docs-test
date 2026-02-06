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
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google Sheets] Error updating cell:`, message);
    return { success: false, error: `Failed to update cell: ${message}` };
  }
}
