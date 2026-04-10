# Meridian — Foundation Document

> **Product:** Meridian — Enterprise R&D Intelligence
> **Status:** v0 foundation doc — design-partner phase
> **Lineage:** Reuses ~70% of the Veritas codebase (multi-agent fact-checker)
> **Author / source:** Discovery session, 2026-04-10
> **Confidence:** Many decisions are still open — this doc captures what *is* decided, what is *assumed*, and what is still *open*.

---

## 1. One-paragraph pitch

An AI research analyst that connects a company's internal R&D corpus to the outside world — papers, patents, standards, regulatory filings, and the open web — and tells researchers, strategy analysts, and IP teams **what corroborates their work, what contradicts it, what might scoop it, and where the white space is**. Built on a hierarchical multi-agent architecture (Director → Manager → Interns) with a cross-corpus knowledge graph that surfaces relationships and contradictions across thousands of sources, returning confidence-scored landscapes with full citation trails — not hard verdicts.

---

## 2. The wedge

The temptation with a horizontal R&D platform is to be everything to everyone: literature review, hypothesis generation, prior art, competitive scans, internal knowledge mining, all five personas, all input modes, all output formats. That is the v3 vision and it is captured in §10. **It is not v1.**

For the design-partner demo, v1 narrows to one structural workflow that serves two high-value jobs:

> **Take an internal artifact → scan the external world → return a confidence-scored landscape of relationships (corroboration, contradiction, prior art, white space) with citations.**

The two jobs that share this shape:

1. **Competitive / technology landscape scan** (strategy analyst persona). Input: a strategy brief or technology area. Output: a structured landscape of who is doing what, where the consensus is, where the disagreements are, and where the gaps are.
2. **Prior-art search before filing** (IP / patent persona). Input: an invention disclosure or claim draft. Output: a ranked list of potentially conflicting prior art across patents and literature, with confidence scores and the specific passages that conflict.

These two workflows let us reuse the *same* pipeline (decompose → gather → cross-corpus KG → confidence scoring → multi-format report) with only the prompts and the output renderer differing. That is the wedge: one pipeline, two demos, one defensible thesis.

The thesis itself — *the magic is connecting internal and external* — is what makes the product defensible. Pure external research is a crowded space (Elicit, Consensus, Undermind, Scite). Pure internal search is a crowded space (Glean, Guru, every enterprise search vendor). The cross-corpus relationship layer is the moat, and it is exactly what Veritas's contradiction-detection KG was built to do — it just needs to span two corpora instead of one.

---

## 3. Personas

| Persona | v1 priority | Why |
|---|---|---|
| Strategy / competitive intelligence analyst | **Primary** | Owns the landscape-scan workflow. Pays for tools. |
| IP / patent / technical due-diligence | **Primary** | Owns the prior-art workflow. Pays for tools. High willingness to pay. |
| Bench / research scientist | Secondary | Will use the literature-review mode but not the buyer in v1. |
| R&D manager / program lead | Phase 2 | Needs collaboration features we are deferring. |

The two primary personas are intentionally non-scientists. They are the ones with budget, the ones who do this work repeatedly, and the ones whose current workflows (manual reading, expensive consulting reports, paralegal patent search) are most obviously improvable.

---

## 4. Input modes

The user picks the mode at session start. The Director agent routes based on input type.

| Mode | What the user provides | Example |
|---|---|---|
| **Question** | A research question | "What's known about solid-state battery dendrite suppression?" |
| **Hypothesis** | An assertion to stress-test | "Lithium-metal anodes are unviable above 4mAh/cm²." |
| **Topic** | A technology area to scan | "Perovskite tandem solar cells, last 24 months." |
| **Brief** | A structured prompt with constraints and goals | A pasted strategy brief or invention disclosure |
| **Internal doc** | A Google Drive file as the seed | "Find prior art for this disclosure." |

The "internal doc as seed" mode is the one most closely tied to the wedge — it is the entry point for both killer workflows.

---

## 5. Output artifacts

The user picks one or more output formats. The same underlying findings render into different views.

1. **Written report with citations** (Veritas's current default). Long-form, narrative, suited for sharing.
2. **Structured landscape** — entities, relationships, gaps, timeline. The strategy analyst's primary view.
3. **Ranked findings list** — opportunities, risks, prior-art hits with evidence. The IP/patent primary view.
4. **Interactive knowledge graph** — explorable, with cross-corpus edges highlighted (internal node ↔ external node).
5. **Decision memo** — recommendation + confidence + rationale. Short-form, suited for executives.

Critically, **none of these artifacts include a hard verdict**. Veritas's TRUE/FALSE/MIXED scale is replaced by a softer **confidence + consensus** model:

- **Confidence** — how strong is the evidence for this finding (0–1, calibrated)
- **Consensus** — how much do the sources agree with each other (0–1, derived from KG corroboration scoring)
- **Source diversity** — how many independent sources contributed (count + Gini-style spread)

A finding with high confidence and low consensus is a *contested area* — often the most valuable signal in R&D work. Veritas's contradiction detection already produces this signal; we just expose it directly instead of collapsing it into a verdict label.

---

## 6. Data sources

### Internal (v1)

| Source | v1 | Notes |
|---|---|---|
| Google Drive | ✅ | OAuth connector, incremental sync, document chunking into the existing Chroma vector store. The only internal source for v1. |
| SharePoint / OneDrive | Phase 2 | |
| Confluence / Notion | Phase 2 | |
| ELN / LIMS | Domain-specific, deferred | |
| Internal patent DB | Phase 2 | |
| Slack / Teams / email | Phase 3 | Privacy-sensitive, low signal-to-noise |

### External (v1)

| Source | v1 | Notes |
|---|---|---|
| General web (Bright Data SERP) | ✅ | Reused from Veritas as-is |
| Scientific literature (Semantic Scholar, arXiv) | ✅ | Reused from Veritas as-is. PubMed to be added. |
| Patents (USPTO, EPO, Google Patents) | ✅ | **New.** Needs a real parser — claims structure, citation graphs, family trees. Not just SERP scraping. |
| Standards (IEEE, ISO, ASTM, NIST) | ✅ (best-effort) | **New.** Most are paywalled; v1 covers metadata + abstracts via web search; full-text is BYO-subscription phase 2. |
| Regulatory filings (FDA, EMA, SEC EDGAR) | ✅ | **New.** SEC EDGAR is free and well-documented. FDA/EMA have public APIs. |
| Conference proceedings & preprints | ✅ | Mostly covered by Semantic Scholar + arXiv already; ACM/IEEE need targeted scrapers. |
| Market / industry reports (Gartner, IDC) | ⚠️ Deferred | Licensed content, cannot be scraped. v1 supports BYO-PDF upload; native API integration is phase 2 with paid agreements. |
| Clinical trials (ClinicalTrials.gov) | ❌ Out | Not selected — confirms horizontal positioning, not life-sci-first. Trivial to add later. |

---

## 7. Architecture

### 7.1 Reused from Veritas (largely as-is)

The Veritas architecture transfers cleanly because the core abstraction — **a hierarchical agent system that decomposes a complex query, gathers evidence in parallel, builds a knowledge graph, and synthesizes a grounded answer** — is exactly what an R&D intelligence tool needs. The components reused without significant modification:

- **Three-tier agent hierarchy** (Director → Manager → Intern pool) with `asyncio.gather()` parallel execution
- **Hybrid retrieval** (BGE embeddings + ChromaDB + BM25 + Reciprocal Rank Fusion)
- **Incremental knowledge graph** (SQLite + NetworkX, NER + LLM relation extraction, credibility scoring)
- **Verification pipeline** (Chain-of-Verification + CRITIC + HHEM scoring, ConfidenceCalibrator)
- **Cost tracker** (per-model token usage, Opus/Sonnet/Haiku routing)
- **Pause / resume / crash recovery** (iteration checkpointing)
- **Real-time event system** (WebSocket broadcast, activity feed)
- **FastAPI backend + Next.js frontend shell** (sessions, checks, evidence, events routes; the Next.js App Router structure)
- **Storage layer** (`VeritasDatabase` with WAL mode and connection pool)
- **Hybrid memory system** (rolling window + summarization + persistent SQLite)

### 7.2 Reworked from Veritas

| Component | Change |
|---|---|
| **Verdict synthesis** (Manager) | Replace TRUE/FALSE/MIXED scale with confidence + consensus + source-diversity scoring. The CoVe/CRITIC pipeline still runs on individual findings; only the top-level synthesis changes. |
| **Manager prompts** | Decomposing a *claim* into sub-claims becomes decomposing a *research brief* into research sub-questions. Same structural operation, different prompt scaffolding. |
| **Intern tools** | Existing `web_search` and `academic_search` tools stay. Add `patent_search`, `standards_search`, `regulatory_search`, `gdrive_search`. The Intern abstraction does not need to change — only the tool registry grows. |
| **Knowledge graph** | Add a `corpus` attribute to every entity and relation (`internal` vs `external`). Add cross-corpus edges as a first-class relation type. The contradiction detection logic is unchanged; it just now flags internal-vs-external contradictions, which are the highest-value signal. |
| **Director agent** | Add a multi-mode intent router on the front end (question / hypothesis / topic / brief / internal-doc). Route to different Manager prompt templates accordingly. |
| **Report writer** | Currently produces one Markdown report. Becomes a multi-format renderer with five output templates (report, landscape, ranked findings, KG view, decision memo) sharing one underlying findings model. |
| **Frontend** | Dashboard, check detail, evidence browser, KG visualizer, activity feed all transfer. Verdict badge component is replaced with a confidence/consensus visualization. |

### 7.3 New components (built from scratch)

- **Google Drive connector** — OAuth flow, incremental sync (page tokens), file-type-aware extraction (Docs, PDFs, Slides), chunking, embedding into the existing Chroma store with `corpus=internal` metadata. This is the single biggest new build.
- **Patent ingestion + parser** — claims structure (independent vs dependent), citation graph (forward + backward), family tree (continuations, divisionals), CPC classification. USPTO and EPO have free bulk APIs; Google Patents has a usable search surface.
- **Standards / regulatory adapters** — thin wrappers over EDGAR, openFDA, EMA public endpoints, plus targeted scrapers for IEEE/ISO/ASTM metadata pages.
- **Cross-corpus relationship engine** — given a node in the internal corpus and a node in the external corpus, determine the relationship type (corroborates, contradicts, prior art for, scoops, cites, is cited by, claims overlap with). Runs as a Manager-level pass after evidence gathering. Reuses the existing KG storage.
- **Confidence + consensus scoring** — replaces the verdict synthesizer. Aggregates evidence weights from CoVe/CRITIC, KG corroboration scores, and source credibility into the new triple-score model.
- **Multi-format report renderer** — five output templates over a shared findings schema.
- **Shareable read-only links** — signed-URL session sharing for the lightweight collaboration model.
- **Multi-mode intent router** on the Director.

### 7.4 Retired from Veritas

- **AI content detector** (text and image)
- **Plagiarism checker**

These are consumer-facing utilities that don't fit an enterprise R&D positioning and would dilute the product story. They can stay in the codebase but should be hidden from the v1 UI.

---

## 8. The cross-corpus knowledge graph (the moat)

This deserves its own section because it is the most architecturally distinctive piece of the product.

Veritas's KG already extracts entities and relations from evidence and scores corroboration vs. contradiction across sources. The R&D tool extends this in one specific way: **every node and edge is tagged with a corpus origin (internal vs external)**, and a new pass after evidence gathering specifically searches for cross-corpus edges.

The kinds of cross-corpus edges that matter:

| Edge type | Why it matters |
|---|---|
| `internal_corroborates_external` | Our work agrees with the published literature — confidence boost |
| `internal_contradicts_external` | Our work disagrees with the published literature — investigate, this is often the most valuable finding |
| `external_predates_internal` (potential prior art) | Risk for IP filing; killer signal for the patent persona |
| `external_overlaps_with_internal_claim` | Patent claims-language overlap — the prior-art smoking gun |
| `external_cites_internal` | Someone outside cited our work (or our patents) |
| `external_white_space_near_internal` | We're in a region the literature hasn't covered — opportunity signal |

The strategy-analyst landscape view and the IP/patent prior-art view are both renderings of this same graph, filtered to different edge types. That is what makes one pipeline serve two demos.

---

## 9. Deployment, security, compliance

Per the discovery session, these are explicitly out of scope for the v1 foundation doc. The v1 design-partner phase assumes friendly users, low data sensitivity, and no compliance requirements. SOC 2, tenant isolation, BYO-LLM (Bedrock), SSO/SAML, and audit hardening are deliberate phase-2 deferrals — not oversights. They will be revisited before the first paying customer.

For v1 we can use the Anthropic API directly with default cloud-LLM routing, keep Veritas's SQLite + FastAPI + Next.js stack, and not invest in multi-tenancy.

---

## 10. Out of scope for v1 (the deferred ambition)

These are real and on the roadmap; they are not v1.

- All internal sources beyond Google Drive (SharePoint, Confluence, Notion, ELN, internal patent DB, Slack, email)
- All paid / licensed market reports (Gartner, IDC) as native integrations
- Team collaboration: workspaces, comments, @mentions, review/approval workflows
- The bench-scientist literature-review workflow as a primary persona surface
- The R&D manager / program lead persona
- Hypothesis generation as a generative workflow (vs the stress-testing mode we are keeping)
- Multi-tenancy, SSO/SAML, RBAC
- Compliance: SOC 2, ISO 27001, HIPAA, GxP, ITAR, GDPR data residency
- Self-hosted / VPC / on-prem deployment
- BYO-LLM (Bedrock, Azure OpenAI, self-hosted)

---

## 11. Open questions

These are decisions that were not made in the discovery session and need to be resolved before implementation:

1. **Pricing model.** Per-seat? Per-session? Per-document-ingested? Annual contract? This shapes the design partner conversation.
2. **Patent data licensing.** USPTO and EPO are free; Google Patents has terms; full-text PDF retrieval at scale may need a commercial agreement (e.g. PatSnap, Derwent). What's our v1 stance — free sources only, or one paid contract?
3. **The "internal doc as seed" UX.** Does the user pick a Drive file from a picker, paste a Drive link, or drop a file inline? This is the killer-workflow entry point — it deserves real design attention.
4. **Confidence calibration ground truth.** Veritas's `ConfidenceCalibrator` was tuned for fact-checking; for R&D landscapes we have no ground truth. How do we calibrate for v1 — heuristics, design-partner feedback, or accept it's uncalibrated?
5. **Cross-corpus relationship extraction quality.** The relationship engine is the moat but also the riskiest component. What's the v1 evaluation set? Without one we won't know if it works.
6. **Design partner profile.** Which 2–3 organizations do we target first? The persona answer says strategy + IP, but the right design partners are probably industry-specific (a deep-tech VC's portfolio company? a corporate R&D group? a boutique IP firm?). This affects which external sources to prioritize.
7. **Veritas → Meridian brand relationship.** Retire Veritas entirely, or keep it as the engine name ("Meridian, powered by the Veritas engine")? The latter has a nice technical-credibility story for design partners.
8. **The "all of the above" risk.** The discovery session selected all input modes, all output formats, and three personas. The wedge in §2 narrows this for v1, but the underlying tension remains: every additional mode/format/persona is real engineering. We need a forcing function — probably the design-partner contract — to keep v1 honest.

---

## 12. Suggested next steps

1. **Lock the wedge.** Get a design partner to confirm the §2 thesis is real for them — that they would pay for a tool that does exactly the strategy-analyst landscape scan or the pre-filing prior-art search, with the cross-corpus connection as the differentiator.
2. **Build the Google Drive connector first.** It is the longest-pole new component, the one with the most unknowns (auth, sync, permissions, file-type extraction), and the gating dependency for the wedge. Two-week spike.
3. **Build a patent ingest prototype next.** USPTO bulk API + a claims parser + storing patents as `corpus=external` nodes in the existing KG. Validate that the cross-corpus relationship engine produces useful edges on a small test set.
4. **Rip the verdict scale out of the Manager.** Replace with the confidence/consensus/diversity triple. This is a small code change with large product implications and should happen early so the rest of the system stops thinking in TRUE/FALSE.
5. **Hide the Veritas consumer tools** (AI detector, plagiarism) from the UI before showing anything to a design partner.
6. **Resolve the open questions in §11.** Especially the design-partner profile — almost every other open question is easier to answer once we know who we're building for first.

---

*This document is a v0 working spec, not a finished PRD. It captures the decisions made in the 2026-04-10 discovery session, the assumptions filling the gaps, and the questions still open. The next pass should resolve §11 and convert this into a milestone-bearing v1 plan.*
