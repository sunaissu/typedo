# Typedo

A React typing app with quick tests, QWERTY finger guidance, and progress saved in your browser.

## Run locally

Requires Node.js 22.12+ or 24+ and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5178/. The local app does not require a login and only listens on this computer. Use that same address each time to keep the same browser progress. On Windows with PowerShell script restrictions, use `npm.cmd` instead of `npm`.

```sh
npm test
npm run build
npm run preview
```

## What works

- Timed tests: 15, 30, 60, or 120 seconds. Word tests: 10, 25, 50, or 100 words.
- Optional punctuation and numbers, custom passages up to 1,500 characters, repeat-text and new-text restarts.
- Home-row, top-row, bottom-row, full-keyboard, and weak-key practice use short phrases. Weak-key practice puts difficult letters into real words.
- A dedicated Lessons area with eight steps: first words, home row, G/H reaches, top row, bottom row, capitals and Shift, numbers, and punctuation. Each lesson has three practice passages and three test passages. Retrying always picks a different passage.
- Lesson tests require at least 95% attempt accuracy and 95% correct final text. There is no speed requirement. Completed drills, passed tests, and best scores persist locally and are included in backups.
- Beginner mode keeps large hands and the next finger beside the typing prompt, including in focus mode. Independent mode hides the hands without restarting, and the choice is remembered across typing and lessons. The full keyboard map is available below the typing area.
- Live key and finger highlights, opposite-hand Shift guidance, optional strict practice, and progress measured in completed correct words.
- WPM, raw WPM, accuracy, mistakes, a speed chart, session history, weak-key stats, daily goals, and streaks.
- A dark blue theme by default, a light blue alternative, focus mode, optional synthesized key sounds, and reduced-motion support. The theme switch updates the full page background as well as the controls.
- JSON progress export and restore. Restore keeps existing results, skips duplicate session IDs, and takes the larger per-key totals to avoid double counting overlapping backups. Settings and custom text are restored from the backup.

The app expects a physical keyboard and printable ASCII input. It guides finger placement but cannot detect which physical finger pressed a key. Mouse and touch navigation work on smaller screens; typing practice requires a hardware keyboard.

## Shortcuts and scoring

From the typing area, **Tab then Enter** restarts. **Ctrl+Enter** or **Command+Enter** restarts from anywhere outside a dialog. **Escape** resets the session and exits focus mode. Backspace corrects the previous character. Normal Shift+Tab navigation remains available.

Timing starts with the first printable character. Leaving the tab does not pause a timed test. Deadline checks run both on ticks and before input; timed text grows if it runs low. Held-key repeats, paste, and composed input are excluded. Changing a mode or exercise abandons the current run without saving it.

WPM = currently correct characters, including spaces, divided by five and by elapsed minutes. Raw WPM uses all character attempts. Accuracy = correct attempts divided by all attempts; correcting an error does not erase it. Practice results are separate from test personal bests. The pace chart compares the last 20 tests and may include different settings.

## Storage

The app uses versioned `localStorage` under `typedo:v1`. It stores settings, aggregate key statistics, lesson completion, and up to 500 completed sessions. The history screen displays the latest 50; exports contain all retained sessions. Lesson completion is retained even when older session history reaches its limit. There is no backend, account, analytics, or typing-content upload. Optional web fonts are requested from Google Fonts; system fallbacks work without them.

This is appropriate for a personal first version. Cookies are unnecessary for these records. Data belongs to this browser and site origin, so localhost and the hosted site have separate histories. Clearing browser data removes progress. Export and restore move results between devices or origins. Storage failures show a message while practice remains usable.

For future cross-device sync, add authentication and a database behind a small storage interface. Never put database credentials in the React client.

## Code

- `src/typing.js`: pure typing engine, metrics, lesson generation, finger mapping.
- `src/storage.js`: versioned persistence and backup validation.
- `src/App.jsx`: workspace, result/progress screens, settings, shortcuts.
- `src/Keyboard.jsx`: keyboard and finger guide.
- `src/Lessons.jsx` and `src/lessons.js`: lesson workspace, authored course, test goals, and completion records.
- `src/shell.css`: desktop sidebar, responsive navigation, and themed page background.
- `tests/typing.test.js`: timing, scoring, correction, text growth, mapping, and storage failure checks.
- `tests/lessons.test.js` and `tests/ui.test.js`: lesson thresholds, saved course results, keyboard flows, and theme switching. UI checks use jsdom; they do not replace visual browser review.

Built with React, Vite, and Lucide icons. Static production output goes to `dist/`. Hosted site: https://typedo.sleek-finch-9258.chatgpt.site. Local changes require a new deployment to update the hosted version.
