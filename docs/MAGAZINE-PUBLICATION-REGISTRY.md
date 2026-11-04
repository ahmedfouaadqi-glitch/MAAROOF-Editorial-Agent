# Magazine and Editorial Publication Registry

## Why this registry is separate

This registry is distinct from the social-network catalogue. A magazine, a self-publishing platform, a CMS, and a social network have different editorial workflows and must not share a generic "publish" action.

## Preserve the original 17-entry seed list

The original user-provided list remains preserved in `docs/PLATFORM-REGISTRY.md` and `src/data/platforms.ts`. Its editorial destinations are:

- Medium
- Substack
- WordPress
- Blogger
- Ghost

The remaining entries in that original list are communities, research repositories, developer destinations, or web-data sources. They remain in the original registry and must not be represented as magazines.

The exact names/URLs of the user's separate original magazine list are not present in the currently retrievable project record. Do not fabricate or silently replace those names. Keep the existing seed list intact and merge the original magazine list when its source is available.

## Additional editorial destinations discovered

These are additions to the candidate registry, not claims of integration or guaranteed acceptance:

| Destination | Type | Submission path | Editorial fit |
|---|---|---|---|
| The Gulf Magazine | Regional editorial magazine | Guest article form / pitch; editor review | Gulf business, reporting, analysis and opinion |
| DAWN Prism | Magazine section | Pitch or article submission; editor review | South Asia, Pakistan and diaspora features/analysis |
| I by IMD | Business-school publication | Formal proposal first | Leadership, strategy, innovation, AI and business |
| +972 Magazine | Independent magazine | Pitch / op-ed submission | Middle East reporting, analysis and opinion |
| HackerNoon | Technology publication | Contributor/editorial workflow | Technology, software, AI and startups |
| DZone | Technology publication | Contributor/editorial workflow | Software engineering, cloud, DevOps and architecture |

Official submission references:
- The Gulf Magazine: https://thegulfmagazine.com/submit-article
- DAWN Prism: https://www.dawn.com/prism/submit
- I by IMD: https://www.imd.org/ibyimd/how-to-submit-content-to-ibyimd/
- +972 Magazine: https://www.972mag.com/how-to-submit/
- HackerNoon: https://hackernoon.com/
- DZone: https://dzone.com/

The first four have identifiable official submission guidance in the research performed for this update. HackerNoon and DZone are included as relevant technical editorial candidates, but their current contributor intake and submission requirements must be checked before a campaign is prepared.

## Editorial workflow types

### 1. Self-publishing
Examples: Medium, Substack. The author or publication owner controls the account and creates the post. The system can prepare a platform-specific draft, but direct publishing requires a supported, authorized adapter.

### 2. Publishing CMS
Examples: WordPress, Ghost, Blogger. These are publishing systems rather than individual magazines. Each website/publication is a separate destination with its own domain, credentials, roles, taxonomies, image rules, and publication policy.

### 3. Editorial submission
Examples: The Gulf Magazine, DAWN Prism, I by IMD, +972 Magazine. The system prepares the correct pitch or manuscript package and routes it through the official submission method. It must track submitted, editor-replied, revision-requested, accepted, rejected, and published states. A submission is never reported as publication.

## Platform-specific editorial requirements

- **The Gulf Magazine:** original reporting, sourced analysis, or evidence-backed opinion relevant to Gulf readers; include author bio, source links, and disclosures where relevant.
- **DAWN Prism:** regionally relevant feature/analysis; provide a short bio and separately supplied image captions and sources; avoid simultaneous submission to multiple DAWN desks or other newspapers where prohibited by the stated guidance.
- **I by IMD:** prepare a formal proposal first; do not send a full unsolicited draft before proposal approval.
- **+972 Magazine:** prepare a concise pitch covering why the story matters now, reporting plan/access, and the author's relevant insight or expertise.
- **HackerNoon / DZone:** use only for genuinely technical material and confirm current contributor rules before submission.

## Required magazine profile fields

Each registered publication should have:

- canonical name, domain, language, geography, subject areas, audience;
- destination type: self-publishing, CMS, editorial magazine, or section within a larger publication;
- submission route: API, authenticated CMS, contributor portal, email pitch, or manual handoff;
- official submission-guidelines URL and last-checked date;
- pitch-first requirement, accepted formats, word-count limits, image requirements, author bio, source/citation rules;
- exclusivity and simultaneous-submission policy;
- sponsored-content and disclosure policy;
- byline, rights/licensing, republication and embargo rules;
- account identity, authorization state, and workspace ownership;
- adapter status, supported operations, test evidence, and publication verification method.

## Publishing state machine

`candidate` → `policy_checked` → `account_or_submission_route_verified` → `draft_prepared` → `human_approved` → `submitted` → `editorial_review` → `revision_requested | accepted | rejected` → `published_verified`.

For self-publishing CMS destinations, use a separate flow: `draft` → `preview_verified` → `approved` → `publish_submitted` → `published_verified`.

Never treat `submitted`, `accepted`, or a successful button click as `published_verified`.

## Editorial and legal safeguards

- Never submit the same article to multiple publications where exclusivity or simultaneous-submission rules prohibit it.
- Track article originality and prior-publication status per destination.
- Preserve citations, image rights, captions, credits, disclosures, and author attribution.
- Never invent interviews, sources, credentials, or exclusive access.
- Do not promise acceptance, backlinks, search ranking, or AI visibility.
- Use manual submission when no approved and tested integration exists.
- Do not run paid research or publish externally without explicit authorization.

## Implementation status

This registry is a structured candidate catalogue and editorial workflow specification. It does not mean any magazine account is connected, any editorial submission was sent, or any publication adapter is operational.
