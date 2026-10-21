# StatusTag

One short status, an icon plus one to three words, built on antd `Tag`. Two separate sets: how serious a finding is, and where an asset stands.

**Finding severity** (on each finding and in `ChecksSummary`)

| Tag | Means | Tone |
| --- | --- | --- |
| Critical | Blocks approval until it's fixed | critical |
| Caution | The reviewer decides | warning |
| Good | The check found nothing | success |

**Asset status** (on each `QueueItem`): Adobe Workfront's decision words, plus Rejected

| Tag | Means | Tone |
| --- | --- | --- |
| Pending | No decision yet | neutral |
| Changes required | Sent back; the submitter must edit and resubmit | warning |
| Approved with changes | Can go live once the listed small edits are made, no second review | success |
| Approved | Cleared to run as is | success |
| Rejected | Can't run in any form | critical |

- A resubmitted asset goes back to Pending; its round ("Round 2") shows in the item's details, not in the tag.
- Never a sentence in a tag. The headline next to it explains.
- Pass `label` only to add a detail.
