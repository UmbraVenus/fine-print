Fine Print is a review tool for marketing compliance teams. It should feel calm, exact and fast: the reviewer is the hero, the AI does the prep work, and nothing important is ever more than one click away.

## Voice

- Write findings as one plain sentence: what's wrong on this ad. "The rate claim is missing the full APR range", not "Reg Z §1026.16 violation". Put the rule name in the small mono line, not the headline.
- Sentence case everywhere, including buttons: "Request changes", "Use suggested fix".
- Status tags are one or two words, the terms review teams already use. A finding is **Critical**, **Caution** or **Good**; an asset is **Pending**, **Changes required**, **Approved with changes**, **Approved** or **Rejected** (Adobe Workfront's decision words, plus Rejected). The sentence next to the tag does the explaining.
- Specific over vague: "1 critical · due Oct 22", never "Some issues found".
- Never blame the submitter. Say what to change, not who got it wrong.
- No emoji, no exclamation marks. One light joke is allowed in empty states ("Queue cleared. Go get a snack.").
- The AI suggests, people decide. Nothing the AI finds ever disables Submit or Approve. To submitters, findings are "suggestions".
- Roles, not names, in the product: Marketer, Reviewer, Affiliate, Compliance lead.
- Due dates are days ("due today", "due Oct 23"), never hours. Review rounds are a dashboard metric, not shown on review screens.

## Color

- `ink` on `surface` for text; `ink-muted` for metadata; `surface-subtle` behind panels.
- `primary` (deep teal) for the one primary button per view, links, the selected nav item and the focus ring. Text on it is `on-primary`.
- `mint` is the brand tint: the logo lens and small fills with `ink` on them. Never mint text on white.
- A flagged area on an image gets a thin box: a 2px `ink` outline (`highlight-outline`) with a 1px white keyline so it shows on light and dark ads, plus a numbered pin. The selected one is `primary`. No fill and no thick border: an annotation must never hide or look like part of the ad. In text assets (emails, landing page copy, SMS, affiliate posts) the flagged phrase gets a 2px `ink` underline and the same numbered pin, the way a document editor marks comments. `highlight` (soft yellow) is reserved for words quoted inside a finding's text; never on the ad, buttons, banners or status.
- Status colors (`critical`, `warning`, `success`, each with a `-soft` background) only ever mean status, and always come with an icon and a word (`StatusTag`).
- Proportion: about 60% `surface`/`surface-subtle`, 30% `ink`, 10% accent.
- Every text pair listed in a token's note meets 4.5:1; control borders use `line-strong` (3.1:1). `line` is for decorative dividers only.

## Type and layout

- Inter (Google Fonts) for all UI; IBM Plex Mono only for asset IDs and rule citations (`mono`).
- `display` for the page title, `title` for the asset name, `heading` for a finding's headline, `body` for everything else, `caption` for metadata.
- 4px spacing grid: `space-4` inside cards and panels, `space-6` between sections, `space-8` page margins.
- `radius-md` on controls, `radius-lg` on cards and the ad frame, `radius-sm` on tags and highlight boxes.
- Borders first. Shadows only on what floats (`shadow-overlay`) and the selected item (`shadow-card`).
- The review screen is three columns: queue (`QueueItem` list) · the ad (`AdReview`) · findings (`ChecksSummary` + the findings list). The ad never scrolls out of view while findings open. Pins on the ad and items in the list are linked: selecting one highlights the other. Nothing floats over the ad.

## Components

- Build on antd 6 (React 18): wrap the app in `FinePrintProvider` and use antd for every standard control. The theme object is `FinePrint.theme`; it mirrors `tokens.json`.
- Fine Print's own pieces: `Logo`, `StatusTag`, `ChecksSummary`, `QueueItem`, `AdReview`. The findings list is still to be designed.
- Group findings by severity: Critical first, then Caution, then Good (collapsed but visible).
- Use **Approved with changes** when only small, clear edits remain: the asset can go live once they are made, with no second review round.
- Every action a reviewer takes can be undone, and every dismissal asks for a reason.

## Iconography

- Use `@ant-design/icons`, outlined by default. Status uses the filled set: `CloseCircleFilled` (Critical, Rejected), `ExclamationCircleFilled` (Caution), `CheckCircleFilled` (Good, Approved). The previews here draw small inline equivalents.
- Icons sit beside a word; an icon-only button needs an `aria-label`.

## Accessibility

- Keyboard first: queue items, highlight boxes and finding actions are all real buttons with a visible `primary` focus ring (2px, 2px offset).
- Never color alone: status, overdue and severity always carry a word.
- Light theme only for now; colors live in tokens so a dark theme can be added later.
