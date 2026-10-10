# Live Local Model Integration Plan — PromptIQ Enterprise

## Goal
Make every feature of PromptIQ work end-to-end with a **local Ollama instance** (no demo mode), while preserving demo mode as an optional fallback and improving the first-run bootstrap experience so users can go from zero to a live evaluation in under 60 seconds.

---

## Executive Gaps Found

| # | Severity | Issue | Why it matters |
|---|----------|-------|----------------|
| 1 | 🔴 CRITICAL | **PromptEditor ↔ Lab state is silently disconnected.** The Lab maintains `currentDraft` but PromptEditor owns internal `title`/`content`. Typed edits in PromptEditor never reach `currentDraft`, so `handleEvaluate`/`handleImprove` send **stale or empty** prompt content to Ollama. User sees "Evaluation complete" but it ran on `''`. | This is the #1 reason live mode "doesn't work" even when Ollama is correctly configured. |
| 2 | 🟡 HIGH | **No first-run onboarding.** A new user launching the app with `demoMode=false` (the default) lands on Overview with zero guidance: Start Ollama? Pull a model? Select a model? No in-app prompts explain this. | Users can't bootstrap without reading an external README. |
| 3 | 🟡 HIGH | **Global status doesn't surface broken live mode.** TopNav's "Live Mode" pill stays green even when `connectionStatus=disconnected` or `selectedModel=''`. The user has no way to know their next Evaluate button will fail until they press it. | Silent failure state. |
| 4 | 🟠 MEDIUM | **Compare page has inline error recovery.** When "Evaluate Improved" fails on the Compare page, only a toast is shown — no inline error card with Retry/Open Settings CTAs like Evaluator and Lab have. | Inconsistent UX. |
| 5 | 🟠 MEDIUM | **Model list populated but nothing auto-selected.** After clicking "Discover Models" the user sees a list, then must explicitly click one. If they return to Evaluator without clicking, evaluation fails. | Small friction, but blocks first-run flow. |
| 6 | 🟢 LOW | **Evaluator uses its own raw textarea** instead of the shared `PromptEditor` component, missing: category field, autosave, and consistent counter layout. | Not a correctness bug, but a consistency/maintainability concern. |

---

## Execution Plan (5 Tasks)

### Task 1 — Fix the PromptEditor ↔ Parent state contract (fixes Gap #1)

**Files:**
- `src/components/ui/PromptEditor.tsx`
- `src/pages/Lab.tsx`

**Changes:**

1.1 In **PromptEditor**, expose the current editor state outwards:
- Add new optional props: `controlledTitle?`, `controlledContent?`, `onChangeTitle?`, `onChangeContent?`, `onChangeDraft?: (draft: {title:string; content:string}) => void`.
- When `onChangeDraft` is provided, fire it (throttled via existing 400ms debounce, or immediately on textarea/input `onChange`) inside the existing `setTitle`/`setContent` effects/handlers so the parent always has the latest values.
- **Alternative (simpler):** Change `onEvaluate` and `onImprove` signatures to `onEvaluate?: (draft: {title:string; content:string}) => void` and `onImprove?: (draft: {title:string; content:string}) => void`. PromptEditor calls them with **its own internal state** when clicked. This removes the need for parents to mirror state entirely.

1.2 In **Lab.tsx**, adopt the new contract:
- Remove `<DraftMirror>` entirely (lines 429-448 plus the hidden `<input type="hidden">` block lines 198-203).
- Rewrite `handleEvaluate` and `handleImprove` to accept a `{title, content}` draft passed from PromptEditor instead of reading `currentDraft`.
- Keep `currentDraft` only for: (a) pre-filling the editor when a `promptId` URL param exists, (b) powering the "Copy prompt content" button. Pass `initialTitle`/`initialContent` to PromptEditor so it starts correctly.

1.3 Confirm no regressions in **Evaluator.tsx** and **Overview.tsx** Quick Draft section (they don't depend on PromptEditor's internal state, so they're unaffected by the signature additions).

**Verification:** Run `npm run lint`. Then manually: type a prompt into Lab → click Evaluate → confirm the content sent to Ollama (in Network tab / console.log) matches exactly what was typed.

---

### Task 2 — First-run Setup Onboarding Panel (fixes Gap #2)

**Files:**
- `src/pages/Overview.tsx`
- Possibly a new reusable component under `components/ui/SetupChecklist.tsx` or inline

**Changes:**

2.1 On Overview, **conditionally replace the Quick Draft + Templates section** with a Setup Checklist card when ALL of these are true:
- `demoMode === false`
- Either: `connectionStatus !== 'connected'`, OR `selectedModel === ''`, OR `models.length === 0`
- AND: total evaluations + improvements === 0 (genuinely first run)

2.2 The checklist shows 4 numbered steps with visual "done/pending" states:

| Step | Label | Auto-detect done when | Action CTA |
|------|-------|----------------------|------------|
| 1 | Start Ollama locally | `connectionStatus !== 'disconnected'` after a test call | Link to docs: run `ollama serve` |
| 2 | Test the connection | `connectionStatus === 'connected'` | Button "Test Connection" → calls `testOllamaConnection()` |
| 3 | Install a model | `models.length > 0` after discovery | Info card telling user to run `ollama pull llama3.2`; Button "Scan for installed models" → `discoverModels()` |
| 4 | Select a default model | `selectedModel` is non-empty | Inline select dropdown rendering `models` list |

2.3 When all 4 are complete, show a green "You're all set. Start prompting!" card + button that navigates to `/lab`.

2.4 The existing Quick Draft + Templates render normally whenever the checklist is not shown (i.e., already set up, or demo mode on).

**Verification:** Wipe localStorage, refresh app with demoMode=false → see checklist. Complete each step, watch states flip. After step 4, see "All set".

---

### Task 3 — Live Mode Status Pill / Global Connection Indicator (fixes Gap #3)

**Files:**
- `src/components/layout/TopNav.tsx`
- `src/components/layout/navConfig.ts` (if needed, probably not)

**Changes:**

3.1 Replace the current simple "Demo Mode / Live Mode" pill with a tri-state indicator, while still using the same chip visual:

| State | Pill label + color | Click behavior |
|-------|--------------------|----------------|
| demoMode=true | Demo Mode · accent (unchanged) | No-op |
| demoMode=false + connected + selectedModel ✓ | **Live · `<model-name>`** · muted/ink (like current Live, but shows model) | Navigate to `/settings` |
| demoMode=false + (disconnected OR no model) | **⚠ Live Setup needed** · score-fair/orange border | Navigate to `/settings` and open Settings |

3.2 On hover, show a tooltip (or title attribute, minimally) with concise text like "Ollama disconnected" / "No model selected" etc.

3.3 Sidebar's nav items are NOT disabled when setup is incomplete — users can still browse pages; they'll see the page-level error states.

**Verification:** Toggle connection + model states, watch pill update correctly. Click the pill → navigates to Settings.

---

### Task 4 — Inline Error + Retry in Compare Page (fixes Gap #4)

**Files:**
- `src/pages/Compare.tsx`

**Changes:**

4.1 Add a local `error: OllamaError | null` state.

4.2 In `evaluateImproved()`, on catch populate `setError(e)` in addition to the toast.

4.3 Insert an inline error card (same visual style as Evaluator `error` block) above the comparison grid when `error` is not null. Include:
- AlertTriangle icon, title "Failed to evaluate improved prompt", `error.message`, `error.guidance` when present.
- Buttons: "Retry" (re-calls `evaluateImproved`) and "Open Settings" (navigate `/settings`).
- A dismiss / clear error button.

4.4 Similarly, if the user arrives on Compare with `demoMode=false` + `!selectedModel` + no existing comparison content, show an amber chip/message in the empty-state saying "Select a model in Settings first" (inline on EmptyCompareState, not replacing it entirely).

**Verification:** Simulate failure (kill Ollama mid-session), click "Evaluate Improved" → see inline error. Retry after re-launching Ollama → succeeds and error clears.

---

### Task 5 — Auto-select first discovered model + sanity improvements (fixes Gap #5)

**Files:**
- `src/store/usePromptStore.ts`
- `src/components/ui/ModelSelector.tsx` (optional, minor polish)
- `src/pages/Settings.tsx` (optional, minor polish)

**Changes:**

5.1 In **usePromptStore `discoverModels`**, after successfully loading the models list:
- If `settings.ollama.selectedModel` is still empty AND `models.length > 0`, call `setSelectedModel(models[0].name)` automatically.
- Emit a toast: `info` "Auto-selected `<model name>` as the default. Change it anytime in Settings."

5.2 Guard against overwriting an already-selected model (only auto-select when previously empty).

5.3 (Minor polish) In **ModelSelector**, when dropdown is showing the "Select a model…" placeholder with non-empty `models`, add a subtle hint row beneath: "Tip: first model was auto-selected for you." or similar (only if auto-select actually fired — we can detect via selectedModel being equal to models[0] and no prior selection existed; simplest: skip this, the toast is enough).

5.4 (Minor polish) In **Settings** after a successful Test Connection with 0 models discovered, surface a stronger hint with a copy-pasteable `ollama pull llama3.2` snippet + Copy button.

**Verification:** Clear storage → set demoMode=false → first discoverModels call → first model is selected automatically and toast appears. Re-discover → existing selection preserved.

---

### Optional Task 6 (out of scope unless requested) — Refactor Evaluator to use PromptEditor

Fixes Gap #6. Would replace Evaluator's standalone `<textarea>` + `<input>` + `<ModelSelector>` with a single `<PromptEditor>`, wiring `onEvaluate` to use the draft callback added in Task 1. Low risk but changes tested UI — defer until after Tasks 1–5 are verified.

---

## Order of Execution

1. **Task 1 (Critical)** — Fix the broken state pipeline. Nothing "works live" without this.
2. **Task 5 (Friction)** — Auto-select the first model so Task 2's checklist flows cleanly.
3. **Task 3 (Awareness)** — Global status pill reflects reality at all times.
4. **Task 2 (Onboarding)** — New users guided through setup on Overview.
5. **Task 4 (Consistency)** — Inline errors on Compare page match Evaluator/Lab standard.

## Acceptance Criteria (end state)

- [ ] A brand-new user, on a machine with Ollama running + `llama3.2` pulled, can open the app, complete the checklist on Overview, navigate to Lab, type a prompt, click **Evaluate**, and see a real 5-dimension scored result from their local model — **without** ever clicking into Settings or reading docs.
- [ ] Demo mode still works identically to current behavior and can be toggled on/off at any time in Settings.
- [ ] `npm run lint` (tsc --noEmit) passes 0 errors.
- [ ] Every `runEvaluate` / `runImprove` path (Lab, Evaluator, Compare → Evaluate Improved) handles failure with inline guidance + Retry + Open Settings CTAs.
- [ ] When setup is incomplete, the status pill at all times tells the user exactly what's missing.
