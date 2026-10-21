# Keysteady

A React typing app with quick tests, QWERTY finger guidance, and progress saved in your browser.

## Run locally

Requires Node.js 22.12+ or 24+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. On Windows with PowerShell script restrictions, use `npm.cmd` instead of `npm`.

```sh
npm test
npm run build
npm run preview
```

## What works

- Timed tests: 15, 30, 60, or 120 seconds. Word tests: 10, 25, 50, or 100 words.
- Optional punctuation and numbers, custom passages up to 1,500 characters, repeat-text and new-text restarts.
- Home-row, top-row, bottom-row, full-keyboard, and weak-key practice. Row lessons mix drills with words that emphasize the selected row.
- Live key and finger highlights, opposite-hand Shift guidance, and optional strict practice that waits for the correct key.
- WPM, raw WPM, accuracy, mistakes, a speed chart, session history, weak-key stats, daily goals, and streaks.
- Dark theme, focus mode, optional synthesized key sounds, and reduced-motion support.
- JSON progress export and restore. Restore keeps existing results, skips duplicate session IDs, and takes the larger per-key totals to avoid double counting overlapping backups. Settings and custom text are restored from the backup.

The app expects a physical keyboard and printable ASCII input. It guides finger placement but cannot detect which physical finger pressed a key. Mouse and touch navigation work on smaller screens; typing practice requires a hardware keyboard.

## Shortcuts and scoring

From the typing area, **Tab then Enter** restarts. **Ctrl+Enter** or **Command+Enter** restarts from anywhere outside a dialog. **Escape** resets the session and exits focus mode. Backspace corrects the previous character. Normal Shift+Tab navigation remains available.

Timing starts with the first printable character. Leaving the tab does not pause a timed test. Deadline checks run both on ticks and before input; timed text grows if it runs low. Held-key repeats, paste, and composed input are excluded. Changing a mode or exercise abandons the current run without saving it.

WPM = currently correct characters, including spaces, divided by five and by elapsed minutes. Raw WPM uses all character attempts. Accuracy = correct attempts divided by all attempts; correcting an error does not erase it. Practice results are separate from test personal bests. The pace chart compares the last 20 tests and may include different settings.

## Storage

The app uses versioned `localStorage` under `keysteady:v1`. It stores settings, aggregate key statistics, and up to 500 completed sessions. The history screen displays the latest 50; exports contain all retained sessions. There is no backend, account, analytics, or typing-content upload. Optional web fonts are requested from Google Fonts; system fallbacks work without them.

This is appropriate for a personal first version. Cookies are unnecessary for these records. Data belongs to this browser and site origin, so localhost and the hosted site have separate histories. Clearing browser data removes progress. Export and restore move results between devices or origins. Storage failures show a message while practice remains usable.

For future cross-device sync, add authentication and a database behind a small storage interface. Never put database credentials in the React client.

## Code

- `src/typing.js`: pure typing engine, metrics, lesson generation, finger mapping.
- `src/storage.js`: versioned persistence and backup validation.
- `src/App.jsx`: workspace, result/progress screens, settings, shortcuts.
- `src/Keyboard.jsx`: keyboard and finger guide.
- `tests/typing.test.js`: timing, scoring, correction, text growth, mapping, and storage failure checks.

Built with React, Vite, and Lucide icons. Static production output goes to `dist/`. Hosting identity is recorded in `.openai/hosting.json`.
