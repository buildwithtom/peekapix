# Peekapix

**Look closer. Fix smarter.**

Peekapix is a Chrome extension for inspecting computed CSS, comparing two elements, measuring their rendered bounds, and trying temporary CSS changes directly on the page.

## Install

Use Node.js 22.12 or later and Chrome 127 or later. The included `.nvmrc` selects Node.js 24.

```sh
npm ci
npm run build
```

Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3`. Pin Peekapix from Chrome’s Extensions menu so the toolbar icon is always available. After rebuilding, click **Reload** on Peekapix’s extensions card and refresh the page you’re inspecting.

For watch mode, run `npm run dev` and load `.output/chrome-mv3-dev` from `chrome://extensions`. Keep the dev server running while you edit. Reload the extension manually after restarting the server. [WXT development setup](https://wxt.dev/guide/essentials/config/browser-startup)

Run `npm run fixture` in a second terminal to try the local test page. Run `npm run zip` to package the production extension for distribution. [Local fixture](http://127.0.0.1:4173)

## Inspect and compare

1. Click the Peekapix toolbar icon. Hover for an outline and rendered dimensions, then click to pin. You can also Tab to a focusable webpage element and press Enter. Escape pauses picking.
2. In **Inspector**, click a value to copy its declaration, or use a section’s copy button to copy the group. The box readout shows computed margin and padding alongside the rendered size.
3. Click **Compare** and pick **A**, then **B**. Differences appear first, grouped by layout, spacing, typography, and appearance. Choose **All** to see matching values. Click either value to copy it. Use the arrow on a reference to replace it, or the swap control to switch A and B.
4. Compare reports aligned gaps, shortest diagonal gaps, touching bounds, or overlapping rectangles. These measurements use the elements’ rendered, axis-aligned bounds in CSS pixels. Computed CSS margin, padding, and gap appear in **Spacing**.
5. The dock moves between sides on wide viewports and between the top and bottom on narrow viewports. Collapse the panel or hide measurements to free up space. The toolbar icon and dock’s close button deactivate Peekapix.

## Preview and export

Choose **Match B to A** or **Match A to B**, check the differing properties you want to try, and click **Preview**. Each click applies the checked declarations as one step. The comparison retains the original values while the reference dimensions and ruler track the rendered preview. **Undo** rolls back one step. **Reset** rolls back all steps and lets you change direction.

Peekapix records the original inline values, priorities, and declaration order. Closing the extension, changing modes, replacing or swapping a reference, and refreshing end the preview. During rollback, Peekapix preserves unrelated inline edits and newer values written by the page when those writes can be distinguished.

**Copy differences** exports the current source values as a rule for the current target. **Copy preview patch** exports the declarations you actually applied. Selectors are generated against the current DOM. Verify their stability and cascade priority before adding the rule to your project. Rules for open shadow roots belong inside the relevant root.

## Architecture and privacy

- The [Manifest V3 service worker](entrypoints/background.ts) handles the Chrome toolbar action, tab indicators, and the restricted-page popup. It injects the inspector into the top frame on demand using `activeTab` and `scripting`. [WXT scripting](https://wxt.dev/guide/essentials/scripting) · [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- The [injected entrypoint](entrypoints/inspector.tsx) mounts a React UI and visual overlays in a Shadow DOM. The bundle provides its styles and fonts locally. The [session](src/core/session.ts) manages picking, geometry, and teardown, with style reads sampled separately from frame-by-frame geometry.
- [CSS comparison and export](src/core/css.ts), [rectangle measurement](src/core/geometry.ts), and [preview rollback](src/core/preview.ts) live in focused modules. Selections and style information stay in the inspected tab. There are no host permissions, analytics, accounts, requests to external services, or persisted inspection data.

The [original mark](assets/peekapix.svg) is rasterized at 16, 32, 48, and 128px for Chrome. Barlow and IBM Plex Mono are bundled under their [SIL Open Font Licenses](public/licenses).

## Verification

```sh
npm run lint
npm run check
npm test
npm run build
npx playwright install chromium --no-shell
npm run test:browser
```

The Chromium suite launches temporary profiles, loads the production extension, and uses Chromium’s DevTools extension action to exercise the toolbar workflow. It starts a loopback fixture server automatically. The fixture includes spacing and typography variants, grid and flex layouts, nested and transformed elements, scroll containers, forms, CSS variables, an open shadow root, and a sandboxed cross-origin frame.

To verify manually, open the fixture, activate Peekapix, and compare the two **Add to kit** buttons. The kit action counter should stay at zero while you select them. Check **Padding top**, preview B to A, and verify the variant’s top padding changes from `8px` to `12px` while the bottom stays `8px`. Copy the patch, then test Undo, Reset, and closing with a preview active. Repeat at a narrow viewport. Open `chrome://settings` and click the toolbar icon to see the restricted-page explanation.

## Limits

- Chrome protects internal pages, the Chrome Web Store, and some built-in viewers. For local files, enable **Allow access to file URLs** in Peekapix’s extension details.
- Peekapix inspects the top document, including reachable nodes in open shadow roots. It can select a frame’s outer element. Embedded documents, closed shadow internals, pseudo-elements, and canvas contents are outside inspection.
- Bounds are axis-aligned rectangles. Transforms, overflow clipping, nonrectangular shapes, and fragmented inline elements can make those bounds differ from the shape of visible pixels. Rulers are hidden if their endpoints are offscreen.
- Preview edits affect a single element’s inline declarations. CSS inheritance, layout reflow, transitions, and page scripts can affect the rendered result. Page handlers registered earlier at the window capture stage can observe selection events before Peekapix.
# peekapix
