# PromptIQ Enterprise

**Tagline:** Make Every Prompt Count

**Version:** 2.0
**Purpose:** AI Prompt Engineering Workspace
**Design Reference:** [Google Stitch Project](https://stitch.withgoogle.com/projects/4564006644176163028)

## 1. Product Overview

PromptIQ is a prompt engineering workspace that helps users evaluate, improve, compare, save, and reuse AI prompts.

The application must provide a polished, professional experience suitable for a technical product demonstration.

### Core Workflow

Write Prompt → Evaluate → Review Feedback → Improve → Compare → Save → Reuse

## 2. Technology Stack

* React with Vite
* TypeScript
* Tailwind CSS
* shadcn/ui where appropriate
* Lucide React icons
* React Router
* Zustand for shared application state
* LocalStorage for persistence
* Native Fetch API for Ollama integration
* Vercel for frontend deployment

**Architecture:** Frontend-only application. No separate Express backend, paid AI APIs, login system, or mandatory cloud database.

## 3. Design System

Follow the existing Stitch design as the primary visual reference.

Design style: Warm Architectural Editorial.

* Background: `#FAF9F6`
* Primary text: `#242620`
* Primary accent: `#356B50`
* Card surfaces: `#FFFFFF`

Use restrained typography, clean layouts, consistent spacing, subtle borders, and horizontal score indicators.

Avoid dark themes, neon colors, excessive gradients, glassmorphism, glowing effects, robot illustrations, and generic AI dashboard designs.

The application must be responsive, accessible, and visually consistent across all pages.

## 4. Application Pages

### A. Overview — `/`

* Prompt editor with title and content.
* Word, character, and estimated token counts.
* Ollama model selector.
* Evaluate Prompt and Save to Library actions.
* Quick-start templates for email writing, document summarisation, and information analysis.
* Recent evaluation history with scores and status indicators.

### B. Evaluator — `/evaluator`

Evaluate prompts across five dimensions:

| Dimension           | Weight |
| ------------------- | -----: |
| Clarity             |    25% |
| Context             |    20% |
| Specificity         |    20% |
| Constraints         |    20% |
| Output Expectations |    15% |

Each dimension receives a score from 0 to 10.

The application calculates the weighted overall score.

Display an executive assessment, strengths, weaknesses, actionable recommendations, and horizontal score meters.

Actions: Improve Prompt, Save, Copy Report, and Export Markdown.

### C. Compare — `/compare`

Display original and improved prompts side by side.

Include:

* Original and improved scores.
* Word and estimated token counts.
* Score differences.
* Actual structural changes.
* Copy, edit, save, and export actions.

Do not invent benchmark results or claim unsupported determinism improvements.

### D. Prompt Lab — `/lab`

Provide a dedicated prompt editor with model selection, live counters, evaluation, improvement, and saving.

Support loading prompts from other pages.

### E. My Prompts — `/prompts`

Provide a persistent prompt library with:

* Search and category filters.
* Sorting.
* Create, edit, duplicate, and delete actions.
* Run in Evaluator.
* Open in Prompt Lab.
* JSON import and export.

Categories:
Engineering, Product & Strategy, Customer Success, Security & Compliance.

Store prompt data locally using LocalStorage.

### F. Templates — `/templates`

Provide reusable templates for:

* Email Writing
* Document Summarisation
* Meeting Notes
* Report Generation
* SQL Assistance
* Technical Documentation

Support previewing templates, filling variables, editing generated prompts, and saving them.

### G. Settings

Include:

* Ollama server URL.
* Connection testing.
* Available model discovery.
* Model selection.
* Demo Mode.
* Local data management.

Default Ollama URL: `http://localhost:11434`.

## 5. Ollama Integration

Communicate directly with Ollama using HTTP requests.

Endpoints:

* `GET /api/tags` — Discover installed models.
* `POST /api/chat` — Evaluate and improve prompts.

Use the selected model rather than hardcoding a particular model.

Implement connection status, loading states, response validation, error handling, and retry functionality.

Calculate the weighted evaluation score in application code rather than trusting the model's overall score.

The deployed frontend may encounter browser security, CORS, HTTPS, and local-network restrictions when connecting to Ollama. Handle these failures clearly.

## 6. Demo Mode

The application must remain demonstrable without a running Ollama instance.

Provide sample prompts, clearly labeled example
