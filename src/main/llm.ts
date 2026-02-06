import Anthropic from '@anthropic-ai/sdk';
import { getSheetTabs, getSheetData } from './google-sheets';
import { getDocContent } from './google-docs';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceReferences?: string[];
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
      max_tokens: 4096,
      system: `You are a cross-referencing data analyst. You will receive data from three sources:

1. **JIRA tickets** — from spreadsheet tabs like "Tickets", "Team", "Sprints" (structured project tracking data)
2. **Meeting notes** — from a Google Doc (decisions, action items, discussions)
3. **Slack messages** — from the "Slack Proxy" spreadsheet tab (columns: Timestamp, Channel, Sender, Message — includes #engineering channel and DM conversations)

Your job is to cross-reference ALL three sources and find discrepancies, inconsistencies, and gaps. Specifically look for:
- Tasks assigned to different people in Slack vs JIRA tickets
- Deadlines discussed in Slack that don't match ticket due dates
- Decisions made in DMs that weren't reflected in meeting notes or tickets
- Work completed or claimed by someone other than the ticket assignee
- Action items from meeting notes that have no corresponding JIRA ticket
- Status updates in Slack that contradict ticket status

Your summary MUST start with a quantitative overview: count the specific discrepancies you found by category (e.g. "Found 2 assignment mismatches, 1 missing ticket, 3 unreflected Slack decisions"). Then briefly assess the overall alignment between the three data sources.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Found X discrepancies across Y categories: N assignment mismatches, N deadline conflicts, N unreflected decisions. [Brief overall assessment.]",
  "recommendations": [
    {
      "id": "rec_1",
      "title": "Short title",
      "description": "What the discrepancy is, citing the specific sources that conflict",
      "category": "Category Name",
      "sourceReferences": ["Slack #engineering 2024-01-15", "Tickets row 3"],
      "action": {
        "tab": "SheetTabName",
        "range": "B5",
        "newValue": "Corrected value"
      }
    }
  ]
}

Each recommendation MUST include:
- "category": a grouping label such as "Assignment Mismatch", "Deadline Conflict", "Missing Ticket", "Unreflected Decision", or "Status Contradiction"
- "sourceReferences": an array of 1-3 short strings identifying the conflicting sources (e.g. "Slack #engineering 2024-01-15", "Meeting Notes - Q1 Planning", "Tickets row 5 Assignee column")

Provide 3-7 recommendations. Each should address a specific discrepancy and cite which sources conflict. The action should correct the JIRA ticket data to match what was actually decided or done.`,
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

export async function modifyRecommendation(
  rec: Recommendation,
  userNotes: string
): Promise<{ tab: string; range: string; newValue: string } | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: 'ANTHROPIC_API_KEY not set in .env' };
  }

  try {
    console.log(`[LLM] Modifying recommendation ${rec.id} with user notes...`);
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are a data correction assistant. The user has a recommendation to update a spreadsheet cell, but wants to modify the action based on their additional notes. Return ONLY valid JSON with the modified action.

Respond with this exact format:
{
  "tab": "SheetTabName",
  "range": "B5",
  "newValue": "The modified corrected value"
}

Keep the same tab and range unless the user's notes explicitly request a different cell. Focus on adjusting the newValue based on the user's notes.`,
      messages: [
        {
          role: 'user',
          content: `Original recommendation:
Title: ${rec.title}
Description: ${rec.description}
Action: Set ${rec.action.tab}!${rec.action.range} to "${rec.action.newValue}"

User's modification notes: ${userNotes}

Return the modified action as JSON.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { error: 'No text response from Claude' };
    }

    let jsonStr = textBlock.text.trim();
    jsonStr = jsonStr.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr) as { tab: string; range: string; newValue: string };
    console.log(`[LLM] Modified action: ${parsed.tab}!${parsed.range} = "${parsed.newValue}"`);
    return parsed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[LLM] Modify error:', message);
    return { error: `Modification failed: ${message}` };
  }
}
