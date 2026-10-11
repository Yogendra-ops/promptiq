export type EvaluationDimension =
  | 'clarity'
  | 'context'
  | 'specificity'
  | 'constraints'
  | 'outputExpectations';

export const DIMENSION_WEIGHTS: Record<EvaluationDimension, number> = {
  clarity: 0.25,
  context: 0.20,
  specificity: 0.20,
  constraints: 0.20,
  outputExpectations: 0.15,
};

export const DIMENSION_LABELS: Record<EvaluationDimension, string> = {
  clarity: 'Clarity',
  context: 'Context',
  specificity: 'Specificity',
  constraints: 'Constraints',
  outputExpectations: 'Output Expectations',
};

export const DIMENSION_DESCRIPTIONS: Record<EvaluationDimension, string> = {
  clarity: 'Language is unambiguous, free of jargon, and each instruction is phrased precisely.',
  context: 'Provides sufficient background information and situational detail for the model.',
  specificity: 'Defines scope, boundaries, and concrete deliverables rather than vague requests.',
  constraints: 'Explicitly lists rules, formats, limits, and exclusion criteria for the response.',
  outputExpectations: 'Defines the shape, tone, length, and structure of the desired output.',
};

export interface DimensionScore {
  score: number;
  feedback: string;
  examples?: string[];
}

export interface EvaluationResult {
  id: string;
  createdAt: string;
  promptId?: string;
  promptTitle: string;
  promptContent: string;
  model: string;
  dimensions: Record<EvaluationDimension, DimensionScore>;
  overallScore: number;
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  isDemo?: boolean;
}

export interface ImprovementResult {
  id: string;
  createdAt: string;
  promptId?: string;
  originalPromptContent: string;
  originalTitle: string;
  improvedPromptContent: string;
  improvedTitle: string;
  model: string;
  changes: string[];
  rationale: string;
  isDemo?: boolean;
}

export interface AIComparisonAnalysis {
  id: string;
  createdAt: string;
  promptATitle: string;
  promptBTitle: string;
  winner: 'A' | 'B' | 'tie';
  verdict: string;
  keyDifferences: string[];
  promptAStrengths: string[];
  promptBStrengths: string[];
  synthesisRecommendation: string;
  model: string;
  isDemo?: boolean;
}

export type PromptCategory =
  | 'Engineering'
  | 'Product & Strategy'
  | 'Customer Success'
  | 'Security & Compliance'
  | 'General';

export const PROMPT_CATEGORIES: PromptCategory[] = [
  'Engineering',
  'Product & Strategy',
  'Customer Success',
  'Security & Compliance',
  'General',
];

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  category: PromptCategory;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  lastScore?: number;
  notes?: string;
}

export interface TemplateVariable {
  name: string;
  label: string;
  description?: string;
  defaultValue?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  content: string;
  variables: TemplateVariable[];
  icon: string;
}

export interface PromptCounters {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  estimatedTokens: number;
}

export type AppPage =
  | 'overview'
  | 'evaluator'
  | 'compare'
  | 'lab'
  | 'prompts'
  | 'templates'
  | 'settings';

export interface OllamaSettings {
  baseUrl: string;
  selectedModel: string;
  connectionStatus: 'unknown' | 'connected' | 'disconnected' | 'checking';
  timeoutMs: number;
  temperature: number;
}

export interface AppSettings {
  ollama: OllamaSettings;
  demoMode: boolean;
  lastOpenedPage: AppPage;
}

export interface ComparisonView {
  original: EvaluationResult | null;
  improved: EvaluationResult | null;
  improvement: ImprovementResult | null;
}

export interface OllamaModel {
  name: string;
  size: number;
  modifiedAt: string;
  digest: string;
  details?: {
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}
