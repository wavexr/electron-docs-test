import { google } from 'googleapis';
import { getAuthClient } from './google-sheets';

let docsClient: ReturnType<typeof google.docs> | null = null;

async function getDocsClient() {
  if (docsClient) return docsClient;

  const auth = await getAuthClient();
  docsClient = google.docs({ version: 'v1', auth });
  return docsClient;
}

interface DocElement {
  type: 'heading' | 'paragraph' | 'list' | 'table';
  content: string;
  level?: number;
}

export async function getDocContent(): Promise<{ title: string; elements: DocElement[] } | null> {
  const docId = process.env.DOC_ID;

  if (!docId) {
    console.log('[Google Docs] No DOC_ID set, returning null');
    return null;
  }

  try {
    const docs = await getDocsClient();
    const response = await docs.documents.get({ documentId: docId });
    const doc = response.data;

    const title = doc.title || 'Untitled Document';
    const elements: DocElement[] = [];

    if (doc.body?.content) {
      for (const element of doc.body.content) {
        if (element.paragraph) {
          const paragraph = element.paragraph;
          const text = extractText(paragraph);

          if (!text.trim()) continue;

          // Check if it's a heading
          const style = paragraph.paragraphStyle?.namedStyleType;
          if (style?.startsWith('HEADING_')) {
            const level = parseInt(style.replace('HEADING_', ''), 10) || 1;
            elements.push({ type: 'heading', content: text, level });
          } else if (paragraph.bullet) {
            // It's a list item
            elements.push({ type: 'list', content: text });
          } else {
            elements.push({ type: 'paragraph', content: text });
          }
        } else if (element.table) {
          // Extract table content as text
          const tableText = extractTableText(element.table);
          if (tableText) {
            elements.push({ type: 'table', content: tableText });
          }
        }
      }
    }

    console.log(`[Google Docs] Fetched "${title}" with ${elements.length} elements`);
    return { title, elements };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Google Docs] Error fetching document:', message);
    return null;
  }
}

function extractText(paragraph: any): string {
  if (!paragraph.elements) return '';

  return paragraph.elements
    .map((el: any) => el.textRun?.content || '')
    .join('')
    .trim();
}

function extractTableText(table: any): string {
  if (!table.tableRows) return '';

  const rows: string[] = [];
  for (const row of table.tableRows) {
    const cells: string[] = [];
    for (const cell of row.tableCells || []) {
      const cellText = cell.content
        ?.map((c: any) => c.paragraph ? extractText(c.paragraph) : '')
        .join(' ')
        .trim() || '';
      cells.push(cellText);
    }
    rows.push(cells.join(' | '));
  }
  return rows.join('\n');
}
