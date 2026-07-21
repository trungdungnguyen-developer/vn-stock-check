# UI architecture

The interface is now organized into predictable layers. No JavaScript behavior or DOM hooks were changed.

## CSS loading order

1. `css/legacy.css` — compatibility layer for the existing application.
2. `css/design-tokens.css` — colors, type, radius and shadow tokens.
3. `css/base.css` — page defaults and text contrast.
4. `css/layout.css` — shell, sidebar and major regions.
5. `css/components.css` — cards, tables, navigation, charts and notifications.
6. `css/controls.css` — buttons, inputs and focus states.
7. `css/accessibility.css` — semantic colors, links and selection.
8. `css/responsive.css` — small-screen and high-contrast adaptations.

## Maintenance rules

- Add new colors only as variables in `design-tokens.css`.
- Do not add feature-specific overrides to `legacy.css`.
- Preserve IDs and classes used by JavaScript.
- Text and backgrounds must maintain readable contrast.
- Interactive elements need visible hover, active, disabled and keyboard-focus states.
- Put responsive overrides in `responsive.css`, not beside desktop component rules.

## Safe legacy cleanup

`legacy.css` remains intentionally isolated to prevent regressions. Remove rules from it gradually only after checking all tabs and responsive states. The modular layers are the source of truth for future visual work.
