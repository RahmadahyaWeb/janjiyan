---
version: 2.4.0
name: Mobbin
description: Mobbin is a gallery-white minimal system that disappears behind the content it curates, built on near-black ink on pure white canvas with neutral tints carrying structure instead of shadows, stadium-pill geometry, Saans at 652/456/300, and a single electric blue reserved for commercial signals.
colors:
  canvas: "#ffffff"
  bone: "#f3f3f3"
  card: "#ffffff"
  dark: "#141414"
  deep: "#0a0a0a"
  ink: "#141414"
  body: "#262626"
  charcoal: "#525252"
  mute: "#707070"
  ash: "#6b6b6b"
  stone: "#adadad"
  on-dark: "#fcfcfc"
  on-dark-mute: "rgba(252,252,252,0.72)"
  hero-background: "#ffffff"
  hero-title: "#141414"
  hero-subtitle: "#707070"
  hero-accent: "#0066ff"
  link: "#0066ff"
  ring-focus: "#141414"
  badge-accent: "#0066ff"
  badge-overlay: "rgba(115,115,115,0.56)"
  badge-text: "#ffffff"
  hairline: "#e0e0e0"
  divider: "#f0f0f0"
  primary: "#141414"
  accent: "#0066ff"
  field: "#f0f0f0"
  canvas-soft: "#f3f3f3"
  hairline-soft: "#f0f0f0"
  text-muted: "#707070"
  text-faint: "#6b6b6b"
  surface: "#f3f3f3"
colors-dark:
  canvas: "#0d0d0d"
  bone: "#1a1a1a"
  card: "#222222"
  dark: "#e8e8e8"
  deep: "#0a0a0a"
  ink: "#e8e8e8"
  body: "#c8c8c8"
  charcoal: "#a0a0a0"
  mute: "#a0a0a0"
  ash: "#adadad"
  stone: "#404040"
  on-dark: "#fcfcfc"
  on-dark-mute: "rgba(252,252,252,0.72)"
  hero-background: "#0d0d0d"
  hero-title: "#fcfcfc"
  hero-subtitle: "#a0a0a0"
  hero-accent: "#0066ff"
  link: "#5b9cff"
  ring-focus: "#fcfcfc"
  badge-accent: "#0066ff"
  badge-overlay: "rgba(115,115,115,0.56)"
  badge-text: "#ffffff"
  hairline: "#2e2e2e"
  divider: "#262626"
  primary: "#e8e8e8"
  accent: "#0066ff"
  field: "#252525"
  canvas-soft: "#1a1a1a"
  hairline-soft: "#262626"
  text-muted: "#a0a0a0"
  text-faint: "#adadad"
  surface: "#1a1a1a"
typography:
  display:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "80px"
    fontWeight: 652
    lineHeight: 1
    letterSpacing: "0"
  heading-1:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "56px"
    fontWeight: 652
    lineHeight: 1
    letterSpacing: "0"
  heading-2:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "44px"
    fontWeight: 652
    lineHeight: 1.13
    letterSpacing: "0"
  heading-3:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 652
    lineHeight: 1.13
    letterSpacing: "0"
  heading-4:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 652
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body-lg:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 300
    lineHeight: 1.38
    letterSpacing: "0"
  body:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 456
    lineHeight: 1.38
    letterSpacing: "0"
  body-sm:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 456
    lineHeight: 1.43
    letterSpacing: "0"
  link:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.38
    letterSpacing: "0"
  label:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0"
  caption:
    fontFamily: "Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 456
    lineHeight: 1.33
    letterSpacing: "0"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  xxxl: "64px"
  section: "80px"
  band: "120px"
rounded:
  none: "0px"
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "24px"
  full: "9999px"
components:
  nav-pill:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.link}"
    rounded: "{rounded.full}"
    padding: "0px {spacing.md}"
    height: "56px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.badge-text}"
    typography: "{typography.link}"
    rounded: "{rounded.full}"
    padding: "0px {spacing.md}"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.link}"
    rounded: "{rounded.full}"
    padding: "0px {spacing.md}"
    height: "48px"
  button-pill-soft:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.link}"
    rounded: "{rounded.full}"
    padding: "0px {spacing.md}"
    height: "40px"
  text-input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.md}"
    height: "48px"
  badge-popular:
    backgroundColor: "{colors.badge-accent}"
    textColor: "{colors.badge-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.xxs} {spacing.sm}"
    height: "24px"
  badge-overlay:
    backgroundColor: "{colors.badge-overlay}"
    textColor: "{colors.badge-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.xxs} {spacing.sm}"
    height: "28px"
  pricing-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
    height: "auto"
  pricing-card-featured:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
    height: "auto"
  segmented-control:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.mute}"
    typography: "{typography.link}"
    rounded: "{rounded.full}"
    padding: "{spacing.xxs}"
    height: "48px"
  segmented-control-active:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.link}"
    rounded: "{rounded.full}"
    padding: "0px {spacing.md}"
    height: "40px"
  testimonial-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
    height: "auto"
  faq-row:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
    height: "auto"
  footer:
    backgroundColor: "{colors.dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
    height: "auto"
---

## Overview

Mobbin is a reference library of real product interfaces, and its own interface is engineered to get out of the way. The system is strictly monochrome — near-black ink ({colors.ink}) on a pure white canvas ({colors.canvas}) — with structure carried by a ladder of barely-perceptible neutral tints ({colors.bone}, {colors.field}, {colors.hairline}) rather than by shadows or color. The thousands of app screenshots, icon tiles, and brand logos the site exists to show are the only saturated elements on any page — the chrome frames them the way a gallery wall frames paintings.

The geometry does the brand work that color refuses to do. Every interaction is a stadium pill ({rounded.full}) — the floating navigation bar ({components.nav-pill}), every button ({components.button-primary}), the segmented billing toggle ({components.segmented-control}), the overlay badges ({components.badge-overlay}). Containers sit at a calm {rounded.md}, media tiles at {rounded.sm}, and app icons render as iOS-style squircles at 30% corner radius. Type is set in Saans at deliberately non-standard variable weights — a chunky 652 for every heading ({typography.display}), a bookish 456 for text ({typography.body}), an airy 300 for hero subtitles ({typography.body-lg}) — which gives the monochrome pages a strong typographic voice without a single decorative flourish.

One color is allowed to interrupt: an electric blue accent ({colors.accent}), used exclusively for commercial signals — the Popular plan badge ({components.badge-popular}) and the yearly-savings callout on pricing. Its scarcity is the point — when blue appears, it is asking for a decision.

**Key Characteristics:**
- Gallery-white monochrome palette — {colors.ink} on {colors.canvas}, zero brand chroma outside the single {colors.accent} blue
- Stadium-pill interaction language: nav bar, buttons, toggles, and badges all at {rounded.full}
- Shadow-free elevation — hierarchy built from a neutral tint ladder ({colors.bone}, {colors.field}, {colors.hairline}) and 1px hairlines ({colors.divider})
- Saans at signature variable weights: 652 headings ({typography.heading-1}) with tight 1.0–1.13 line-height, 456 body ({typography.body}), 300 light subtitles ({typography.body-lg})
- iOS-style squircle icon tiles (30% radius) as a recurring visual motif across library counters and brand marquees
- Content supplies the color: app screenshots, brand icons, and grayscale curator portraits carry all visual richness
- Full-bleed near-black {colors.dark} footer ({components.footer}) with rounded top corners ({rounded.md}) closes every page in polarity inversion

## Colors

Source pages: home, pricing, awards, signup. All values reference {colors.canvas} through {colors.badge-text} with dark-mode mirrors in {colors-dark}.

### Brand & Accent
- **Ink Black** ({colors.primary}): The brand color. Fills every primary CTA pill ({components.button-primary}), the footer band ({components.footer}), and all display typography ({typography.display}). Mobbin's identity is this near-black, softened just off pure black to sit comfortably next to photography.
- **Electric Blue** ({colors.accent}): The only chromatic accent in the system. Reserved for commercial emphasis — the Popular pricing badge ({components.badge-popular}) and savings callouts ({colors.hero-accent}). Never used decoratively, never used for CTAs — primary actions stay {colors.primary} ink pills.

### Surface
- **Canvas** ({colors.canvas}): Default page and card background ({components.pricing-card}) across all pages.
- **Bone / Soft Canvas** ({colors.bone}): The workhorse tint — a 6% ink wash over white. Fills the floating nav pill ({components.nav-pill}), the featured pricing card ({components.pricing-card-featured}), FAQ accordion rows ({components.faq-row}), soft utility pills ({components.button-pill-soft}), segmented-control tracks ({components.segmented-control}), and the highlighted comparison-table column.
- **Card** ({colors.card}): Elevated white surface for pricing and testimonial cards ({components.testimonial-card}) sitting on {colors.bone}.
- **Dark** ({colors.dark}): Polarity-inverted ink fill for footer ({components.footer}) and primary buttons ({components.button-primary}).
- **Deep** ({colors.deep}): Deepest baseboard tone behind dark-mode canvas ({colors-dark.canvas}).
- **Field** ({colors.field}): An 8% ink wash used as the fill for form inputs ({components.text-input}), giving fields presence without borders.
- **Soft Hairline** ({colors.hairline-soft}): 1px card outlines — the faintest possible edge, used on white-on-white cards.
- **Hairline** ({colors.hairline}): The stronger control border, used on outlined pill buttons ({components.button-outline}) and interactive chrome.
- **Divider** ({colors.divider}): Horizontal rule and row separator tone for tables and stacked lists.

### Text
- **Ink** ({colors.ink}): Headings, body copy ({typography.body}), and nav links ({typography.link}).
- **Body** ({colors.body}): Slightly lifted dark for secondary lockups and the awards wordmark.
- **Charcoal** ({colors.charcoal}): Mid-ink for plan names ({typography.heading-4}) and emphasized rows ({typography.title}).
- **Mute** ({colors.mute}): Secondary copy — supporting paragraphs, plan descriptions, vote counts, underlined inline links ({colors.link}).
- **Ash** ({colors.ash}): Tertiary text — placeholders, de-emphasized footer links, fine print ({typography.caption}).
- **Stone** ({colors.stone}): Faintest edge-text for disabled states and hairline labels ({typography.label}).
- **On-Dark** ({colors.on-dark}): Light text on {colors.dark} fills — footer headings and primary-button labels.
- **On-Dark-Mute** ({colors.on-dark-mute}): Diminished light text for footer secondary links and captions on dark.

### Semantic
- The system ships no dedicated success/warning/error palette on its marketing surfaces — state communication stays within the monochrome ladder ({colors.ink} through {colors.stone}), with {colors.accent} as the sole positive-emphasis signal ({colors.badge-accent}).
- **Hero** tokens anchor the marketing lockup: background {colors.hero-background}, title {colors.hero-title} in {typography.display}, subtitle {colors.hero-subtitle} in {typography.body-lg}, accent {colors.hero-accent} for savings callouts.
- **Link** ({colors.link}) renders inline actions in {typography.link} with focus ring {colors.ring-focus}; badges use {colors.badge-accent} fill with {colors.badge-text} label in {typography.label}, while photo overlays use {colors.badge-overlay} scrim with {colors.badge-text}.

| Token | Light | Dark | Use |
|---|---|---|---|
| {colors.canvas} / {colors-dark.canvas} | {colors.canvas} white canvas | {colors-dark.canvas} near-black canvas | Page background ({colors.hero-background}) |
| {colors.bone} / {colors-dark.bone} | {colors.bone} soft tint | {colors-dark.bone} dark tint | Nav pill ({components.nav-pill}), featured card ({components.pricing-card-featured}), FAQ ({components.faq-row}) |
| {colors.card} / {colors-dark.card} | {colors.card} white card | {colors-dark.card} charcoal card | Cards ({components.pricing-card}, {components.testimonial-card}) |
| {colors.ink} / {colors-dark.ink} | {colors.ink} near-black | {colors-dark.ink} off-white | Headings ({typography.heading-1}), body ({typography.body}) |
| {colors.mute} / {colors-dark.mute} | {colors.mute} mid-gray | {colors-dark.mute} light gray | Secondary copy ({typography.body-sm}) |
| {colors.hairline} / {colors-dark.hairline} | {colors.hairline} control border | {colors-dark.hairline} dark border | Outlined buttons ({components.button-outline}) |
| {colors.divider} / {colors-dark.divider} | {colors.divider} faint rule | {colors-dark.divider} dark rule | Dividers, table rows |
| {colors.accent} / {colors-dark.accent} | {colors.accent} electric blue | {colors-dark.accent} electric blue | Commercial-only badge ({components.badge-popular}) |
| {colors.link} / {colors-dark.link} | {colors.link} blue link | {colors-dark.link} light blue link | Inline links ({typography.link}) |
| {colors.ring-focus} / {colors-dark.ring-focus} | {colors.ring-focus} ink ring | {colors-dark.ring-focus} white ring | Focus outline |
| {colors.hero-title} / {colors-dark.hero-title} | {colors.hero-title} ink hero | {colors-dark.hero-title} white hero | Hero display ({typography.display}) |
| {colors.hero-subtitle} / {colors-dark.hero-subtitle} | {colors.hero-subtitle} gray lead | {colors-dark.hero-subtitle} gray lead | Hero lead ({typography.body-lg}) |
| {colors.on-dark} / {colors-dark.on-dark} | {colors.on-dark} white on dark | {colors-dark.on-dark} white on dark | Footer text ({components.footer}) |

Dark mode preserves the flat, shadow-free logic — fills shift from {colors.bone} to {colors-dark.bone} and hairlines from {colors.hairline} to {colors-dark.hairline}, while {colors.accent} and {colors.badge-overlay} stay identical across modes so commercial signals never change meaning.

## Typography

### Font Family

**Saans** — a contemporary neo-grotesque used exclusively, across every page and every role ({typography.display} through {typography.caption}). It is loaded as a variable font, and the brand's voice comes from where it sits on the weight axis: headings render at an unusual 652 ({typography.heading-1}), running text at 456 ({typography.body}), and hero subtitles at a genuinely light 300 ({typography.body-lg}). Fallback stack: Saans, Inter, Hanken Grotesk, -apple-system, Helvetica Neue, Arial, sans-serif ({typography.body}).

Substitutes: Saans is commercial. The closest widely-available substitutes are **Inter** (variable, supports the 300/450/650 weight positions via its variable axis) or **Hanken Grotesk**. When substituting, map weight 652 ({typography.display}) to 650 (or 700 at static weights), 456 ({typography.body}) to 450 (or 500), and keep line-heights as specified — Saans has a compact x-height, so substitutes may need line-height reduced slightly.

Mono accents use Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace for code and data-table eyebrows.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| {typography.display} | 80px ({spacing.section} scale) | 652 | 1.0 | 0 | Homepage hero statements and library counters |
| {typography.heading-1} | 56px | 652 | 1.0 | 0 | Page heroes in {colors.hero-title} |
| {typography.heading-2} | 44px | 652 | 1.13 | 0 | Section headings on content pages |
| {typography.heading-3} | 32px | 652 | 1.13 | 0 | Card-level headlines, award winner names, auth headings |
| {typography.heading-4} | 24px ({spacing.lg} scale) | 652 | 1.25 | 0 | Sub-section headings, plan names in {colors.charcoal} |
| {typography.title} | 20px | 600 | 1.3 | 0 | Feature titles, emphasized rows in {colors.body} |
| {typography.body-lg} | 20px | 300 | 1.38 | 0 | Hero subtitles in {colors.hero-subtitle} — the light counterpoint to 652 headings |
| {typography.body} | 16px ({spacing.md} scale) | 456 | 1.38 | 0 | Default body copy in {colors.ink}, testimonial quotes ({components.testimonial-card}) |
| {typography.body-sm} | 14px | 456 | 1.43 | 0 | Supporting copy, plan feature lists, legal text in {colors.mute} |
| {typography.link} | 16px ({spacing.md} scale) | 600 | 1.38 | 0 | Nav links ({components.nav-pill}) and button labels ({components.button-primary}) in {colors.ink} |
| {typography.label} | 12px ({spacing.sm} scale) | 600 | 1.33 | 0 | Badge and pill labels ({components.badge-popular}) in {colors.badge-text} |
| {typography.caption} | 12px ({spacing.sm} scale) | 456 | 1.33 | 0 | Captions, metadata, form fine print in {colors.ash} |

### Principles

- **Weight contrast is the drama.** Pairing 652 headings ({typography.heading-1}) against 300 light subtitles ({typography.body-lg}) at the same scale step creates hierarchy without color ({colors.canvas}) or ornament.
- **Tight leading up top.** Display ({typography.display}) and heading-1 ({typography.heading-1}) sit at line-height 1.0; headings never breathe more than 1.25 ({typography.heading-4}). Body text ({typography.body}) opens up to 1.38–1.43 ({typography.body-sm}).
- **Zero letter-spacing everywhere.** The grotesque is trusted at its natural fit ({typography.caption}); no tracking adjustments at any size.
- **Sentence case with terminal periods.** Headlines in {typography.heading-2} read as declarative sentences — the period is part of the voice, set in {colors.ink}.

### Note on Font Substitutes

Saans is a commercial typeface. The closest widely-available substitutes are **Inter** (variable, supports the 300/450/650 weight positions via its variable axis) or **Hanken Grotesk**. When substituting, map weight 652 ({typography.display}) → 650 (or 700 at static weights), 456 ({typography.body}) → 450 (or 500), and keep line-heights as specified — Saans has a compact x-height, so substitutes may need line-height reduced by a hair. Mono fallbacks stay in Geist Mono for tabular data. Always keep {typography.label} at 600 and {typography.caption} at 456 so badge ({components.badge-overlay}) and fine-print hierarchy survive the swap.

## Layout & Spacing

The layout system centers heroes, pairs pricing two-up, grids portraits three-up, and stacks testimonials in four-column masonry — all breathing on a strict 8px base with generous section rhythm ({spacing.section} to {spacing.band}).

Semantic spacing scale — base unit {spacing.xs} with {spacing.xxs} half-steps:
- {spacing.xxs} — micro gaps: badge padding ({components.badge-popular}), segmented-track inset ({components.segmented-control})
- {spacing.xs} — tight rhythm: icon-to-label gaps, chip gutters
- {spacing.sm} — component inner padding: inputs ({components.text-input}), FAQ gaps ({components.faq-row})
- {spacing.md} — standard gutter: button horizontal padding ({components.button-primary}), card-stack gaps
- {spacing.lg} — card padding ({components.pricing-card}, {components.testimonial-card})
- {spacing.xl} — section inner padding, footer padding ({components.footer})
- {spacing.xxl} — large separations between content blocks
- {spacing.xxxl} — extra separation for hero-to-grid transitions
- {spacing.section} — inter-section rhythm separating major acts
- {spacing.band} — homepage act breaks between collage and typographic interludes

Buttons are fixed-height pills padded horizontally at {spacing.md} ({components.button-primary}); inputs pad {spacing.sm} {spacing.md} ({components.text-input}). Universal rhythm constants recur on every page using {spacing.section} steps.

Grid & container: content rides a centered column on {colors.canvas} — single-column centered lockups for heroes ({typography.display} in {colors.hero-title} with {typography.body-lg} in {colors.hero-subtitle}), a 2-up card grid for pricing plans ({components.pricing-card}), 3-up for portrait tiles, and a 4-column masonry for testimonials ({components.testimonial-card}). The floating nav pill ({components.nav-pill}) in {colors.bone} is detached from the viewport edge and horizontally centered, rather than a full-width bar — the page canvas ({colors.canvas}) visibly wraps around it. Marquee strips (brand logos, app screenshots) run full-bleed beyond the content column at {rounded.none}.

Whitespace philosophy: whitespace is the primary grouping device. Sections are separated by {spacing.section} to {spacing.band} of empty {colors.canvas} with no divider rules ({colors.divider} reserved for tables); within cards, generous {spacing.lg} padding keeps content off the hairline ({colors.hairline-soft}) edges. The homepage alternates dense collage moments (icon clouds, screenshot grids) with near-empty typographic interludes — compression and release.

## Elevation & Depth

The system is essentially shadow-free: no drop shadows appear on any card ({components.pricing-card}), button ({components.button-primary}), or nav element ({components.nav-pill}). Elevation is communicated by *fill difference* (white {colors.canvas} vs. 6–8% ink tints {colors.bone} and {colors.field}) and by hairlines ({colors.hairline}), which keeps every surface print-flat and lets the screenshot content supply all depth cues.

| Level | Treatment | Use |
|---|---|---|
| 0 | Flat on {colors.canvas} | Default — most of every page, heroes ({colors.hero-background}) |
| 1 | {colors.bone} fill, no border | Nav pill ({components.nav-pill}), featured pricing card ({components.pricing-card-featured}), FAQ rows ({components.faq-row}), soft pills ({components.button-pill-soft}) |
| 2 | 1px {colors.hairline-soft} outline on {colors.card} | Pricing ({components.pricing-card}) and testimonial cards ({components.testimonial-card}) |
| 3 | 1px inset ring in {colors.hairline} | Comparison-table highlight column edge, segmented active edge ({components.segmented-control-active}) |
| Inverse | {colors.dark} fill, {colors.on-dark} text | Footer band ({components.footer}), primary CTAs ({components.button-primary}) |

The one soft-shadow exception is the active segment of the segmented control ({components.segmented-control-active}), which lifts off its {colors.bone} track ({components.segmented-control}) as a white pill ({colors.canvas}).

### Decorative Depth

- **Glass monoliths** — the awards hero renders tall trophy pillars in a white-to-gray vertical gradient, reading as frosted glass against the {colors.bone} band; the page's only atmospheric gradient, headed in {typography.heading-1}.
- **Photography as depth** — floating app-icon squircles (30% radius), angled screenshot collages (signup's rotated marquee panel at {rounded.md}), and device mockups create parallax-like layering on a flat {colors.canvas}.
- **Polarity inversion** — the {colors.dark} footer ({components.footer}) with {rounded.md} top corners and {colors.on-dark} display type acts as a heavy baseboard, giving each page a physical end-stop in {colors.ink}.

## Shapes

Geometry does the brand work color refuses: pills everywhere for interaction, calm large radii for containers, squircles for icons.

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| {rounded.none} | 0px ({spacing.xxs} flush) | Full-bleed media strips and marquee images |
| {rounded.xs} | 8px ({spacing.xs} radius) | Tiny chips, focus rings ({colors.ring-focus}), dense UI |
| {rounded.sm} | 16px ({spacing.md} radius) | Inputs ({components.text-input}), video tiles, testimonial cards ({components.testimonial-card}), FAQ rows ({components.faq-row}) |
| {rounded.md} | 24px ({spacing.lg} radius) | Content cards ({components.pricing-card}), device mockups, portrait tiles, footer top corners ({components.footer}) |
| {rounded.lg} | 24px ({spacing.lg} radius) | Large cards and featured surfaces ({components.pricing-card-featured}) — mirrors {rounded.md} for scale continuity |
| {rounded.full} | 9999px stadium pill | Every pill: nav ({components.nav-pill}), buttons ({components.button-primary}), badges ({components.badge-popular}, {components.badge-overlay}), toggles ({components.segmented-control}) |

### Photography Geometry

- App screenshots render inside device-shaped frames at {rounded.md} on {colors.canvas}, preserving aspect ratios and cropping rather than stretching.
- App icons use the signature 30% squircle radius — the iOS icon silhouette — at every size from small chips ({spacing.xl} tiles) to large hero tiles, anchoring brand-chip lockups in {typography.heading-3}.
- Curator portraits are near-square tiles at {rounded.md}, always black-and-white grayscale, with name captions overlaid in {colors.on-dark} on a {colors.badge-overlay} scrim ({components.badge-overlay}) near the lower edge in {typography.label}.
- Avatars in testimonial cards ({components.testimonial-card}) are small circles ({rounded.full}) with a tiny company logo badge overlapping the bottom-right corner, set in {typography.body-sm} with {colors.mute} metadata.
- Marquee photography runs full-bleed at {rounded.none} and overflows the viewport intentionally, cropping at the edge rather than scaling, spaced on {spacing.section} rhythm.

## Components

All interactive elements are stadium pills ({rounded.full}); all containers are flat fills ({colors.canvas}, {colors.bone}) with hairlines ({colors.hairline}) — no shadows.

### Buttons & Interaction

**`button-primary` ({components.button-primary})** — Join for free, Get started, Continue, View winners.
- Background {colors.primary}, text {colors.badge-text}, type {typography.link}, rounded: {rounded.full}, padding 0px {spacing.md}, height 48px
- The single CTA style everywhere: nav ({components.nav-pill}), pricing cards ({components.pricing-card-featured}), auth form, awards hero ({colors.hero-title})

**`button-outline` ({components.button-outline})** — Continue with Google, secondary Get started.
- Background {colors.canvas}, text {colors.ink}, type {typography.link}, rounded: {rounded.full}, padding 0px {spacing.md}, height 48px
- 1px {colors.hairline} border; the de-emphasized twin of the primary pill ({components.button-primary}) for side-by-side actions or third-party auth

**`button-pill-soft` ({components.button-pill-soft})** — Explore, Mobbin, Read more.
- Background {colors.bone}, text {colors.ink}, type {typography.link}, rounded: {rounded.full}, padding 0px {spacing.md}, height 40px
- Tertiary utility pill for outbound and in-page links; no border, relies on its {colors.bone} tint fill

**`segmented-control` ({components.segmented-control}) + `segmented-control-active` ({components.segmented-control-active})** — billing-period toggle.
- Background {colors.bone}, text {colors.mute}, type {typography.link}, rounded: {rounded.full}, padding {spacing.xxs}, height 48px; active: Background {colors.canvas}, text {colors.ink}, type {typography.link}, rounded: {rounded.full}, padding 0px {spacing.md}, height 40px
- A {colors.bone} stadium track holding two pill options; the active option is a {colors.canvas} white pill, the inactive label sits in {colors.mute}

### Inputs & Selection

**`text-input` ({components.text-input})** — default field.
- Background {colors.field}, text {colors.ink} with {colors.ash} placeholder in {typography.body-sm}, type {typography.body}, rounded: {rounded.sm}, padding {spacing.sm} {spacing.md}, height 48px
- {colors.field} fill, no border at rest; focus adds a 2px {colors.ring-focus} ink ring — focus is signaled in ink, consistent with the monochrome system

**`faq-row` ({components.faq-row})** — accordion item / selectable row.
- Background {colors.bone}, text {colors.ink}, type {typography.body}, rounded: {rounded.sm}, padding {spacing.md}, height auto
- Full-width {colors.bone} bar with trailing chevron in {colors.mute}; rows stack with {spacing.sm} gaps

### Chips & Controls

**`badge-popular` ({components.badge-popular})** — featured-tier marker; the only blue element on the page.
- Background {colors.badge-accent}, text {colors.badge-text}, type {typography.label}, rounded: {rounded.full}, padding {spacing.xxs} {spacing.sm}, height 24px
- Compact {colors.accent} chip beside the plan name ({typography.heading-4}) in the featured card ({components.pricing-card-featured})

**`badge-overlay` ({components.badge-overlay})** — photo tag.
- Background {colors.badge-overlay}, text {colors.badge-text}, type {typography.label}, rounded: {rounded.full}, padding {spacing.xxs} {spacing.sm}, height 28px
- Translucent gray pill laid over photography and screenshots (category tags, portrait captions) in {typography.label}

**`brand-chip`** — marquee lockup of squircle icon + brand name in {typography.heading-3} ink ({colors.ink}); scrolls horizontally in full-bleed strips ({rounded.none}) on {colors.canvas}.
- Background {colors.canvas}, text {colors.ink}, type {typography.heading-3}, rounded: {rounded.full}, padding {spacing.xs} {spacing.md}, height 48px

**`app-icon-squircle`** — recurring 30%-radius icon tile; floats in loose clouds around library counters ({typography.display}), lines up in Other nominees rows, anchors brand-chip entries.
- Background {colors.bone}, text {colors.ink}, type {typography.caption}, rounded: {rounded.md}, padding {spacing.xxs}, height auto

### Data & Containers

**`pricing-card` ({components.pricing-card})** — default plan tier.
- Background {colors.canvas}, text {colors.ink}, type {typography.body-sm}, rounded: {rounded.md}, padding {spacing.lg}, height auto
- 1px {colors.hairline-soft} outline; plan name in {typography.heading-4} with {colors.charcoal} qualifiers, feature rows in {typography.body-sm} with {colors.mute} icons

**`pricing-card-featured` ({components.pricing-card-featured})** — highlighted Pro tier.
- Background {colors.bone}, text {colors.ink}, type {typography.body-sm}, rounded: {rounded.md}, padding {spacing.lg}, height auto
- Borderless {colors.bone} fill — emphasis by tint, not outline; carries {components.badge-popular} and full-width {components.button-primary} while default tier gets {components.button-outline}

**`testimonial-card` ({components.testimonial-card})** — user quote tile in 4-column masonry.
- Background {colors.canvas}, text {colors.ink}, type {typography.body}, rounded: {rounded.sm}, padding {spacing.lg}, height auto
- 1px {colors.hairline-soft} outline; circular avatar ({rounded.full}) with company mini-badge, name in {typography.link}, company in {colors.mute} {typography.body-sm}, quote in {typography.body}

**`compare-table`** — pricing comparison grid: feature rows divided by 1px {colors.divider} rules, recommended column washed in {colors.bone} with inset {colors.hairline} edge.
- Background {colors.canvas}, text {colors.ink}, type {typography.body-sm}, rounded: {rounded.md}, padding {spacing.lg}, height auto

**`portrait-tile`** — curator/juror grid cell; grayscale photograph at {rounded.md}, name + role caption overlaid in {colors.on-dark} on {colors.badge-overlay}.
- Background {colors.card}, text {colors.on-dark}, type {typography.label}, rounded: {rounded.md}, padding {spacing.xs}, height auto

### Feedback Components

**`award-lockup`** — centered winner presentation: laurel-flanked eyebrow in {colors.mute} {typography.label}, winner name in {typography.heading-3} with {colors.ink}, description in {colors.mute} {typography.body}, vote share in {typography.body-sm}, closed by {components.button-pill-soft}.
- Background {colors.canvas}, text {colors.ink}, type {typography.heading-3}, rounded: {rounded.md}, padding {spacing.xl}, height auto

**Toast / empty-state** — feature-card chrome ({components.pricing-card}) with {colors.canvas} fill, {typography.body-sm} in {colors.body}, {rounded.md}, padding {spacing.sm} {spacing.md} ({spacing.xxl} for empty-state), height auto; captions use {typography.body} in {colors.mute}.

### Navigation

**`nav-pill` ({components.nav-pill})** — Top Nav Desktop.
- Background {colors.bone}, text {colors.ink}, type {typography.link}, rounded: {rounded.full}, padding 0px {spacing.md}, height 56px
- Floating, horizontally-centered stadium bar in {colors.bone}: logomark + wordmark left, text links in {typography.link} right, capped by {components.button-primary}; detaches from page edge with visible {colors.canvas} above it, persists sticky on scroll

**Top Nav Mobile** — pill ({components.nav-pill}) tightens to logomark + CTA ({components.button-primary}); links collapse behind the pill, height stays 56px ({spacing.section} rhythm preserved).

**Sub-nav Awards** — minimal corner marks instead of a bar: logomark + section name in {typography.title} with {colors.body} top-left, a {components.button-pill-soft} return link top-right.

**`footer` ({components.footer})** — full-width {colors.dark} band with {rounded.md} top corners.
- Background {colors.dark}, text {colors.on-dark}, type {typography.body-sm}, rounded: {rounded.md}, padding {spacing.xl}, height auto
- White wordmark at display scale ({typography.display} in {colors.on-dark}), tagline in {colors.on-dark-mute} {typography.body-lg}, two columns of {colors.on-dark-mute} links in {typography.body-sm} that read in {colors.on-dark} for emphasis rows

## Do's and Don'ts

### Do
- Keep the canvas {colors.canvas} white and let imported content (screenshots, icons, logos) supply all saturation — chrome stays {colors.bone} and {colors.field}.
- Use {rounded.full} for every interactive element ({components.button-primary}, {components.nav-pill}, {components.segmented-control}, {components.badge-overlay}) — a rectangular button does not exist in this system.
- Build emphasis with the tint ladder: {colors.bone} fill for featured surfaces ({components.pricing-card-featured}), {colors.hairline-soft} outlines for resting cards ({components.pricing-card}).
- Reserve {colors.accent} for commercial signals ({components.badge-popular}, {colors.hero-accent} savings callouts) — one or two blue elements per page at most.
- Set every heading in Saans 652 ({typography.display} through {typography.heading-4}) with line-height 1.0–1.13 and end headline sentences with a period.
- Pair heavy 652 headings ({typography.heading-1}) with 300-weight {typography.body-lg} subtitles in {colors.hero-subtitle} for hierarchy without color.
- Render app icons as 30% squircles and portraits in grayscale at {rounded.md} to keep third-party imagery inside the system.
- Close pages with the inverse {colors.dark} footer ({components.footer}), rounded at the top ({rounded.md}) with {colors.on-dark} type.

### Don't
- Don't add drop shadows — elevation is {colors.bone} fills and {colors.hairline} hairlines only, never shadows.
- Don't use {colors.accent} for CTAs; primary actions are always {colors.primary} ink pills ({components.button-primary}) in {typography.link}.
- Don't introduce additional accent hues, gradients on UI chrome, or colored section bands beyond {colors.canvas} and {colors.bone}.
- Don't outline the featured pricing tier ({components.pricing-card-featured}) — feature it with the {colors.bone} fill and {components.badge-popular} instead.
- Don't apply letter-spacing or all-caps styling; the type system ({typography.body}, {typography.label}) runs at natural tracking in sentence case.
- Don't put borders on form fields at rest — inputs ({components.text-input}) are {colors.field} tint fills with {colors.ash} placeholders; the border appears only as the 2px {colors.ring-focus} ink focus ring.
- Don't let full-color photography of people into the curator grids; portraits stay strictly black-and-white with {colors.badge-overlay} captions in {colors.on-dark}.
- Don't square off pill geometry at small sizes — badges ({components.badge-popular}), chips, and toggles ({components.segmented-control}) stay stadium-shaped at {rounded.full}.

## Responsive Behavior

The floating pill persists, grids collapse column-by-column, and marquees crop rather than scale — all on {colors.canvas} with {rounded.full} interaction preserved.

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| 2xl | 1536px ({spacing.band} canvas) | Max content width engaged; marquees widen at {rounded.none} |
| xl | 1280px ({spacing.section} grid) | Default desktop grid in {colors.canvas} |
| lg | 1024px ({spacing.xxl} condense) | Comparison table condenses; testimonial masonry ({components.testimonial-card}) drops to 3 columns |
| md | 840px / 768px ({spacing.section} stack) | Pricing cards ({components.pricing-card}) stack to 1-up; portrait grid drops to 2-up; nav links ({typography.link}) collapse |
| sm | 719px / 640px ({spacing.lg} single-column) | Single-column layouts; display type ({typography.display}) scales down from hero scale |
| xs | 600px ({spacing.md} minimum) | Minimum layout; auth split-panel drops its screenshot marquee, keeps centered form ({components.text-input}) |

### Touch Targets

- Pill buttons ({components.button-primary}) and nav CTAs ({components.nav-pill}) are fixed-height stadium shapes at 48–56px ({spacing.xxl} rhythm) comfortably above minimum touch size; form inputs ({components.text-input}) pad to a similar height via {spacing.sm} {spacing.md}.
- The segmented billing toggle ({components.segmented-control}) presents each option ({components.segmented-control-active}) as a full pill target in {typography.link}, not a small radio dot.
- Overlay badges ({components.badge-overlay}) and soft pills ({components.button-pill-soft}) keep {rounded.full} hit areas with {spacing.xs} minimum gutters.

### Collapsing Strategy

- The floating {components.nav-pill} in {colors.bone} persists on scroll and across breakpoints, tightening to logomark + CTA ({components.button-primary}) on narrow screens.
- Multi-column grids (pricing 2-up {components.pricing-card}, portraits 3-up, testimonials 4-up {components.testimonial-card}) collapse column-by-column rather than reflowing horizontally, preserving {spacing.md} gutters and {rounded.md} corners.
- The signup page's two-panel split (form {components.text-input} left, angled screenshot marquee right) drops the marquee panel entirely on narrow viewports, keeping the centered form column on {colors.canvas}.
- Footer ({components.footer}) stacks its {colors.on-dark} columns vertically, keeping the {rounded.md} top corners and {colors.dark} inversion intact.

### Image Behavior

- App screenshots and device mockups keep fixed aspect ratios and {rounded.md} corners at all sizes on {colors.canvas}.
- Marquee strips overflow the viewport intentionally at {rounded.none} and animate horizontally; they crop rather than scale, spaced on {spacing.section} rhythm.
- Curator portraits stay square-ish tiles at {rounded.md}, lazily loaded, always grayscale with {colors.badge-overlay} captions in {colors.on-dark} ({typography.label}).
- Squircle icons (30% radius) scale from {spacing.xl} chips to hero tiles without redrawing, anchoring brand lockups in {typography.heading-3}.

## Iteration Guide

1. **Start from the tint ladder, not color.** When adding a surface, choose first between {colors.canvas}, {colors.bone}, and {colors.field} — if it needs emphasis, use {colors.bone} fill ({components.pricing-card-featured}); if it needs quiet separation, use a 1px {colors.hairline-soft} outline ({components.pricing-card}). Never reach for shadow or hue.
2. **Keep pills pill-shaped.** Any new interactive element — button, toggle, badge, input-chip — must use {rounded.full} with {typography.link} or {typography.label}. Reserve {rounded.sm} for tiles ({components.testimonial-card}, {components.text-input}) and {rounded.md} for cards ({components.pricing-card}). Verify against {components.button-primary} and {components.nav-pill}.
3. **Guard the blue.** Before using {colors.accent} or {colors.badge-accent}, confirm the element is a commercial signal (featured badge {components.badge-popular}, savings callout {colors.hero-accent}). If it is navigation, CTA, or decoration, use {colors.primary} or {colors.ink} instead.
4. **Pair heavy with light.** Every new hero must combine a 652 heading ({typography.display} or {typography.heading-1} in {colors.hero-title}) with a 300 lead ({typography.body-lg} in {colors.hero-subtitle}). Check tight leading (1.0 for {typography.display}) and zero letter-spacing, sentence case with terminal period.
5. **Substitute type carefully.** If Saans is unavailable, swap to Inter or Hanken Grotesk, remap 652 → 650 and 456 ({typography.body}) → 450, and re-check {typography.body-lg} at 300 for lightness. Keep {colors.ink} headings and {colors.mute} secondary copy intact.
6. **Treat imagery as the palette.** New screenshots keep {rounded.md} device frames; new icons must be redrawn as 30% squircles; new people photos must ship grayscale with {colors.badge-overlay} captions ({components.badge-overlay}) in {colors.on-dark}. Color photography belongs only to product content, never chrome.
7. **Close with inversion.** Every new page template must end with {components.footer} — {colors.dark} fill, {colors.on-dark} type, {rounded.md} top corners — and verify dark-mode mirror ({colors-dark.canvas}, {colors-dark.ink}, {colors-dark.hairline}) still reads flat and shadow-free.

## Known Gaps

- **Semantic state palette undocumented.** Success, warning, and error treatments beyond the monochrome ladder ({colors.ink} through {colors.stone}) and single {colors.accent} signal are not specified — form validation, destructive confirmations, and inline alerts need dedicated {colors.ring-focus} and {colors.badge-accent} guidance.
- **Dark-mode imagery rules incomplete.** While surfaces mirror from {colors.canvas} to {colors-dark.canvas} and text from {colors.ink} to {colors-dark.ink}, grayscale-portrait contrast, squircle-on-dark fills ({colors-dark.bone}), and marquee scrim ({colors.badge-overlay}) opacity on dark have no measured specs.
- **Motion and marquee physics unspecified.** Marquee speed, easing, pause-on-hover, and floating-pill ({components.nav-pill}) hide/reveal behavior are not tokenized — durations exist only as generic animation tokens, not per-component motion.
- **Data-density components missing.** Dense tables, filters, search-result rows, and pagination beyond the marketing comparison table and {components.faq-row} accordion are not documented; cell padding ({spacing.sm} {spacing.md}) and header type ({typography.caption}) need product-UI extension.
- **Accessibility contrast at small sizes.** Combinations like {colors.mute} {typography.body-sm} on {colors.bone} and {colors.ash} placeholders ({components.text-input}) on {colors.field} lack verified ratios, especially for {colors-dark.mute} on {colors-dark.bone}.
- **Iconography and illustration system absent.** Beyond the 30% squircle container and {typography.label} badge overlays ({components.badge-overlay}), stroke weight, icon grid, and empty-state illustration style on {colors.bone} are not defined.
