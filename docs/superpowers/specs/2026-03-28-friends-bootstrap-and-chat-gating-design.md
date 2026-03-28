# Friends Bootstrap And Chat Gating Design

## Goal

Keep the existing automatic friend generation model, but make the product flow explicit:

1. users configure base models first,
2. the app derives default AI friends from those models,
3. users customize friend role data such as display name, avatar, description, and `systemPrompt`,
4. chat only runs with valid, enabled, model-bound friends.

The intent is to remove the current product confusion where the Friends page feels disconnected from the actual prerequisites for group chat.

## Current Problems

- The app already has a two-layer structure: `models` as the capability layer and `friends` as the role layer.
- Default friends are auto-generated from models in both frontend and backend flows.
- That relationship is mostly implicit, so users do not understand why the Friends page may appear empty or incomplete.
- The Friends page currently behaves like a manual CRUD screen instead of a model-to-role management screen.
- The chat page checks for missing friends, but the guidance is too weak and does not clearly explain the prerequisite flow.
- The frontend bootstrap only covers the "no friends at all" case, not the "new model exists but no corresponding friend yet" case.

## Product Decision

Chosen direction: keep automatic generation, but make the flow visible and consistent.

This means:

- models remain the source of truth for capability,
- friends remain the editable role layer used by group chat,
- the app may auto-create default friends from models,
- the UI must clearly explain that relationship,
- chat must only consume valid friends that still bind to a usable model.

## Desired User Flow

### 1. Settings Page

The Settings page remains the base model configuration layer.

- Users configure provider, model ID, base URL, API key, and enable/disable state here.
- Copy should make it clear that configured models become the source for available AI friends.
- Saving or adding a model does not expose that model directly in chat as a raw model; it feeds the friend layer.

### 2. Friends Page

The Friends page becomes the model-derived role management layer.

- The page explains that AI friends come from configured models.
- Existing default friends continue to be generated from models.
- Users can customize each friend's display name, avatar, description, and `systemPrompt` without losing the model binding.
- If a model exists without a corresponding friend profile, the page must show a visible sync state and provide a sync action.
- "Add Friend" remains allowed, but its meaning becomes "add a custom role bound to a model", not "create an unbound chat participant".

### 3. Chat Page

The chat page becomes a strict consumer of valid friend roles.

- It only lists friends that are enabled and bound to a valid model configuration.
- If no usable friends exist, the page must tell the user exactly what to do next: configure models in `settings.html`, then review or sync roles in `friends.html`.
- Group settings, member selection, and synthesis selection all operate on the filtered set of usable friends.

## Functional Rules

### Model To Friend Mapping

- Default mapping stays `one model -> one default friend`.
- Default friend IDs continue to use the existing `friend-${model.id}` pattern where possible.
- A friend is considered model-bound when `modelConfigId` resolves to an existing model.

### Sync Rules

Introduce a reusable sync operation that works in both frontend normalization and backend normalization.

When syncing:

- If a model exists and its default friend does not exist, create that default friend.
- If a default friend already exists, keep user-customized fields intact.
- If a model has been removed, any friend still referencing it is not auto-deleted.
- Invalid friends remain editable in the Friends page so the user can rebind or delete them.
- Invalid friends are excluded from chat execution and member selection.

This preserves user customization while keeping chat behavior safe and predictable.

### Chat Gating Rules

Chat execution must use `usable friends`, defined as:

- friend `enabled !== false`,
- friend has a non-empty `modelConfigId`,
- `modelConfigId` resolves to an existing model,
- the bound model is enabled.

If the full friend list is non-empty but usable friends are empty, the status message should not imply that no friends exist. It should explain that current friends are not usable because they are missing or lost model bindings.

### Group Settings Normalization

- `memberIds` must be normalized against usable friend IDs, not merely all enabled friend IDs.
- `synthesisFriendId` must also resolve within usable friend IDs.
- This same rule should apply in frontend state and backend persistence normalization.

## UI Changes

### Friends Page Additions

- Add explanatory copy near the top of the page describing the three-layer flow: models -> friends -> group chat.
- Add a sync summary area above the friend grid.
- If there are unmapped models, show a message such as "X models are ready to generate friend roles" and offer a sync button.
- If a friend is bound to a missing or disabled model, show a clear warning state on that card.
- Keep the current editing controls, but visually reinforce the bound model relationship.

### Chat Page Messaging

- Improve empty-state and blocked-run messages.
- Distinguish these cases:
  - no friends exist,
  - friends exist but none are usable,
  - no prompt or no selected usable members.
- Messages should direct users toward `settings.html` and `friends.html` explicitly.

### Settings Page Messaging

- Add copy that explains configured models become available as AI friend roles.
- The page does not need new interaction complexity; the main change is clearer framing.

## Implementation Outline

### Frontend

In `script.js`:

- Add helper(s) to derive default friend profiles from the current model list and merge them into existing friend profiles.
- Replace the current bootstrap behavior that only runs when the entire friend list is empty with a broader reconciliation flow.
- Add helper(s) to compute usable friends and invalid friends.
- Update friend rendering to show sync status and invalid binding warnings.
- Update run gating and group settings logic to use usable friends.
- Add i18n strings for sync states, invalid bindings, and clearer prerequisite messaging.

In `friends.html`:

- Add containers for the sync summary and guidance copy.

### Backend

In `server.mjs`:

- Reuse the same conceptual normalization rule during database reads.
- If models exist but expected default friends are missing, backfill them.
- Keep invalid friend records instead of silently deleting them.
- Normalize group settings against usable friends.

## Error Handling

- Missing model binding is a recoverable configuration issue, not a destructive data-loss event.
- The UI should never silently delete customized friend profiles because a model was removed.
- The app should degrade by excluding invalid friends from chat while still exposing them for repair.

## Verification

### Frontend Scenarios

- Fresh workspace with models and no friend storage creates or syncs default friends.
- Existing workspace with some friends missing for newly added models shows sync availability and can fill the gap.
- Friend bound to removed model is visible on Friends page but unavailable in chat.
- Group settings only show usable members.
- Chat run blocks with a precise explanation when no usable friends exist.

### Backend Scenarios

- Database with models but missing friend entries gets normalized with default friends added.
- Database with stale friend bindings keeps those records but excludes them from runnable group settings.

### Build Check

- Run `npm run build`.

## Scope Boundaries

Included:

- clearer product flow,
- sync and reconciliation behavior,
- stricter chat gating,
- improved user guidance.

Not included:

- major schema redesign,
- removing manual friend creation,
- forcing all friends to be regenerated,
- unrelated UI refactors.
