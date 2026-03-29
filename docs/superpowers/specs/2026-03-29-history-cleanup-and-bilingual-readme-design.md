# History Cleanup And Bilingual README Design

## Goal

Clean up the repository's recent default-branch history into a short, high-signal commit sequence, and rewrite the README so GitHub presents Chinese content first while still allowing readers to jump to a full English version inside the same file.

## Current Problems

- The current default-branch history contains many low-signal incremental commits such as `fix`, `test`, `refactor`, and branch-merge artifacts.
- The GitHub commit list is difficult to scan because implementation, cleanup, review fixes, and documentation are interleaved.
- The current README is English-first, which does not match the user's desired primary audience.
- The README currently has no explicit Chinese-first / English-switch structure.
- Security-sensitive configuration examples need to stay descriptive without becoming copy-paste credential material.

## Product Decision

Chosen direction:

- rewrite the recent default-branch history into a short curated sequence,
- preserve the current code state as the source of truth,
- rewrite the README into a single-file bilingual document,
- make Chinese the default visible documentation,
- provide a clear in-file switch to English via anchor navigation,
- keep commands, file paths, API names, and config keys in their original literal form.

## Scope

This project has two linked but distinct deliverables:

1. repository history cleanup,
2. README restructuring and translation.

They are linked because the final cleaned history should present the README rewrite as one of the high-signal commits rather than leaving it as a small follow-up patch on a noisy branch.

## Desired Outcome

### 1. Git History

The remote default branch should end up with a short linear history that reflects meaningful product milestones instead of review-by-review noise.

Recommended final shape:

1. `feat: stabilize multi-model workspace experience`
2. `feat: make friend bootstrap explicit and gate chat on usable friends`
3. `docs: rewrite README with Chinese-first bilingual navigation`

This structure keeps one commit for the broader workspace baseline, one for the friend/bootstrap/chat behavior correction, and one for documentation.

### 2. README Presentation

The repository homepage should open with Chinese content first.

- A short language navigation block appears near the top.
- Chinese sections come first.
- English sections live in the same file and are reachable through anchors.
- The English content should be complete enough for non-Chinese readers, not just a short summary.

## Recommended README Structure

### Top Navigation

Add a compact navigation block near the top, for example:

- `中文`
- `English`

These should link to the Chinese and English anchors inside the same document.

### Chinese Section First

The first full content section should be Chinese and cover:

- product overview,
- key capabilities,
- page overview,
- run commands,
- password gate configuration,
- local model bootstrap,
- build/test commands,
- architecture,
- backend API,
- data storage,
- deploy notes,
- implementation notes.

### English Section Second

The English section should mirror the Chinese section structure closely so the file stays maintainable.

It does not need to be literal sentence-by-sentence duplication, but the information hierarchy should remain aligned.

## Security And Documentation Rules

- Do not include a real password, real hash, or a commonly copied weak example as a fixed config value.
- Keep examples as placeholders such as `<md5-hash>`.
- Keep the warning not to commit actively used password hashes.
- Do not introduce deployment examples that look like valid secrets.

## Implementation Strategy

### History Rewrite Strategy

Do not try to salvage the current recent history through a large interactive rebase in the user's dirty main workspace.

Instead:

- use an isolated workspace,
- treat the current verified code state as the content baseline,
- reconstruct a clean commit sequence intentionally,
- verify the rebuilt branch,
- then force-push it to the remote default branch.

This reduces conflict risk and avoids mixing the user's unrelated uncommitted changes into the rewrite.

### README Rewrite Strategy

- keep a single `README.md`,
- add language anchors and navigation,
- place Chinese first,
- place English second,
- preserve literal commands and identifiers,
- keep the document concise enough for GitHub browsing while still complete.

## Verification

Before the rewritten history is pushed:

- run `npm test`,
- run `npm run build`,
- confirm the final commit sequence matches the intended three-commit shape,
- confirm `README.md` renders as Chinese-first and contains working anchor navigation to English.

After pushing:

- confirm remote `main` points to the rebuilt head,
- confirm GitHub default-branch history shows the cleaned commit sequence.

## Scope Boundaries

Included:

- rewriting recent default-branch history,
- force-pushing remote `main`,
- rewriting `README.md` into Chinese-first bilingual form,
- preserving secure placeholder-based auth documentation.

Not included:

- changing product behavior,
- refactoring unrelated source files,
- splitting README into multiple files unless the approved design changes,
- preserving the exact old commit SHAs.

## Risks

- Remote history rewrite is destructive for anyone depending on the current `main` commit graph.
- Any collaborator with an older clone will need to reset or re-sync after the force push.
- A dirty local main workspace must not be used as the rewrite surface.

These risks are accepted because the user explicitly requested history cleanup on both the local and GitHub sides.
