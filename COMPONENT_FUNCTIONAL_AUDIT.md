# Component Functional Audit

## Rubric
- 5/5: Critical business function, actively wired, and resilient under failure.
- 4/5: High-value feature component with clear runtime impact and good UX behavior.
- 3/5: Functional baseline component that serves a valid purpose but has limited leverage.
- 2/5: Weak/partially wired component with low practical impact.
- 1/5: Unused or effectively non-functional in live flows.

## Scope
- Assessed custom app components in `src/components/**` excluding generated `src/components/ui/**` primitives.
- Threshold rule applied: any component below 3/5 was rebuilt.

## Results
| Component | Functional use justification | Score | Action |
|---|---|---:|---|
| `EmptyStateGuide` | Primary empty-state onboarding surface with embedded quick add path. | 4/5 | Keep |
| `ErrorBoundary` | Route-level crash containment and chunk-load recovery path; prevents total app failure. | 5/5 | Keep |
| `ProtectedRoute` | Auth gate for private routes with loading state and redirect preservation. | 5/5 | Keep |
| `QuickAddBar` | Fast ingestion path from pasted URLs; enrichment + save workflow. | 5/5 | Keep |
| `bookmarks/CompletionSheet` | Captures post-watch rating/review metadata; drives engagement and data quality. | 4/5 | Keep |
| `bookmarks/ConfirmMetadataDialog` | Human verification step for enrichment confidence and manual correction. | 5/5 | Keep |
| `bookmarks/PosterCard` | Core interaction unit for watch actions, status cycling, scheduling, and detail navigation. | 5/5 | Keep |
| `bookmarks/Rail` | Reusable horizontal grouping shell that structures dashboard content by context. | 4/5 | Keep |
| `dashboard/BulkActionBar` | Batch operation control surface for delete/done/plan workflows. | 4/5 | Keep |
| `dashboard/FilterChips` | Primary quick-filter UX for status/type segmentation. | 4/5 | Keep |
| `dashboard/FilterPanel` | Advanced filtering by provider/mood/runtime for narrowing large watchlists. | 3/5 | Keep |
| `dashboard/MoodPicker` | Fast mood filtering control. Previously unused; now wired into dashboard filtering. | 4/5 | Rebuilt |
| `dashboard/StatsBar` | At-a-glance status metrics with click-to-filter behavior. Previously unused; now wired. | 4/5 | Rebuilt |
| `layout/AppLayout` | Shared authenticated shell (nav + search overlay + unread badge data wiring). | 4/5 | Keep |
| `layout/BottomNav` | Mobile-first route/action access for core pages. | 4/5 | Keep |
| `layout/HeroBanner` | High-visibility contextual hero with watch/more-info actions for active item. | 4/5 | Keep |
| `layout/PageTransition` | Route transition polish wrapper; low complexity but valid UX role. | 3/5 | Keep |
| `layout/TopNav` | Main global navigation, search trigger, quick-add entry, profile/logout controls. | 5/5 | Keep |
| `onboarding/DashboardTour` | First-run education flow for feature discovery and activation. | 3/5 | Keep |
| `plans/SortableBookmarkRow` | Drag/reorder row with remove action in plan editing workflows. | 4/5 | Keep |
| `schedules/QuickScheduleSheet` | Fast schedule flow from cards/new bookmark with quick presets. | 4/5 | Keep |
| `schedules/ScheduleDialog` | Full schedule configuration (date/time/reminder/recurrence) with rollback logic. | 4/5 | Keep |
| `search/SearchOverlay` | Global in-app search UX with keyboard navigation and quick open-to-detail flow. | 4/5 | Keep |

## Rebuild details
- `dashboard/StatsBar` was raised from 1/5 (unused) to 4/5 by integrating it into `Dashboard` as live metrics + status filtering.
- `dashboard/MoodPicker` was raised from 1/5 (unused) to 4/5 by integrating it into `Dashboard` as a quick mood filter that contributes to active filtering state.

## Validation
- Build verification passed: `npm run build`.
