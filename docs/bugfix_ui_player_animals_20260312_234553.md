## UI / Player Animals Bugfix Notes

### Fixed
- Quick presets were visually sparse because only five cards were rendered and the grid auto-fit left a large empty lower row on desktop.
  - Fix: expanded the preset set to six cards and switched the layout to an explicit desktop `3 x 2` grid.

- Player identity UI only showed `Human` / `AI-x` text, so the animal-first family theme was not reflected in setup or in-game side panels.
  - Fix: added player animal badges plus `Human / Bear`, `AI-1 / Fox` style labels.

- Recommended presets reused the same seat state each time, so there was no playful variation between sessions.
  - Fix: added random White/Black player-animal assignment when a recommended preset starts.

- Save/resume/archive payloads did not preserve player-profile animal choices.
  - Fix: extended save normalization and archive normalization with `setupPlayerAnimals`.
