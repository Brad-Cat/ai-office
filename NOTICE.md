# AI Office

AI Office is a modified version of [Herdr](https://github.com/herdrdev/herdr-app)
(herdr desktop app), used under the Apache License 2.0 (see `LICENSE`).
It is not made, endorsed or supported by the Herdr authors. "Herdr" is their name;
AI Office does not use it as its own.

AI Office still runs terminals and agents through
[herdr-core](https://github.com/herdrdev/herdr-core), unchanged.

## What AI Office changed

- An office layout (`defaults/layouts/office.json`, `defaults/mods/office`,
  `defaults/mods/office-hire`): each agent is a person at a desk; working,
  needs-you, done and idle are shown as what they do. It is the first screen.
- Nine looks for the office people (three hairstyles and six animals), picked
  when hiring, from the right-click menu or from the work pane's header
  (`defaults/mods/office-look`, art from `scripts/office-art.py`). An agent that
  ends its turn with a question raises its hand instead of walking over.
- A button in Herdr's sidebar footer (`defaults/mods/workspace-chrome`) and in
  the office header to switch between the two screens.
- Its own home folder, `~/.config/ai-office` (`src/mods.rs`), so it never
  shares files with an installed Herdr.
- Its own name, icon and bundle id (`scripts/package-ai-office`,
  `assets/icons/AIOffice.icns`, visible text in `defaults/frame`).
- Built from source (`.github/workflows/ai-office-mac.yml`): no update checks
  against Herdr's release server and no usage reports.

Files changed from Herdr carry a "Modified by AI Office" line at the top.
