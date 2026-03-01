/**
 * System architecture types for GREGORE
 * Maps internal architecture to professional engineering terminology
 *
 * Design Philosophy:
 * - Names describe WHAT systems do, not poetic metaphors
 * - Standard industry patterns (Repository, Service, Strategy)
 * - Indistinguishable from Fortune 500 engineering team
 */

import { UUID, Timestamp, ConfidenceLevel, ExecutionMode } from './domain';

// Result type for operations
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// System input/output base types
export interface SystemInput {
  requestId: UUID;
  content: string;
  context?: RequestContext;
  timestamp: Timestamp;
}

export interface SystemOutput {
  requestId: UUID;
  result: unknown;
  confidence: ConfidenceLevel;
  metadata?: Record<string, unknown>;
  timestamp: Timestamp;
}

export interface RequestContext {
  conversationId?: UUID;
  mode: ExecutionMode;
  activeContextIds?: UUID[];
  constraints?: RequestConstraint[];
}

export interface RequestConstraint {
  type: string;
  value: unknown;
  priority: number;
}

// Knowledge Store (verified facts and evidence)
export interface KnowledgeEntry {
  id: UUID;
  domain: string;
  statement: string;
  evidence: Evidence[];
  confidence: ConfidenceLevel;
  createdAt: Timestamp;
  verifiedAt?: Timestamp;
  expiresAt?: Timestamp;
}

export interface Evidence {
  source: string;
  type: 'observation' | 'inference' | 'citation' | 'experiment';
  weight: number;
  timestamp: Timestamp;
}

export interface KnowledgeStore {
  entries: Map<UUID, KnowledgeEntry>;
  unknowns: Map<UUID, KnowledgeGap>;
  relationships: KnowledgeRelationship[];
}

export interface KnowledgeGap {
  id: UUID;
  question: string;
  criticality: number; // 0-1, load-bearing importance
  discoveredAt: Timestamp;
}

export interface KnowledgeRelationship {
  from: UUID; // entry id
  to: UUID; // entry id
  mechanism: string;
  confidence: ConfidenceLevel;
}

// Active Context (working memory)
export interface ActiveContext {
  slots: ContextSlot[];
  maxSlots: number; // 7±2 items
  currentMode: ExecutionMode;
}

export interface ContextSlot {
  id: UUID;
  content: string;
  type: 'conversation' | 'document' | 'task' | 'reference';
  priority: number;
  loadedAt: Timestamp;
}

export interface RequestQuota {
  daily: number;
  spent: number;
  remaining: number;
  resetAt: Timestamp;
}

// Performance Tracking (self-assessment)
export interface PerformanceMetrics {
  domains: Map<string, DomainMetrics>;
  overall: number; // 0-1
}

export interface DomainMetrics {
  domain: string;
  accuracy: number; // 0-1
  sampleSize: number;
  lastUpdated: Timestamp;
}

export interface CalibrationData {
  bins: CalibrationBin[];
}

export interface CalibrationBin {
  statedConfidence: number;
  actualAccuracy: number;
  count: number;
}

// System Validation (quality gates)
export interface ValidationResult {
  id: UUID;
  type: 'policy_violation' | 'quality_failure' | 'anomaly_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  blocked: boolean;
  timestamp: Timestamp;
}

export interface SystemHealth {
  validationScore: number; // Self-reflection depth (R > 0)
  recentValidations: ValidationResult[];
  lastCheckAt: Timestamp;
}

// Runtime Profile (execution state)
export interface RuntimeProfile {
  stress: number; // 0-1, urgency level
  novelty: number; // 0-1, new information exposure
  satisfaction: number; // 0-1, goal achievement
  mode: ExecutionMode;
  profile: 'explorer' | 'builder' | 'maintainer' | 'crisis';
}

// Model Routing (AI model selection)
export interface RoutingDecision {
  tier: 'fast' | 'balanced' | 'advanced';
  strategy: 'direct' | 'cascade' | 'consensus';
  confidence: ConfidenceLevel;
  reasoning: string;
  estimatedCost: number;
}

export interface ModelRoute {
  decision: RoutingDecision;
  primaryModel: string;
  fallbackModels: string[];
  timeoutMs: number;
}

// Audit Trail (provenance tracking)
export interface AuditEntry {
  id: UUID;
  action: string;
  actor: 'user' | 'system' | 'service';
  input: unknown;
  output: unknown;
  timestamp: Timestamp;
  parentId?: UUID; // causal chain
}
