# Design System Document: Institutional Command

## 1. Overview & Creative North Star
**Creative North Star: "Disciplined Architecturalism"**

This design system moves away from the cluttered, "app-like" density common in mobile management tools. Instead, it draws inspiration from modern institutional architecture—monolithic forms, high-quality materials, and a sense of unshakeable order. By utilizing intentional asymmetry, expansive negative space, and tonal depth, we create a digital environment that feels as secure and prestigious as the People's Public Security University of China.

The "Editorial" feel is achieved through a dramatic contrast between the authoritative `display` typography and the utilitarian `body` scales. We treat information not just as data, but as a command structure: clear, prioritized, and absolute.

## 2. Colors & Surface Philosophy

### The Tonal Palette
The palette is rooted in the `primary` (#001e40) navy, representing the legacy and authority of the police force. Silver and gray accents (`secondary` and `surface` tiers) provide a modern, metallic tech-forward edge.

*   **Primary (#001e40):** Use for high-level branding and "Hero" moments.
*   **Secondary (#466270):** Used for supporting elements and administrative contexts.
*   **Tertiary (#460002):** A deep, authoritative red reserved strictly for high-priority alerts and disciplinary actions.

### The "No-Line" Rule
To achieve a high-end, bespoke aesthetic, **the use of 1px solid borders for sectioning is strictly prohibited.** Boundaries must be defined through background color shifts. For example, a module using `surface_container_low` should sit on a `surface` background. This creates a "molded" look rather than a "sketched" look.

### Surface Hierarchy & Nesting
The UI is a series of stacked, physical layers.
1.  **Base:** `surface` (#f7f9fc)
2.  **Sectioning:** `surface_container_low` (#f2f4f7)
3.  **Actionable Cards:** `surface_container_lowest` (#ffffff)
4.  **Floating Elements:** Semi-transparent `surface` with a 20px backdrop-blur (Glassmorphism).

### Signature Textures
Main CTAs and Hero sections should utilize a subtle linear gradient (135°) transitioning from `primary` (#001e40) to `primary_container` (#003366). This adds a "brushed metal" depth that prevents the interface from feeling flat or generic.

## 3. Typography
The system uses a dual-font approach to balance institutional prestige with high-density legibility.

*   **Headlines (Public Sans):** Chosen for its geometric, authoritative stance. Use `display-lg` and `headline-lg` for dashboard summaries to create an "Editorial" impact.
*   **Body & Labels (Inter):** A high-performance sans-serif designed for micro-legibility on mobile screens.
*   **Hierarchy as Command:** Use `on_surface_variant` (#43474f) for secondary labels and `on_surface` (#191c1e) for primary data to ensure the eye follows the chain of command in the information.

| Scale | Font | Size | Weight | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| Display-LG | Public Sans | 3.5rem | 700 | Large data visualizations / Hero stats |
| Headline-SM | Public Sans | 1.5rem | 600 | Page titles / Section headers |
| Title-MD | Inter | 1.125rem | 500 | Card titles / Navigation items |
| Body-MD | Inter | 0.875rem | 400 | Standard reports / Form inputs |
| Label-SM | Inter | 0.6875rem | 600 | Status badges / Micro-data |

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Layering** rather than structural lines.
*   Place a `surface_container_lowest` card on a `surface_container_low` section to create a soft, natural lift.
*   Avoid the "floating" look unless the element is transient (e.g., a modal or a floating action button).

### Ambient Shadows
When an element must float, use **Ambient Shadows**.
*   **Shadow Color:** A tinted version of `on_surface` at 6% opacity.
*   **Blur:** High diffusion (24px to 40px blur) with 0px offset to mimic natural, overhead light.
*   **Strictly Forbid:** Dark, high-opacity "drop shadows" which feel dated and "cheap."

### The "Ghost Border" Fallback
In rare cases where accessibility requires a border (e.g., input fields), use a **Ghost Border**.
*   **Token:** `outline_variant` (#c3c6d1) at **20% opacity**.
*   This creates a hint of a container without disrupting the fluid, "No-Line" aesthetic.

## 5. Components

### Buttons
*   **Primary:** Gradient from `primary` to `primary_container`. Text: `on_primary`. Roundedness: `md` (0.375rem).
*   **Secondary:** Solid `secondary_container`. Text: `on_secondary_container`. No border.
*   **Tertiary/Danger:** Solid `tertiary_container`. Text: `on_tertiary_container`.

### Input Fields
*   **Structure:** No background color. Only a bottom "Ghost Border" (2px) using `outline_variant` at 20%.
*   **Focus State:** The border transitions to 100% `primary` with a 2px thickness.
*   **Error State:** Border transitions to `error` (#ba1a1a).

### Cards & Lists
*   **No Dividers:** Lists must not use horizontal lines. Separate list items using `8px` of vertical whitespace or by alternating background tones between `surface_container_low` and `surface_container_lowest`.
*   **Asymmetry:** In cards, use a 12px left-accent bar of `primary` color to denote "Active" or "Official" status, breaking the symmetry of the container.

### Status Indicators (Badges)
*   Use `full` roundedness (capsule style).
*   **Official/Confirmed:** `secondary_container` background with `on_secondary_container` text.
*   **Alert/Urgent:** `tertiary_fixed` background with `on_tertiary_fixed` text.

## 6. Do's and Don'ts

### Do:
*   **Do** use extreme whitespace (32px+) between major sections to let the "Architectural" feel breathe.
*   **Do** use `glassmorphism` for the WeChat bottom navigation bar to show the content scrolling beneath it.
*   **Do** align all text to a strict grid, but allow images or data cards to slightly offset to create visual interest.

### Don't:
*   **Don't** use 100% black. Use `on_surface` (#191c1e) for all "black" text to maintain tonal softness.
*   **Don't** use standard WeChat "Green" for success states. Use `primary_fixed` (#d5e3ff) to maintain the professional police blue palette.
*   **Don't** use more than two levels of nesting. If a layout requires a card inside a card, reconsider the information architecture.