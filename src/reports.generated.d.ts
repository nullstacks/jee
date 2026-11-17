export interface GeneratedYearRow {
  year: number;
  q: number;
  mcq: number;
  num: number;
}

export interface GeneratedTopicRow {
  name: string;
  q: number;
  share: number;
  mcq: number;
  num: number;
  span: string;
}

export interface GeneratedMatrixRow {
  year: number;
  counts: number[];
  total: number;
}

export interface GeneratedSubTopic {
  name: string;
  q: number;
  share: number;
  span: string;
}

export interface GeneratedExample {
  year: number;
  type: string;
  text: string;
}

export interface GeneratedTopicDetail {
  name: string;
  q: number;
  share: number;
  mcq: number;
  num: number;
  years: { year: number; q: number }[];
  subtopics: GeneratedSubTopic[];
  examples: GeneratedExample[];
}

export interface GeneratedReport {
  file: string;
  subject: string;
  slug: string;
  id: string;
  chapter: string;
  unit: string;
  exams: string;
  questionsInFile: number;
  analysed: number;
  excluded: number;
  grouping: string;
  span: string;
  unlabelled: boolean;
  summary: string;
  years: GeneratedYearRow[];
  topics: GeneratedTopicRow[];
  matrix: GeneratedMatrixRow[];
  detail: GeneratedTopicDetail[];
  pattern: string[];
}

export const REPORT_DATA: {
  generatedFrom: string;
  reports: Record<string, GeneratedReport>;
};
