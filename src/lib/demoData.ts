import {
  type EvaluationResult,
  type ImprovementResult,
  type EvaluationDimension,
  type DimensionScore,
  type PromptTemplate,
  type SavedPrompt,
} from '@/types';
import { uid, calculateWeightedScore } from '@/lib/utils';

export const DEMO_PROMPTS: SavedPrompt[] = [
  {
    id: 'demo-prompt-1',
    title: 'Weekly Engineering Standup Summary',
    content:
      'Summarize the following engineering team updates into a concise weekly standup summary. Focus on blockers, completed work, and upcoming priorities.',
    category: 'Engineering',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    tags: ['standup', 'summary', 'team'],
    lastScore: 7.2,
    notes: 'Works well with bullet-point input format.',
  },
  {
    id: 'demo-prompt-2',
    title: 'Customer Escalation Response',
    content: 'Draft a professional reply to an upset customer email.',
    category: 'Customer Success',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    tags: ['email', 'support', 'escalation'],
    lastScore: 5.4,
  },
  {
    id: 'demo-prompt-3',
    title: 'Security Audit Checklist',
    content:
      'As a senior security auditor, review the attached architecture for OWASP Top 10 vulnerabilities. Provide a severity-rated checklist with concrete remediation steps and owners.',
    category: 'Security & Compliance',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    tags: ['audit', 'OWASP', 'security'],
    lastScore: 8.4,
  },
];

export const DEMO_TEMPLATES: PromptTemplate[] = [
  {
    id: 'template-email',
    name: 'Email Writing',
    description: 'Professional email drafts with tone, context, and call to action.',
    category: 'General',
    icon: 'Mail',
    content:
      'Write a professional email with the following parameters:\n\n**Tone:** {{tone}}\n**Context:** {{context}}\n**Recipient:** {{recipient}}\n**Key Points:**\n{{keyPoints}}\n**Desired Outcome / Call to Action:** {{cta}}',
    variables: [
      { name: 'tone', label: 'Tone', description: 'e.g. friendly, formal, urgent', defaultValue: 'Professional and concise' },
      { name: 'context', label: 'Context / Background', description: 'Short description of the situation', defaultValue: '' },
      { name: 'recipient', label: 'Recipient Role', description: 'e.g. customer, manager, prospect', defaultValue: 'Customer' },
      { name: 'keyPoints', label: 'Key Points (one per line)', description: 'Bullet list of points to include', defaultValue: '' },
      { name: 'cta', label: 'Call to Action', description: 'What should the reader do next?', defaultValue: '' },
    ],
  },
  {
    id: 'template-summary',
    name: 'Document Summarisation',
    description: 'Condense long documents into structured summaries.',
    category: 'Product & Strategy',
    icon: 'FileText',
    content:
      'Summarize the following document.\n\n**Document:**\n{{document}}\n\nProduce a structured summary with these sections:\n1. Executive TL;DR (2-3 sentences)\n2. Key Findings / Decisions\n3. Open Questions\n4. Action Items with Owners',
    variables: [
      { name: 'document', label: 'Document Text', description: 'The full text to summarise', defaultValue: '' },
    ],
  },
  {
    id: 'template-meeting',
    name: 'Meeting Notes',
    description: 'Capture decisions, owners, and action items from meeting transcripts.',
    category: 'Product & Strategy',
    icon: 'Calendar',
    content:
      'You are an executive assistant. Convert the following meeting transcript into polished meeting minutes.\n\n**Meeting Title:** {{title}}\n**Transcript / Notes:**\n{{notes}}\n\nStructure your output with:\n- Attendees\n- Decisions Made\n- Discussion Highlights\n- Action Items (Owner | Action | Due)\n- Next Steps',
    variables: [
      { name: 'title', label: 'Meeting Title', description: 'e.g. Q3 Planning Sync', defaultValue: '' },
      { name: 'notes', label: 'Transcript / Notes', description: 'Raw discussion or voice-to-text notes', defaultValue: '' },
    ],
  },
  {
    id: 'template-report',
    name: 'Report Generation',
    description: 'Generate structured business reports from raw data and notes.',
    category: 'Product & Strategy',
    icon: 'BarChart3',
    content:
      'Draft a formal {{reportType}} report for {{audience}} based on the following input data.\n\n**Input Data:**\n{{data}}\n\nRequirements:\n- Executive summary (max 3 bullets)\n- 3 key insights with supporting evidence\n- Risk register with likelihood and impact\n- Recommendations with resource estimates',
    variables: [
      { name: 'reportType', label: 'Report Type', description: 'e.g. Quarterly, Incident, Strategy', defaultValue: 'Quarterly Business Review' },
      { name: 'audience', label: 'Audience', description: 'e.g. Executive Team, Board', defaultValue: 'Leadership Team' },
      { name: 'data', label: 'Input Data / Notes', description: 'All raw data to include', defaultValue: '' },
    ],
  },
  {
    id: 'template-sql',
    name: 'SQL Assistance',
    description: 'Write, explain, and optimize SQL queries for a target database.',
    category: 'Engineering',
    icon: 'Database',
    content:
      'You are a senior data engineer working with a {{dialect}} database.\n\n**Schema (tables and columns):**\n{{schema}}\n\n**Task:** {{task}}\n\nRespond with:\n1. A plain-English explanation of the logic\n2. The SQL query (formatted)\n3. Any performance considerations or index suggestions',
    variables: [
      { name: 'dialect', label: 'SQL Dialect', description: 'e.g. PostgreSQL, BigQuery, SQL Server', defaultValue: 'PostgreSQL' },
      { name: 'schema', label: 'Schema', description: 'Tables, columns, and relationships', defaultValue: '' },
      { name: 'task', label: 'Query Task', description: 'What the query should produce', defaultValue: '' },
    ],
  },
  {
    id: 'template-docs',
    name: 'Technical Documentation',
    description: 'Create API docs, architecture READMEs, and runbooks.',
    category: 'Engineering',
    icon: 'BookOpen',
    content:
      'Write production-grade technical documentation.\n\n**Document Type:** {{docType}}\n**Subject / Code:**\n{{code}}\n\nSections:\n- Purpose & Scope\n- Prerequisites\n- Usage / Quick Start\n- Architecture Overview (if applicable)\n- Edge Cases & Failure Modes\n- Maintainers & Ownership',
    variables: [
      { name: 'docType', label: 'Document Type', description: 'README, API Reference, Runbook, Architecture', defaultValue: 'README' },
      { name: 'code', label: 'Code / Subject', description: 'The code, API, or system being documented', defaultValue: '' },
    ],
  },
];

function dim(score: number, feedback: string): DimensionScore {
  return { score, feedback };
}

export function makeDemoEvaluation(promptTitle: string, promptContent: string): EvaluationResult {
  const dimensions: Record<EvaluationDimension, DimensionScore> = {
    clarity: dim(
      8,
      'The prompt uses straightforward language and avoids ambiguity. A few instructions could be broken into numbered steps for faster scanning.'
    ),
    context: dim(
      6,
      'You have provided the role and broad task, but additional situational context (audience, constraints, past attempts) would help tailor the response.'
    ),
    specificity: dim(
      7,
      'The requested output is reasonably scoped. Specifying length limits and format preferences (tables, bullets) would improve determinism.'
    ),
    constraints: dim(
      5,
      'Rules and exclusions are mostly implicit. State forbidden topics, tone guardrails, and compliance requirements explicitly.'
    ),
    outputExpectations: dim(
      8,
      'The overall deliverable is clear. Adding an example snippet or output skeleton would guarantee shape consistency.'
    ),
  };

  const overall = calculateWeightedScore(dimensions);

  return {
    id: uid('eval-demo-'),
    createdAt: new Date().toISOString(),
    promptTitle,
    promptContent,
    model: 'demo-mock-7b',
    dimensions,
    overallScore: overall,
    executiveSummary:
      `This prompt is well-structured and clearly communicates the core request. The overall score is ${overall.toFixed(1)}/10. ` +
      `Strengths lie in clarity and output expectations. The main opportunities are richer situational context and an explicit constraints list that the model should honor.`,
    strengths: [
      'Clear primary objective stated at the top',
      'Role framing helps the model adopt the right persona',
      'Output expectations are described in actionable terms',
    ],
    weaknesses: [
      'Missing explicit constraints (forbidden topics, tone rules, length)',
      'Lightweight situational context — no past attempts or audience detail',
      'No edge-case handling or fallback behavior defined',
    ],
    recommendations: [
      'Add numbered constraints section covering tone, length, and forbidden content',
      'Provide 2-3 sentences of situational context and intended audience',
      'Include an output skeleton or example of the desired format',
      'State failure mode instructions: what the model should do if it lacks information',
    ],
    isDemo: true,
  };
}

export function makeDemoImprovement(promptTitle: string, promptContent: string): ImprovementResult {
  const improvedTitle = promptTitle.endsWith(' (Improved)') ? promptTitle : `${promptTitle} (Improved)`;
  const improvedContent =
    `# Role & Task\nYou are a senior specialist. Carefully read and execute the following request.\n\n# Context\n${promptContent}\n\n# Constraints\n- Keep the output structured and skimmable; use headings and bullet points.\n- Stay factual and avoid speculation. If information is missing, list it as a follow-up question.\n- Do not exceed 500 words unless the user explicitly requests more depth.\n- Preserve all numbers, names, and dates as provided.\n\n# Output Format\n1. Executive TL;DR (2-3 sentences)\n2. Detailed response\n3. Assumptions & Follow-up questions (if any)\n4. Recommended next action`;

  return {
    id: uid('imp-demo-'),
    createdAt: new Date().toISOString(),
    originalTitle: promptTitle,
    originalPromptContent: promptContent,
    improvedTitle,
    improvedPromptContent: improvedContent,
    model: 'demo-mock-7b',
    changes: [
      'Added explicit Role & Task preamble to anchor the persona',
      'Introduced a formal Constraints section with length, tone, and format rules',
      'Specified a structured, four-part output format with TL;DR first',
      'Asked the model to surface assumptions and follow-up questions explicitly',
    ],
    rationale:
      'The original prompt expressed a valid intent but relied on implicit model defaults. Adding explicit boundaries, a concrete output skeleton, and a missing-information policy reduces ambiguity and produces more consistent, auditable outputs.',
    isDemo: true,
  };
}
