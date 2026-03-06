import { NextResponse } from 'next/server';
import {
  inferTypeFromDescription,
  getNewProjectQuestions,
} from '@/lib/portfolio/onboarding';

// POST /api/portfolio/infer
// Body: { description: string }
// Returns: { inferred, questions, projectName }
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { description?: string };
    const description = (body.description ?? '').trim();

    if (!description) {
      return NextResponse.json(
        { success: false, error: 'description required' },
        { status: 400 },
      );
    }

    const inferred = inferTypeFromDescription(description);
    const questions = getNewProjectQuestions(description, inferred);

    // Derive a reasonable project name from the description (first few words,
    // title-cased). User can override in path selection step.
    const words = description.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 4);
    const projectName = words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    return NextResponse.json({
      success: true,
      data: { inferred, questions, projectName },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
