# MAAROOF Editorial Agent — UI System

## Visual direction
- Product UI uses an original editorial workspace: compact grouped navigation and precise surfaces, with a warm yellow-and-ink-black signature palette; it may borrow clarity from Linear-style tools but does not copy their layout or visual assets.
- Ivory and grayscale are supporting neutrals for legibility; yellow marks the active path and primary actions, while black anchors text, navigation, and the dark theme.
- Vector illustrations are native inline SVG. They are not stock images and do not depend on remote image services.
- Light mode is the default. Dark mode is a complete token set, not a separate page skin.
- Arabic is the default locale and the application shell switches RTL/LTR direction with the locale control.
- The mobile layout uses a collapsible side navigation; the browser assistant opens as a full-screen panel on phones and remains a side drawer on wider screens.

## React Bits integration
The project integrates the official React Bits `SpotlightCard` TypeScript/CSS component in:
- `src/components/SpotlightCard.tsx`
- `src/components/SpotlightCard.css`

The component is used selectively on the home hero, metric cards, article creation, and research settings. It adds pointer-reactive spotlight and border glow without adding a new runtime dependency. The rest of the design remains intentionally calm so interaction does not compete with editorial content.

Upstream source:
- https://github.com/DavidHDev/react-bits
- https://reactbits.dev/

The upstream repository declares MIT + Commons Clause licensing. Preserve upstream attribution and license notices when redistributing the component source. Do not redistribute the component library as a standalone product.

## Motion and accessibility
- Spotlight interaction respects `prefers-reduced-motion`.
- Decorative SVGs do not carry essential information.
- Controls have accessible labels or visible text.
- No WebGL, canvas, GSAP, or paid React Bits Pro assets are required for this UI implementation.

## Implemented views
- Overview dashboard with editorial pipeline, platform metrics, quick actions, and vector artwork.
- Article creation form connected to the standalone Node API.
- Article queue connected to the workspace article API, with explicit one-stage progression.
- Platform registry with filters and capability inspector.
- Research budget settings connected to the standalone Node API.
- Light/dark theme switch and Arabic/English shell labels.

## Known limitations
- The workspace ID is currently a development constant (`main-workspace`); production identity-to-workspace authorization is not implemented.
- API admin token is held in React memory for the active session and must not be exposed in a public bundle.
- Article creation and stage progression are operational only when the standalone API is running and a valid admin token is supplied.
- The UI includes manual evidence workflows and a generic user-controlled browser handoff. Verified platform-specific publishing adapters, automated submission, and external publication verification remain unimplemented; live search and scraping still require server-side provider configuration and quotas.
