/**
 * GregLite API Sidecar — Sprint 36.0
 *
 * Express server that serves all /api/* routes in the installed Tauri build.
 * In dev mode (pnpm dev), Next.js handles these routes natively — this server
 * is never started in development.
 *
 * Architecture:
 * - Port 3717 (canonical, never changes)
 * - CORS allows tauri://localhost and http://localhost:3000
 * - All route handlers are thin wrappers around the existing Next.js route modules
 * - SSE streaming (/api/chat) is handled transparently by the adapter
 * - Graceful shutdown on SIGTERM/SIGINT (Tauri kills the process on window close)
 */

import express from 'express';
import cors from 'cors';
import type { Server } from 'http';

import { threadsRouter } from './routes/threads';
import { chatRouter } from './routes/chat';
import { bootstrapRouter } from './routes/bootstrap';
import { contextRouter } from './routes/context';
import { costsRouter } from './routes/costs';
import { agentSdkRouter } from './routes/agent-sdk';
import { kernlRouter } from './routes/kernl';
import { transitRouter } from './routes/transit';
import { decisionsRouter } from './routes/decisions';
import { decisionGateRouter } from './routes/decision-gate';
import { portfolioRouter } from './routes/portfolio';
import { projectsRouter } from './routes/projects';
import { ghostRouter } from './routes/ghost';
import { eosRouter } from './routes/eos';
import { recallRouter } from './routes/recall';
import { shimmerRouter } from './routes/shimmer';
import { crossContextRouter } from './routes/cross-context';
import { artifactsRouter } from './routes/artifacts';
import { autoTitleRouter } from './routes/auto-title';
import { morningBriefingRouter } from './routes/morning-briefing';
import { onboardingRouter } from './routes/onboarding';
import { restoreRouter } from './routes/restore';
import { settingsRouter } from './routes/settings';
import { aegisRouter } from './routes/aegis';
import { captureRouter } from './routes/capture';
import { importRouter } from './routes/import';
import { templatesRouter } from './routes/templates';
import { healthRouter } from './routes/health';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3717;
const VERSION = '1.1.0';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow both the Tauri WebView (tauri://localhost) and the Next.js dev server.
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        'tauri://localhost',
        'http://localhost:3000',
        'http://localhost:3717',
        // Tauri v2 on some systems uses this origin
        'https://tauri.localhost',
      ];
      // No origin = same-origin / non-browser (curl, health checks)
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Sidecar health (fast path, no handler overhead) ──────────────────────────
app.get('/api/health/sidecar', (_req, res) => {
  res.json({ ok: true, version: VERSION, port: PORT });
});

// ── Route namespaces ─────────────────────────────────────────────────────────
app.use('/api/threads', threadsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/bootstrap', bootstrapRouter);
app.use('/api/context', contextRouter);
app.use('/api/costs', costsRouter);
app.use('/api/agent-sdk', agentSdkRouter);
app.use('/api/kernl', kernlRouter);
app.use('/api/transit', transitRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/decision-gate', decisionGateRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/ghost', ghostRouter);
app.use('/api/eos', eosRouter);
app.use('/api/recall', recallRouter);
app.use('/api/shimmer-matches', shimmerRouter);
app.use('/api/cross-context', crossContextRouter);
app.use('/api/artifacts', artifactsRouter);
app.use('/api/auto-title', autoTitleRouter);
app.use('/api/morning-briefing', morningBriefingRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/restore', restoreRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/aegis', aegisRouter);
app.use('/api/capture', captureRouter);
app.use('/api/import', importRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/health', healthRouter);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', hint: 'GregLite sidecar: unknown /api route' });
});

// ── Shutdown ──────────────────────────────────────────────────────────────────
let server: Server;

function shutdown(signal: string): void {
  console.log(`[sidecar] ${signal} received — shutting down`);
  server.close(() => {
    console.log('[sidecar] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s if connections hang
  setTimeout(() => {
    console.warn('[sidecar] forced exit after timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────────────────
server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[sidecar] GregLite API server v${VERSION} on http://127.0.0.1:${PORT}`);
});
