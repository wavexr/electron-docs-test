import Anthropic from '@anthropic-ai/sdk';
import { getSheetTabs, getSheetData } from './google-sheets';
import { getDocContent } from './google-docs';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  action: {
    tab: string;
    range: string;
    newValue: string;
  };
}

interface AnalysisResult {
  summary: string;
  recommendations: Recommendation[];
  error?: string;
}

export async function analyzeData(): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      summary: '',
      recommendations: [],
      error: 'ANTHROPIC_API_KEY not set in .env',
    };
  }

  try {
    // 1. Gather all data
    console.log('[LLM] Gathering data for analysis...');
    const tabsResult = await getSheetTabs();
    const tabs = Array.isArray(tabsResult) ? tabsResult : [];

    const sheetDataParts: string[] = [];
    for (const tab of tabs) {
      const data = await getSheetData(tab);
      if ('error' in data) continue;

      let section = `\n--- Sheet Tab: "${tab}" ---\n`;
      section += `Headers: ${data.headers.join(' | ')}\n`;
      for (const row of data.rows) {
        section += `${row.join(' | ')}\n`;
      }
      sheetDataParts.push(section);
    }

    const docContent = await getDocContent();
    let docSection = '';
    if (docContent) {
      docSection = `\n--- Document: "${docContent.title}" ---\n`;
      for (const el of docContent.elements) {
        if (el.type === 'heading') {
          docSection += `\n## ${el.content}\n`;
        } else {
          docSection += `${el.content}\n`;
        }
      }
    }

    const userMessage = `Here is the spreadsheet data:\n${sheetDataParts.join('\n')}${docSection ? `\n\nHere is the document content:${docSection}` : ''}`;

    console.log('[LLM] Calling Claude Haiku...');

    // 2. Call Anthropic API
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a data analyst. You will receive spreadsheet data from multiple tabs and optionally a document. Analyze the data and provide actionable recommendations.

Your summary MUST start with a quantitative overview: count the specific issues you found by category (e.g. "Found 3 missing assignments, 2 overdue items, 1 status inconsistency"). Then briefly describe the overall state of the data. The summary should read like a report header so the user immediately knows the scope of issues before reviewing individual recommendations below.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Found X issues across Y categories: N missing assignments, N overdue items, N status inconsistencies. [Brief overall assessment of data health.]",
  "recommendations": [
    {
      "id": "rec_1",
      "title": "Short title",
      "description": "What to do and why",
      "action": {
        "tab": "SheetTabName",
        "range": "B5",
        "newValue": "Approved"
      }
    }
  ]
}
Provide 2-5 recommendations based on what you see in the data. Each recommendation should address one of the issues counted in the summary.`,
      messages: [{ role: 'user', content: userMessage }],
    });

    // 3. Parse the response
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { summary: '', recommendations: [], error: 'No text response from Claude' };
    }

    let jsonStr = textBlock.text.trim();

    // Strip markdown code blocks if present
    jsonStr = jsonStr.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

    // Fallback: extract first JSON object by braces
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr) as AnalysisResult;
    console.log(`[LLM] Analysis complete: ${parsed.recommendations.length} recommendations`);
    return parsed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[LLM] Error:', message);
    return {
      summary: '',
      recommendations: [],
      error: `Analysis failed: ${message}`,
    };
  }
}
