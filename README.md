# Typedo

Licensed under the [MIT License](LICENSE). Third-party dependencies retain their own licenses.

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

- New visitors start with a short explanation and a choice of a guided lesson, a 30-second test, or story practice. The Start page stays available in navigation. Returning learners with saved practice open the typing workspace.
- Start opens backup restore directly and labels lessons according to course progress. Lesson practice shows the current round's finger instructions above the passage, including when the live hand guide is off. Story selection moves keyboard focus to the library heading; returning from a chapter focuses its resume button.
- Timed tests: 15, 30, 60, or 120 seconds. Word tests: 10, 25, 50, or 100 words.
- Optional punctuation and numbers, custom passages up to 1,500 characters, repeat-text and new-text restarts.
- Home-row, top-row, bottom-row, and full-keyboard practice use short phrases. Personalized weak-key practice uses readable scenes that include your troublesome letters, capitals, digits, and punctuation. Recommendations appear after a key has at least four attempts, two errors, and a 10% error rate. Uppercase and lowercase attempts are tracked separately.
- Twelve lessons cover first words, familiar reaches, keyboard rows, capitals, numbers, punctuation, word flow, contractions, messages, and everyday writing. Each has three practice blocks with several passages. The typing area moves through one passage at a time; results appear after the whole block. Every target key repeats at least three times in standard practice, with extra words for repeated mistakes after at least eight attempts and two errors.
- Choose everyday life, outdoors, or a little adventure for the final scene. Quick, standard, and extra practice change how much text each block contains. Standard lessons contain roughly 500–800 characters across their three blocks. Duration depends on typing pace; there is no countdown. Theme and length changes apply to the next block or retry without discarding current input.
- Practice continues to the next lesson after three blocks. Enter continues from results; Shift+Enter retries the same round. Use Previous round or the numbered round buttons to revisit completed rounds and return to the next unfinished round. Switching rounds starts a fresh block; completed credit stays saved. A little more practice adds a longer version of the current block without adding course credit. Finish for now returns to Start, and the next visit resumes at the next unfinished round. Existing completed lessons keep their credit. Unfinished lesson blocks are not saved as drafts.
- Completed lessons return in an optional review queue. Guided reviews revisit familiar keys. A check without hints can record retention only on a later local calendar day, at least 20 hours after the preceding completed practice, review, or test. It requires at least 40 correct characters, two correct occurrences of every target key, 95% unrounded attempt accuracy, and 95% correct final text. Review intervals start at one day, then move to three and seven days after successful checks. These intervals are product defaults, not a claim that one schedule suits everyone.
- Lesson completion and later-check evidence are separate. Checks never add or remove course credit. A later failed check recommends guided practice and keeps the date of an earlier success. Improvement notes compare error rates only after enough attempts in comparable practice. Optional independent practice hides the finger guide; turning hints on at any point marks that block as guided.
- Optional lesson tests use several passages from a separate assessment pool and cover every target key. Passing requires at least 40 correct characters, 95% attempt accuracy, 95% correct final text, and two correctly typed positions for every target key. Repeatedly correcting one occurrence cannot substitute for covering a second. Tests are not required to continue learning; existing completion credit is preserved. Progress, seen passages, passed tests, and best scores persist locally and are included in backups.
- Stories offers five original short comedies, each with three chapters and full capitalization, dialogue, and punctuation. Your position saves as you type, including unfinished chapters, mistakes, and corrections. Resume from the library after navigating away or reloading. Rereads also keep your place between chapters while retaining your original completion credit. The whole story is available; there is no time limit or speed requirement.
- A weekly featured story includes suggested daily chapters. Five editions are bundled for October 19 through November 22, 2026. The next chapter follows your bookmark, even when you start late or read ahead. All stories stay available in the library. After the calendar ends, the app recommends unfinished library stories. More editions require adding authored content and dates; there is no publishing service.
- Beginner mode keeps large hands and the next finger beside the typing prompt, including in focus mode. Independent mode hides the hands without restarting, and the choice is remembered across typing and lessons. The full keyboard map is available below the typing area.
- Live key and finger highlights, opposite-hand Shift guidance, optional strict practice, and progress measured in completed correct words.
- Two consecutive mistakes at the same position in lesson practice show the key pressed and the expected key. Results suggest up to two keys to revisit after at least eight attempts, two mistakes, and a 10% error rate per key. Learners can take a shorter review of the same round or continue; a retry never adds another round of course credit.
- WPM, raw WPM, accuracy, mistakes, a speed chart, session history, weak-key stats, daily goals, and streaks.
- A dark blue theme by default, a light blue alternative, focus mode, optional synthesized key sounds, and reduced-motion support. The theme switch updates the full page background as well as the controls.
- JSON progress export and restore. Restore keeps existing results, skips duplicate session IDs, and takes the larger per-key totals to avoid double counting overlapping backups. Settings and custom text are restored from the backup, and the first practice passage uses the restored key statistics. Completed lesson rounds and story bookmarks never move backward during a restore. Unfinished story chapters are included; the most recently saved valid draft wins when both backups contain one. A draft cannot restore a run already recorded as complete.

The app expects a physical keyboard and printable ASCII input. It guides finger placement but cannot detect which physical finger pressed a key. Mouse and touch navigation work on smaller screens; typing practice requires a hardware keyboard.

## Shortcuts and scoring

**Shift+Enter** retries free typing or the current lesson round, including from lesson results. It works from the typing area, Reset/Restart, or the lesson Continue button. **Tab then Enter** still reaches Reset/Restart. In free typing, **Ctrl+Enter** or **Command+Enter** also restarts. In lessons and stories, **Enter** on the primary result button continues after completion. **Escape** remains an alternative for retrying lessons. Stories provides a Restart chapter button that clears that chapter's unfinished attempt. Completed chapter credit stays intact. Backspace corrects the previous character. Normal Shift+Tab navigation remains available.

Timing starts with the first printable character. Leaving the tab does not pause a timed test. Deadline checks run both on ticks and before input; timed text grows if it runs low. Held-key repeats, paste, and composed input are excluded. Changing a free-typing mode or lesson abandons that unfinished run. Stories saves partial progress and pauses when the window loses focus, the page is hidden, or the reader is left; resuming preserves elapsed practice time without counting time away.

WPM = currently correct characters, including spaces, divided by five and by elapsed minutes. Raw WPM uses all character attempts. Accuracy = correct attempts divided by all attempts; correcting an error does not erase it. Practice results are separate from test personal bests. The pace chart compares the last 20 tests and may include different settings.

## Storage

The app uses versioned `localStorage` under `typedo:v1`. It stores settings, aggregate key statistics, lesson rounds, seen lesson passages, up to 64 learning-evidence samples per lesson, story bookmarks, one unfinished draft per story, and up to 500 completed sessions. Learning samples keep per-key counts, guidance use, and dates for review scheduling and comparisons. Backup imports validate that evidence and recompute retention rather than trusting imported status labels. Story drafts hold typed text, attempt counters, and elapsed time locally. They do not count toward daily goals, history, or aggregate statistics until the chapter is complete. The history screen displays the latest 50; exports contain all retained sessions. Lesson completion and story bookmarks are retained even when older session history reaches its limit. There is no backend, account, analytics, or typing-content upload. Optional web fonts are requested from Google Fonts; system fallbacks work without them.

This is appropriate for a personal first version. Cookies are unnecessary for these records. Data belongs to this browser and site origin, so different addresses have separate histories. Clearing browser data removes progress. Export and restore move results between devices or origins. Storage failures show a message while practice remains usable.

If saved data cannot be read, automatic saving pauses to protect the original. The warning offers a download of the original data when available. You can keep typing and export that visit's results. Restoring a valid backup resumes saving and includes results completed during the visit; an invalid backup leaves the original untouched.

For future cross-device sync, add authentication and a database behind a small storage interface. Never put database credentials in the React client.

## Backlog

See [the product and experience roadmap](ROADMAP.md) for the consolidated suggestions, proposed priorities, keyboard navigation, pause/resume behavior, UI improvements, and acceptance checks. The roadmap describes future work; the features above describe what is implemented.

Monetization is planned for later. Pricing, payments, subscriptions, and paid story packs are not implemented or released. Keep them out of the current learning flow. When development begins, unfinished purchase features should stay disabled until they are ready to release.

Classroom assignments, teacher reports, accounts, and cross-device sync are also future work. The current app is a local learning workspace for one person. New story editions can be added without introducing accounts or payments.

## Code

- `src/typing.js`: pure typing engine, metrics, lesson generation, finger mapping.
- `src/adaptivePractice.js`: readable practice passages and recommendations based on recorded mistakes.
- `src/storage.js`: versioned persistence and backup validation.
- `src/App.jsx`: workspace, result/progress screens, settings, shortcuts.
- `src/Start.jsx`: first-visit explanation and practice choices.
- `src/Keyboard.jsx`: keyboard and finger guide.
- `src/Lessons.jsx`, `src/lessons.js`, and `src/lessonContent.js`: guided rounds, authored course, optional tests, and completion records.
- `src/lessonPractice.js` and `src/lessonPracticeContent.js`: longer practice blocks, target coverage, themes, adaptive passages, optional assessments, and separate later-check material.
- `src/lessonFeedback.js`: repeated-error messages and specific practice suggestions from per-key results.
- `src/lessonLearning.js`: bounded learning evidence, spaced review, later checks, and improvement feedback.
- `src/Stories.jsx` and `src/stories.js`: story library, chapter typing, original stories, and bookmarks.
- `src/storySchedule.js`: dated weekly features, daily chapter suggestions, and library recommendations after the schedule ends.
- `src/storyDrafts.js`: validation and restoration of unfinished chapters, including corrected mistakes and saved timing.
- `src/shell.css`: desktop sidebar, responsive navigation, and themed page background.
- `tests/typing.test.js`: timing, scoring, correction, text growth, mapping, and storage failure checks.
- `tests/lessons.test.js` and `tests/ui.test.js`: lesson thresholds, saved course results, keyboard flows, and theme switching. UI checks use jsdom; they do not replace visual browser review.

Built with React, Vite, and Lucide icons. Run `npm run dev` and open http://127.0.0.1:5178/ to use the app locally. Static production output goes to `dist/` and can be served by any static web host.
