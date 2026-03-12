## Phase 5 UI Player Animals Plan

### Goal
- Reflow the quick preset cards into a balanced `3 x 2` layout on desktop.
- Add player animal profiles for White and Black without exposing the word "mascot" in the UI.
- Randomly assign different player animals when a recommended preset starts.
- Preserve chosen animals through autosave, resume, archive, and replay flows.

### Scope
- Start screen quick preset cards
- Custom setup seat rows
- In-game player cards
- Save/archive payloads

### Rules
- UI text should use `Human / Bear`, `AI-1 / Fox` style labels.
- Recommended presets randomize White and Black animals.
- Custom setup keeps manual animal selection.
- Animal pool must contain at least 16 friendly mammal/bird choices.
- Insects, frogs, and reptiles are excluded.

### Planned Changes
1. Add `PLAYER_ANIMALS` to `shared/constants.js` and expose helpers through `shared/utils.js`.
2. Store `setupPlayerAnimals` in `js/game.js`, plus helpers for cycling and random assignment.
3. Extend autosave/archive normalization in `js/persistence/save-manager.js`.
4. Update `js/ui.js` start screen cards, setup rows, and player cards to render animal badges and role labels.
5. Adjust `css/style.css` for:
   - fixed 3-column quick preset layout
   - preset emoji rows
   - animal badge treatment in setup/player cards
6. Refresh asset query strings in `index.html`.

### Verification
- Syntax check on edited JS files
- Save manager / resume regression
- Static UI smoke

### Full Code Snapshot Policy
- Create a local-only snapshot in `legacy_code/`
- Exclude Stockfish assets and isolated legacy files as before
