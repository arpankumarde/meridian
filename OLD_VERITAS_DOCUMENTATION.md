# Meridian — Comprehensive Project Documentation

> **AI-powered hierarchical multi-agent fact-checking system powered by Claude.**
>
> Version: 0.1.0 | License: MIT | Python 3.10+ | Next.js 16 | Author: Karan Prasad

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Agent Hierarchy](#3-agent-hierarchy)
4. [Data Flow & Verification Pipeline](#4-data-flow--verification-pipeline)
5. [Python Engine (`engine/`)](#5-python-engine-engine)
   - 5.1 [Entry Point & CLI](#51-entry-point--cli)
   - 5.2 [Agent System](#52-agent-system)
   - 5.3 [Tools](#53-tools)
   - 5.4 [Knowledge Graph](#54-knowledge-graph)
   - 5.5 [Retrieval System](#55-retrieval-system)
   - 5.6 [Verification Pipeline](#56-verification-pipeline)
   - 5.7 [Storage & Database](#57-storage--database)
   - 5.8 [Event System](#58-event-system)
   - 5.9 [Interaction System](#59-interaction-system)
   - 5.10 [Reports](#510-reports)
   - 5.11 [Memory System](#511-memory-system)
   - 5.12 [Cost Tracking](#512-cost-tracking)
   - 5.13 [Audit & Decision Logging](#513-audit--decision-logging)
   - 5.14 [Logging Configuration](#514-logging-configuration)
6. [FastAPI Backend (`api/`)](#6-fastapi-backend-api)
   - 6.1 [Server Configuration](#61-server-configuration)
   - 6.2 [Middleware](#62-middleware)
   - 6.3 [API Routes](#63-api-routes)
   - 6.4 [WebSocket System](#64-websocket-system)
   - 6.5 [Database Layer (`api/db.py`)](#65-database-layer-apidbpy)
   - 6.6 [Event Emitter (`api/events.py`)](#66-event-emitter-apieventspy)
7. [Next.js Frontend (`src/`)](#7-nextjs-frontend-src)
   - 7.1 [App Router Pages](#71-app-router-pages)
   - 7.2 [Components](#72-components)
   - 7.3 [Libraries & Utilities](#73-libraries--utilities)
   - 7.4 [Styling & Design System](#74-styling--design-system)
8. [Data Models](#8-data-models)
9. [Configuration & Environment](#9-configuration--environment)
10. [Build System & Dependencies](#10-build-system--dependencies)
11. [Database Schema](#11-database-schema)
12. [Model Routing & LLM Usage](#12-model-routing--llm-usage)
13. [Output & Exports](#13-output--exports)
14. [Development Guide](#14-development-guide)
15. [API Reference](#15-api-reference)
16. [File Index](#16-file-index)

---

## 1. Project Overview

Meridian is a hierarchical multi-agent fact-checking system that decomposes claims into sub-claims, gathers evidence from the web and academic sources, builds a knowledge graph for contradiction detection, and synthesizes a final verdict using Claude models with extended thinking.

### Key Capabilities

- **Claim decomposition** — Complex claims are broken into atomic, independently verifiable sub-claims
- **Parallel evidence gathering** — Multiple intern agents search concurrently via `asyncio.gather()`
- **Multi-engine web search** — Google + Bing SERP via Bright Data, plus 25+ platform-specific extractors
- **Academic search** — Semantic Scholar (200M+ papers) and arXiv (2.4M+ preprints), free APIs
- **Real-time knowledge graph** — Entity/relation extraction with NER + LLM, stored in SQLite+NetworkX
- **Contradiction detection** — Knowledge graph corroboration scoring identifies conflicting evidence
- **Hybrid retrieval** — BGE embeddings + ChromaDB (semantic) combined with BM25 (lexical) via Reciprocal Rank Fusion
- **Verification pipeline** — Chain-of-Verification (CoVe) + CRITIC for hallucination reduction (50-70%)
- **Cost tracking** — Per-model token usage and cost estimates (Opus, Sonnet, Haiku)
- **Pause/resume/crash recovery** — Iteration checkpoint system with full state persistence
- **Real-time UI** — WebSocket-powered live updates during fact-checking
- **Interactive mode** — Pre-check clarification questions and mid-check user guidance injection
- **Standalone tools** — AI content detector (text + image), plagiarism checker

### Verdict Scale

| Verdict | Meaning |
|---------|---------|
| `TRUE` | Strong, consistent evidence supports the claim |
| `MOSTLY_TRUE` | Evidence largely supports with minor caveats |
| `MIXED` | Significant evidence both for and against |
| `MOSTLY_FALSE` | Evidence largely contradicts with minor true elements |
| `FALSE` | Strong, consistent evidence contradicts the claim |
| `UNVERIFIABLE` | Insufficient evidence to determine truth value |

---

## 2. Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 16 Frontend                      │
│        Landing ─ Dashboard ─ Check Detail ─ Tools            │
│                  (port 3004, App Router)                      │
└────────────┬────────────────────┬────────────────────────────┘
             │ HTTP REST          │ WebSocket (ws://localhost:9090)
             ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (api/)                     │
│         Sessions ─ Checks ─ Evidence ─ Events ─ Tools        │
│              (port 9090, CORS, auth, rate limiting)           │
└────────────┬────────────────────┬────────────────────────────┘
             │                    │
             ▼                    ▼
┌──────────────────┐   ┌──────────────────────────────────────┐
│   SQLite Database │   │        Python Engine (engine/)        │
│   (WAL mode,      │   │                                      │
│    connection pool)│   │  Director → Manager → Intern Pool    │
│                    │   │                                      │
│  meridian.db        │   │  Knowledge Graph ─ Retrieval         │
│  veritas_kg.db     │   │  Verification  ─ Reports             │
│  veritas_memory.db │   │  Events ─ Costs ─ Audit              │
└──────────────────┘   └──────────────────────────────────────┘
                                     │
                                     ▼
                       ┌──────────────────────────┐
                       │   External Services       │
                       │  ─ Bright Data (SERP +    │
                       │    scraping + platform)    │
                       │  ─ Semantic Scholar API    │
                       │  ─ arXiv API               │
                       │  ─ Claude API (Anthropic)  │
                       └──────────────────────────┘
```

### Three-Tier Agent Hierarchy

```
                    ┌─────────────┐
                    │  DIRECTOR   │  User-facing layer
                    │  (director) │  Session management, verdicts
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   MANAGER   │  Orchestration layer
                    │  (manager)  │  Claim decomposition, evidence evaluation
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ INTERN_0 │ │ INTERN_1 │ │ INTERN_2 │  Evidence gathering
        │ (intern) │ │ (intern) │ │ (intern) │  Web + academic search
        └──────────┘ └──────────┘ └──────────┘
```

---

## 3. Agent Hierarchy

### 3.1 Director Agent (`engine/agents/director.py`)

**Role:** User-facing interface layer.

**Class:** `DirectorAgent(BaseAgent)`

**Responsibilities:**
- Receive and interpret user claims
- Manage claim clarification via `UserInteraction`
- Create and manage `CheckSession` objects
- Start/pause/resume/stop verification sessions
- Display progress with Rich progress bars
- Present final verdicts with evidence tables
- Export results to `output/{slug}_{session_id}/`
- Track and display API cost summaries

**Key Methods:**
| Method | Description |
|--------|-------------|
| `start_verification(claim, max_iterations, ...)` | Main entry — creates session, runs verification, exports results |
| `clarify_claim(claim)` | Pre-verification clarification questions |
| `pause_verification()` | Graceful pause with state persistence |
| `export_results()` | Exports `report.md`, `evidence.json`, and KG data |
| `_display_report(report)` | Renders verdict, evidence table, stats |
| `_display_costs()` | Shows per-model API cost breakdown |

**System Prompt Focus:** Professional, neutral communication. Present evidence from all sides. Clearly distinguish verified facts from uncertain claims.

### 3.2 VeritasHarness (`engine/agents/director.py`)

**Role:** Primary entry point for running the system.

**Class:** `VeritasHarness` (async context manager)

**Usage:**
```python
async with VeritasHarness(db_path="meridian.db") as harness:
    report = await harness.verify("The Great Wall is visible from space")
```

**Lifecycle:**
1. `__aenter__`: Opens database, creates `DirectorAgent`
2. `verify()` / `check()`: Delegates to `DirectorAgent.start_verification()`
3. `__aexit__`: Cleans up manager resources, closes database

### 3.3 Manager Agent (`engine/agents/manager.py`)

**Role:** Orchestration layer — claim decomposition, evidence evaluation, verdict synthesis.

**Class:** `ManagerAgent(BaseAgent)`

**Responsibilities:**
- Decompose claims into sub-claims (`SubClaim` objects)
- Create `VerificationDirective` objects for interns
- Run the ReAct (Reason + Act) loop for N iterations
- Critically evaluate gathered evidence (supporting AND contradicting)
- Identify gaps, inconsistencies, and areas needing deeper investigation
- Query the knowledge graph for contradictions and research directions
- Synthesize final verdict using Opus model with extended thinking
- Manage parallel intern pool (`ParallelInternPool`)
- Process evidence into knowledge graph via `KGProcessor`
- Handle crash recovery with iteration checkpoints

**Model Usage:** Sonnet for speed during iteration; Opus used only for final verdict synthesis.

**Key Subsystems Managed:**
- `ParallelInternPool` — concurrent evidence gathering
- `IncrementalKnowledgeGraph` — real-time entity/relation extraction
- `HybridKnowledgeGraphStore` — SQLite+NetworkX persistence
- `ManagerQueryInterface` — KG querying for research directions
- `CredibilityScorer` — source credibility assessment
- `HybridMemory` — long-session memory management
- `KGProcessor` — evidence-to-KG processing pipeline

**ReAct Loop:**
```
for each iteration (1..max_iterations):
    1. Think: Analyze evidence state, gaps, contradictions
    2. Act:
       a. Create VerificationDirectives for interns
       b. Execute via ParallelInternPool.gather_evidence_parallel()
       c. Process evidence into KG
       d. OR synthesize report if sufficient evidence
    3. Observe: Assess results, update context
```

**Evidence Evaluation Framework:**
- **Accuracy** — Source credibility and verifiability
- **Relevance** — Direct address of the claim
- **Strength** — Direct vs. circumstantial evidence
- **Independence** — Independent confirmation vs. echo chamber
- **Recency** — Currency and applicability
- **Contradictions** — Conflicting evidence detection

### 3.4 Intern Agent (`engine/agents/intern.py`)

**Role:** Evidence gathering via web and academic search.

**Class:** `InternAgent(BaseAgent)`

**Responsibilities:**
- Execute web searches based on Manager directives
- Find evidence BOTH supporting AND contradicting claims
- Extract relevant information from search results
- Identify primary sources, official records, expert opinions
- Suggest follow-up investigation angles
- Report evidence back to the Manager via `EvidenceReport`
- Deduplicate evidence via MinHash/LSH (`EvidenceDeduplicator`)

**Search Strategy:**
1. Search for supporting evidence
2. Search for contradicting evidence
3. Search for original source of claim
4. Look for expert opinions and official statements
5. Search for existing fact-checks (Snopes, PolitiFact, FactCheck.org)
6. Use specific terms, dates, key phrases
7. Auto-detect academic topics → search Semantic Scholar + arXiv

**Source Prioritization (highest → lowest):**
1. Official government data and statistics
2. Peer-reviewed papers and preprints
3. Established fact-checking organizations
4. Reputable news organizations
5. Technical documentation and official records
6. Expert interviews and statements
7. Blog posts and social media

**Evidence Types:**
| Type | Description |
|------|-------------|
| `SUPPORTING` | Evidence that supports the claim |
| `CONTRADICTING` | Evidence that contradicts the claim |
| `CONTEXTUAL` | Background context relevant to the claim |
| `SOURCE` | A primary source worth investigating |
| `QUESTION` | An unanswered question worth pursuing |
| `FACT` | Verified specific information |
| `INSIGHT` | Analysis from credible sources |
| `CONNECTION` | Links between claims or related facts |
| `CONTRADICTION` | Conflicting information needing resolution |

### 3.5 Parallel Intern Pool (`engine/agents/parallel.py`)

**Role:** Concurrent evidence gathering using multiple intern instances.

**Class:** `ParallelInternPool`

**Key Design Decisions:**
- Each directive gets a **fresh** `InternAgent` instance (prevents state corruption from concurrent access)
- Uses `asyncio.wait()` with 15-minute timeout per batch (preserves partial results from completed interns on timeout)
- Pool size configurable (default: 3 concurrent interns)
- Thread-safe with asyncio locks

**Key Methods:**
| Method | Description |
|--------|-------------|
| `gather_evidence_parallel(directives, session_id)` | Execute multiple directives concurrently |
| `decompose_and_gather(claim, session_id, llm_callback)` | Decompose claim into aspects, then gather in parallel |
| `_decompose_claim(claim, llm_callback, max_aspects)` | Use LLM to decompose claim into verification angles |

**Result:** `ParallelVerificationResult` containing aggregated reports, evidence, search counts, and errors.

### 3.6 KG Processor (`engine/agents/kg_processor.py`)

**Role:** Processes evidence into the knowledge graph and retrieval index.

**Class:** `KGProcessor`

**Pipeline:**
1. Index evidence for hybrid retrieval (semantic + lexical)
2. Convert `Evidence` objects to `KGFinding` format
3. Add to knowledge graph (batch for >3 items, individual otherwise)
4. Detect contradictions during graph construction

---

## 4. Data Flow & Verification Pipeline

### Complete Verification Flow

```
User claim
    │
    ▼
Director.start_verification()
    ├── Create/load CheckSession
    ├── Clarify claim (optional, via UserInteraction)
    ├── Reset cost tracker
    │
    ▼
Manager.run_verification() [ReAct loop, N iterations]
    │
    ├── PHASE: parallel_init
    │   └── ParallelInternPool.decompose_and_gather()
    │       ├── LLM decomposes claim into 3 verification angles
    │       └── 3 interns search in parallel (asyncio.gather)
    │
    ├── PHASE: react_loop (for each iteration)
    │   ├── Manager.think()
    │   │   ├── Assess evidence state, gaps, contradictions
    │   │   ├── Query KG for research summary and directions
    │   │   ├── Check for user guidance messages
    │   │   └── Use hybrid memory context
    │   │
    │   ├── Manager.act()
    │   │   ├── Create VerificationDirective for interns
    │   │   ├── Execute via intern pool (parallel)
    │   │   ├── Process evidence → KG via KGProcessor
    │   │   └── OR trigger synthesis if sufficient evidence
    │   │
    │   └── Manager.observe()
    │       └── Update context with results
    │
    ├── PHASE: synthesis
    │   ├── Build KG summary → entity graph + contradictions
    │   ├── Opus model with extended thinking → verdict
    │   └── Generate VerdictReport
    │
    ▼
Director.export_results()
    ├── evidence.json (structured evidence data)
    ├── report.md (narrative verdict report via VerdictReportWriter)
    └── Knowledge graph exports (entities, relations)
```

### Event Flow (Real-Time Updates)

```
Agent Action
    │
    ▼
engine/events/ (emit_thinking, emit_action, emit_evidence, emit_synthesis)
    │
    ├── [In API process] → EventEmitter.emit() → WebSocket → UI
    │
    └── [In CLI process] → HTTP proxy → /api/events/emit → EventEmitter
```

---

## 5. Python Engine (`engine/`)

### 5.1 Entry Point & CLI

**File:** `engine/main.py`

**CLI Tool:** `meridian` (registered via `pyproject.toml` → `engine.main:app`)

**Framework:** Typer with Rich console output

**Commands:**

#### `meridian <claim>` — Fact-check a claim

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `claim` | Argument | Required | The claim to fact-check |
| `--iterations, -n` | Option | `1` | Number of verification iterations (1-10) |
| `--db, -d` | Option | `meridian.db` | SQLite database path |
| `--no-clarify` | Flag | `False` | Skip pre-check clarification questions |
| `--autonomous, -a` | Flag | `False` | Run fully autonomous (no interaction) |
| `--timeout` | Option | `60` | Timeout for mid-check questions (10-300s) |
| `--depth` | Option | `5` | Maximum verification depth (1-10) |

**Output:** `output/{claim-slug}_{session-id}/` containing `report.md` and `evidence.json`

#### `meridian ui` — Launch the web UI

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `session_id` | Argument | `None` | Optional session ID to open directly |
| `--port, -p` | Option | `9090` | API server port |
| `--no-browser` | Flag | `False` | Don't auto-open browser |
| `--restart/--no-restart` | Flag | `True` | Restart servers if ports in use |

**Behavior:** Starts the FastAPI backend (port 9090) and Next.js frontend (port 3004), auto-opens browser, waits for Ctrl+C.

### 5.2 Agent System

**Base module:** `engine/agents/`

#### BaseAgent (`engine/agents/base.py`)

**Abstract base class** implementing the ReAct loop pattern.

**Abstract Methods (must be implemented by subclasses):**
- `system_prompt` (property) — Agent's role definition
- `think(context)` — Reason about current state
- `act(thought, context)` — Execute an action
- `observe(action_result)` — Process action result
- `is_done(context)` — Check completion

**Concrete Methods:**
| Method | Description |
|--------|-------------|
| `run(initial_context, resume)` | Main ReAct loop executor |
| `stop()` | Request graceful stop |
| `pause()` | Request pause after current iteration |
| `call_claude(prompt, tools, use_thinking, task_type, output_format, model_override)` | LLM call via Claude Agent SDK |
| `call_claude_with_tools(prompt, tools)` | LLM call with tool use (WebSearch, WebFetch) |
| `send_message(to_agent, message_type, content, session_id)` | Inter-agent messaging |
| `_log_decision(session_id, decision_type, ...)` | Audit trail logging |

**Error Handling:**
- 3 consecutive errors → agent stops
- Exponential backoff with jitter between retries
- Error events emitted via WebSocket

**API Key Resolution:** `_get_api_key()` checks:
1. `ANTHROPIC_API_KEY` environment variable
2. Claude Code's `~/.claude/get-api-key.sh` script

#### AgentConfig

```python
@dataclass
class AgentConfig:
    model: str = "sonnet"         # sonnet, opus, haiku
    max_turns: int = 10           # Max turns per LLM call
    max_iterations: int = 100     # Max ReAct loop iterations
    allowed_tools: list[str]      # ["WebSearch", "WebFetch"]
    max_thinking_tokens: int = 10000  # Extended thinking budget
```

#### ModelRouter (`engine/agents/base.py`)

Routes LLM calls to appropriate models by task type:

| Task | Model | Use Case |
|------|-------|----------|
| `classify` | Haiku | Quick classification |
| `extract_simple` | Haiku | Simple extraction |
| `yes_no` | Haiku | Binary decisions |
| `format` | Haiku | Output formatting |
| `search` | Sonnet | Search analysis |
| `extract_evidence` | Sonnet | Evidence extraction |
| `summarize` | Sonnet | Summarization |
| `analyze_results` | Sonnet | Result analysis |
| `query_expansion` | Sonnet | Query expansion |
| `strategic_planning` | Opus | Deep planning |
| `synthesis` | Opus | Evidence synthesis |
| `critique` | Opus | Critical evaluation |
| `deep_analysis` | Opus | Complex reasoning |
| `verdict_writing` | Opus | Verdict generation |

Extended thinking is automatically enabled for Opus tasks.

### 5.3 Tools

#### WebSearchTool (`engine/tools/web_search.py`)

**Purpose:** Web search and page scraping via Bright Data.

**Features:**
- Multi-engine SERP search (Google + Bing by default)
- Page scraping to markdown via Web Unlocker
- Platform-specific structured data (auto-detected from URL)
- Batch scraping for parallel page fetches
- Deep scraping: page markdown + structured platform data in one call

**Zone Configuration:**
| Env Variable | Purpose | Default |
|-------------|---------|---------|
| `BRIGHT_DATA_SERP_ZONE` | Dedicated SERP zone | (none, falls back to Web Unlocker) |
| `BRIGHT_DATA_ZONE` | Web Unlocker zone for scraping | `mcp_unlocker` |
| `BRIGHT_DATA_API_TOKEN` | API authentication | Required |

**SearchResult dataclass:**
```python
@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    content: str | None = None      # Full page content (when scraped)
    engine: str = "google"
    platform: str | None = None      # Detected platform
    platform_data: dict | None = None # Structured platform data
```

#### BrightDataClient (`engine/tools/bright_data.py`)

**Purpose:** Low-level async client wrapping all Bright Data APIs.

**Supported Operations:**
- `search(query, num, engine)` — Multi-engine SERP
- `scrape_page(url, fmt)` — Single page scraping (markdown/HTML)
- `scrape_batch(urls, fmt)` — Parallel batch scraping
- `get_platform_data(url, platform)` — Structured data extraction

**Platform Auto-Detection (25+ platforms):**

| Platform | URL Pattern | Bright Data Endpoint |
|----------|-------------|---------------------|
| X/Twitter | `x.com/*/status/*` | `x_posts` |
| Reddit | `reddit.com/r/*/comments/*` | `reddit_posts` |
| Instagram Posts | `instagram.com/p/*` | `instagram_posts` |
| Instagram Reels | `instagram.com/reel/*` | `instagram_reels` |
| Instagram Profiles | `instagram.com/*` | `instagram_profiles` |
| Facebook Posts | `facebook.com/posts/*` | `facebook_posts` |
| TikTok Posts | `tiktok.com/@*/video/*` | `tiktok_posts` |
| YouTube Videos | `youtube.com/watch*` | `youtube_videos` |
| YouTube Profiles | `youtube.com/@*` | `youtube_profiles` |
| LinkedIn Person | `linkedin.com/in/*` | `linkedin_person_profile` |
| LinkedIn Company | `linkedin.com/company/*` | `linkedin_company_profile` |
| Reuters | `reuters.com/*` | `reuter_news` |
| Crunchbase | `crunchbase.com/organization/*` | `crunchbase_company` |
| GitHub Files | `github.com/*/*/blob/*` | `github_repository_file` |
| Google Play | `play.google.com/store/apps/*` | `google_play_store` |
| Apple App Store | `apps.apple.com/*` | `apple_app_store` |

#### AcademicSearchTool (`engine/tools/academic_search.py`)

**Purpose:** Academic paper discovery via free APIs.

**APIs:**
1. **Semantic Scholar** — 200M+ papers, citation graphs, TLDRs
2. **arXiv** — 2.4M+ preprints, full-text access

**Features:**
- No API keys required for basic usage
- Exponential backoff with full-jitter retry strategy
- Rate limit handling with Retry-After header support
- Auto-detection of academic topics based on keyword matching

**Academic Topic Detection Keywords:**
`research`, `study`, `paper`, `journal`, `scientific`, `evidence`, `theory`, `clinical`, `trial`, `treatment`, `peer-reviewed`, `academic`, `scholar`, `university`, etc.

### 5.4 Knowledge Graph

**Module:** `engine/knowledge/`

#### Components

| File | Class | Purpose |
|------|-------|---------|
| `graph.py` | `IncrementalKnowledgeGraph` | Real-time entity/relation extraction from evidence using NER + LLM |
| `store.py` | `HybridKnowledgeGraphStore` | Persistence layer — SQLite + NetworkX hybrid |
| `query.py` | `ManagerQueryInterface` | KG querying for research summary and next research directions |
| `models.py` | `Entity`, `Relation`, `KGFinding`, etc. | Data models for KG entities |
| `fast_ner.py` | `FastNER` | Fast named entity recognition using spaCy (`en_core_web_sm`) |
| `credibility.py` | `CredibilityScorer` | Source credibility scoring based on domain, HTTPS, recency, path depth |
| `visualize.py` | `KnowledgeGraphVisualizer` | KG visualization export |

#### Data Models

```python
@dataclass
class Entity:
    name: str
    entity_type: str  # person, organization, location, concept, etc.
    properties: dict

@dataclass
class Relation:
    source: Entity
    target: Entity
    relation_type: str  # supports, contradicts, related_to, etc.
    properties: dict

@dataclass
class KGFinding:
    id: str
    content: str
    source_url: str
    source_title: str
    timestamp: str
    credibility_score: float
    finding_type: str
    search_query: str | None

@dataclass
class Contradiction:
    entity: str
    conflicting_claims: list[str]
    sources: list[str]

@dataclass
class KnowledgeGap:
    topic: str
    reason: str
```

#### IncrementalKnowledgeGraph

**Processing Pipeline:**
1. Extract entities using `FastNER` (spaCy NER)
2. Extract relations using LLM (Sonnet model)
3. Store in `HybridKnowledgeGraphStore` (SQLite + NetworkX)
4. Detect contradictions between entities
5. Calculate credibility scores for sources

**Methods:**
- `add_finding(finding, fast_mode)` — Process single evidence item
- `add_findings_batch(findings, batch_size)` — Batch process evidence items
- `get_contradictions()` — Find conflicting claims
- `get_knowledge_gaps()` — Identify under-explored areas

#### CredibilityScorer

**Scoring Components:**
| Factor | Description | Weight |
|--------|-------------|--------|
| Domain Authority | Known-domain reputation lookup | High |
| Recency | How current the source is | Medium |
| Source Type | Government > academic > news > blog | High |
| HTTPS | Secure connection indicator | Low |
| Path Depth | Shallow paths = more authoritative | Low |

**Output:** `credibility_label` — "High", "Medium", "Low"

### 5.5 Retrieval System

**Module:** `engine/retrieval/`

#### Components

| File | Class | Purpose |
|------|-------|---------|
| `embeddings.py` | `EmbeddingService` | BGE embedding generation |
| `vectorstore.py` | `VectorStore` | ChromaDB-based vector storage |
| `bm25.py` | `BM25Index` | Lexical BM25 search index |
| `hybrid.py` | `HybridRetriever` | Combines semantic + lexical via Reciprocal Rank Fusion |
| `reranker.py` | `Reranker`, `LightweightReranker` | Cross-encoder reranking for quality boost |
| `evidence.py` | `EvidenceRetriever` | Evidence-specific retrieval wrapper |
| `deduplication.py` | `EvidenceDeduplicator` | MinHash/LSH-based evidence deduplication (datasketch) |
| `query_expansion.py` | `QueryExpander` | LLM-based multi-query expansion |
| `memory_integration.py` | `SemanticMemoryStore` | Semantic memory for long sessions |

#### HybridRetriever Pipeline

```
Query → [Semantic Search (BGE + ChromaDB)]  ─┐
      → [Lexical Search (BM25)]              ─┼→ Reciprocal Rank Fusion → Reranking → Results
                                               │
```

**Note:** Currently disabled in Manager for speed. ChromaDB + reranker model loading adds 10-15s startup.

#### EvidenceDeduplicator

Uses `datasketch` library for MinHash/LSH-based near-duplicate detection. Prevents the same evidence from being added multiple times across different searches.

#### QueryExpander

Expands a single query into multiple semantically diverse queries for better search coverage. Uses LLM to generate variations, KG context for grounding, and sufficiency checking to avoid over-searching.

### 5.6 Verification Pipeline

**Module:** `engine/verification/`

**Status:** Currently **disabled** in Manager for speed. The system relies on evidence quality + Opus synthesis rather than per-evidence verification.

#### Components

| File | Class | Purpose |
|------|-------|---------|
| `cove.py` | `ChainOfVerification` | CoVe: generates verification questions, independently answers them, compares |
| `critic.py` | `CRITICVerifier` | CRITIC pattern: iterative self-critique with tool-augmented correction |
| `critic.py` | `HighStakesDetector` | Detects high-stakes claims needing extra verification |
| `hhem.py` | `HHEMScorer` | Hughes Hallucination Evaluation Model scoring |
| `confidence.py` | `ConfidenceCalibrator` | Calibrates confidence scores based on verification results |
| `pipeline.py` | `VerificationPipeline` | Orchestrates streaming + batch verification |
| `metrics.py` | `VerificationMetricsTracker` | Latency and accuracy metrics |
| `models.py` | `VerificationConfig`, `VerificationResult`, etc. | Data models |
| `json_utils.py` | — | JSON parsing utilities |

#### Confidence Thresholds

| Score Range | Status | Action |
|-------------|--------|--------|
| >85% | `VERIFIED` | Auto-accept |
| 50-85% | `FLAGGED` | Flag for review |
| <50% | `REJECTED` | Reject, trigger additional search |

#### Chain-of-Verification (CoVe)

1. Generate verification questions from the evidence
2. Independently answer each question (not using the original evidence)
3. Compare independent answers with the original evidence
4. Adjust confidence based on consistency

#### CRITIC Pattern

1. Generate initial assessment of evidence
2. Self-critique the assessment
3. Use web search to verify questionable claims
4. Iterate until confident or max iterations reached

### 5.7 Storage & Database

**File:** `engine/storage/database.py`

**Class:** `VeritasDatabase`

**Backend:** SQLite with WAL (Write-Ahead Logging) mode via `aiosqlite`

**Connection Pool:** `_ConnectionPool` class
- Default size: 5 connections
- WAL mode set on first connection
- `busy_timeout=15000` (15 seconds)
- Automatic connection health management (replace broken connections)
- `asynccontextmanager` pattern for connection acquisition

**Session ID Generation:** 7-character hexadecimal (`secrets.token_hex(4)[:7]`)

**Slug Generation:** `_generate_slug(claim)` — URL-friendly slug from claim text (removes stop words, max 50 chars)

**Core Operations:**
| Method | Description |
|--------|-------------|
| `connect()` | Initialize pool, create tables |
| `create_session(goal, max_iterations)` | Create new check session |
| `get_session(session_id)` | Retrieve session by ID |
| `update_session(session)` | Update session state |
| `save_evidence(evidence)` | Persist evidence item |
| `get_session_findings(session_id)` | Get all evidence for a session |
| `save_message(message)` | Save inter-agent message |
| `save_credibility_audit(...)` | Save source credibility audit |
| `get_session_stats(session_id)` | Aggregate statistics |
| `checkpoint_session(session_id, ...)` | Save iteration checkpoint for crash recovery |

**Database Files:**
| File | Purpose |
|------|---------|
| `meridian.db` | Main database (sessions, evidence, topics, messages, events) |
| `veritas_kg.db` | Knowledge graph data (entities, relations) |
| `veritas_memory.db` | External memory for long sessions |

### 5.8 Event System

**Module:** `engine/events/`

**Architecture:** Registry pattern decoupling agents from API layer.

**Registration:** API server registers its emitter at startup via `register_emitter()`. When running in CLI mode (no API server), events are proxied over HTTP to the API server.

**Event Types:**

| Event | Function | Data |
|-------|----------|------|
| `thinking` | `emit_thinking()` | `{thought: str}` |
| `action` | `emit_action()` | `{action: str, iteration: int, query?: str, results_count?: int}` |
| `evidence` | `emit_evidence()` | `{content: str, source?: str, confidence?: float}` |
| `synthesis` | `emit_synthesis()` | `{message: str, progress?: int}` |
| `error` | `emit_error()` | `{error: str, recoverable: bool}` |
| `verdict` | `emit_verdict()` | `{verdict: str, confidence?: float}` |
| `system` | `emit_agent_event()` | `{message: str}` |

**Remote Proxy:** When `MERIDIAN_IN_API` is not set (CLI mode) and no local subscribers exist, events are forwarded to the API server via HTTP POST to `/api/events/emit`.

### 5.9 Interaction System

**Module:** `engine/interaction/`

#### InteractionConfig (`engine/interaction/config.py`)

```python
@dataclass
class InteractionConfig:
    enable_clarification: bool = True        # Pre-check questions
    max_clarification_questions: int = 4
    clarification_timeout: int = 120         # seconds per question
    enable_async_questions: bool = True      # Mid-check questions
    question_timeout: int = 60
    max_questions_per_session: int = 5
    enable_message_queue: bool = True
    autonomous_mode: bool = False            # No interaction at all
```

**Factory Methods:**
- `InteractionConfig.from_cli_args(no_clarify, autonomous, timeout)` — From CLI flags
- `InteractionConfig.autonomous()` — Fully autonomous
- `InteractionConfig.interactive()` — All features enabled

#### UserInteraction (`engine/interaction/handler.py`)

**Three Main Features:**
1. **Pre-verification clarification** — LLM-generated questions about ambiguous claims
2. **Async mid-verification questions** — Timeout-based questions during fact-checking
3. **User message queue** — Inject guidance anytime during verification

**Key Models:**
- `ClarificationQuestion` — Generated question with ID and text
- `ClarifiedGoal` — Original claim + enriched context from answers
- `PendingQuestion` — Active mid-check question awaiting response
- `UserMessage` — User-injected guidance message

#### InputListener (`engine/interaction/listener.py`)

Listens for user input on stdin during CLI mode. Supports typing guidance that gets injected into the Manager's reasoning loop.

### 5.10 Reports

**File:** `engine/reports/writer.py`

**Class:** `VerdictReportWriter`

**Purpose:** Generates comprehensive markdown verdict reports using Opus model with extended thinking.

**Dynamic Report Sections:**

| Section Type | Description |
|-------------|-------------|
| `VERDICT_SUMMARY` | Overall verdict with confidence level |
| `TLDR` | 2-3 sentence summary |
| `FLASH_NUMBERS` | Key metrics callouts |
| `STATS_TABLE` | Tabular comparisons |
| `COMPARISON` | Side-by-side analysis |
| `TIMELINE` | Chronological view of events |
| `NARRATIVE` | Standard prose analysis |
| `ANALYSIS` | Deep synthesis section |
| `GAPS` | Open questions and knowledge gaps |
| `CONCLUSIONS` | Final conclusions |
| `REFERENCES` | Source references (inline citations using `[N]` notation) |

**Citation System:** Each evidence item gets a numbered citation `[N]`. Sections cite sources inline: "accuracy improved 40% [3]."

**Evidence Cap:** 15,000 characters (~4k tokens) per prompt to avoid context overflow.

### 5.11 Memory System

**Module:** `engine/memory/`

#### HybridMemory (`engine/memory/hybrid.py`)

**Purpose:** Manages conversation context for long verification sessions.

**Features:**
- Rolling window of recent messages (configurable max tokens)
- Automatic summarization when threshold exceeded
- LLM-powered compression via Haiku model

**Configuration:**
- `max_recent_tokens: int = 8000`
- `summary_threshold: float = 0.8` (80% of max → trigger compression)

#### ExternalMemoryStore (`engine/memory/external.py`)

**Purpose:** Persistent memory across sessions stored in separate SQLite database (`veritas_memory.db`).

### 5.12 Cost Tracking

**File:** `engine/costs/tracker.py`

**Purpose:** Tracks per-model API usage and estimates costs.

**Pricing (per million tokens):**

| Model | Input | Output |
|-------|-------|--------|
| Opus | $5.00 | $25.00 |
| Sonnet | $3.00 | $15.00 |
| Haiku | $1.00 | $5.00 |
| Web Search | — | $0.01/search |

**Tracked Metrics:** Input tokens, output tokens, thinking tokens, number of calls, web searches, web fetches.

**Display:** Rich table showing per-model breakdown and total cost after each verification.

### 5.13 Audit & Decision Logging

**Module:** `engine/audit/`

**File:** `engine/audit/decision_logger.py`

**Purpose:** Records agent decisions for audit trail and debugging.

**Decision Types:**
| Type | Description |
|------|-------------|
| `MULTI_QUERY_GEN` | Multi-query expansion generation |
| `CONTEXTUAL_EXPAND` | Contextual query expansion |
| `SUFFICIENCY_CHECK` | Evidence sufficiency assessment |
| `QUERY_MERGE` | Search result merging |
| `STOP_SEARCHING` | Decision to stop searching |

**Stored Data:** agent role, decision type, outcome, reasoning (truncated to 500 chars), inputs JSON, metrics JSON, iteration number, timestamp.

### 5.14 Logging Configuration

**File:** `engine/logging_config.py`

**Purpose:** Centralized logging setup.

**Log File:** `~/.meridian/meridian.log`

**Log Levels:** Configurable per module. DEBUG for agent internals, INFO for user-visible actions.

---

## 6. FastAPI Backend (`api/`)

### 6.1 Server Configuration

**File:** `api/server.py`

**Framework:** FastAPI 0.110+

**Ports:** HTTP API at `localhost:9090`, WebSocket at `ws://localhost:9090/ws/{session_id}`

**App Configuration:**
```python
app = FastAPI(
    title="Meridian API",
    description="Backend API for hierarchical AI fact-checking system",
    version="0.1.0",
    lifespan=lifespan,
)
```

**Lifespan Events:**
- **Startup:** Connect database, register event emitter with engine layer, mark crashed sessions
- **Shutdown:** Close WebSocket subscribers, close database

### 6.2 Middleware

Middleware is applied in this order (CORS runs first due to FastAPI ordering):

1. **CORSMiddleware** — `allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]`
2. **_RateLimitMiddleware** — 120 requests/minute per IP, sliding window, in-memory
3. **_AuthMiddleware** — Optional Bearer token auth via `MERIDIAN_API_KEY` env var. When unset, no auth (local dev). Always allows health check, docs, and OPTIONS.

### 6.3 API Routes

All routes are prefixed with `/api/`.

#### Sessions (`api/routes/sessions.py`) — `/api/sessions`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions/` | Create a new check session |
| `GET` | `/api/sessions/` | List all sessions (limit param, max 1000) |
| `GET` | `/api/sessions/{session_id}` | Get a specific session |
| `DELETE` | `/api/sessions/{session_id}` | Delete session and all related data |
| `GET` | `/api/sessions/{session_id}/stats` | Get aggregate stats (evidence, sources, sub-claims) |

#### Checks (`api/routes/checks.py`) — `/api/checks`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/checks/start` | Start a new fact-check (creates session + runs in background) |
| `POST` | `/api/checks/clarify` | Generate clarification questions for a claim |
| `POST` | `/api/checks/enrich` | Enrich a claim with user clarification answers |
| `GET` | `/api/checks/{id}/status` | Get fact-check status |
| `POST` | `/api/checks/{id}/stop` | Stop a running fact-check |
| `POST` | `/api/checks/{id}/pause` | Pause a running fact-check (saves state) |
| `POST` | `/api/checks/{id}/resume` | Resume a paused/crashed fact-check |
| `POST` | `/api/checks/{id}/answer` | Answer a mid-check question |

**Start Check Request:**
```json
{
  "claim": "string",
  "max_iterations": 1,
  "max_depth": 2,
  "autonomous": true,
  "enable_mid_questions": false
}
```

**Background Execution:** Fact-checks run as `asyncio.Task` objects tracked in `running_checks` dict. Harness references stored in `running_harnesses` for pause/resume support.

#### Evidence (`api/routes/evidence.py`) — `/api/sessions/{id}/evidence`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/{id}/evidence` | List evidence with filtering (search, type, confidence range) |
| `GET` | `/api/sessions/{id}/sources` | List source index with credibility data |

#### Events (`api/routes/events.py`) — `/api/events`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events/{session_id}` | List persisted events for playback |
| `POST` | `/api/events/emit` | Receive events from CLI engine (proxy endpoint) |

#### Report (`api/routes/report.py`) — `/api/sessions/{id}/report`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/{id}/report` | Get the generated markdown report |

#### Knowledge Graph (`api/routes/knowledge.py`) — `/api/sessions/{id}/knowledge`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/{id}/knowledge/graph` | Get KG data (entities, relations) |
| `GET` | `/api/sessions/{id}/knowledge/contradictions` | Get detected contradictions |

#### Verification (`api/routes/verification.py`) — `/api/sessions/{id}/verification`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/{id}/verification/results` | List verification results |
| `GET` | `/api/sessions/{id}/verification/stats` | Get aggregate verification stats |

#### Agents (`api/routes/agents.py`) — `/api/sessions/{id}/agents`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/{id}/agents/decisions` | List agent decision audit trail |

#### Tools (`api/routes/tools.py`) — `/api/tools`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tools/detect-ai` | AI content detection by URL (scrapes page via Bright Data) |
| `POST` | `/api/tools/detect-ai-text` | AI content detection on pasted text |
| `POST` | `/api/tools/check-plagiarism` | Plagiarism check by URL |
| `POST` | `/api/tools/check-plagiarism-text` | Plagiarism check on pasted text |
| `POST` | `/api/tools/detect-ai-image` | AI image detection by URL (EXIF + metadata analysis) |
| `POST` | `/api/tools/detect-ai-image-upload` | AI image detection on uploaded file |

**AI Content Detection Signals:**
- Repetitive sentence structures
- Lack of personal voice
- Hedging language ("It's important to note")
- Formulaic transitions
- Unusual paragraph length uniformity
- Characteristic AI phrasings

**AI Image Detection Signals:**
- EXIF data presence/absence (strongest signal)
- Power-of-2 dimensions (512, 1024, etc.)
- Software field contents (DALL-E, Midjourney, etc.)
- PNG text chunks (SD parameters, prompts)
- Color diversity ratio
- Aspect ratio analysis

**Plagiarism Check Pipeline:**
1. Extract 5 distinctive passages using Haiku
2. Search for each passage using Bright Data (exact phrase search)
3. Synthesize originality verdict using Sonnet

### 6.4 WebSocket System

**Endpoint:** `ws://localhost:9090/ws/{session_id}`

**Validation:** Session ID must be 1-16 char hex string.

**Connection Flow:**
1. Client connects → server accepts
2. Server sends `{"type": "connected", "session_id": "...", "subscribers": N}`
3. Server sends welcome system event
4. Server-side heartbeat: ping every 60s if no client message
5. Client sends `"ping"` → server responds with `{"type": "pong"}`

**Event Format:**
```json
{
  "session_id": "abc1234",
  "event_type": "thinking|action|evidence|synthesis|error|verdict|system",
  "agent": "director|manager|intern|parallel|server",
  "timestamp": "2026-04-10T12:00:00.000",
  "data": { ... }
}
```

### 6.5 Database Layer (`api/db.py`)

**Class:** `APIDatabase`

**Purpose:** Thin wrapper around `VeritasDatabase` that adds API-specific query methods.

**Pattern:** Composition — delegates connection pooling and common CRUD to `VeritasDatabase`, adds:
- `list_sessions(limit)` — Sessions ordered by `started_at DESC`
- `delete_session(session_id)` — Atomic deletion of session + all related data (evidence, topics, messages, verification_results, credibility_audit, agent_decisions, events)
- `mark_crashed_sessions()` — Mark `running` → `crashed` on startup
- `save_event(...)` / `list_events(...)` — Event persistence for playback
- `list_evidence(...)` — Filtered evidence listing with search, type, confidence range
- `list_sources(...)` — Source index with credibility audit data (JOIN)
- `list_verification_results(...)` — Verification results joined with evidence content
- `get_verification_stats(...)` — Aggregate verification statistics
- `list_agent_decisions(...)` — Agent decision audit trail
- `list_topics(...)` — Topic tree ordered by depth, priority

**Singleton:** `get_db()` returns global `APIDatabase` instance (lazy initialization).

### 6.6 Event Emitter (`api/events.py`)

**Class:** `EventEmitter` (singleton)

**Purpose:** Broadcasts agent events to WebSocket clients with event persistence.

**Architecture:**
- Subscriber map: `session_id → Set[WebSocket]`
- Thread-safe with `asyncio.Lock`
- Dead connection cleanup after failed sends
- Event persistence to SQLite for later playback
- 5-second timeout per WebSocket send

---

## 7. Next.js Frontend (`src/`)

### 7.1 App Router Pages

**Framework:** Next.js 16 with App Router

**Dev Port:** 3004

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Landing page (hero, process, nav, footer) |
| `/dashboard` | `src/app/dashboard/page.tsx` | Dashboard — list all sessions, create new checks |
| `/check/[id]` | `src/app/check/[id]/page.tsx` | Check detail — evidence browser, report preview, activity feed |
| `/check/[id]/sources` | `src/app/check/[id]/sources/page.tsx` | Sources browser with credibility data |
| `/check/[id]/graph` | `src/app/check/[id]/graph/page.tsx` | Knowledge graph visualization (vis-network) |
| `/check/[id]/verify` | `src/app/check/[id]/verify/page.tsx` | Verification pipeline details |
| `/check/[id]/agents` | `src/app/check/[id]/agents/page.tsx` | Agent decision audit trail |
| `/tools/ai-detector` | `src/app/tools/ai-detector/page.tsx` | AI content detection tool |
| `/tools/image-detector` | `src/app/tools/image-detector/page.tsx` | AI image detection tool |
| `/tools/plagiarism` | `src/app/tools/plagiarism/page.tsx` | Plagiarism checker tool |

### 7.2 Components

#### Custom Application Components

| Component | File | Purpose |
|-----------|------|---------|
| `NewCheckForm` | `src/components/new-check-form.tsx` | Form to start a new fact-check (claim input, iterations, options) |
| `EvidenceBrowser` | `src/components/evidence-browser.tsx` | Browse and filter evidence items |
| `SourcesBrowser` | `src/components/sources-browser.tsx` | Browse sources with credibility scores |
| `ReportPreview` | `src/components/report-preview.tsx` | Render markdown verdict report |
| `ActivityFeed` | `src/components/activity-feed.tsx` | Real-time agent event stream |
| `QuestionModal` | `src/components/question-modal.tsx` | Modal for mid-check questions |
| `VerdictBadge` | `src/components/verdict-badge.tsx` | Color-coded verdict display badge |

#### Landing Page Components

| Component | File |
|-----------|------|
| `Hero` | `src/components/landing/hero.tsx` |
| `Process` | `src/components/landing/process.tsx` |
| `Nav` | `src/components/landing/nav.tsx` |
| `Footer` | `src/components/landing/footer.tsx` |

#### UI Component Library (shadcn/ui — New York Style)

50+ components registered in `components.json`. Full list includes: Accordion, Alert, AlertDialog, AspectRatio, Avatar, Badge, Breadcrumb, Button, ButtonGroup, Calendar, Card, Carousel, Checkbox, Collapsible, Command, ContextMenu, Dialog, Drawer, DropdownMenu, Empty, Field, HoverCard, Input, InputGroup, InputOTP, Item, Kbd, Label, Menubar, NativeSelect, NavigationMenu, Pagination, Popover, Progress, RadioGroup, Resizable, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner (toast), Spinner, Switch, Table, Tabs, Textarea, Toggle, ToggleGroup, Tooltip.

### 7.3 Libraries & Utilities

#### API Client (`src/lib/api.ts`)

**Base URL:** `http://localhost:9090`

**Functions:**
| Function | Endpoint | Description |
|----------|----------|-------------|
| `getSessions(limit)` | `GET /api/sessions/` | List all sessions |
| `getSession(id)` | `GET /api/sessions/{id}` | Get session details |
| `getSessionStats(id)` | `GET /api/sessions/{id}/stats` | Get evidence/source/topic counts |
| `getEvidence(id, params)` | `GET /api/sessions/{id}/evidence` | Get filtered evidence |
| `getSources(id, limit)` | `GET /api/sessions/{id}/sources` | Get source index |
| `getReport(id)` | `GET /api/sessions/{id}/report` | Get markdown report |
| `getVerificationResults(id)` | `GET /api/sessions/{id}/verification/results` | Get verification data |
| `getVerificationStats(id)` | `GET /api/sessions/{id}/verification/stats` | Get verification stats |
| `getAgentDecisions(id)` | `GET /api/sessions/{id}/agents/decisions` | Get agent decisions |
| `getEvents(id, limit, order)` | `GET /api/events/{id}` | Get persisted events |
| `startCheck(body)` | `POST /api/checks/start` | Start fact-check |
| `pauseCheck(id)` | `POST /api/checks/{id}/pause` | Pause fact-check |
| `resumeCheck(id)` | `POST /api/checks/{id}/resume` | Resume fact-check |
| `clarify(claim, maxQuestions)` | `POST /api/checks/clarify` | Generate clarification questions |
| `enrich(claim, questions, answers)` | `POST /api/checks/enrich` | Enrich claim with answers |

**TypeScript Interfaces:** `Session`, `Evidence`, `VerificationStats`, `Report`, `StartCheckBody`, `StartCheckResponse`, `WSEvent`

#### WebSocket Client (`src/lib/websocket.ts`)

**Class:** `ResearchWebSocket`

**Features:**
- Auto-reconnection (max 5 attempts, increasing delay)
- Ping/pong keepalive (every 30 seconds)
- Connection status tracking: `connecting` → `connected` → `reconnecting` → `disconnected`
- Event subscription with cleanup function
- Status change callbacks

**Usage:**
```typescript
const ws = new ResearchWebSocket(sessionId);
ws.onEvent((event) => console.log(event));
ws.onStatusChange((status) => console.log(status));
ws.connect();
// Later: ws.disconnect();
```

#### Utilities

| File | Purpose |
|------|---------|
| `src/lib/utils.ts` | `cn()` helper for merging Tailwind classes (clsx + tailwind-merge) |
| `src/lib/prisma.ts` | Prisma client initialization (PostgreSQL, scaffolding only) |

#### Hooks

| File | Purpose |
|------|---------|
| `src/hooks/use-mobile.ts` | Responsive breakpoint detection hook |

### 7.4 Styling & Design System

**Framework:** Tailwind CSS v4 with CSS variables for theming

**Fonts:**
- **Fraunces** — Serif display font
- **Outfit** — Sans-serif body font
- **Space Mono** — Monospace code font
- **Material Symbols Outlined** — Icon font

**CSS:** `src/app/globals.css` — Custom properties for colors, spacing, and the `grain` texture effect

**Component Styling:** shadcn/ui New York style variant with Radix UI primitives

---

## 8. Data Models

### Core Models (`engine/models/evidence.py`)

#### CheckSession

```python
class CheckSession(BaseModel):
    id: str | None          # 7-char hex ID
    claim: str              # The claim being checked
    slug: str | None        # AI-generated short name
    verdict: str | None     # true/false/mostly_true/mostly_false/mixed/unverifiable
    max_iterations: int = 5
    time_limit_minutes: int = 0
    started_at: datetime
    ended_at: datetime | None
    status: str = "active"  # active | running | paused | crashed | completed | error | interrupted
    total_findings: int = 0
    total_searches: int = 0
    depth_reached: int = 0
    # Pause/resume/crash recovery
    elapsed_seconds: float = 0.0
    paused_at: datetime | None
    iteration_count: int = 0
    phase: str = "init"     # init | parallel_init | react_loop | synthesis | done
```

#### Evidence

```python
class Evidence(BaseModel):
    id: int | None
    session_id: str                  # 7-char hex
    content: str
    evidence_type: EvidenceType      # supporting/contradicting/contextual/source/...
    source_url: str | None
    confidence: float = 0.8          # 0.0-1.0
    search_query: str | None
    created_at: datetime
    validated_by_manager: bool = False
    manager_notes: str | None
    topic_id: int | None
    # Verification
    verification_status: str | None  # verified/flagged/rejected/skipped
    verification_method: str | None  # cove/critic/kg_match/streaming/batch
    kg_support_score: float | None   # 0.0-1.0
    original_confidence: float | None
```

#### SubClaim

```python
class SubClaim(BaseModel):
    id: int | None
    session_id: str
    topic: str
    parent_topic_id: int | None
    depth: int = 0
    status: str = "pending"    # pending | in_progress | completed | blocked
    priority: int = 5          # 1-10
    assigned_at: datetime | None
    completed_at: datetime | None
    findings_count: int = 0
```

#### VerificationDirective (Manager → Intern)

```python
class ManagerDirective(BaseModel):
    action: str            # search | deep_dive | verify | expand | stop
    topic: str
    instructions: str
    priority: int = 5      # 1-10
    max_searches: int = 5
```

#### EvidenceReport (Intern → Manager)

```python
class InternReport(BaseModel):
    topic: str
    evidence: list[Evidence]
    searches_performed: int
    suggested_followups: list[str]
    blockers: list[str]
```

#### VerdictReport (Manager → Director)

```python
class ManagerReport(BaseModel):
    summary: str
    key_evidence: list[Evidence]
    topics_explored: list[str]
    topics_remaining: list[str]
    quality_assessment: str
    recommended_next_steps: list[str]
    time_elapsed_minutes: float
    iterations_completed: int
    searches_performed: int
    verdict: str | None
    sub_claims_explored: list[str]
    sub_claims_remaining: list[str]
```

### Backward-Compatibility Aliases

```python
VerificationDirective = ManagerDirective
EvidenceReport = InternReport
VerdictReport = ManagerReport
FindingType = EvidenceType
Finding = Evidence
ResearchSession = CheckSession
ResearchTopic = SubClaim
```

### API Models (`api/models.py`)

| Model | Purpose |
|-------|---------|
| `HealthResponse` | Health check response (`status`, `version`, `uptime`) |
| `CheckSessionCreate` | Create session request body |
| `CheckSessionResponse` | Session response with all fields |

---

## 9. Configuration & Environment

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BRIGHT_DATA_API_TOKEN` | **Yes** | — | Bright Data API authentication token |
| `BRIGHT_DATA_ZONE` | No | `mcp_unlocker` | Web Unlocker zone name |
| `BRIGHT_DATA_SERP_ZONE` | No | — | Dedicated SERP zone (recommended) |
| `ANTHROPIC_API_KEY` | No | (CLI auth fallback) | Anthropic API key for Claude |
| `MERIDIAN_API_KEY` | No | — | API authentication key (when set, Bearer auth required) |
| `DATABASE_URL` | No | — | PostgreSQL connection string (for Prisma scaffolding) |
| `MERIDIAN_DEBUG` | No | — | Enable debug-only endpoints (test event emission) |
| `MERIDIAN_API_URL` | No | `http://localhost:9090` | API server URL for event proxying |
| `MERIDIAN_IN_API` | Auto | — | Set automatically in API server process |
| `MERIDIAN_DISABLE_EVENT_PROXY` | No | — | Disable CLI→API event proxying |
| `MERIDIAN_DISABLE_LOG_EVENTS` | No | — | Disable system log events to WebSocket |

### Prisma Configuration

**File:** `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id    String @id @default(uuid())
  email String @unique
  name  String
}
```

**Note:** This is minimal scaffolding. The primary data persistence is via SQLite through `engine/storage/database.py`. Prisma/PostgreSQL is set up for future use.

---

## 10. Build System & Dependencies

### Python (`pyproject.toml`)

**Build System:** Hatchling

**CLI Entry Point:** `meridian = "engine.main:app"`

**Wheel Packages:** `engine`, `api`

**Key Dependencies:**

| Package | Version | Purpose |
|---------|---------|---------|
| `claude-agent-sdk` | >=0.1.0 | Claude Agent SDK for LLM calls |
| `anthropic` | >=0.40.0 | Anthropic API client |
| `rich` | >=13.7.0 | Terminal formatting and progress |
| `typer` | >=0.12.0 | CLI framework |
| `pydantic` | >=2.5.0 | Data validation and models |
| `aiosqlite` | >=0.19.0 | Async SQLite |
| `anyio` | >=4.0.0 | Async I/O |
| `networkx` | >=3.2.0 | Knowledge graph operations |
| `pyvis` | >=0.3.2 | KG visualization |
| `numpy` | >=1.26.0 | Numerical operations |
| `sentence-transformers` | >=3.0.0 | BGE embeddings for retrieval |
| `chromadb` | >=1.0.0 | Vector database |
| `datasketch` | >=1.6.0 | MinHash/LSH deduplication |
| `spacy` | >=3.7.0 | NER (Named Entity Recognition) |
| `transformers` | >=4.36.0 | Model loading for reranking |
| `httpx` | >=0.27.0 | Async HTTP client |
| `python-dotenv` | >=1.0.0 | Environment variable loading |
| `fastapi` | >=0.110.0 | Web framework |
| `uvicorn[standard]` | >=0.27.0 | ASGI server |
| `websockets` | >=12.0 | WebSocket support |

**Python Version:** >=3.10, targeting 3.11

**Linting:**
```toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
```

### Node.js (`package.json`)

**Key Dependencies:**

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | React framework (App Router) |
| `react` / `react-dom` | 19.2.3 | React 19 |
| `radix-ui` | ^1.4.3 | Headless UI primitives |
| `shadcn` | ^4.0.5 | UI component system |
| `lucide-react` | ^0.577.0 | Icon library |
| `@phosphor-icons/react` | ^2.1.10 | Additional icon library |
| `next-themes` | ^0.4.6 | Theme management |
| `vis-network` / `vis-data` | ^10.0.2 / ^8.0.3 | Knowledge graph visualization |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `clsx` + `tailwind-merge` | — | Class name utilities |
| `sonner` | ^2.0.7 | Toast notifications |
| `date-fns` | ^4.1.0 | Date formatting |
| `cmdk` | ^1.1.1 | Command palette |
| `vaul` | ^1.1.2 | Drawer component |
| `react-resizable-panels` | ^4.7.2 | Resizable layout panels |
| `embla-carousel-react` | ^8.6.0 | Carousel component |
| `@prisma/client` | ^7.5.0 | PostgreSQL ORM client |

**Dev Dependencies:** `tailwindcss` v4, `@tailwindcss/postcss`, TypeScript 5, ESLint 9, Prisma CLI

**Scripts:**
```json
{
  "dev": "next dev -p 3004",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

**Package Manager:** pnpm

---

## 11. Database Schema

### SQLite Tables (via `engine/storage/database.py`)

#### `sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | 7-char hex session ID |
| `claim` | TEXT | The claim being fact-checked |
| `slug` | TEXT | URL-friendly slug |
| `verdict` | TEXT | Final verdict |
| `max_iterations` | INTEGER | Max ReAct loop iterations |
| `time_limit` | INTEGER | Time limit (deprecated, kept for compat) |
| `started_at` | TEXT | ISO 8601 timestamp |
| `ended_at` | TEXT | ISO 8601 timestamp |
| `status` | TEXT | active/running/paused/crashed/completed/error/interrupted |
| `total_findings` | INTEGER | Total evidence count |
| `total_searches` | INTEGER | Total search count |
| `depth_reached` | INTEGER | Maximum depth reached |
| `elapsed_seconds` | REAL | Accumulated run time |
| `paused_at` | TEXT | Pause timestamp |
| `iteration_count` | INTEGER | Current iteration for resume |
| `phase` | TEXT | Current phase |

#### `findings` (Evidence)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT FK | References sessions(id) |
| `content` | TEXT | Evidence content |
| `evidence_type` | TEXT | supporting/contradicting/etc. |
| `source_url` | TEXT | Source URL |
| `confidence` | REAL | 0.0-1.0 |
| `search_query` | TEXT | Query that found this evidence |
| `created_at` | TEXT | ISO 8601 timestamp |
| `verification_status` | TEXT | verified/flagged/rejected/skipped |
| `verification_method` | TEXT | cove/critic/kg_match/etc. |
| `kg_support_score` | REAL | KG corroboration score |

#### `topics` (Sub-Claims)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT FK | References sessions(id) |
| `topic` | TEXT | Sub-claim text |
| `parent_topic_id` | INTEGER | Parent topic for hierarchy |
| `depth` | INTEGER | Depth in topic tree |
| `status` | TEXT | pending/in_progress/completed/blocked |
| `priority` | INTEGER | 1-10 |
| `assigned_at` | TEXT | Assignment timestamp |
| `completed_at` | TEXT | Completion timestamp |
| `findings_count` | INTEGER | Evidence count for this topic |

#### `messages` (Inter-Agent)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT FK | References sessions(id) |
| `from_agent` | TEXT | Sender role |
| `to_agent` | TEXT | Receiver role |
| `message_type` | TEXT | task/report/critique/question/directive |
| `content` | TEXT | Message content |
| `metadata` | TEXT | JSON metadata |
| `created_at` | TEXT | ISO 8601 timestamp |

#### `verification_results`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT FK | References sessions(id) |
| `finding_id` | INTEGER FK | References findings(id) |
| `original_confidence` | REAL | Pre-verification confidence |
| `verified_confidence` | REAL | Post-verification confidence |
| `verification_status` | TEXT | verified/flagged/rejected |
| `verification_method` | TEXT | cove/critic/kg_match |
| `consistency_score` | REAL | CoVe consistency score |
| `kg_support_score` | REAL | KG corroboration score |
| `kg_entity_matches` | INTEGER | Entity match count |
| `kg_supporting_relations` | INTEGER | Supporting relation count |
| `critic_iterations` | INTEGER | CRITIC iteration count |
| `corrections_made` | TEXT | JSON corrections |
| `questions_asked` | TEXT | JSON verification questions |
| `external_verification_used` | INTEGER | Boolean flag |
| `contradictions` | TEXT | JSON contradictions |
| `verification_time_ms` | REAL | Processing time |
| `created_at` | TEXT | ISO 8601 timestamp |
| `error` | TEXT | Error message if failed |

#### `credibility_audit`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT FK | References sessions(id) |
| `finding_id` | INTEGER | Evidence item ID |
| `url` | TEXT | Source URL |
| `domain` | TEXT | Extracted domain |
| `final_score` | REAL | Overall credibility score |
| `domain_authority_score` | REAL | Domain reputation |
| `recency_score` | REAL | Source recency |
| `source_type_score` | REAL | Source type weight |
| `https_score` | REAL | HTTPS indicator |
| `path_depth_score` | REAL | URL path depth |
| `credibility_label` | TEXT | High/Medium/Low |
| `created_at` | TEXT | ISO 8601 timestamp |

#### `agent_decisions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `session_id` | TEXT FK | References sessions(id) |
| `agent_role` | TEXT | Agent identifier |
| `decision_type` | TEXT | Type of decision |
| `decision_outcome` | TEXT | What was decided |
| `reasoning` | TEXT | Truncated to 500 chars |
| `inputs_json` | TEXT | JSON inputs |
| `metrics_json` | TEXT | JSON metrics |
| `iteration` | INTEGER | ReAct loop iteration |
| `created_at` | TEXT | ISO 8601 timestamp |

#### `events`

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | TEXT FK | References sessions(id) |
| `event_type` | TEXT | thinking/action/evidence/etc. |
| `agent` | TEXT | Agent name |
| `timestamp` | TEXT | Event timestamp |
| `data_json` | TEXT | JSON event data |
| `created_at` | TEXT | Persistence timestamp |

---

## 12. Model Routing & LLM Usage

### Claude Agent SDK Integration

All LLM calls go through `claude_agent_sdk.query()` which provides:
- Model selection (haiku, sonnet, opus)
- Extended thinking support (`max_thinking_tokens`)
- Tool use (WebSearch, WebFetch)
- Structured output via JSON schema (`output_format`)
- Streaming response handling

### Model Usage by Component

| Component | Model | Purpose |
|-----------|-------|---------|
| Intern search analysis | Sonnet | Evidence extraction from search results |
| Intern query generation | Sonnet | Search query formulation |
| Manager reasoning (ReAct) | Sonnet | Strategic planning each iteration |
| Manager verdict synthesis | Opus + thinking | Final verdict determination |
| KG entity extraction | Sonnet | NER augmentation with LLM |
| Memory summarization | Haiku | Context compression |
| Clarification questions | Haiku | Quick question generation |
| Interaction callbacks | Haiku | Fast response processing |
| Report generation | Opus + thinking | Comprehensive narrative report |
| AI content detection | Sonnet | Content analysis |
| Plagiarism extraction | Haiku | Passage extraction |
| Plagiarism synthesis | Sonnet | Originality assessment |
| Image analysis | Sonnet | Metadata-based forensics |

### Timeouts

| Operation | Timeout |
|-----------|---------|
| Pure LLM call | 5 minutes |
| LLM call with tools | 10 minutes |
| Parallel intern batch | 15 minutes |
| API tool calls | 2 minutes |

---

## 13. Output & Exports

### Output Directory Structure

```
output/{claim-slug}_{session-id}/
├── report.md          # Narrative verdict report with citations
├── evidence.json      # Structured evidence data
└── (KG export files)  # Knowledge graph data (entities, relations)
```

### `evidence.json` Format

```json
{
  "session": {
    "id": "abc1234",
    "claim": "The claim being checked",
    "slug": "claim-slug",
    "started_at": "2026-04-10T12:00:00",
    "ended_at": "2026-04-10T12:05:00",
    "status": "completed"
  },
  "evidence": [
    {
      "content": "Evidence text...",
      "type": "supporting",
      "source_url": "https://example.com",
      "confidence": 0.85,
      "search_query": "query used"
    }
  ],
  "sub_claims_explored": ["sub-claim 1", "sub-claim 2"],
  "sub_claims_remaining": ["sub-claim 3"],
  "costs": {
    "total_cost": 0.0234,
    "sonnet_cost": 0.0180,
    "opus_cost": 0.0050,
    "haiku_cost": 0.0004
  }
}
```

---

## 14. Development Guide

### Initial Setup

```bash
# Clone and enter repository
git clone https://github.com/thtskaran/meridian
cd meridian

# Python setup
pip install -e .
python -m spacy download en_core_web_sm

# Node.js setup
pnpm install

# Environment
cp .env.example .env
# Edit .env and add BRIGHT_DATA_API_TOKEN
```

### Running

```bash
# CLI fact-check
meridian "The Great Wall of China is visible from space"
meridian "COVID vaccines cause autism" --iterations 5
meridian "Earth is flat" -n 3 --autonomous --no-clarify

# Web UI (starts both API + frontend)
meridian ui
meridian ui --port 9090

# API server only
python -m api.server

# Frontend only
pnpm dev
```

### Linting

```bash
# Python
ruff check engine/
ruff format engine/

# Frontend
pnpm lint
```

### Key Development Patterns

1. **All agent code is async/await** — Uses `asyncio` throughout
2. **State persistence via SQLite** — WAL mode for concurrent reads/writes
3. **Crash recovery** — Iteration checkpoints allow resume after failures
4. **Fire-and-forget events** — Event emission doesn't block agent operations
5. **Connection pool** — 5 SQLite connections with automatic health management
6. **Backward compatibility** — Type aliases maintain API stability as naming evolves

---

## 15. API Reference

### Health Check

```
GET /
```

Response: `{"status": "healthy", "version": "0.1.0", "uptime": 123.45}`

### Documentation

```
GET /docs     → Swagger UI
GET /redoc    → ReDoc
```

### WebSocket

```
WS ws://localhost:9090/ws/{session_id}
```

Session ID: 1-16 character hex string.

### Full REST API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/api/sessions/` | Create session |
| `GET` | `/api/sessions/` | List sessions |
| `GET` | `/api/sessions/{id}` | Get session |
| `DELETE` | `/api/sessions/{id}` | Delete session |
| `GET` | `/api/sessions/{id}/stats` | Session stats |
| `GET` | `/api/sessions/{id}/evidence` | List evidence |
| `GET` | `/api/sessions/{id}/sources` | List sources |
| `GET` | `/api/sessions/{id}/report` | Get report |
| `GET` | `/api/sessions/{id}/verification/results` | Verification results |
| `GET` | `/api/sessions/{id}/verification/stats` | Verification stats |
| `GET` | `/api/sessions/{id}/agents/decisions` | Agent decisions |
| `GET` | `/api/sessions/{id}/knowledge/graph` | KG data |
| `GET` | `/api/sessions/{id}/knowledge/contradictions` | KG contradictions |
| `POST` | `/api/checks/start` | Start fact-check |
| `POST` | `/api/checks/clarify` | Generate questions |
| `POST` | `/api/checks/enrich` | Enrich with answers |
| `GET` | `/api/checks/{id}/status` | Check status |
| `POST` | `/api/checks/{id}/stop` | Stop check |
| `POST` | `/api/checks/{id}/pause` | Pause check |
| `POST` | `/api/checks/{id}/resume` | Resume check |
| `POST` | `/api/checks/{id}/answer` | Answer mid-check question |
| `GET` | `/api/events/{id}` | List events |
| `POST` | `/api/events/emit` | Emit event (proxy) |
| `POST` | `/api/tools/detect-ai` | AI detection (URL) |
| `POST` | `/api/tools/detect-ai-text` | AI detection (text) |
| `POST` | `/api/tools/check-plagiarism` | Plagiarism (URL) |
| `POST` | `/api/tools/check-plagiarism-text` | Plagiarism (text) |
| `POST` | `/api/tools/detect-ai-image` | AI image (URL) |
| `POST` | `/api/tools/detect-ai-image-upload` | AI image (upload) |
| `POST` | `/api/test/emit/{id}` | Test event emission (debug only) |

---

## 16. File Index

### Python Engine (`engine/`)

```
engine/
├── __init__.py                     # Package marker
├── main.py                         # CLI entry point (Typer app)
├── logging_config.py               # Centralized logging setup
├── agents/
│   ├── __init__.py
│   ├── base.py                     # BaseAgent, AgentConfig, ModelRouter, AgentState
│   ├── director.py                 # DirectorAgent, VeritasHarness
│   ├── manager.py                  # ManagerAgent (orchestration, verdict synthesis)
│   ├── intern.py                   # InternAgent (evidence gathering)
│   ├── parallel.py                 # ParallelInternPool (concurrent execution)
│   └── kg_processor.py            # KGProcessor (evidence → knowledge graph)
├── tools/
│   ├── __init__.py
│   ├── web_search.py              # WebSearchTool (SERP + scraping)
│   ├── bright_data.py             # BrightDataClient (low-level Bright Data API)
│   └── academic_search.py         # AcademicSearchTool (Semantic Scholar + arXiv)
├── models/
│   ├── __init__.py
│   ├── evidence.py                # CheckSession, Evidence, SubClaim, Verdict, etc.
│   └── findings.py                # AgentMessage, AgentRole (re-exports)
├── knowledge/
│   ├── __init__.py                # Module exports
│   ├── graph.py                   # IncrementalKnowledgeGraph
│   ├── store.py                   # HybridKnowledgeGraphStore (SQLite+NetworkX)
│   ├── query.py                   # ManagerQueryInterface
│   ├── models.py                  # Entity, Relation, KGFinding, Contradiction
│   ├── fast_ner.py                # FastNER (spaCy NER)
│   ├── credibility.py             # CredibilityScorer
│   └── visualize.py               # KnowledgeGraphVisualizer
├── retrieval/
│   ├── __init__.py                # Module exports + backward-compat aliases
│   ├── embeddings.py              # EmbeddingService (BGE)
│   ├── vectorstore.py             # VectorStore (ChromaDB)
│   ├── bm25.py                    # BM25Index (lexical search)
│   ├── hybrid.py                  # HybridRetriever (RRF fusion)
│   ├── reranker.py                # Reranker, LightweightReranker
│   ├── evidence.py                # EvidenceRetriever
│   ├── deduplication.py           # EvidenceDeduplicator (MinHash/LSH)
│   ├── query_expansion.py         # QueryExpander
│   └── memory_integration.py      # SemanticMemoryStore
├── verification/
│   ├── __init__.py                # Module exports
│   ├── cove.py                    # ChainOfVerification
│   ├── critic.py                  # CRITICVerifier, HighStakesDetector
│   ├── hhem.py                    # HHEMScorer
│   ├── confidence.py              # ConfidenceCalibrator
│   ├── pipeline.py                # VerificationPipeline
│   ├── metrics.py                 # VerificationMetricsTracker
│   ├── models.py                  # VerificationConfig, VerificationResult, etc.
│   └── json_utils.py              # JSON parsing utilities
├── storage/
│   ├── __init__.py
│   └── database.py                # VeritasDatabase (SQLite, connection pool, WAL)
├── events/
│   └── __init__.py                # Event emission (emit_thinking, emit_action, etc.)
├── interaction/
│   ├── __init__.py
│   ├── config.py                  # InteractionConfig
│   ├── handler.py                 # UserInteraction
│   ├── listener.py                # InputListener (stdin)
│   └── models.py                  # ClarificationQuestion, ClarifiedGoal, etc.
├── reports/
│   ├── __init__.py
│   └── writer.py                  # VerdictReportWriter (Opus + extended thinking)
├── memory/
│   ├── __init__.py
│   ├── hybrid.py                  # HybridMemory (rolling window + summarization)
│   └── external.py                # ExternalMemoryStore (persistent SQLite)
├── costs/
│   ├── __init__.py
│   └── tracker.py                 # CostTracker, ModelPricing, CostSummary
└── audit/
    ├── __init__.py
    └── decision_logger.py         # DecisionLogger, DecisionType
```

### API Backend (`api/`)

```
api/
├── __init__.py
├── server.py                      # FastAPI app, middleware, WebSocket, lifespan
├── db.py                          # APIDatabase (wraps VeritasDatabase)
├── events.py                      # EventEmitter (singleton, WebSocket broadcast)
├── models.py                      # HealthResponse, CheckSessionCreate/Response
├── kg.py                          # Knowledge graph API helpers
└── routes/
    ├── __init__.py
    ├── sessions.py                # CRUD for check sessions
    ├── checks.py                  # Fact-check execution (start/pause/resume/stop)
    ├── evidence.py                # Evidence and source listing
    ├── events.py                  # Event persistence and proxy
    ├── report.py                  # Report retrieval
    ├── knowledge.py               # Knowledge graph data
    ├── verification.py            # Verification results and stats
    ├── agents.py                  # Agent decision audit trail
    └── tools.py                   # AI detection, plagiarism checking, image analysis
```

### Next.js Frontend (`src/`)

```
src/
├── app/
│   ├── layout.tsx                 # Root layout (fonts, metadata)
│   ├── globals.css                # Global styles and theme
│   ├── page.tsx                   # Landing page
│   ├── api/route.ts               # API route (proxy/health)
│   ├── dashboard/page.tsx         # Dashboard (session list + new check form)
│   ├── check/[id]/
│   │   ├── page.tsx               # Check detail (evidence, report, activity)
│   │   ├── sources/page.tsx       # Sources browser with credibility
│   │   ├── graph/page.tsx         # Knowledge graph visualization
│   │   ├── verify/page.tsx        # Verification pipeline details
│   │   └── agents/page.tsx        # Agent decision audit trail
│   └── tools/
│       ├── ai-detector/page.tsx   # AI content detection tool
│       ├── image-detector/page.tsx # AI image detection tool
│       └── plagiarism/page.tsx    # Plagiarism checker tool
├── components/
│   ├── activity-feed.tsx          # Real-time agent event stream
│   ├── evidence-browser.tsx       # Evidence list with filters
│   ├── sources-browser.tsx        # Source index with credibility
│   ├── new-check-form.tsx         # New fact-check form
│   ├── question-modal.tsx         # Mid-check question modal
│   ├── report-preview.tsx         # Markdown report renderer
│   ├── verdict-badge.tsx          # Color-coded verdict badge
│   ├── landing/
│   │   ├── hero.tsx               # Landing hero section
│   │   ├── process.tsx            # How-it-works section
│   │   ├── nav.tsx                # Navigation bar
│   │   └── footer.tsx             # Footer
│   └── ui/                        # 50+ shadcn/ui components
├── hooks/
│   └── use-mobile.ts              # Mobile breakpoint hook
└── lib/
    ├── api.ts                     # REST API client functions
    ├── websocket.ts               # WebSocket client class
    ├── utils.ts                   # cn() class merge utility
    └── prisma.ts                  # Prisma client init
```

### Root Configuration Files

```
meridian/
├── pyproject.toml                 # Python build config + dependencies
├── package.json                   # Node.js dependencies + scripts
├── tsconfig.json                  # TypeScript configuration
├── next.config.ts                 # Next.js configuration
├── next-env.d.ts                  # Next.js type declarations
├── components.json                # shadcn/ui configuration
├── prisma.config.ts               # Prisma configuration
├── prisma/schema.prisma           # PostgreSQL schema (scaffolding)
├── CLAUDE.md                      # AI assistant instructions
├── README.md                      # Project readme
└── .env.example                   # Environment variable template
```

---

*Generated from codebase analysis on 2026-04-10. This documentation covers the complete Meridian project including all Python engine modules, FastAPI backend routes, Next.js frontend pages, data models, database schema, and configuration.*
