/**
 * Voice Templates — Sprint 17.0
 *
 * Centralized copy for all system-facing text in GregLite.
 * Every component that needs user-facing strings imports from here.
 * No hardcoded strings in components — all copy lives here.
 *
 * Voice: Deadpan professional. Data-forward. Sardonic edge in empty states.
 * No exclamation marks. No "I'm sorry." No emoji in system messages.
 * Lead with numbers. See GREGORE_AUDIT.md §1 for full voice guide.
 *
 * Source: GREGORE_AUDIT.md §1, SPRINT_17_0_BRIEF.md Task 1
 */

// ── What's This? guide content ────────────────────────────────────────────────
// Accessed via the ? button in the Header. Plain-language panel glossary.
// No jargon. Passes the Grandma Test.

export const GUIDE_ITEMS = [
  { label: 'Strategic', description: 'Your main conversation thread with Greg' },
  { label: 'Workers', description: 'Automated background tasks — code generation, testing, research' },
  { label: 'Task Board', description: 'Visual status of all running and queued worker tasks' },
  { label: 'Conversation Map', description: 'Visual timeline of your conversation\'s key moments' },
  { label: 'Background Assistant', description: 'Watches your files and email for relevant context' },
  { label: 'System Monitor', description: 'Tracks CPU/memory to manage workload intensity' },
  { label: 'Review Prompts', description: 'Greg pauses to double-check before risky actions' },
  { label: 'Memory', description: 'Greg\'s persistent knowledge from past conversations' },
  { label: 'Code Quality', description: 'Automated code health scoring' },
  { label: 'Inspector', description: 'Detailed diagnostics panel — cost, quality, learning insights' },
] as const;

export const VOICE = {
  // ── Receipt footer ────────────────────────────────────────────────────────
  receipt: {
    collapsed: (model: string, cost: string, latency: string) =>
      `✓ ${cost} · ${latency} · ${model}`,
    expand: 'Details',
    collapse: 'Less',
    cached: 'cached',
    tokens: (input: number, output: number) =>
      `${input.toLocaleString()} in · ${output.toLocaleString()} out`,
    tokensTotal: (total: number) => `${total.toLocaleString()} tokens`,
    cacheHit: 'Cache: hit',
    cacheMiss: 'Cache: miss',
    model: (fullModel: string) => fullModel,
  },

  // ── Decision gate ─────────────────────────────────────────────────────────
  gate: {
    repeated_question: "You've circled back to this topic. Want a deeper look?",
    sacred_principle_risk: 'This looks like a shortcut. Proceed anyway?',
    irreversible_action: "This can't be undone. Confirm?",
    low_confidence: 'Confidence is low on this one. Want verification?',
    contradicts_prior: 'This contradicts a previous decision. Review?',
    high_tradeoff_count: 'Multiple trade-offs detected. Worth a pause.',
    multi_project_touch: 'This spans multiple projects. Tread carefully.',
    large_build_estimate: 'This is a large build. Break it down first?',
    append_only_violation: 'Audit log or journal table is append-only. Modification not allowed.',
    reversibility_missing: 'No reversibility mechanism in scope. Add undo before proceeding.',
    deep_work_interruption: 'Deep work in progress. This update can wait until a break.',
    dismiss: 'Proceed',
    address: 'Reconsider',
  },

  // ── Orchestration theater ─────────────────────────────────────────────────
  theater: {
    preferencePrompt: 'How much detail going forward?',
    preferenceOptions: {
      full: 'Full — always expanded',
      compact: 'Compact — collapsed, click to expand',
      minimal: 'Minimal — checkmark and cost only',
      hidden: 'Hidden — no receipts',
    },
  },

  // ── Status bar ────────────────────────────────────────────────────────────
  status: {
    system_idle: 'Idle',
    system_active: 'Active',
    memory_ready: 'Ready',
    memory_indexing: 'Indexing',
    memory_error: 'Error',
    // Background Assistant labels (replaces "Ghost Thread" in UI)
    background_active: 'Active',
    background_partial: 'Partial',
    background_paused: 'Paused',
    background_starting: 'Starting',
    background_off: 'Off',
  },

  // ── Background Assistant (replaces "Ghost" in all user-facing copy) ────────
  background: {
    label: 'BACKGROUND',
    tooltip_off: 'Background Assistant not running',
    tooltip_active: 'Monitoring filesystem and email for relevant context',
    tooltip_degraded: (failed: string) =>
      `Partial: ${failed || 'some components'} failed — email + scoring still active`,
    tooltip_paused: 'Paused due to high system load',
    tooltip_starting: 'Background Assistant starting up…',
    settings_label: 'Background Assistant',
    settings_description: 'Watches your files and email for context to surface in conversations',
  },

  // ── Tabs & navigation ─────────────────────────────────────────────────────
  tabs: {
    strategic_tooltip: 'Your main conversation thread with Greg',
    workers_tooltip: 'Automated background tasks — code generation, testing, research',
    workers_heading_tooltip: 'Background task runners for automated code, testing, and research jobs',
    taskboard_tooltip: 'Visual status of all running and queued worker tasks',
    map_tooltip: 'Visual timeline of your conversation\'s key moments',
  },

  // ── Safety / Decision Gate (replaces "Sacred Laws" / "Decision Gate" jargon) ─
  safety: {
    review_prompt_heading: 'Safety Check',
    review_prompt_description: 'Greg paused before this action. Review and decide.',
    guardrails_label: 'Safety Rules',
    guardrails_description: 'Boundaries Greg enforces to keep actions reversible and safe',
  },

  // ── Empty states (sardonic edge permitted here) ───────────────────────────
  empty: {
    war_room: 'Nothing running. Workers are on break.',
    jobs: 'No active jobs. Quiet shift.',
    insights: 'No insights yet. Run the pipeline to find patterns.',
    transit_no_data: 'No conversation data. Start talking.',
    search_no_results: 'Nothing matched. Try different terms.',
  },

  // ── Errors (direct, actionable) ───────────────────────────────────────────
  error: {
    api_key_invalid: 'API key rejected. Check Settings.',
    api_unreachable: "Can't reach the API. Network issue or key problem.",
    db_corrupted: 'Database integrity check failed. Recovery options available.',
    generic: (detail: string) => `Something broke: ${detail}`,
  },
} as const;

// ── Portfolio Dashboard — Sprint 24.0 ────────────────────────────────────────

export const PORTFOLIO = {
  // Empty state
  empty: {
    title: 'No projects here yet.',
    description: 'This is your command center. Every project you manage shows up here with its current status and what needs attention next.',
    addButton: 'Add Project',
  },

  // Health signal labels
  health: {
    green: (reason: string) => reason,
    amber: (reason: string) => reason,
    red: (reason: string) => reason,
    unknown: 'Not yet scanned',
  },

  // Project type labels
  typeLabels: {
    code: 'Code',
    research: 'Research',
    business: 'Business',
    creative: 'Creative',
    custom: 'Custom',
  } as const,

  // Status labels
  statusLabels: {
    active: 'Active',
    paused: 'Paused',
    archived: 'Archived',
  } as const,

  // Loading / error states
  loading: 'Loading projects…',
  error: (detail: string) => `Failed to load projects: ${detail}`,
  scanError: (detail: string) => `Scan failed: ${detail}`,
  refreshing: 'Scanning…',
  refreshButton: 'Refresh',

  // Detail panel
  detail: {
    startWorking: 'Start Working',
    close: 'Close',
    noStatus: 'No STATUS.md found.',
    noNextAction: 'No next action recorded.',
    noVersion: '—',
    noPhase: '—',
    noLastActivity: 'No activity recorded',
    path: 'Path',
    type: 'Type',
    version: 'Version',
    phase: 'Phase',
    lastActivity: 'Last Activity',
    health: 'Health',
    nextAction: 'Next',
    testsPassing: (passing: number, total: number) => `${passing}/${total} passing`,
    tscErrors: (n: number) => (n === 0 ? 'Clean' : `${n} error${n > 1 ? 's' : ''}`),
    statusExcerpt: 'Status',
  },

  // Relative time labels (used by formatRelativeTime)
  relativeTime: {
    justNow: 'just now',
    minutesAgo: (n: number) => `${n}m ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    daysAgo: (n: number) => `${n} days ago`,
    weeksAgo: (n: number) => `${n}w ago`,
    monthsAgo: (n: number) => `${n}mo ago`,
    never: 'never',
  },

  // Add project (simplified Sprint 24 path input)
  addProject: {
    placeholder: 'Paste project path (e.g. D:\\Projects\\MyProject)',
    registerButton: 'Register',
    registering: 'Registering…',
    successMessage: (name: string) => `${name} registered.`,
    errorMessage: (detail: string) => `Registration failed: ${detail}`,
  },

  // Skeleton / skeleton count
  skeletonCount: 6,
} as const;

// ── Relative time formatter ───────────────────────────────────────────────────

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return PORTFOLIO.relativeTime.never;
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return PORTFOLIO.relativeTime.never;
  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return PORTFOLIO.relativeTime.justNow;
  if (diffMin < 60) return PORTFOLIO.relativeTime.minutesAgo(diffMin);
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return PORTFOLIO.relativeTime.hoursAgo(diffHr);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return PORTFOLIO.relativeTime.daysAgo(diffDay);
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return PORTFOLIO.relativeTime.weeksAgo(diffWk);
  const diffMo = Math.floor(diffDay / 30);
  return PORTFOLIO.relativeTime.monthsAgo(diffMo);
}

// ── Formatters ────────────────────────────────────────────────────────────────

/** Format cost for receipt footer — 4 decimal places, always shows $ */
export function formatReceiptCost(costUsd: number | undefined): string {
  if (costUsd === undefined || costUsd <= 0) return '$0.0000';
  return `$${costUsd.toFixed(4)}`;
}

/** Format latency for receipt footer — ms or seconds */
export function formatReceiptLatency(latencyMs: number | undefined): string {
  if (latencyMs === undefined || latencyMs <= 0) return '—';
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`;
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

// ── Onboarding — Sprint 25.0 ──────────────────────────────────────────────────
// All conversational strings for the Add Existing Project flow.
// Voice: deadpan professional, data-forward, no exclamation marks, no "I'm sorry."

export const ONBOARDING = {
  // Scan summary
  scan: {
    summary: (folderName: string, totalFiles: number, dominantType: string, buildSystem: string) =>
      `I scanned ${folderName}. ${totalFiles.toLocaleString()} files. ${dominantType}.${buildSystem ? ` Build system: ${buildSystem}.` : ' No build system detected.'}`,
    scanning: (folderName: string) => `Scanning ${folderName}…`,
    scanComplete: 'Scan complete.',
    existingDna: 'This project already has a PROJECT_DNA.yaml. I can update it or leave it alone.',
    empty: 'The directory appears to be empty or inaccessible.',
  },

  // Core questions for unknown/custom types
  coreQuestions: {
    purpose:       'What is this project actually for?',
    inputs:        'What are the inputs you work with?',
    doneLooks:     'What does done look like for this?',
    constraints:   'What are the constraints or deadlines?',
    successSignal: 'How do you know if it\'s going well or badly?',
  },

  // High-confidence confirmation questions
  confirmQuestions: {
    codeConfirm:     (lang: string, fileCount: number, hasSuite: boolean) =>
      `I found a ${lang} project with ${fileCount} source files${hasSuite ? ' and a test suite' : ''}. Sound right?`,
    extraMetrics:    'Any specific metrics you want to track beyond the defaults?',
    nameConfirm:     (folderName: string) => `I\'ll use "${folderName}" as the project name. Change it?`,
  },

  // Medium-confidence clarifying questions
  researchQuestions: {
    question:    'What\'s the central research question?',
    methodology: 'What methodology or framework are you using?',
    outputs:     'What are the expected outputs — papers, reports, datasets?',
    timeline:    'Is there a deadline or submission target?',
  },
  businessQuestions: {
    deliverable: 'What\'s the primary deliverable?',
    client:      'Who\'s the client or audience?',
    milestones:  'What are the key milestones?',
    successKpi:  'What does success look like — revenue, deliverables shipped, something else?',
  },
  creativeQuestions: {
    medium:      'What medium — writing, visual, audio, video, mixed?',
    audience:    'Who\'s this for?',
    scope:       'What\'s the scope — one piece, a series, an ongoing practice?',
    completionSignal: 'How do you know when a piece is done?',
  },

  // Acknowledgments between questions
  ack: {
    got_it:   'Got it.',
    noted:    'Noted.',
    ok:       'OK.',
    makes_sense: 'Makes sense.',
    good:     'Good.',
  },

  // DNA preview
  dnaPreview: {
    intro:     'Here\'s what I\'d set up for this project:',
    approveBtn:   'Looks good',
    editBtn:      'Edit',
    startOver:    'Start over',
  },

  // Migration decision
  migration: {
    decisionPrompt: 'Do you want to manage this project in place, or create a clean copy with the standard structure?',
    inPlaceLabel:   'Manage in place',
    inPlaceDetail:  'I\'ll add PROJECT_DNA.yaml, STATUS.md, and a backlog file to the existing directory. No files will be moved.',
    copyLabel:      'Create a clean copy',
    copyDetail:     'I\'ll copy the project to a new location, add structure files, and archive the original with a timestamp suffix.',
    warningsIntro:  (count: number) => `Found ${count} issue${count > 1 ? 's' : ''} to review before copying:`,
    warningAbsPath: (count: number) => `${count} absolute path reference${count > 1 ? 's' : ''} in config files — may need updating after migration.`,
    warningSymlink: 'Symlinks detected — may break if targets are outside the directory.',
    warningLargeDir: (sizeGb: string) => `Directory is ${sizeGb} GB — copy will take a while.`,
    acknowledgeBtn: 'I understand, proceed',
    cancelBtn:      'Cancel',
  },

  // Archive safe deletion (ArchiveManager)
  archive: {
    status:           'Archived — awaiting verification',
    statusVerified:   'Archived — verified',
    markVerifiedBtn:  'Mark as verified',
    markVerifiedHelp: 'Confirm that the migrated copy works correctly before enabling deletion.',
    deleteBtn:        'Delete archive',
    deleteBtnDisabled:'Verify migration first',
    modalTitle:       (projectName: string) => `Delete archived version of ${projectName}`,
    modalBody:        (projectName: string, archivePath: string) =>
      `This will permanently delete the archived version of ${projectName} at ${archivePath}. This cannot be undone.`,
    modalResponsibility: 'It is your responsibility to verify the migration was successful before deleting.',
    typeToConfirm:    (projectName: string) => `Type "${projectName}" to confirm deletion`,
    typeToConfirmPlaceholder: (projectName: string) => `Type ${projectName}`,
    deleteConfirmBtn: 'Delete permanently',
    deleteConfirmBtnDisabled: 'Type the project name to enable',
    deleteSuccess:    'Archive deleted.',
    deleteError:      (detail: string) => `Deletion failed: ${detail}`,
  },

  // Completion
  completion: {
    success:      (projectName: string) => `${projectName} registered. You\'re all set.`,
    viewProject:  'View project',
    inPlaceDone:  (projectName: string) => `${projectName} is now managed in place. DNA and status files added.`,
    copyDone:     (projectName: string, newPath: string) => `${projectName} copied to ${newPath}. Original archived.`,
    error:        (detail: string) => `Registration failed: ${detail}`,
  },

  // Step labels
  steps: {
    path:      'Project path',
    scanning:  'Scanning',
    questions: 'Setup',
    migration: 'Migration',
    done:      'Done',
  },
} as const;

// ── Sprint 26.0: Scaffold copy ────────────────────────────────────────────────

export const SCAFFOLD = {
  // Create New flow prompts
  initialPrompt:  'What are you building?',
  inferredType:   (type: string, confidence: string) =>
    confidence === 'high'
      ? `Looks like a ${type} project.`
      : `This could be a ${type} project — confirming a few details.`,
  unknownType:    'Not sure what type this is. Answering a few questions will help.',

  // Type-specific question headers
  questionHeaders: {
    code:     'A few questions about the codebase:',
    research: 'A few questions about the research:',
    business: 'A few questions about the project:',
    creative: 'A few questions about the work:',
    custom:   'A few questions to set this up right:',
  } as const,

  // Scaffold preview descriptions per file type
  fileDescriptions: {
    'PROJECT_DNA.yaml':  'Project identity, type, and metrics',
    'STATUS.md':         'Build status and sprint tracking',
    'FEATURE_BACKLOG.md':'Feature backlog with priority tiers',
    'RESEARCH_LOG.md':   'Date-ordered research findings log',
    'METHODOLOGY.md':    'Research methodology and approach',
    'MILESTONES.md':     'Milestone tracker with dates and status',
    'TASK_LIST.md':      'Simple task list',
    'README.md':         'Project description and getting started',
  } as const,

  // Preview step
  previewHeader:  (fileCount: number) => `${fileCount} files will be created.`,
  previewConfirm: 'Create project',

  // Path selection
  pathPrompt:  'Where should this be created?',
  pathDefault: (dir: string) => `Default: ${dir}`,
  pathOverride:'Choose a different location',

  // Completion
  done:    (name: string) => `${name} created.`,
  viewBtn: 'View project',
  error:   (detail: string) => `Scaffold failed: ${detail}`,

  // Steps (button labels + step indicator labels)
  steps: {
    describe:    'Describe',
    questions:   'Setup',
    preview:     'Preview',
    location:    'Location',
    done:        'Done',
    // Button labels
    continue:    'Continue',
    analyzing:   'Analyzing\u2026',
    choosePath:  'Choose Location',
    create:      'Create Project',
    scaffolding: 'Setting up\u2026',
    viewProject: 'View Project',
    cancel:      'Cancel',
  } as const,

  // Step indicator labels (maps FlowStep keys)
  stepLabels: {
    describe:    'Describe your project',
    questions:   'A few details',
    preview:     'Files that will be created',
    path:        'Choose a location',
    scaffolding: 'Creating\u2026',
    complete:    'Done',
  } as const,

  // Named prompts used in component JSX
  title: 'New Project',
  prompts: {
    describe:            'What are you building?',
    describePlaceholder: "I\u2019m building a\u2026",
    pathPrompt:          'Where should this be created?',
    pathHint:            'The directory will be created if it does not exist.',
  } as const,

  // Type inference banner
  inference: {
    detected: (type: string, confidence: string) =>
      confidence === 'high'
        ? `Looks like a ${type} project.`
        : `This could be a ${type} project \u2014 confirming a few details.`,
  },

  // Scaffold preview step
  preview: {
    intro: (name: string, count: number) =>
      `${name} \u2014 ${count} file${count !== 1 ? 's' : ''} will be created.`,
  },

  // Completion step
  completion: {
    title:        (name: string) => `${name} created.`,
    filesCreated: (n: number)    => `${n} file${n !== 1 ? 's' : ''} created.`,
    hint:         'Your project is registered. Open the card to pick up where you left off.',
  },
} as const;

// ── Sprint 26.0: Attention queue copy ─────────────────────────────────────────

export const ATTENTION = {
  // Section header
  header: (count: number) =>
    count === 1 ? '1 project needs attention' : `${count} projects need attention`,
  allOnTrack: 'All projects on track.',

  // Staleness messages
  staleRed:   (name: string, days: number, next: string) =>
    `${name} hasn't been touched in ${days} days.${next}`,
  staleAmber: (name: string, days: number) =>
    `${name} — ${days} days since last activity.`,
  neverActive:(name: string) =>
    `${name} was registered but never started.`,

  // Blocker message
  blockers:   (name: string) =>
    `${name} has items marked blocked.`,

  // Test failure message
  testFailures:(name: string, count: number) =>
    `${name} — ${count} test${count > 1 ? 's' : ''} failing.`,

  // Deadline message
  deadlineApproaching: (name: string, daysLeft: number) =>
    daysLeft === 0
      ? `${name} has a deadline today.`
      : `${name} has a deadline in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,

  // High-velocity acknowledgment
  velocity: (name: string) => `${name} — on track. High activity.`,

  // Action suggestions
  actionPickUp:         'Pick up where you left off',
  actionReviewBlockers: 'Review blockers',
  actionRunTests:       'Run tests',
  actionReviewDeadline: 'Review deadline',
  actionKeepGoing:      'Keep going',

  // Mute — flat keys (legacy, kept for compatibility)
  muteTitle:       'Mute attention signals',
  mute30Days:      'Mute for 30 days',
  muteUntilResume: 'Mute until I resume',
  mutePermanent:   'Mute permanently',
  muteConfirm:     'Muted.',
  unmuteLabel:     'Unmute',

  // Mute — nested form used by AttentionQueue.tsx
  mute: {
    label: 'Mute',
    confirm: 'Muted.',
    options: {
      oneHour:   'Mute for 1 hour',
      fourHours: 'Mute for 4 hours',
      oneDay:    'Mute for 1 day',
      threeDays: 'Mute for 3 days',
      oneWeek:   'Mute for 1 week',
    } as const,
  } as const,

  // Dismiss — nested form used by AttentionQueue.tsx
  dismiss: {
    label: 'Dismiss',
  } as const,

  // Queue header — nested form used by AttentionQueue.tsx
  queue: {
    summary: (count: number, highCount: number) => {
      const base = count === 1
        ? '1 project needs attention'
        : `${count} projects need attention`;
      return highCount > 0 ? base : base;
    },
  },
} as const;

// ── Sprint 27.0: Recall (Ambient Memory) copy ─────────────────────────────────

export const RECALL = {
  // File revisit
  file_revisit_intensive:   (filename: string, month: string) =>
    `You worked on ${filename} pretty intensively last ${month}. Haven't touched it since.`,
  file_revisit_conversations:(filename: string, count: number, month: string) =>
    `This came up in ${count} conversations back in ${month}: ${filename}.`,
  file_revisit_forgotten:   (filename: string, days: number) =>
    `${filename}. ${days} days since you last opened it. Still relevant?`,

  // Conversation callback
  conversation_decision:    (topic: string, timeAgo: string) =>
    `You made a call on ${topic} ${timeAgo}. Worth checking how that played out?`,
  conversation_deep:        (project: string, title: string, date: string) =>
    `${project}: you worked through ${title} on ${date}. Still holding up?`,

  // Project milestone
  project_version:          (project: string, version: string, sprintCount: number) =>
    `${project} hit ${version}. That's ${sprintCount} sprints since you started.`,
  project_reactivated:      (project: string, days: number) =>
    `${project} is active again after ${days} days. Welcome back.`,

  // Pattern insight
  pattern_focus:            (project: string) =>
    `You've been on ${project} every day this week. That's not your usual rotation.`,
  pattern_topic:            (topic: string, count: number) =>
    `${count} of your last conversations circled back to ${topic}. Turning into a focus area?`,

  // Personal moment
  moment_anniversary:       (project: string, duration: string, sprintCount: number) =>
    `${project} turns ${duration} old today. ${sprintCount} sprints shipped.`,
  moment_first:             (description: string) =>
    `First time: ${description}.`,

  // Actions
  action_appreciated: 'Noted.',
  action_dismissed:   'Gone.',
  action_snoozed:     'Will circle back tomorrow.',

  // Settings
  settings_title:             'Memory Highlights',
  settings_description:       'Greg surfaces things worth remembering — old files, past decisions, project milestones. Adjust how often and what types.',
  settings_frequency_label:   'How often Greg looks for things to surface',
  settings_max_per_day_label: 'Maximum highlights per day',
  settings_type_toggles_label:'What Greg looks for',

  // Inspector / diagnostics
  inspector_tab:    'Memory',
  inspector_last_run: (time: string) => `Last detection run: ${time}`,
  inspector_no_events: 'No recall events yet.',

  // Auto-calibration messages (shown in settings)
  calibration_reducing:   "Dialing it back. You've been dismissing most highlights — I'll surface fewer.",
  calibration_increasing: "You seem to like these. Want me to surface more?",

  // Empty state (section is invisible when no active recall — but used in Inspector)
  no_active: 'Nothing to surface right now.',
} as const;

// ── Sprint 28.0: Synthesis ceremony copy ─────────────────────────────────────
// Voice: Greg at his most thoughtful. Still deadpan professional — no exclamation
// marks, no "Wow!" — but genuinely insightful and respectful of the magnitude
// of what the user is sharing. Tone: "I see you clearly now. Here's what I notice."
// Reference: GREGORE_AUDIT.md §1

export const SYNTHESIS = {
  // ── Source selection cards ────────────────────────────────────────────────
  source_local_files_title: 'Local Files',
  source_local_files_desc:  'Your documents, code, research, and creative work.',
  source_projects_title:    'Projects',
  source_projects_desc:     'Registered projects with their status and backlogs.',
  source_email_title:       'Email',
  source_email_desc:        'Conversations, attachments, and professional context.',
  source_calendar_title:    'Calendar',
  source_calendar_desc:     'Schedule, meetings, and time commitments.',
  source_conversations_title: 'Conversations',
  source_conversations_desc:  'Past sessions — decisions, context, patterns.',
  source_notes_title:       'Notes',
  source_notes_desc:        'Your knowledge base and working notes.',
  source_custom_title:      'Custom Source',
  source_custom_desc:       'Any other data source you want Greg to know about.',

  // ── Indexing progress ─────────────────────────────────────────────────────
  indexing_scanning:  (count: number) => `${count.toLocaleString()} items scanned\u2026`,
  indexing_preview:   (finding: string) => `Found: ${finding}`,
  indexing_complete:  (count: number, type: string) => `${count.toLocaleString()} ${type} indexed.`,
  indexing_heading:   (label: string) => `Indexing ${label}\u2026`,

  // ── Per-source synthesis ──────────────────────────────────────────────────
  synthesis_heading:           'What I found',
  combination_intro:           'Now that I can see both\u2026',
  capabilities_heading:        'What this unlocks',
  capability_unlocked:         (capability: string) => capability,

  // ── Skipped source notices ────────────────────────────────────────────────
  skipped_gentle: (sourceLabel: string, capability: string) =>
    `${sourceLabel} isn\u2019t connected yet. When you\u2019re ready, I\u2019ll be able to ${capability}.`,
  add_later:      'Add later',

  // ── Flow navigation ───────────────────────────────────────────────────────
  add_another_source: 'Add another source',
  done_for_now:       'Done for now',
  add_source_button:  'Add source',
  skip_source:        'Skip for now',
  back:               'Back',

  // ── Master synthesis ceremony ─────────────────────────────────────────────
  master_opening:              'I see you now.',
  master_patterns_header:      'Patterns',
  master_insights_header:      'Things you might not have noticed',
  master_blindspots_header:    'What I can\u2019t see yet',
  master_capabilities_header:  'What I can do for you now',
  master_dismiss:              'Let\u2019s get to work.',
  master_generating:           'Synthesising\u2026',
  master_error:                'Synthesis failed. Check your API key and try again.',
  master_retry:                'Try again',

  // ── Re-engagement nudges ──────────────────────────────────────────────────
  nudge_source: (sourceLabel: string, capability: string) =>
    `Connecting ${sourceLabel} would let me ${capability}. Your call.`,
  nudge_contextual: (sourceLabel: string, capability: string) =>
    `If ${sourceLabel} were connected, ${capability}.`,
  nudge_dismiss: 'Got it',

  // ── Step labels (progress indicator in SourceAdditionFlow) ───────────────
  step_select:    'Select',
  step_configure: 'Configure',
  step_indexing:  'Indexing',
  step_synthesis: 'Synthesis',
  step_combine:   'Combined view',

  // ── Category breakdown labels (shown during indexing progress) ───────────
  category_typescript_projects: (n: number) => `${n} TypeScript project${n !== 1 ? 's' : ''}`,
  category_research_docs:       (n: number) => `${n} research document${n !== 1 ? 's' : ''}`,
  category_business_plans:      (n: number) => `${n} business plan${n !== 1 ? 's' : ''}`,
  category_files:               (n: number) => `${n} file${n !== 1 ? 's' : ''}`,

  // ── Onboarding entry point ────────────────────────────────────────────────
  onboarding_intro:       'Before we begin, I need to see your world.',
  onboarding_subtitle:    'Add your data sources one at a time. Each one changes what I can do for you.',
  onboarding_first_source:'Start with your most important source.',
} as const;

// ── Sprint 31.0: Startup registration copy ───────────────────────────────────

export const STARTUP = {
  settings_title: 'Launch Behavior',
  settings_description:
    'GregLite starts minimized in the system tray. Your projects and capture pad are always one click away.',
  toggle_label: 'Launch GregLite when you start your computer',
  toast_registered: 'Registered. GregLite will launch on next boot.',
  toast_unregistered: "Removed. GregLite won\u2019t auto-launch.",
  toast_error: 'Couldn\u2019t update startup settings. Try running as administrator.',
  installer_checkbox: 'Launch GregLite when Windows starts',
} as const;

/** Shorten model name for receipt footer display */
export function formatReceiptModel(model: string | undefined): string {
  if (!model) return '—';
  // claude-sonnet-4-5-20250929 → sonnet-4
  return model
    .replace(/^claude-?/i, '')
    .replace(/-\d{8}$/, '')       // strip date suffix
    .replace(/-\d+$/, '')          // strip trailing version digit if still present
    .split('-')
    .slice(0, 2)
    .join('-');
}

// ── Sprint 29.0: Quick Capture Pad copy ──────────────────────────────────────
// Voice: deadpan professional. Efficient. No exclamation marks. No emoji.
// Greg captures — he doesn't celebrate.

export const CAPTURE = {
  // ── Pad ───────────────────────────────────────────────────────────────────
  pad: {
    placeholder: "Bug, feature, idea... prefix with project name",
    project_unrouted: 'Unrouted',
  },

  // ── Toasts ────────────────────────────────────────────────────────────────
  toast: {
    captured:  'Captured.',
    merged:    (count: number) => `Merged. That's ${count}x now.`,
    routed:    (project: string) => `\u2192 ${project}`,
    unrouted:  "Captured. No project matched \u2014 check your inbox.",
  },

  // ── Inbox ─────────────────────────────────────────────────────────────────
  inbox: {
    title:          'Capture Inbox',
    empty:          'Inbox clear. Nothing pending.',
    promote:        'Promote to backlog',
    dismiss:        'Dismiss',
    reroute:        'Re-route',
    promote_all:    (project: string) => `Promote all for ${project}`,
    mention_count:  (count: number) => `${count}x`,
    high_priority:  'Mentioned 3+ times',
    unrouted_group: 'Unrouted',
  },

  // ── Classification badges ─────────────────────────────────────────────────
  classification: {
    bug:      'Bug',
    feature:  'Feature',
    question: 'Question',
    idea:     'Idea',
  } as const,

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    title:                  'Quick Capture',
    description:            'Global hotkey notepad that routes thoughts to the right project backlog.',
    hotkey_label:           'Capture shortcut',
    hotkey_value:           'Ctrl+Shift+Space',
    dedup_label:            'Smart merge (detects duplicate notes)',
    default_project_label:  'Default project for unrouted notes',
    default_project_none:   'None \u2014 keep unrouted',
    inbox_badge_label:      'Show inbox count on Portfolio tab',
  },

  // ── Command palette entry ─────────────────────────────────────────────────
  palette: {
    open_inbox:      'Capture Inbox',
    open_inbox_desc: 'Review and promote captured notes',
  },
} as const;

// ── Sprint 30.0: Navigation + UX copy ────────────────────────────────────────
// Tooltips and labels for header buttons, status bar, morning briefing.
// Voice: deadpan professional. No exclamation marks.

export const NAV = {
  projects_button_label:   'Projects',
  projects_button_tooltip: 'Projects (Cmd+P)',
  capture_button_tooltip:  'Quick Capture (Ctrl+Shift+Space)',
  statusbar_collapse:      'Collapse status bar',
  statusbar_expand:        'Expand status bar',
  briefing_dismiss:        'Dismiss briefing',
  briefing_skip_today:     "Don\u2019t show again today",
  portfolio_overlay_title: 'Projects',
  portfolio_overlay_close: 'Close projects (Cmd+P)',
} as const;

// ── Sprint 32.0: Web Session (headless browser routing) ───────────────────
export const WEB_SESSION = {

  // ── Settings panel ────────────────────────────────────────────────────────
  settings_title:       'Message Routing',
  settings_description: "Route messages through Claude's web interface instead of the API — zero token cost during development and dogfooding.",

  // ── Mode options ──────────────────────────────────────────────────────────
  mode_api:       'API Only',
  mode_api_desc:  'Always use the Anthropic API. Requires a valid API key.',
  mode_web:       'Web Session',
  mode_web_desc:  'Route all messages through the web interface. Requires an active web session.',
  mode_auto:      'Auto',
  mode_auto_desc: 'Try web session first; fall back to API automatically if unavailable.',

  // ── Session status ────────────────────────────────────────────────────────
  status_active:        (expiresIn: string) => `Active (expires ~${expiresIn})`,
  status_expired:       'Expired — reconnect to continue using web routing.',
  status_disconnected:  'Not connected.',

  // ── Connect / Disconnect ──────────────────────────────────────────────────
  connect_button:     'Connect to Claude',
  disconnect_button:  'Disconnect',

  // ── Governor ──────────────────────────────────────────────────────────────
  governor_title:       'Usage Governor',
  governor_description: 'Enforced limits prevent rate-limiting by claude.ai. These cannot be disabled.',
  governor_warning:     'Adjusting limits below defaults may result in your session being throttled or blocked.',
  governor_stats:       (today: number, max: number) => `${today} / ${max} messages today`,

  // ── Receipt footer ────────────────────────────────────────────────────────
  receipt_web:              'web',
  receipt_routed_via_web:   'Routed via: Web Session',
  receipt_routed_via_api:   'Routed via: API',

  // ── Fallback toast ────────────────────────────────────────────────────────
  fallback_toast: (reason: string) => `Web session unavailable (${reason}). Falling back to API.`,

} as const;