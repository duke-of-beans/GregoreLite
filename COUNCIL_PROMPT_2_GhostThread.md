# COUNCIL SESSION 2: GHOST THREAD FULL ARCHITECTURE
**Gregore Lite Architectural Council — Round 1**  
*February 28, 2026*

---

## WHAT YOU ARE DOING

You are a member of the Gregore Lite Architectural Council. Gregore Lite is a purpose-built Tauri + Next.js 16 + React 19 + TypeScript desktop application that serves as David Kirsch's primary cognitive operating environment. It replaces Claude Desktop entirely, hits the Claude API directly, and integrates KERNL (persistent memory), SHIM (code quality analysis), AEGIS (resource management), Continuity (crash recovery), and Oktyv (browser automation) as native TypeScript modules.

The Ghost Thread is the most ambitious feature in the system. It is a silent, persistent background intelligence layer that has access to David's full digital environment — all drives, all email — and surfaces critical patterns at most twice a day. It does not respond to David. It does not have a conversational UI. It is an observer and it speaks only when something is worth interrupting for.

David has explicitly approved full access scope for the Ghost Thread. This is not a design constraint to debate — it is a product decision. The architectural question is how to build a system with this access scope that is performant, private, secure, and non-intrusive.

---

## LOCKED DECISIONS — DO NOT RE-ARGUE

- Ghost Thread has read access to all drives on David's system (full disk) and all email/inbox (Gmail, Outlook, or whatever providers David uses).
- Ghost Thread has a hard interrupt limit: maximum 2 proactive surfacings per day. These appear as cards in the context panel. Ghost never speaks in the strategic thread conversation.
- Ghost Thread uses a delta-based ingest model. It does not read everything every time it surfaces something. New content (files created/modified, new emails) flows through a pipeline: delta detection → chunking → embedding → vector index write.
- Ghost queries the vector index, not raw files.
- The Cross-Context Engine (Council Session 1) builds and maintains the indexes Ghost reads from. Ghost is a consumer of those indexes, not the owner.
- Ghost Thread is Phase 3 of the build order. However, Phase 1 schema decisions must accommodate it from day one — no migration pain when Phase 3 arrives.
- SMS and phone call access require a separate architecture design session. Out of scope for this Council.

---

## QUESTIONS FOR DELIBERATION

**Question 1: Delta-Based Ingest Pipeline — Exact Design**

New content must flow from source to vector index without Ghost having to re-read everything on each cycle. Design the complete pipeline:

For **filesystem**: What is the watcher mechanism in Tauri/Rust? How do you handle events for large file writes (writes that arrive as many small events)? What file types does Ghost index and what does it exclude? What is the chunk size strategy for different content types (code files vs. documents vs. plain text vs. PDFs)? How do you handle binary files or file types that cannot be meaningfully embedded?

For **email**: IMAP or OAuth? How do you handle Gmail vs. Outlook vs. other providers — is this a pluggable connector architecture or do you support only specific providers in Phase 3? What is the polling strategy (long poll vs. webhook vs. interval)? How do you handle email threads vs. individual messages — what is the unit of indexing?

For **chunking**: What is your chunk size and overlap strategy? Justify it for semantic coherence at retrieval time.

For **embedding pipeline**: Is this the same embedding model as the Cross-Context Engine uses (answer will depend on Council Session 1 outcome) or does Ghost use a different model? How is the embedding pipeline rate-limited to not consume AEGIS budget?

Design this pipeline with enough specificity that it can be built as a workstream.

**Question 2: Privacy Model — What Never Gets Indexed**

Ghost has access to everything. That means it will encounter passwords, financial credentials, medical records, private personal communications, and legally sensitive content. What is the exclusion policy?

Design the content filter that runs before any chunk is embedded and written to the index. What categories are excluded by rule (never indexed regardless of context)? What categories are excluded by pattern (detected by regex or classifier before embedding)? Is there a user-configurable exclusion list, and if so, what is its data model?

Be specific about edge cases: What happens to email from a therapist or doctor? What happens to a file in a directory named "private" or "personal"? What happens to `.env` files or files with the word "password" in the name? Does Ghost index encrypted files?

Also address: What is the data residency model? All embeddings and chunks are stored locally in KERNL's SQLite. How is that database encrypted at rest? KERNL's current implementation uses AES-256 SQLite encryption — confirm this carries forward unchanged or specify what changes.

**Question 3: Interrupt Threshold Engine — Precise Design**

The 2-per-day interrupt limit is declared. What is not declared is how Ghost decides that something is worth an interrupt.

The naive approach (fire whenever similarity exceeds a threshold) will produce noise. The right approach produces 2 high-quality interrupts per day that David actually acts on. Design the interrupt decision logic:

What signals feed the decision? (Recency of the matched content? Confidence of the similarity match? Whether the matched content was previously acted on or dismissed? Whether the matched content involves a project currently active in the strategic thread?)

How do you rank candidate interrupts when multiple patterns are detected in the same day? If Ghost identifies 8 potentially interrupt-worthy patterns in a 24-hour window, how does it decide which 2 to surface?

What is the data model for tracking interrupt history — what Ghost has surfaced before, what David did with it (acted, dismissed, ignored), and how that history affects future threshold calibration?

Is the 2-per-day limit a hard cap or a target that can be overridden by severity? If a Ghost detection is genuinely critical (e.g., Ghost identifies that David is about to rebuild a system he deleted 3 months ago), does it bypass the daily limit?

**Question 4: Ghost's Identity — Process Architecture**

Is Ghost Thread a persistent background Claude Agent SDK session? A scheduled batch job? A process that wakes on filesystem events? Something else?

Specifically resolve: Is Ghost the same as the pattern detection background thread from the Cross-Context Engine, or are these two distinct processes with different lifecycles? If distinct, justify the separation. If unified, describe how the unified process serves both roles without conflating their concerns.

What is Ghost's prompt architecture? Ghost must maintain a persistent mental model of David's full context — projects, decisions, patterns, current focus — without a conversational UI to update it through. How does Ghost's system prompt get constructed and refreshed? Does Ghost run a single long-lived Claude session, or does it spawn discrete analysis sessions with fresh context each time?

What happens to Ghost when Gregore Lite closes? Does it continue running as a background process? Does it shut down and reconstruct state on next launch from KERNL? Can it run headlessly without Gregore Lite open at all?

**Question 5: Email/Inbox Integration — Connector Architecture**

Ghost needs to read David's email. Email providers have different APIs, authentication models, and data formats.

Recommend: IMAP with direct connection, or OAuth with provider-specific REST APIs (Gmail API, Microsoft Graph)? Each has tradeoffs on complexity, reliability, and scope of access. Make a recommendation that covers David's actual likely setup (Gmail primary) but does not create a brittle architecture that breaks when providers change their APIs.

Design the authentication model: Where are credentials stored? (KERNL's encrypted vault, OS keychain, separate secrets store?) How is re-authentication handled when OAuth tokens expire?

Design the data model for ingested email: What fields are stored? (Sender, subject, date, body text, thread ID, attachment metadata?) Are attachments indexed? If so, which file types and up to what size?

**Question 6: Security — The Attack Surface**

Ghost has access to full disk and all email. If the KERNL database is compromised, an attacker has embeddings and chunks of David's most sensitive content. If Ghost's ingest pipeline is compromised, an attacker could exfiltrate real-time content.

Design the security model:
- Encryption at rest for all Ghost-ingested content in KERNL (chunks, embeddings, metadata)
- Process isolation — what OS-level protections prevent other processes from reading Ghost's memory?
- What is the threat model? (Local attacker with user access? Remote attacker via compromised dependency? Compromised Anthropic API endpoint receiving data it shouldn't?)
- Are there any network calls Ghost makes other than to the Claude API and email providers? If so, what are they and why?
- Is there an audit log of what Ghost has indexed? Can David inspect and delete specific indexed content?

**Question 7: Phase 1 Schema Requirements**

Ghost is Phase 3. But the schema must be ready from Phase 1 with no migration pain. What tables, columns, and indexes must exist in the Phase 1 SQLite schema to support Ghost Thread when it arrives?

Provide the exact SQL `CREATE TABLE` statements for any Ghost-specific tables that must exist from day one. Identify which existing tables (from the Cross-Context Engine and core session schema) Ghost will write to vs. which are Ghost-exclusive.

---

## WHAT YOUR RESPONSE MUST INCLUDE

For each of the seven questions above, provide:
1. A concrete recommendation or decision
2. The rationale
3. The failure mode if you are wrong
4. A spec or schema precise enough for implementation

Do not produce bullet point summaries. Write in full architectural prose. This response feeds directly into the final blueprint.

---

## COUNCIL OPERATING PRINCIPLES

- Option B Perfection — design it right or identify what information is missing to design it right.
- LEAN-OUT — before proposing custom infrastructure, verify existing libraries solve this. Filesystem watchers, email connectors, and chunking libraries exist. Use them.
- Zero technical debt — Ghost's ingest pipeline touches production data from day one. There is no "we'll harden it later."
- ZERO ASSUMPTIONS — do not declare that Ghost "will" detect something with a threshold you have not derived from first principles. Flag empirical unknowns explicitly.
- Privacy is non-negotiable — the exclusion policy must be conservative by default. Err toward not indexing.

---

*Gregore Lite Architectural Council — Ghost Thread Full Architecture*  
*Session 2 of 3*
