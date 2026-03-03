/**
 * Templates API — Sprint 9-07
 *
 * GET  /api/templates           — list all templates (optional ?taskType= filter)
 * POST /api/templates           — create a new template
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTemplates,
  getTemplatesByTaskType,
  createTemplate,
  incrementTemplateUseCount,
} from '@/lib/agent-sdk/template-store';
import type { TaskType } from '@/lib/agent-sdk/types';

const VALID_TASK_TYPES = new Set<string>(['code', 'test', 'docs', 'research', 'analysis', 'deploy', 'self_evolution']);

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const taskType = searchParams.get('taskType');

    if (taskType && VALID_TASK_TYPES.has(taskType)) {
      const templates = getTemplatesByTaskType(taskType as TaskType);
      return NextResponse.json({ templates });
    }

    // Check for use action (increment use_count)
    const useId = searchParams.get('use');
    if (useId) {
      incrementTemplateUseCount(useId);
      return NextResponse.json({ incremented: true });
    }

    const templates = getAllTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      task_type?: string;
      title?: string;
      template_description?: string;
      success_criteria?: string[];
      project_path?: string;
    };

    if (!body.name || !body.task_type || !body.title || !body.template_description || !body.project_path) {
      return NextResponse.json({ error: 'name, task_type, title, template_description, and project_path are required' }, { status: 400 });
    }

    if (!VALID_TASK_TYPES.has(body.task_type)) {
      return NextResponse.json({ error: `Invalid task_type: ${body.task_type}` }, { status: 400 });
    }

    if (!Array.isArray(body.success_criteria) || body.success_criteria.length === 0) {
      return NextResponse.json({ error: 'success_criteria must be a non-empty array' }, { status: 400 });
    }

    const desc = body.description?.trim();
    const template = createTemplate({
      name: body.name.trim(),
      ...(desc ? { description: desc } : {}),
      task_type: body.task_type as TaskType,
      title: body.title.trim(),
      template_description: body.template_description.trim(),
      success_criteria: body.success_criteria,
      project_path: body.project_path.trim(),
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
