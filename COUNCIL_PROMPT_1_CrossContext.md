# COUNCIL SESSION 1: CROSS-CONTEXT ENGINE
**Gregore Lite Architectural Council — Round 1**  
*February 28, 2026*

---

## WHAT YOU ARE DOING

You are a member of the Gregore Lite Architectural Council. Gregore Lite is a purpose-built Tauri + Next.js 16 + React 19 + TypeScript desktop application that serves as David Kirsch's primary cognitive operating environment. It replaces Claude Desktop entirely, hits the Claude API directly, and integrates KERNL (persistent memory), SHIM (code quality analysis), AEGIS (resource management), Continuity (crash recovery), and Oktyv (browser automation) as native TypeScript modules — direct imports, no MCP overhead.

The Cross-Context Engine is the feature that makes Gregore Lite fundamentally different from any existing AI desktop client. It is what prevents David from re-solving problems he has already solved, re-building components he has already built, and repeating architectural mistakes he has already made. If this feature is underbuilt, Gregore Lite becomes a prettier Claude Desktop. If built correctly, it becomes a cognitive multiplier. This is the soul of the system. Treat it accordingly.

---

## LOCKED DECISIONS — DO NOT RE-ARGUE

The Council has already reached convergence on the following. These are not proposals.

- The engine maintains three parallel indexes in KERNL's SQLite: **full-text search (FTS5)** on all message content, **vector embeddings** for semantic similarity, and a **pattern registry** of extracted recurring patterns.
- A background thread runs continuously (target: every 30 minutes) to scan new messages and update the pattern registry. This thread never blocks the strategic thread.
- Proactive suggestions surface in the context panel as non-interrupting, dismissable banners. Maximum 2 Ghost-class interrupts per day (Ghost Thread, which is a separate Phase 3 feature).
- The **"you already built this" check** is a gate in the manifest generation flow — it fires before a Cowork manifest is finalized and confirmed, not as a suggestion after. David can override the gate with one click.
- All processing runs at background priority. The strategic thread is never blocked by the engine.
- Ghost Thread is a distinct Phase 3 feature with its own Council. It feeds from the same indexes this engine builds, but its architecture is designed separately.

---

## QUESTIONS FOR DELIBERATION

These are the open architectural questions. Every Council member must address all of them. Make decisions — do not defer.

**Question 1: Embedding Model Selection**

What embedding model do you recommend for Gregore Lite? The options on the table are:
- `all-MiniLM-L6-v2` via `transformers.js` — local, 384-dim, no network dependency, runs in-process
- A hosted embedding API (Voyage, OpenAI `text-embedding-3-small`, Cohere) — higher quality, requires network, introduces latency and cost
- A different local model entirely — specify what and why

Your decision must account for: offline operation (David frequently works without guaranteed internet), cold start performance (the total bootstrap target is under 60 seconds — how much of that budget does embedding initialization consume?), privacy (all content is sensitive: business financials, client data, personal decisions), and long-term scale (years of conversation history, potentially 1M+ message chunks). Make a recommendation. Name the failure mode if you are wrong.

**Question 2: Vector Index Strategy at Scale**

KERNL uses SQLite as its foundation. What is the right vector index implementation for Gregore Lite's scale and query patterns?

Evaluate: `sqlite-vec` (the successor to `sqlite-vss`, native SQLite extension), FAISS with SQLite for metadata, a dedicated vector database (Chroma, LanceDB) running as a local process, or building directly on SQLite's blob storage with cosine similarity computed in TypeScript.

The requirements: sub-200ms query response for real-time "on user input" detection (debounced 2s), support for 1M+ embeddings without performance collapse, compatibility with Tauri's Rust/TS boundary, and zero dependency on external services. Make a recommendation. Include your proposed schema or interface.

**Question 3: Threshold Calibration Before Empirical Data**

The Council has proposed these similarity thresholds without empirical basis:
- `> 0.80` for pattern detection ("you've approached this type of problem before")
- `> 0.85` for on-input suggestions ("you asked something like this in March")
- `> 0.70` for the "you already built this" artifact gate

What are the risks of getting these wrong in each direction (too sensitive vs. too permissive)? What is your recommended starting set of thresholds, and what is the feedback mechanism that allows the system to self-calibrate from David's actual ignore/accept behavior? Be specific — describe the data structure you would use to track and update thresholds over time.

**Question 4: The "You Already Built This" Gate — Exact Behavior**

When the artifact index detects >70% functional similarity between a new Cowork manifest objective and an existing implementation, what happens exactly?

Design the complete interaction: What does David see? What are his options? Is it a hard block on manifest generation, or a required-acknowledgment suggestion? What happens if he overrides it — is that logged, and does it affect future threshold calibration? What happens if he accepts the suggestion — does the engine pull the existing code into the strategic thread? Design this flow precisely enough that a frontend developer can implement it from your spec.

**Question 5: Background Thread Cadence and Compute Budget**

The background thread runs pattern detection and index updates. What is the right cadence, and how do you prevent it from becoming a resource burden that AEGIS would penalize?

Specifically: How do you decide what to index in each run (all new messages since last run? only messages above a length threshold? only messages from the strategic thread?)? What is the maximum CPU time this thread is allowed to consume per run before it yields? How does it interact with AEGIS signals — does it pause during BUILD_SPRINT or COUNCIL profiles? What triggers an out-of-schedule run beyond the regular cadence (e.g., immediately after a session end)?

**Question 6: Cold Start — Warming the Index**

The system targets a <60 second cold start. The vector index must be warm enough to answer similarity queries within seconds of launch. How do you solve this?

Options: pre-compute and cache the most recently accessed embedding clusters at shutdown, load only the last-N-day window at startup and expand asynchronously, maintain a separate "hot tier" of frequently queried embeddings in memory, or another approach. The answer must not violate the <60s target and must not block the strategic thread from becoming interactive.

**Question 7: Proactive Surfacing — When Does It Become Noise?**

The system surfaces suggestions when similarity thresholds are exceeded. In a high-velocity operator environment, how do you prevent suggestion fatigue from making David tune out the entire system?

Design the suppression and ranking logic: If David has dismissed the same suggestion type 3 times in a row, what happens? How do you distinguish a high-value interrupt (this exact component exists and is production-ready) from a low-value one (a vaguely similar conversation from 18 months ago)? What is the maximum number of suggestions that can appear simultaneously in the context panel? Design the ranking and suppression rules precisely.

---

## WHAT YOUR RESPONSE MUST INCLUDE

For each of the seven questions above, provide:
1. A concrete recommendation or decision — not a list of options
2. The rationale — why this over the alternatives
3. The failure mode — what goes wrong if you're wrong
4. A sketch (pseudocode, schema, or prose spec) precise enough for implementation

Do not produce bullet point summaries. Write in full architectural prose. Your response feeds directly into the final blueprint; it will be synthesized by Claude and handed to execution sessions.

---

## COUNCIL OPERATING PRINCIPLES

- Option B Perfection — no MVP thinking. Design it right or identify why the right design needs more information.
- LEAN-OUT — before proposing custom infrastructure, verify no existing tool or library solves this adequately.
- Zero technical debt — no temporary solutions. If you propose a threshold or heuristic, specify how it evolves.
- Foundation out — address the data model and index architecture before the UI surface.
- ZERO ASSUMPTIONS — thresholds, cadences, and calibration numbers must be reasoned from first principles or flagged as empirically uncertain. Do not state a number as if it were validated when it is not.

---

*Gregore Lite Architectural Council — Cross-Context Engine*  
*Session 1 of 3*
