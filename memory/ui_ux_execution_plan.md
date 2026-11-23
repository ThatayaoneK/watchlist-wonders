# UI/UX Execution Plan

## Goal
Make WatchMarks feel like a personal memory index:
save instantly, retrieve instantly, act instantly.

## Priority 1: Capture (Share-To-Save)
1. Default behavior: one-step save when enrichment confidence is high.
2. Confirmation dialog only for low-confidence or blocked metadata cases.
3. Show provider and completion feedback quickly ("Saved to your list").
4. Keep manual edit flow available as fallback, not primary path.

Acceptance criteria:
1. High-confidence share links are saved without extra form interaction.
2. Failed enrichment still lands in manual-save fallback in one tap.

## Priority 2: Retrieval (Saved-First)
1. Search indexes title, provider, type, tags, and mood tags.
2. Saved results always render before fallback section.
3. When query is empty, show quick intent chips to reduce blank-state friction.
4. Make section labels explicit: "From your list" and "Not in your list."

Acceptance criteria:
1. Querying genre terms (e.g. "anime") returns relevant saved items when tags exist.
2. Fallback block never appears above saved results.

## Priority 3: Intent Entry
1. Keep "What do you feel like?" near top of dashboard.
2. Make one-tap mood filtering produce immediate list changes.
3. Empty mood states must suggest quick next action ("Save from anywhere").

Acceptance criteria:
1. User can move from dashboard open to filtered list in one tap.

## Priority 4: Action Completion
1. Every surfaced card should offer clear "watch now" or equivalent action.
2. If item cannot be watched directly, show schedule/save alternatives.

Acceptance criteria:
1. No primary card surface ends in dead state without action CTA.
