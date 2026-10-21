# Design principles

Pulse is built to be opened every day, so every feature has to earn its place against these six rules. They come from research on why people keep using (or abandon) everyday apps and self-tracking tools.

1. **Design for the 5-second glance.** Over 70% of activity-tracker use is brief ~5-second checks with no interaction ([Gouveia et al., 2016](https://ktisis.cut.ac.cy/entities/publication/a95845f4-9f0f-4bf8-8dc9-16cfff5aaffb)). The top of the screen answers "what matters right now?"; detail lives behind a tap (e.g. the workload headline → tap the heatmap for the list).

2. **Zero effort beats motivation.** People lapse through forgetting, upkeep and tedious manual entry; ~44% abandon activity trackers within three months, and splitting one habit across tools is its own pain ([Epstein et al., 2015](https://my.eng.utah.edu/~cs5540/au16/readings/PersonalInformatics-Epstein2015.pdf)). "Motivation fluctuates. Simplicity is stable" ([Fogg](https://www.thebehavioralscientist.com/?p=3058)). Pulse must be useful with no typing: read weights from Moodle titles, merge every account into one view, never require logging.

3. **Anchor to a routine you already have.** The trigger is the alarm: stop it → hear the brief → see the dashboard ([Hooked model](https://umbrex.com/?p=242458)).

4. **Two tiers of notifications.** Only time-critical things interrupt immediately (leave now, a deadline closing within hours, an emergency nearby). Everything else is batched into three digests a day with quiet hours — batching 3×/day made people happier, less stressed and more attentive, while zero notifications made them *more* anxious ([Fitz, Kushlev et al., 2019](https://communities.springernature.com/posts/batching-notifications-can-improve-attention-well-being-and-productivity)).

5. **Every score explains itself and suggests one next step.** Show the contributors ("HRV 8% below your normal · 1h 20m short on sleep") and frame low scores as "pay attention", not failure ([Oura](https://ouraring.com/blog/readiness-score/)).

6. **Streaks forgive.** Streaks lift retention, but losing one discourages people enough to quit ([Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/)). One free missed day a week; after a lapse it's a "fresh start", never "streak lost".

When adding a feature, check: can it be read in 5 seconds? Does it need any manual input? If it notifies, is it truly urgent — or should it wait for a digest?
