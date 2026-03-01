// Bootstrap module types — context injection package

export interface KERNLProject {
  id: string;
  name: string;
  path: string | null;
  description: string | null;
  status: string;
}

export interface KERNLDecision {
  id: string;
  category: string;
  decision: string;  // maps to decisions.title
  rationale: string;
  timestamp: number; // maps to decisions.created_at
}

export interface KERNLContext {
  activeProjects: KERNLProject[];
  recentDecisions: KERNLDecision[];
  lastSessionSummary: string | null;
  activeSession: string | null;
}

export interface DevProtocols {
  technicalStandards: string | null;
  claudeInstructions: string | null;
  loadErrors: string[];
}

export interface ContextPackage {
  systemPrompt: string;
  kernlContext: KERNLContext;
  devProtocols: DevProtocols;
  bootstrapTimestamp: number;
  coldStartMs: number;
}

export interface BootstrapResult {
  success: boolean;
  package: ContextPackage;
  errors: string[];
}
