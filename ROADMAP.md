# Typedo product and experience roadmap

Updated October 25, 2026.

Typedo should help someone learn the keyboard, see their improvement, and want to continue a story. The immediate priority is a complete practice flow that works with a keyboard: choose an activity, type, pause, resume, finish, and continue without having to click the text area.

This consolidates the existing README backlog, the engagement review, and the requested UI and UX improvements. Everything below the current capabilities section is proposed work, with no committed release dates. The order is a recommendation, not a delivery promise. The [README](README.md) remains the reference for implemented behavior.

## Current capabilities and gaps

Typedo already has 12 guided lessons, optional assessments, adaptive weak-key practice, later reviews, timed and word tests, custom passages, finger guidance, and five original stories with three chapters each. It tracks accuracy, speed, history, session goals, and streaks. Stories save unfinished chapters. Progress stays in the browser and can be exported or restored.

| Area | Current behavior | Opportunity |
| --- | --- | --- |
| Returning visits | Saved practice opens the typing workspace. | Lead with the learner's unfinished activity and a useful next step. |
| Lesson selection | Selecting a course card starts a round without moving focus to its typing input. | Focus the ready exercise after an intentional selection. |
| Focus instructions | Some states say to click the text to begin or continue. | Provide a keyboard path and instructions that describe it. |
| Pause | Stories pause on window blur, hidden page, or reader exit. Other modes lack a shared explicit pause experience. | Add a visible pause action and consistent state handling. |
| Restart | Escape can restart free typing and lessons. Tab from the typing field jumps to restart/reset in those modes. | Make pausing safe and keep ordinary keyboard navigation predictable. |
| Unfinished lessons | Completed rounds persist; an unfinished block is not saved as a draft. | Resume the exact passage and position after a break. |
| Daily goals | Every completed session counts once, regardless of length. | Offer active practice time or a small daily plan. |
| Progress | The pace chart combines different test settings. | Compare equivalent tests and show specific skill improvement. |
| Story supply | Five weekly editions cover October 19 through November 22, 2026, then recommendations use the library. | Maintain a realistic publishing schedule and expand the library. |
| Storage and services | One browser, no account, sync, backend, or analytics. | Keep immediate improvements local; add services only when their benefit justifies them. |

## Recommended order

| Order | Work | Definition of a useful first version |
| --- | --- | --- |
| First | Keyboard flow, pause, and lesson drafts | A learner completes a lesson and a story chapter, including a pause and reload, without a mouse or lost work. |
| Next | Home screen, clearer practice screens, consistent results | Each screen makes the current task, state, and next action easy to identify. |
| Next | Daily plan, weekly goals, comparable progress | A returning learner knows what to do and can see evidence of improvement. |
| Then | More stories, practical exercises, saved custom passages | Returning users have useful material that matches their interests and skill. |
| Later | Optional challenges, collections, offline support, sync | Add these after observing the core practice flow in use. |
| Separate future work | Classroom tools and monetization | Keep these distinct from the current individual learning experience. |

## Keyboard operation

### Enter an exercise without clicking its text

Activating Start, Continue, a lesson, a review, or a chapter should bring the typing input and its instructions into view and focus it. Show a caret and a short instruction such as "Start typing to begin." The first printable key starts timing and is counted exactly once. The Enter or Space that activated the preceding button must not become a typed character.

Autofocus should follow an intentional activity action. Opening Home or browsing a library should place focus at the page heading or a sensible navigation point. Selecting a preference should leave focus on that control until the user chooses to return to typing. Renders, score updates, and timers must not pull focus away from another control.

| User action | Proposed focus behavior |
| --- | --- |
| Start or continue an activity | Move to the typing input, announce the activity and ready state, and reveal its caret. |
| Finish a round or chapter | Announce the result briefly and focus the primary Continue action. |
| Continue to the next passage or chapter | Focus the new typing input without counting the activation key. |
| Open settings or help | Move into the dialog; keep background controls inactive while it is open. |
| Close settings or help | Return to the opener; a separate Resume typing action can return to the exercise. |
| Return to the story library | Restore focus to that story's Continue or Read again button. |
| Return to a lesson list | Restore focus to the selected lesson, with its status visible. |
| Reload unfinished work | Show a clear Resume action and saved position before restarting activity. |

Preserve the story library's existing focus restoration. Use a visible "Return to typing" control near practice settings so users can return without traversing the full navigation. Add skip links for the main content and active practice. Every feature must remain reachable through ordinary keyboard navigation even when optional shortcuts are disabled. This follows the approach described in [W3C's keyboard guidance](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).

### Proposed shortcut policy

| Key | Proposed behavior | Scope |
| --- | --- | --- |
| Tab and Shift+Tab | Move forward and backward through controls in logical order. | Preserve normal browser navigation; remove the special jump to Restart. |
| Enter | Activate the focused button or link. | Continue, Resume, Start, and other actions depend on the focused control. |
| Space | Activate a focused button or checkbox; type a space inside the exercise. | Never use it as a global pause shortcut. |
| Escape | Pause an active exercise; close the topmost dialog when one is open. | Replace the current restart behavior. Escape on results must not erase anything. |
| Shift+Enter | Request a retry of the current exercise. | Typing input and related result controls only; preserve ordinary use inside custom-text editing. |
| Backspace | Correct the preceding typed character. | Keep existing accuracy accounting; corrections do not erase earlier mistakes. |
| Arrow keys | Use the expected behavior of the focused select, tab list, or menu. | Do not turn arrows into global navigation keys. |

Ctrl/Cmd+Enter currently restarts free typing and can retry or continue lessons depending on context; stories do not use it. Make Enter on the focused action and Shift+Enter for retry the primary documented controls. Preserve the older aliases in their existing contexts until a deliberate compatibility decision is made, and show their meaning in contextual help. Avoid taking browser shortcuts such as Ctrl/Cmd+L, R, W, F, or Tab.

Show the relevant shortcuts next to their actions, with a Shortcuts button available on every practice screen. Users should be able to discover the whole flow without memorizing chords. Any later command menu should have a normal button and a configurable, tested shortcut.

Do not use global printable shortcuts such as P, R, or ? because the same characters belong in passages, search, and custom text. Handle shortcuts only in the intended context, respecting composition input, modifier keys, focused controls, dialogs, and assistive technology. Character shortcuts, if introduced, must support disabling, remapping, or activation only within the focused component. See [W3C's character shortcut guidance](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html).

## Pause and resume

Use explicit states: Ready, Typing, Paused, and Complete. Paused must preserve the current attempt, including mistakes, corrections, passage position, guidance use, and elapsed active time. It is different from restarting and from finishing a session.

Show a labeled Pause button while typing and an Escape hint beside it. Pausing opens a compact dialog with "Paused. Your place is kept." Focus Resume, with Finish for now and Restart available as secondary actions. Restarting an unfinished attempt should offer a clear confirmation with Keep practicing as the default, or a reliable undo. Do not add confirmation to ordinary pause, resume, or continuation.

Resume returns to the exact caret and waits for the next printable key before restarting the clock. The resume key itself is not typed. Escape closes the pause dialog into the same ready-to-resume state, with the input focused and the clock still stopped until typing begins. Simply returning to the tab must not resume a timer. Ignore held-key repeats for pause, resume, and retry so one press cannot trigger several transitions.

| Activity | Manual pause or leaving the window | Result treatment |
| --- | --- | --- |
| Guided lessons, reviews, stories, custom text, and free practice | Freeze active time and save a draft. | Preserve practice credit rules; pausing never creates completion credit. |
| Timed and word tests | Freeze the session and mark it interrupted. Explain that the attempt can continue as practice. | Exclude interrupted attempts from test personal bests and comparable test charts. |
| Optional lesson assessments and later independent checks | Allow a break, preserve the attempt, and mark it interrupted. | Keep practice evidence, but require a fresh uninterrupted attempt for a passed assessment or later-check credit. |

Record an interrupted assessment as its own outcome, not a failed check. It may contribute ordinary practice statistics, but must not trigger failure-based review advice, erase an earlier pass or later-check success, or enter comparable assessment evidence. Preserve the interrupted classification through drafts, reloads, exports, and restores.

A completed interrupted assessment counts as rehearsal for scheduling: another independent check must wait at least 20 hours and a later local calendar day. It does not advance the successful-check interval. Merely pausing an unfinished attempt does not change the review schedule.

This deliberately changes today's timed-test behavior, where the clock continues when the user leaves the tab. Keep the distinction visible in setup and results: "Paused test: practice result. Start a fresh test to set a personal best." Existing saved results retain their original classification.

Apply automatic pause when the window loses focus or the page is hidden. For untimed practice, also pause when opening settings/help or intentionally navigating away; moving focus among ordinary controls must stay usable. For a measured test, leaving its typing input or opening a panel should mark the attempt interrupted, so browsing controls cannot stop the clock and still qualify for a best score.

Check a timed test's deadline before accepting pause. If the time has already expired, finish the test normally. Exclude paused/background time from active-time goals and pace calculations. Ordinary reading and thinking delays while an exercise is running still count; do not automatically remove them because no key arrived for a few seconds. A pause, reload, or repeated resume must never double-count a session or reset its error history.

Pause dialogs need a visible close control, contained Tab navigation, and correct focus restoration. Settings and help use the same dialog conventions. These behaviors follow [W3C's modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Saving unfinished work

Extend story-style drafts to lesson blocks, guided reviews, custom practice, and interrupted test practice. Save the exact text and passage sequence, position, attempt counters, active time, and relevant settings. Preserve the fact that hints were used at any point. Keep at most one resumable draft per supported activity initially, with clear replacement behavior.

Checkpoint drafts while typing and at pause, navigation, and page exit. Resume compatible drafts after reload and include them in backup export and restore. If a content update makes a draft incompatible, explain the issue and preserve completed credit. Do not silently turn an old attempt into a new passage.

Do not label a draft "Saved" until saving succeeds. Keep the existing distinction between saved on this browser and kept for this visit. Completing a draft should record the result exactly once and remove the unfinished copy. Switching activities should preserve the draft instead of silently discarding it.

## Clearer screens and visual design

### Home

Use one prominent Continue card for the most recently unfinished activity, with its name, saved position, and a short reason for the recommendation. If nothing is unfinished, suggest an appropriate review or the next lesson. Let users choose another activity without losing their place.

Below it, show the optional daily plan, this week's practice days, and the current story. Keep speed testing, lessons, stories, and progress available in navigation. New visitors can still choose a lesson, a quick test, or a story without creating an account or completing a questionnaire.

Suggested content order:

1. "Continue First words, block 2 of 3" and its primary action.
2. "Today's practice" with a chosen time budget and optional review.
3. "Continue your story" with the next chapter and saved position.
4. One evidence-based progress note and a link to full progress.

### Typing workspace

Bring the passage, caret, current instruction, and finger guide into the first viewport on a typical laptop. The current lesson screen puts the course list, preferences, progress, and several controls above practice. Move the full course list into an expandable outline and group preferences behind a clearly labeled control.

Keep only the activity title, block/chapter progress, Pause, and relevant guidance near the text. Let experienced users hide the hands and live speed while retaining an obvious way to restore them. Expand the full keyboard map on demand. Focus mode should reduce distractions while keeping Pause, navigation, and keyboard focus visible.

Show one instruction at a time, such as "Use your left pinky for A." Keep the present repeated-error feedback specific and limit result suggestions to one or two useful targets. Avoid making every typo a competing alert, sound, and animation.

### Labels and readability

Use a consistent vocabulary. Prefer "Block 2 of 3" throughout lessons instead of alternating round and block. Explain that "Passage 2 of 5" is part of the current block. Rename "Independent" to "Without finger hints" where that is the actual setting. Keep optional tests visibly separate from course completion.

Replace "Click the text" with state-specific copy that matches the implemented keyboard route. Use labels such as "Resume typing," "Continue lesson," "Restart chapter," and "Finish for now" consistently. Replace technical user-facing labels such as "Local workspace" with "Saved in this browser," only when accurate. Put score formulas and detailed pass requirements behind a How scoring works disclosure.

Increase important labels and help text currently styled around 9-12px. Start design review with 16px body text, 14px supporting labels, and adjustable passage text around 24-32px. These are proposed design values, not accessibility guarantees. Check both existing themes, zoom, line spacing, contrast, and visible focus. Combine error colors with an underline or other visible mark and a readable explanation.

Use a shared spacing scale, consistent buttons, and one primary action per panel. Keep controls stable as numbers update. Support narrow screens and zoom without clipping instructions or hiding actions. On phones, keep progress and browsing useful and explain the hardware-keyboard requirement before starting practice.

### Results and progress

Keep results in the same order across modes: what was completed, accuracy, speed when relevant, one useful observation, and the next action. Default to Continue for a lesson or story and Try again for a test. Place Restart and optional extra practice below the primary action. Hide raw WPM and detailed graphs behind a disclosure for beginners.

Default speed charts to equivalent test format, duration or word count, punctuation, and number settings. Keep guided practice and interrupted attempts separate. Show sample counts and a median or typical recent result alongside personal bests. Avoid presenting a change in test difficulty as lost skill.

Show per-key progress only after enough comparable attempts. Distinguish completed lessons, passed optional tests, and successful later checks. A weekly summary can highlight accuracy gains, completed chapters, and practice days without claiming improvement from too little evidence.

## Engagement suggestions from the review

| Suggestion | Proposed first version |
| --- | --- |
| Short daily plan | Let users choose roughly 3, 5, or 10 minutes, then suggest a warm-up, a lesson/review, and an optional story. Estimates should adapt to pace and remain optional. |
| More compelling stories | Add mysteries, adventures, recurring characters, and occasional choices between chapters. Keep published chapters available without forced waiting. |
| Specific improvement feedback | Build on existing comparable learning evidence to show fewer mistakes with particular keys, improved accuracy, or successful practice without hints. |
| Flexible weekly goals | Offer a target such as three practice days a week alongside the existing streak. Welcome users back after a missed day and offer a refresher. |
| Collections and milestones | Show completed stories on a bookshelf and award optional cosmetic themes for meaningful practice and sustained accuracy. Keep core learning accessible. |
| Personal challenges | Compare a learner with their own comparable results first. Add shareable challenges with identical text and settings later. Treat public rankings as separate work. |
| Sustainable story publishing | Maintain an authored content queue with review dates, edition dates, and a small reserve. Expand the current five-edition schedule without promising releases that are not ready. |

Give each visit a natural stopping point. After completion, show what is next and make Finish for now easy to reach. Optional reminders should follow a schedule the learner chooses and be easy to disable. Do not require notifications or continued play to preserve earned course credit.

## Additional ways to make Typedo useful

| Idea | Practical scope and dependency |
| --- | --- |
| Optional starting check | Use a short diagnostic to recommend a starting lesson. Explain that it is a recommendation, and keep every lesson available. |
| Everyday practice tracks | Add authored emails, school notes, dialogue, forms, dates, and numbers. Label required keys and approximate length so beginners can choose suitable material. |
| Personal passage library | Let users save and name several custom passages locally. Add import preview and clear handling of unsupported characters before extending today's 1,500-character limit. |
| Skill filters | Filter practice by capitals, punctuation, digits, or a small set of troublesome keys. Preserve readable material and the current evidence thresholds. |
| Story discovery | Filter by genre, length, difficulty, and completion; offer search when the library grows. Every filter and story action must work from the keyboard. |
| Comfortable reading controls | Remember passage size, line spacing, live-stat visibility, sounds, and finger hints. Keep layout stable when these settings change. |
| Offline practice | Consider an installable offline version after defining safe content updates and draft compatibility. Explain which stories are available offline. |
| Shared-computer profiles | Consider named local profiles before classroom accounts, with clear profile selection and separate histories. These would not provide account security or device sync. |
| Layout and language support | Research actual demand before adding layouts or languages. Expand character handling, teaching content, key mapping, and scoring together; the current app supports printable ASCII and US QWERTY guidance. |
| Easy backup recovery | Keep export/restore accessible by keyboard, show the last successful backup date if tracked, and offer an occasional dismissible backup reminder after meaningful progress. |

Validate new tracks and features with actual learners before expanding their scope. Ask what they use Typedo for and observe where they hesitate; preferences alone do not establish that a feature improves learning or return visits.

## Existing longer term backlog

Preserve the existing roadmap items while the individual learning flow improves:

- Accounts and cross-device sync, with authentication and a database behind a storage interface. Keep guest practice useful and define how local and remote drafts merge.
- Classroom assignments and teacher reports, with teacher/student workflows developed as a separate product area.
- Monetization, including possible paid story packs, pricing, payments, and subscriptions. These are not implemented. Keep unfinished purchase controls disabled and outside the current learning flow.

Do not make accounts or payments prerequisites for adding new authored stories. Defer public leaderboards, multiplayer races, and a large reward economy until the core learning experience has evidence of regular use.

## Acceptance checks for implementation

These checks describe future work; they are not claims that the proposed features already pass.

- A new visitor can use Tab and Enter to start a lesson, type its first character, finish a block, and continue without clicking the text area.
- Selecting a different lesson focuses the intended exercise and preserves the previous unfinished draft. Changing a preference does not steal focus or silently discard work.
- A learner can start a story, pause, resume, return to the library, reload, and continue from the exact saved position using only the keyboard.
- Escape never restarts an active attempt. Enter and Space used to activate controls do not leak into practice text. Literal P, R, ?, and spaces remain typable.
- Tab and Shift+Tab reach Pause, guidance, settings, navigation, export, and restore. No modal leaves focus behind it or traps the user without a close action.
- Pause preserves errors, corrections, guidance history, and elapsed active time. Waiting while paused, returning from another tab, or reopening the app does not inflate practice time or completion counts; normal thinking time during active practice still counts.
- Interrupted tests cannot set personal bests; interrupted assessments cannot award pass or later-check credit, count as a failed check, or erase an earlier success. Backup restore preserves this classification. Pausing at or after the timed deadline finishes the expired test normally.
- Completed work records once even after repeated resume, reload, or backup restore. Failed storage clearly says work is kept for the visit instead of claiming it is saved.
- Home makes the unfinished activity and next action apparent; results explain completion without requiring knowledge of WPM or retention terminology.
- Important controls remain visible and readable at 200% zoom and narrow widths. Verify keyboard focus, both themes, reduced motion, and screen-reader announcements in a real browser.
- Screen readers receive concise activity, pause, completion, and error messages. Do not repeatedly announce the entire passage or live score on every keystroke.

## How to evaluate the changes

Begin with observed keyboard-only sessions. Record whether learners can start, pause, resume, and continue unaided; where focus gets lost; and whether the next action is understood. Test with beginners as well as experienced typists and include assistive-technology users when evaluating accessibility.

For product measurements, track first-session completion, return practice within seven days, unfinished-activity resumes, next-chapter starts, review completion, and changes across comparable practice. Define the cohort and denominator before comparing versions. Evaluate improved skill and successful short visits alongside return frequency.

Typedo currently has no analytics. Start with local summaries and volunteered feedback. Any future aggregate analytics should use explicitly defined events and a clear data policy, without collecting typed custom text. Engagement gains remain hypotheses until measured.

## Source references

- [Current features and original backlog](README.md)
- [Navigation, free-typing focus, shortcuts, and progress](src/App.jsx)
- [Lesson selection, practice, and results](src/Lessons.jsx)
- [Story drafts, pause handling, and focus restoration](src/Stories.jsx)
- [Learning evidence and later checks](src/lessonLearning.js)
- [Dated story editions](src/storySchedule.js)
- [Current shell layout and text sizes](src/shell.css)
- [W3C keyboard guidance](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [character shortcut guidance](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html), and [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
