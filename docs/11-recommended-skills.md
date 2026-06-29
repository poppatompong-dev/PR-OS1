# Recommended Skills For This Project

This file records the agent skills and working modes that fit PR-OS. It is meant for future Codex/agent sessions and for programmers who want to keep the work organized.

## Requirements And Discovery

- `grill-me`: one-question-at-a-time requirement refinement
- `brainstorming`: explore alternatives before locking architecture
- `grill-with-docs`: review requirements against existing documents
- `summarize-interview`: turn interview audio/transcript into structured requirements

## Documentation And Product Spec

- `to-prd`: synthesize conversation context into a PRD
- `documents`: work with Word/PDF style handoff artifacts
- `writing-plans`: create implementation plans for programmers
- Candidate from skill registry: `addyosmani/agent-skills@documentation-and-adrs`

## UX/UI And Prototype

- `prototype`: build throwaway mock screens or logic prototypes
- `ui-ux-pro-max`: polish operational UI
- `product-design:index`: structure product design decisions
- `build-web-apps:frontend-app-builder`: build app UI when implementation starts
- `build-web-apps:react-best-practices`: keep React/Next.js components maintainable

Registry search on 29 June 2026 found additional UI redesign/design-system skills, but the install counts were low compared with the already available local skills. Do not install them automatically unless a future developer reviews the source quality first.

## Luxury, Premium Feel, And Motion

- `ui-ux-pro-max`: primary local skill for premium visual polish, accessibility, spacing, responsive behavior, and interaction quality
- `product-design:ideate`: use before redesigning a major screen so the luxury direction still fits real user workflows
- `product-design:audit`: use after redesign to check whether the interface feels premium without hurting usability
- `creative-production:moodboard-explorer`: use when the team needs a visual moodboard or art-direction options before UI work
- `figma:figma-generate-design`: use when the team wants an editable Figma direction based on the PR-OS visual prompt
- Registry candidate: `kylezantos/design-motion-principles@design-motion-principles` for purposeful motion, anti-AI-slop animation review, accessibility, and performance checks
- Registry candidate: `bergside/awesome-design-skills@luxury` for luxury-oriented styling vocabulary; treat as optional because the specific skill has a modest install count
- Optional external design-system source: TypeUI design skills and MCP can be used to create a PR-OS-specific visual direction, compare layout variations, and keep Codex output consistent before implementation. Keep this documented only for now; do not install or connect it directly until the project owner confirms.

Current recommendation: install `design-motion-principles` first if more external help is needed. Keep `luxury` as a reviewed optional add-on rather than a default dependency.

## Next.js And Frontend

- `build-web-apps:frontend-app-builder`
- `build-web-apps:frontend-testing-debugging`
- `build-web-apps:react-best-practices`
- Candidate from skill registry: `wshobson/agents@nextjs-app-router-patterns`

## Database And Supabase

- `supabase:supabase`
- `supabase:supabase-postgres-best-practices`
- `build-web-apps:supabase-postgres-best-practices`

## Reporting And KPI

- `data-analytics:design-kpis`
- `data-analytics:build-report`
- `data-analytics:build-dashboard`
- `data-analytics:kpi-reporting`

## Security

- `codex-security:threat-model`
- `codex-security:security-scan`
- `codex-security:security-diff-scan`

## Testing And Verification

- `playwright`
- `build-web-apps:frontend-testing-debugging`
- `test-driven-development`
- `verification-before-completion`

## Suggested Order For Future Agent Work

1. Use `grill-with-docs` to compare new requests against the handoff docs
2. Use `writing-plans` for each major subsystem before code changes
3. Use `supabase-postgres-best-practices` before schema/RLS work
4. Use `frontend-app-builder` and `react-best-practices` during UI implementation
5. Use `codex-security:threat-model` before pilot launch
6. Use `verification-before-completion` before declaring a build ready
