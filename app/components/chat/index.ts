/**
 * Chat Components - Public Exports
 * Phase 5.1 P1 - Ghost System
 * Phase 5.2 P2 - Memory System
 * Phase 5.3 P3 - Orchestration Theater
 * Phase 5.4 P4 - Settings & Polish
 */

export { ChatInterface } from './ChatInterface';
export { Message, type MessageProps } from './Message';
export { MessageList, type MessageListProps } from './MessageList';
export { InputField, type InputFieldProps } from './InputField';
export { SendButton, type SendButtonProps, type SendButtonState } from './SendButton';
export { OverrideModal, type OverrideModalProps } from './OverrideModal';
export { ReceiptFooter, type ReceiptFooterProps } from './ReceiptFooter';
export { MemoryShimmer, type MemoryShimmerProps, type MemoryMatch } from './MemoryShimmer';
export { MemoryModal, type MemoryModalProps, type Memory } from './MemoryModal';
export { MemoryIndicator, type MemoryIndicatorProps } from './MemoryIndicator';
export { OrchestrationDetail, type OrchestrationDetailProps } from './OrchestrationDetail';
export { 
  ReceiptPreferencePrompt, 
  type ReceiptPreferencePromptProps,
  type ReceiptLevel,
  type ReceiptPreference,
} from './ReceiptPreferencePrompt';
export {
  BudgetPreferencePrompt,
  type BudgetPreferencePromptProps,
  type BudgetDisplayLevel,
  type BudgetPreference,
} from './BudgetPreferencePrompt';
export {
  BudgetDisplay,
  type BudgetDisplayProps,
  type BudgetMetrics,
} from './BudgetDisplay';
