/**
 * Budget Enforcer — 500ms wall-clock CPU budget per indexer run.
 *
 * Not true CPU measurement — elapsed wall-clock time is used as a proxy.
 * If the budget is exceeded mid-batch, the indexer stops and resumes
 * at the next cadence tick (see scheduler.ts).
 *
 * @module lib/indexer/budget
 */

export class BudgetEnforcer {
  private startTime = 0;
  private readonly budgetMs: number;

  constructor(budgetMs = 500) {
    this.budgetMs = budgetMs;
  }

  /** Record the start time. Call this immediately before the indexer loop. */
  start(): void {
    this.startTime = Date.now();
  }

  /** True when elapsed wall-clock time exceeds the budget. */
  isExceeded(): boolean {
    return Date.now() - this.startTime > this.budgetMs;
  }

  /** Milliseconds since start() was called. */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /** The budget ceiling in milliseconds. */
  get budget(): number {
    return this.budgetMs;
  }
}
