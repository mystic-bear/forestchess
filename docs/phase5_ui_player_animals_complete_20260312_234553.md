## Phase 5 UI Player Animals Complete

### Summary
- Reworked the quick preset area into a consistent six-card preset grid.
- Added a `PLAYER_ANIMALS` pool with 18 friendly mammal/bird choices.
- Wired player animal selection into custom setup, in-game player cards, autosave, resume, and archive records.
- Randomized White/Black player animals when starting from a recommended preset.

### Implemented Files
- `shared/constants.js`
- `shared/utils.js`
- `shared/i18n.js`
- `js/game.js`
- `js/ui.js`
- `js/persistence/save-manager.js`
- `css/style.css`
- `index.html`
- `test/phase5-player-animals-persistence.js`

### UI Result
- Desktop start screen now renders presets in a denser `3 x 2` layout.
- Each preset card includes a small emoji row for quicker visual scanning.
- Custom setup seat cards now show an animal badge, a `Human / Bear` style role line, and a dedicated `Change animal` action.
- In-game player cards now show the same animal identity without exposing the word "mascot".

### Persistence Result
- `setupPlayerAnimals` is now stored in latest-save snapshots.
- `setupPlayerAnimals` is now stored in finished-game archive entries.
- Resume restores the saved animal choices.

### Verification
- `node --check shared/constants.js`
- `node --check shared/utils.js`
- `node --check js/game.js`
- `node --check js/ui.js`
- `node --check js/persistence/save-manager.js`
- `node test/phase2-static-smoke.js`
- `node test/phase4-save-restore.js`
- `node test/phase5-archive-save.js`
- `node test/phase5-archive-resume-separation.js`
- `node test/phase5-player-animals-persistence.js`
