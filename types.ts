
export interface AuditRequest {
  brandUrl: string;
  healthGoal: string;
}

export interface AuditResult {
  currentAiReality: string;
  authorityTruth: string;
  hallucinationOmission: string;
  theFix: string;
  geoImplementationNotes: string;
  analytics: {
    accuracyScore: number;
    mismatchScore: number;
    unverifiableScore: number;
  };
  citations: Citation[];
}

export interface Citation {
  title: string;
  url: string;
}

export enum AuditStep {
  IDLE = 'IDLE',
  MAPPING = 'MAPPING',
  FACT_CHECKING = 'FACT_CHECKING',
  GAP_ANALYSIS = 'GAP_ANALYSIS',
  GENERATING_FIX = 'GENERATING_FIX',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
