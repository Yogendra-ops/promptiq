import {
  type EvaluationResult,
  type ImprovementResult,
  type EvaluationDimension,
  type DimensionScore,
  type PromptTemplate,
  type SavedPrompt,
  type AIComparisonAnalysis,
} from '@/types';
import { uid, calculateWeightedScore } from '@/lib/utils';

export const DEMO_PROMPTS: SavedPrompt[] = [];

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

export function makeDemoComparisonAnalysis(
  promptA: { title: string; content: string },
  promptB: { title: string; content: string }
): AIComparisonAnalysis {
  const lenA = promptA.content.trim().length;
  const lenB = promptB.content.trim().length;
  const hasStructureA = /#|\*\*|- |\d\./.test(promptA.content);
  const hasStructureB = /#|\*\*|- |\d\./.test(promptB.content);
  const hasConstraintsA = /constraint|must|should not|do not|never|format|schema/i.test(promptA.content);
  const hasConstraintsB = /constraint|must|should not|do not|never|format|schema/i.test(promptB.content);

  // Score heuristic
  const scoreA = (lenA > 40 ? 2 : 0) + (hasStructureA ? 3 : 0) + (hasConstraintsA ? 3 : 0);
  const scoreB = (lenB > 40 ? 2 : 0) + (hasStructureB ? 3 : 0) + (hasConstraintsB ? 3 : 0);

  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (scoreB > scoreA) winner = 'B';
  else if (scoreA > scoreB) winner = 'A';
  else if (lenB > lenA * 1.3) winner = 'B';
  else if (lenA > lenB * 1.3) winner = 'A';

  const titleA = promptA.title || 'Prompt A';
  const titleB = promptB.title || 'Prompt B';

  const verdict =
    winner === 'B'
      ? `${titleB} provides clearer operational boundaries and greater execution predictability for language models. It reduces ambiguous interpretation compared to ${titleA}.`
      : winner === 'A'
      ? `${titleA} demonstrates superior clarity and focus. Its instructions are direct and avoid unnecessary verbosity present in ${titleB}.`
      : `Both prompts exhibit comparable execution quality. ${titleA} offers concise framing while ${titleB} emphasizes situational detail.`;

  const keyDifferences = [
    lenB > lenA
      ? `${titleB} provides more granular instructions (${Math.round((lenB / Math.max(1, lenA)) * 100)}% the length of ${titleA}).`
      : `${titleA} is more concise and direct than ${titleB}.`,
    hasConstraintsB && !hasConstraintsA
      ? `${titleB} introduces explicit negative constraints or formatting rules absent in ${titleA}.`
      : hasConstraintsA && !hasConstraintsB
      ? `${titleA} contains explicit constraints and rules that ${titleB} omits.`
      : 'Both prompts share similar constraint density.',
    hasStructureB && !hasStructureA
      ? `${titleB} utilizes structured markdown hierarchy (headers/lists) for better model parsing.`
      : hasStructureA && !hasStructureB
      ? `${titleA} features structured markdown sections that aid sequential reasoning.`
      : 'Both prompts format their requirements with structural markers.',
  ];

  const promptAStrengths = [
    lenA < lenB ? 'Concise phrasing with minimal token overhead' : 'Detailed context and domain specifications',
    hasStructureA ? 'Clear section delimiters' : 'Direct, unencumbered directive intent',
  ];

  const promptBStrengths = [
    lenB > lenA ? 'Granular task decomposition and lower ambiguity' : 'Focused, tight instructions',
    hasConstraintsB ? 'Explicit guardrails and output format expectations' : 'Clear core deliverable definition',
  ];

  const synthesisRecommendation =
    winner === 'B'
      ? `Adopt ${titleB} as your production baseline. If token consumption is a priority, streamline secondary adjectives while preserving the constraints.`
      : winner === 'A'
      ? `Adopt ${titleA} as your primary template. Consider borrowing specific output schemas or examples from ${titleB} to guarantee output shape.`
      : `Combine the concise core persona from ${titleA} with the output formatting constraints from ${titleB} for optimal LLM adherence.`;

  return {
    id: uid('cmp-demo-'),
    createdAt: new Date().toISOString(),
    promptATitle: titleA,
    promptBTitle: titleB,
    winner,
    verdict,
    keyDifferences,
    promptAStrengths,
    promptBStrengths,
    synthesisRecommendation,
    model: 'demo-mock-7b',
    isDemo: true,
  };
}
