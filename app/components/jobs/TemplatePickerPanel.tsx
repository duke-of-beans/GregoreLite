'use client';

/**
 * TemplatePickerPanel — Sprint 9-07
 *
 * 280px right-side drawer showing all saved templates, grouped by task_type.
 * Click a template to pre-fill ManifestBuilder form fields.
 */

import type { TaskType } from '@/lib/agent-sdk/types';
import { TemplatePicker } from './TemplatePicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedTemplate {
  id: string;
  name: string;
  task_type: TaskType;
  title: string;
  template_description: string;
  success_criteria: string[];
  project_path: string;
}

interface TemplatePickerPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: SelectedTemplate) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplatePickerPanel({ open, onClose, onSelect }: TemplatePickerPanelProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '280px',
        height: '100%',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--frost)', letterSpacing: '0.08em' }}>
          TEMPLATES
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--mist)', fontSize: '14px', padding: '0 4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Template list */}
      <TemplatePicker
        onSelect={(t) => {
          onSelect({
            id: t.id,
            name: t.name,
            task_type: t.task_type,
            title: t.title,
            template_description: t.template_description,
            success_criteria: t.success_criteria,
            project_path: t.project_path,
          });
          onClose();
        }}
        onDelete={() => { /* panel stays open */ }}
      />
    </div>
  );
}
