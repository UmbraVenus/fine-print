# Fine Print · Product spec

Exported Oct 21, 2026 from the live spec. If anything here disagrees with `CLAUDE.md` or the wireframes, those win.

## 1. Summary

**Same team, 550% more ads approved, in hours, not days**

*Fine Print catches issues before an ad is submitted and prepares every review, so ClearPath's three-person compliance team goes from 66 to 430 approved ads a week, and each ad clears 92% faster.*

- **Tagline:** Fix it before you submit. Approve it in one pass.
- **What we're building:** a review workspace where marketers pre-check ads, reviewers decide from a prepared view, and every decision is tracked automatically.

## 2. Problem and background

ClearPath's marketing submits more ads than compliance can clear, and the gap grows every week.

- **The loop:** ads arrive by email, get logged in Excel by hand, and go back and forth 3–5 rounds.
- **The waste:** an ad spends about 6 working days in review, but only about an hour of that is actual reviewing.
- **The cause of extra rounds:** marketers and affiliates can't see the rules, so they find out what's wrong only after submitting.
- **The stakes:** a missed issue is costly. In 2018 the FTC charged SoFi over savings claims whose exclusions sat in the fine print.

## 3. Who it's for

Two roles share one workspace: marketer and reviewer. The reviewer is the primary user. Affiliate content reaches the queue through marketing, labelled with the affiliate's name.

| User | Goal | What they do in Fine Print |
| --- | --- | --- |
| Compliance reviewer (primary) | Clear the queue without missing a violation | Works the queue, reviews prepared findings, approves or requests changes |
| Internal marketer | Get campaigns live on time | Pre-checks ads, fixes flags, submits, tracks status |

## 4. Success metrics

Goal: the same three-person team clears 6.5× as many ads (throughput up 550%), and turnaround drops from about 6 working days to about 4 hours (92% faster). These are modeled estimates from the assumptions below.

| | Today | With Fine Print |
| --- | --- | --- |
| Hours actually reviewing (per reviewer, per week) | 24 of 40 | 36 of 40 |
| First review of an ad | 20 min | 10 min |
| Re-reviews per ad | 3 × 15 min | 1 × 5 min |
| Reviewer time per ad | 65 min | 15 min |
| Ads approved per week (team of 3) | ~66 | ~430 |
| Submit to approval | ~6 working days | ~4 hours |

Assumptions: 3 reviewers; marketing submits ~100 ads a week, so today's backlog grows by ~34 ads a week. A conservative case with smaller gains on every row still gives ~5×. Outside proof that gains this size are real: PerformLine reports Stride Bank cut review time 90%.

**What the product tracks (History page):** turnaround time, ads approved per week, rounds per ad, first-pass approval rate, top issue types.

## 5. Core flows

Four flows cover the product. Ad statuses: Pending → Approved, Approved with changes, Changes required or Rejected. A resubmission goes back to Pending as v2.

**What each status means**

| Status | Means | Set by | Next step for the submitter (action in My ads) |
| --- | --- | --- | --- |
| Draft | Pre-checked, not submitted yet | Marketer | Fix and submit (Pre-check) |
| Pending | Waiting for a reviewer | Marketer, on submit | Wait (no button) |
| Changes required | Fixable, but it needs another review | Reviewer | Fix, re-check, resubmit as v2 (Pre-check) |
| Approved with changes | Can go live once the listed small edits are made, with no second review | Reviewer | Make the edits and launch (no button) |
| Approved | Can go live as is | Reviewer | Launch (no button) |
| Rejected | Can't run in any form. Ends the loop and stays in the ad's activity for audit | Reviewer | Start a new ad |

**How a reviewer picks**

- **Request changes or Reject?** If better wording or layout would make it OK, request changes. Reject only when the ad itself can't run: the offer doesn't exist, the claim can't be backed up, or an affiliate broke the rules on purpose.
- **Approve with changes or Request changes?** Use Approve with changes when the edit is small and exact (e.g., add "APR" after the rate) and the reviewer doesn't need to see it again. Anything bigger or open to judgment is Request changes.
- **On screen:** Approve is the green primary button on the right; Reject is a red text button on the far left, so it is never clicked by accident.

**A. Marketer pre-checks and submits**

1. Opens a draft from My ads; Pre-check opens in a new tab.
2. Sees suggestions in seconds, grouped Critical · Caution · Good, pinned on the ad.
3. Fixes and re-checks, or submits anytime; can add a note to the reviewer on any finding.
4. Follows live status in the app; no email.

**B. Reviewer clears the queue**

1. Opens the queue: one list sorted by due date, with a thumbnail of each item; resubmissions are marked v2.
2. Opens an item: findings are already grouped by severity and pinned on the ad, with the rule explained one click away.
3. Keeps, edits or dismisses each finding (dismissing needs a reason).
4. Decides: approve, approve with changes, request changes or reject; the next item opens automatically.

**C. Resubmission**

1. The marketer sees the reviewer's comments in the app, fixes the ad, resubmits.
2. The reviewer sees version 1 and version 2 side by side, plus a list: resolved · still open · new.
3. All resolved → the reviewer approves in one click.

**D. Reviewer checks the team's numbers**

1. Opens History: team numbers at the top, each with a trend, and every approved ad below.
2. Opens any ad in a drawer: the ad, the reviewer's changes and its activity.

Affiliate posts are reviewed like any other ad; affiliates don't log in.

## 6. Scope

The MVP proves three throughput levers (pre-check, prepared review, what-changed re-review) plus automatic tracking.

**In**

- Pre-check for marketers, with a live Re-check
- Prepared review: findings grouped by decision, proof shown on the ad
- What-changed re-review
- Automatic intake, status and history (replaces Excel + email)
- Team numbers on the History page, and a Rules page where reviewers can add rules
- Asset types: images (social ads, display banners) and text (email, landing page copy, SMS, affiliate posts)

**Out**

- Video and audio
- Fair-lending checks on imagery and targeting (needs human judgment)
- Monitoring affiliate sites after launch
- Precedent search across past decisions (next phase)
- Real login and permissions (a Marketer / Reviewer switcher stands in)
- Integrations (email, Slack, ad platforms), uploads, and the rest of section 11

## 7. Features

Seven features. Each starts with its user story, then what the user sees and when it counts as done.

**F1. Pre-check** (marketer)

*As a marketer, I want to check my ad before I submit it, so that I fix problems now instead of waiting days for a reviewer to find them.*

- Opens from My ads (Pre-check button, new tab) for a draft or an ad that needs changes. Ads come from the sample library.
- AI checks it against the rule library (section 8) and returns suggestions grouped Critical · Caution · Good. Suggestions never block submitting.
- Each finding: one plain sentence (claim, rule, what's missing), a numbered pin on the ad, and a suggested fix. "Add a note" lets the submitter explain or disagree; the reviewer sees the note on that finding.
- A "See all rules" link shows the rule library, so submitters know the rules before they start.
- Done when: all seeded ads land in their expected group, and Re-check returns live findings in under 30 seconds.

**F2. Review queue** (reviewer)

*As a reviewer, I want one queue sorted by due date with a preview of each item, so that I always know what to review next.*

- One table sorted by due date: thumbnail, name, format, product, auto check, due date, and a Review button that opens the review in a new tab. Search, filters (format, product, auto check) and 10 rows per page; My ads and History use the same table. Header cards: waiting, due today, you reviewed this week.
- Due dates are by day (today, tomorrow, Oct 23), the way compliance teams plan.
- Done when: any ad opens in one click, and the next ad opens after a decision.

**F3. Prepared review** (reviewer)

*As a reviewer, I want every finding prepared and shown on the ad, so that I can decide in minutes without re-reading the whole thing.*

- Ad on the left with highlight boxes; findings on the right, grouped Critical · Caution · Good. Good checks stay collapsed but visible.
- Each finding shows its rule's plain name; an info icon beside it explains the rule in place. Pins and list items are linked: selecting one highlights the other. Submitter notes appear on their finding.
- Per finding: keep, edit the comment, or dismiss (reason required).
- Your findings: a text box under the ad. Reviewer findings always go to the submitter and have no severity.
- Decision: Approve, Approve with changes, Request changes or Reject. Approve is always available; the AI never blocks. Only kept and added findings go to the submitter.
- Done when: a reviewer can decide on any seeded ad without leaving the screen.

**F4. What-changed re-review** (reviewer)

*As a reviewer, I want to see only what changed in a resubmission, so that I don't re-review the whole ad every round.*

- v1 and v2 side by side, plus a list: resolved · still open · new.
- Done when: a resubmission with every finding resolved can be approved in one click.

**F5. Automatic tracking** (everyone)

*As anyone on the team, I want status and history kept automatically, so that nobody chases emails or updates Excel.*

- Every submission gets today's Excel fields automatically: ID, date, submitter, asset, channel, product, round, reviewer, status, due date, decision date.
- Full history per ad: versions, findings, comments, decisions, overrides with reasons.
- An in-app badge tells submitters when status changes or comments arrive.
- Done when: nothing in the demo is typed into a tracker by hand.

**F6. History and team numbers** (reviewer)

*As a reviewer, I want to see what we've approved and how fast, so that I can show the process works and find any past decision.*

- History sits right after Queue in the sidebar: team numbers at the top (approved this week, average turnaround, approved on first review, each with a trend), then every Approved and Approved with changes ad, with search, filters and 10 rows per page. Clicking an ad's name (in any table) opens a drawer with the ad, the reviewer's changes and its activity; the last column only holds work buttons (Pre-check, Review).
- Done when: History shows 8 weeks of seeded decisions, and its numbers are computed from that data.

**F7. Add a rule** (reviewer)

*As a reviewer, I want to add a rule when policy changes, so that the auto check catches it from the next check on.*

- "Add a rule" on the Rules page opens a drawer: name, category, what it checks, flag as Critical or Caution, products it applies to, and a Don't and a Do example.
- New rules apply to live checks (Re-check and new submissions). Seeded results stay as they are.
- Done when: a rule added on the Rules page shows up in the next Re-check.

## 8. Rule library

Nine rules power the auto check. Every finding names its rule in plain words (no codes), and the Rules page explains each one. Layers: A = claims (the words), B = required elements, C = presentation. Reviewers can add more (F7).

| Rule | Layer | Applies to |
| --- | --- | --- |
| A rate claim ("as low as X% APR") needs the full APR range and its conditions | A | Loans, cards |
| "No impact to your credit score" must say it covers prequal only; applying is a hard pull | A | All |
| Trigger terms (e.g., "no annual fee") need the required disclosures | A | Cards |
| Savings claims need evidence and can't hide exclusions in fine print | A | All |
| No guaranteed approval or misleading rates | A | All |
| Mortgage ads need the NMLS ID and the Equal Housing logo | B | Mortgage |
| Affiliate content needs a compensation disclosure | B | Affiliate |
| Paid testimonials need a paid-partnership disclosure | B | Affiliate |
| Disclosures must be clear and conspicuous: readable size, near the claim, no scrolling | C | All |

Rule wording is a simplification of Reg Z and FTC guidance, not legal advice.

## 9. Sample data and roles

The app runs without login on a sample ClearPath workspace that can be reset to a clean state in one click.

- **Role switcher:** Marketer and Reviewer.
- **Reset sample data** button restores all seeded data.
- **Seeded ads:** spread across statuses so the queue looks real (new, resubmitted, approved). Each ad is one component in the sample ad library: the queue thumbnail, the review screen and the drawer all show that same ad.
- **AI results:** prepared in advance for seeded ads, so the demo is fast and repeatable; Re-check runs a live check against the current rules, including added ones. The API key stays on the server.
- **History:** 8 weeks of seeded decisions so History shows trends. All seeded dates are relative to today.

## 10. Open questions

Each question has a default, so building can start now.

- [ ] AI: prepared results for seeded ads plus a live check on Re-check and on submit? Default: yes.
- [ ] Can a submitter submit with Critical suggestions still open? Default: yes; suggestions never block, and the reviewer sees what's open.
- [ ] Assigning ads to specific reviewers? Default: no, one shared queue.
- [ ] Due dates: a default target by day, or set by the submitter? Default: target by day.
- [ ] Landing pages: pasted text and screenshots only, no URL fetching? Default: yes.

## 11. To-do (after MVP)

The sidebar shows the first three as "Coming next".

- Turn compliance documents into rules: upload a policy, get suggested rules to review.
- Upload your own ads (images, PDFs, text) instead of picking from the sample library.
- Search past decisions for precedent.
- Safety check for hidden instructions in affiliate content: text inside an ad is checked, never followed. Cut from the MVP to stay focused.
- Pin a reviewer finding to a spot on the ad.
