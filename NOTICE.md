# HeadChicken

HeadChicken is a modified version of [Herdr](https://github.com/herdrdev/herdr-app)
(herdr desktop app), used under the Apache License 2.0 (see `LICENSE`).
It is not made, endorsed or supported by the Herdr authors. "Herdr" is their name;
HeadChicken does not use it as its own.

HeadChicken still runs terminals and agents through
[herdr-core](https://github.com/herdrdev/herdr-core), unchanged.

## What HeadChicken changed

- An office layout (`defaults/layouts/office.json`, `defaults/mods/office`,
  `defaults/mods/office-hire`): each agent is a person at a desk; working,
  needs-you, done and idle are shown as what they do. The office sits on the
  left and the work pane on the right. It is the first screen.
- 3D cartoon art for the office (`defaults/mods/office/art`, positions in
  `art.js`), drawn on an isometric floor. Nine looks (three people and six
  animals) and three outfits, picked when hiring, from the right-click menu or
  from the work pane's header (`defaults/mods/office-look`); the outfit colour
  follows the agent. An agent that ends its turn with a question raises its
  hand instead of walking over.
- A button in Herdr's sidebar footer (`defaults/mods/workspace-chrome`) and in
  the office header to switch between the two screens.
- Its own home folder, `~/.config/headchicken` (`src/mods.rs`), so it never
  shares files with an installed Herdr.
- Its own name, icon and bundle id (`scripts/package-headchicken`,
  `assets/icons/HeadChicken.icns`, visible text in `defaults/frame`).
- Built from source (`.github/workflows/headchicken-mac.yml`): no update checks
  against Herdr's release server and no usage reports.

Files changed from Herdr carry a "Modified by HeadChicken" line at the top.
