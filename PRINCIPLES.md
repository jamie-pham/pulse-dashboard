# Design principles

Pulse is built to be opened every day, so every feature has to earn its place against these six rules. They come from research on why people keep using (or abandon) everyday apps and self-tracking tools.

1. **Design for the 5-second glance.** Over 70% of activity-tracker use is brief ~5-second checks with no interaction ([Gouveia et al., 2016](https://ktisis.cut.ac.cy/entities/publication/a95845f4-9f0f-4bf8-8dc9-16cfff5aaffb)). The top of the screen answers "what matters right now?"; detail lives behind a tap (e.g. the workload headline → tap the heatmap for the list).

2. **Zero effort beats motivation.** People lapse through forgetting, upkeep and tedious manual entry; ~44% abandon activity trackers within three months, and splitting one habit across tools is its own pain ([Epstein et al., 2015](https://my.eng.utah.edu/~cs5540/au16/readings/PersonalInformatics-Epstein2015.pdf)). "Motivation fluctuates. Simplicity is stable" ([Fogg](https://www.thebehavioralscientist.com/?p=3058)). Pulse must be useful with no typing: read weights from Moodle titles, merge every account into one view, never require logging.

3. **Anchor to a routine you already have.** The trigger is the alarm: stop it → hear the brief → see the dashboard ([Hooked model](https://umbrex.com/?p=242458)).

4. **Two tiers of notifications.** Only time-critical things interrupt immediately (leave now, a deadline closing within hours, an emergency nearby). Everything else is batched into three digests a day with quiet hours — batching 3×/day made people happier, less stressed and more attentive, while zero notifications made them *more* anxious ([Fitz, Kushlev et al., 2019](https://communities.springernature.com/posts/batching-notifications-can-improve-attention-well-being-and-productivity)).

5. **Every score explains itself and suggests one next step.** Show the contributors ("HRV 8% below your normal · 1h 20m short on sleep") and frame low scores as "pay attention", not failure ([Oura](https://ouraring.com/blog/readiness-score/)).

6. **Streaks forgive.** Streaks lift retention, but losing one discourages people enough to quit ([Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/)). One free missed day a week; after a lapse it's a "fresh start", never "streak lost".

When adding a feature, check: can it be read in 5 seconds? Does it need any manual input? If it notifies, is it truly urgent — or should it wait for a digest?

## Interface (Oct 2026 research, audience: uni students on iPhone who get pulled into other apps)

1. **One answer above the fold.** The Now card says the single most useful thing (leave / now / next / free) with a live countdown. Same logic as the lock screen widget, so the two always agree. *(NN/g: dashboards are for at-a-glance reading with little cognitive effort.)*
2. **Satisfy, then release.** Quick, rewarding checks build checking habits (Oulasvirta et al. 2012), so Pulse ends the check rather than extending it. The brief shows 3 lines and the rest sits behind "N more"; nothing scrolls forever. *(Calm technology: require the smallest possible amount of attention; use the periphery, i.e. the lock screen.)*
3. **Say it once.** Nothing shown in one card is repeated in another (event → Now card, incidents → Near you).
4. **Proportionate alarm.** Only official warnings take the top slot or the lock screen. Incidents get their own card and a push if close.
5. **Follow the phone's light/dark setting.** Light mode reads better in daylight, especially small text (NN/g); dark mode suits night. Accents are darkened in light mode to keep text contrast ≥ 4.5:1.
6. **Looks count as usability.** Attractive interfaces are judged easier to use, before *and* after use (Tractinsky 2000). Treat polish as function: generous white space, a calm palette and simple type are what this age group rates highest (survey of 200 Gen Z, white space strongest effect).
7. **Write for a glance.** One time style ("10am", "1:30pm"); short titles ("Assignment 3", with weight as a chip); numbers in tabular figures; 11pt minimum on widgets (Apple HIG).
8. **Colour is a second cue, never the only one.** Every colour also has an icon or a word, since about 8% of men have colour-vision deficiency.
9. **Respect Reduce Motion**, and put frequent actions where a thumb reaches; about half of people use their phone one-handed (Hoober).
