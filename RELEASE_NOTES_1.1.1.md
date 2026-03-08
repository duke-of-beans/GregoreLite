# GregLite v1.1.1 — Patch Release
**Release date:** March 8, 2026
**Type:** Patch — UX overhaul + production stability

## What's New

### Onboarding & Tour
- Welcome tour expanded from 8 to 10 steps — covers Transit Map and Projects
- Onboarding wizard gains a 5th step: "Connect your work" with project folder
  picker and import path
- Tour selectors fixed — all steps now correctly highlight their target elements

### Navigation & Settings
- Settings panel redesigned as a full-window centered modal (was a cramped 400px
  right drawer) with two-column layout and icon sidebar
- Collapsed status bar now shows a visible "▲ System Status" bar — was an
  invisible 6px strip

### Contextual Help
- New HelpPopover component — inline ? buttons throughout the app explain what
  each section does in plain English
- SUGGESTION ARCHIVE panel (formerly Context Library) now has a solid background
  and subtitle explaining its purpose

### Bug Fixes
- Fixed: Projects panel crash on fresh install ("no such table: portfolio_projects")
- Fixed: "Internal Server Error" on first launch in dev mode (isTauri() localhost fix)

## Upgrade Notes
Drop-in patch over v1.1.0. No data migration needed. DB fix runs automatically on first launch.
