# UX/UI Audit - Hydraulic/NPSH Simulation App

Audit date: 2026-05-17  
Scope: Canvas/PFD workspace, ribbon/menu bar, Fluid Basis + Unit Standard setup, object task windows, live parameter panels, warning/status UI, and responsive desktop/tablet/mobile behavior.

## 1. Executive Summary

The application is functionally rich and most engineering workflows are represented: Fluid Basis setup, SRC/Tank/Pump/Sink path modeling, dashed semantic attachment, pipe/hydraulic path separation, LIC-to-tank level attachment, calculation traces, warning panel, and unit standard support.

No Critical UX/UI blocker was found in the automated test suite. Earlier browser scenario testing found several High-priority usability issues:

- Unit standard changes are not reflected consistently in all live parameter panels. SNK updates to US units, but SRC, Tank, and unsolved Pump live panels can remain in Metric units.
- Hydraulic connection workflow is intentionally optimized around object right-click/context-menu behavior. The former ribbon `Select` and `Connect Pipe` buttons must not be rendered, so users start pipe/attachment actions from the object they are modeling.
- The warning panel can physically cover new objects, especially LIC on the right side of the default canvas placement, blocking click/right-click interaction.
- Default object placement and live panels can crowd each other, making right-click targets ambiguous around SRC/Tank/Pump/Sink flows.

Overall status: **Audit complete. Practical fix batches 1-29 applied on 2026-05-17 for unit realtime refresh, context-menu-first connection workflow, warning usability, removal of selected-object canvas action buttons, removal of mobile/tablet canvas pan hint, desktop thesis identity readability and exact wording lock, compact no-logo thesis identity beside Solve on small ribbons, iPhone SE 375 x 667 compact identity first-row lock, iPhone SE 667 x 375 compact landscape menu bar visibility, keyboard access, toolbar responsiveness, compact horizontal-scrolling mobile object palette, grouped mobile object overflow now hidden from the ribbon, object-menu keyboard code retained as dormant compatibility, accessibility regression coverage, task-window focus return, nonblocking task-window docking, nonblocking export feedback, internal destructive-action confirmation, clear top-menu intent, confirmed destructive-action result handling, mandatory thesis About startup, mobile pump live-panel readability, and audit-status closure.**

### Practical Fix Batch 1 Standards

Realtime unit switching must rebuild every visible readout that can contain engineering quantities, not only the task window currently being edited. The canonical refresh route is `setUnitStandard(...) -> refreshUnitStandardDependentUi() -> updateSimulation({ renderSidebarAfter: false }) -> updateAllObjectOperatingStatusVisuals()`.

| Quantity | SI / International | US Customary | Metric / European Engineering | Live-panel expectation |
|---|---|---|---|---|
| Flow | m3/h | gpm | m3/h | SRC/Tank/Pump/SNK update immediately |
| Head/elevation | m | ft | m | Source, tank, pump, sink elevations update immediately |
| Absolute pressure | bar a | psia | bar a | Boundary and vapor pressures update immediately |
| Pressure delta | bar | psi | bar | Loss/margin labels update immediately |
| Volume | m3 | ft3 | m3 | Tank inventory readout updates immediately |
| Percent/ratio | % / - | % / - | % / - | No unit conversion |

Live-panel label dictionary for Batch 1:

| Previous label | Updated label | Reason |
|---|---|---|
| Qout | Outlet Flow | Removes ambiguous `Q` shorthand for general users |
| Psrc | Source Press. | Clarifies pressure is the source boundary pressure |
| zSRC | Source Elev. | Clarifies elevation instead of coordinate shorthand |
| Hsrc | Source Head | Keeps hydraulic-head meaning but readable |
| hLs | Suction Loss | Clarifies loss is on suction path |
| NPSHa@P | NPSH at Pump | Same meaning, clearer on canvas |
| Pout | Outlet Press. | Clarifies sink boundary pressure |
| zSNK | Sink Elev. | Clarifies sink elevation |
| HSNK | Sink Head | Clarifies downstream head |
| hLd | Discharge Loss | Clarifies loss is on discharge path |
| Pv | Vapor Press. | Clarifies vapor pressure |
| P-Pv | Vapor Margin | Clarifies pressure above vapor pressure |

Batch 1 verification:

- Automated `.cjs` test suite passed after changes.
- Browser smoke test confirmed SRC, Tank, Pump, and Sink live panels switch from Metric units to US Customary units in realtime after Unit Standard is changed.
- Browser smoke test confirmed the warning panel collapses during modeling activity and can be expanded again.
- Browser smoke test found no page-level horizontal overflow and no console errors in the checked flow.

### Practical Fix Batch 2 Standards

Connection workflow originally exposed visible ribbon mode controls for discoverability. This was superseded by Batch 19 and Batch 20: the efficient modeling workflow is now object-first and context-menu-first, so the ribbon must not render the `Select` or `Connect Pipe` buttons and the canvas must not render the selected-object action bar.

Ribbon auto-placement should account for live panel footprint, not only icon width. New toolbar-click objects use a left-to-right sequence with wider spacing and row wrapping so SRC, Tank, Pump, Sink, and LIC are less likely to land under warning/status overlays or each other's live panels.

Batch 2 verification:

- Automated `.cjs` test suite passed after changes.
- Superseded by Batch 19: `Select` and `Connect Pipe` are no longer ribbon controls.
- Static test coverage now verifies the context-menu connection workflow, connect-mode canvas hint, live-panel de-emphasis while wiring, and absence of the selected-object canvas action bar.
- Browser smoke test confirmed default Source, Tank, Pump, and Sink placement is spaced left-to-right without page-level horizontal overflow.
- Browser smoke test found no console errors in the checked flow.

### Practical Fix Batch 3 Standards

After `Apply Basis / Start Modeling`, the large setup CTA must remain hidden as requested, but the active basis should still be glanceable. The UI therefore uses a compact, read-only status badge that shows the active fluid and unit standard only when the basis is confirmed and clean. If the basis becomes dirty, the large setup CTA returns and the compact badge hides.

Help content opened from Help > Fluid Properties and boundary guidance should use a stable Task Window kind: `fluid-help`. This keeps help windows distinct from the editable Fluid Basis setup and from object-property task windows.

Batch 3 verification:

- Automated `.cjs` test suite passed after changes.
- Browser smoke test confirmed compact basis status appears only after confirmed clean basis.
- Browser smoke test confirmed compact basis status hides when the basis becomes dirty and reconfirmation is required.
- Browser smoke test confirmed Property Source Map opens with Task Window kind `fluid-help`; static tests cover SRC help, SNK help, and NPSH notes using the same kind.
- Browser smoke test found no console errors in the checked flow.

### Practical Fix Batch 4 Standards

Canvas warning text should be short enough to support modeling. The warning panel now shows a concise summary while preserving full detail in the warning item tooltip and opening the related object task window when the warning is clicked.

The PFD canvas is intentionally larger than the visible viewport. Batch 4 originally added a small pan/scroll hint on tablet/mobile-sized viewports. That visual hint is superseded by Batch 22: it must not render because it can distract users on iPhone/iPad/tablet canvas space.

Batch 4 verification:

- Automated `.cjs` test suite passed after changes.
- Browser smoke test confirmed warning panel summaries are shortened on canvas, while full details remain attached to the warning item.
- Browser smoke test confirmed clicking a warning opens/selects the related object task window for detailed context.
- Static responsive test originally confirmed tablet/mobile canvas included a nonblocking pan/scroll affordance; Batch 22 later converted this to a locked non-rendering rule.
- Browser smoke test found no console errors in the checked flow.

### Practical Fix Batch 5 Standards

Batch 5 originally added a compact selected-object action bar after normal left-click selection. That decision has been superseded by Batch 20 because the extra canvas buttons were not effective on small/mobile screens and could interfere with modeling work. The locked workflow is now context-menu-first: users open object properties, start pipes, and create attachments from the right-click/long-press object context menu.

Expected context-menu actions:

| Selected object | Primary action | Engineering meaning |
|---|---|---|
| SRC as Open Tank / Reservoir or Pressurized Vessel | Attach Tank/Vessel | Dashed semantic attachment only; not a hydraulic flow path |
| SRC as External Header / Pipe Tie-in, Fixed Flow Source, or Standalone Boundary Source | Start Pipe | Solid hydraulic connection from boundary source |
| LIC / level instrument | Attach Level | Dashed instrument signal/measurement attachment to tank/vessel level |
| Other hydraulic equipment with ports | Start Pipe | Solid hydraulic connection from equipment port |

The selected-object `Properties`, `Attach Tank/Vessel`, and other floating canvas action buttons must not render. Object properties remain available through the object context menu and task-window launchers.

Batch 5 verification:

- Added static test coverage in `tests/canvas-selection-actions.cjs`; Batch 20 later changed that test to lock removal of the selected-object action panel.
- Automated `.cjs` test suite passed after changes.
- Browser smoke test originally confirmed SRC semantic source types show `Attach Tank/Vessel`.
- Browser smoke test originally confirmed SRC hydraulic source types show `Start Pipe`.
- Browser smoke test originally confirmed LIC shows `Attach Level` and Tank shows `Start Pipe`.
- Browser smoke test found no console errors in the checked flow.
- Browser smoke screenshot: `docs/ux_ui_fix_batch5_selection_actions_smoke.png`.

### Practical Fix Batch 6 Standards

Keyboard and assistive-technology access should cover the same critical paths as mouse users: top menu commands, canvas context menu, warning review, and task-window focus. Batch 6 upgrades the menu surfaces without changing the visual workflow.

Keyboard behavior expected after Batch 6:

| Surface | Keyboard support |
|---|---|
| Top menu triggers | Focusable with `Tab`; open with `Enter`, `Space`, or `ArrowDown`; close with `Escape` |
| Dropdown content | Navigate visible menu items with `ArrowUp`, `ArrowDown`, `Home`, and `End` |
| Dropdown submenu | Open submenu with `ArrowRight`; return/collapse with `ArrowLeft` |
| Canvas context menu | Uses `role="menu"`/`role="menuitem"`; focuses first item on open; supports `ArrowUp`, `ArrowDown`, `Home`, `End`, `Enter`, `Space`, and `Escape` |
| Warning panel items | Native buttons remain keyboard-activatable and open the relevant task window |
| Task Window | Dialog is programmatically focusable and receives focus when opened |

Batch 6 verification:

- Added static test coverage in `tests/keyboard-navigation-accessibility.cjs`.
- Automated `.cjs` test suite passed after changes.
- Browser smoke test confirmed Help menu opens via `ArrowDown` and updates `aria-expanded`.
- Browser smoke test confirmed Fluid Properties submenu opens with `ArrowRight` and collapses with `ArrowLeft`.
- Browser smoke test confirmed canvas context menu uses `role="menu"` / `role="menuitem"`, focuses the first item, supports arrow navigation, and closes with `Escape`.
- Browser smoke test confirmed Task Window receives focus when opened from object property workflow.
- Browser smoke test found no console errors in the checked flow.
- Browser smoke screenshot: `docs/ux_ui_fix_batch6_keyboard_smoke.png`.

### Practical Fix Batch 7 Standards

Warning messages should preserve the engineering cause while also telling the user what to do next. The solver warning text remains unchanged for regression safety, but UI readouts now append a concise `Action:` recommendation for the warning panel and pump warning/task readouts.

Action guidance examples:

| Warning cause | UI action guidance |
|---|---|
| Flow, downstream pressure, and pump curve are all fixed | Choose one independent downstream constraint, or keep both only for residual-head review |
| Pump head above/below required system head | Adjust fixed flow, downstream pressure target, pump head/curve, or system losses/elevation |
| Missing solid hydraulic path | Create a solid route from source/tank outlet to pump suction and pump discharge to sink |
| NPSH/cavitation risk | Review source level/pressure, suction elevation/losses, vapor pressure, and NPSHr basis |
| Pipe high point or vapor margin | Check vapor pressure, high point elevation, pressure profile, and static head |

Batch 7 verification:

- Added static/unit test coverage in `tests/warning-action-guidance.cjs`.
- Automated `.cjs` test suite passed after changes.
- Production bundle rebuild confirmed the warning guidance helper is included in `app.bundle.min.js`.
- Browser smoke test confirmed normal app startup after the bundle change with no console errors in the checked flow.
- Solver/model warning strings remain unchanged; UI display text appends action guidance only at the presentation layer.

### Practical Fix Batch 8 Standards

The ribbon should stay usable on tablet/mobile without making the whole page or whole ribbon feel like one long horizontal strip. Batch 8 keeps the primary controls stable while making only the object palette horizontally scrollable on smaller screens.

Responsive toolbar behavior:

| Surface | Behavior |
|---|---|
| `Select`, `Connect Pipe`, Fluid Basis, Solve | Remain fixed-size ribbon controls |
| Object toolbar palette | Uses internal horizontal scroll at tablet/mobile widths |
| Toolbar groups | Snap gently to group starts while scrolling |
| Toolbar tools | Keep larger mobile touch targets: about 50px wide and 48px tall |
| Keyboard/accessibility | Object palette has `role="toolbar"`, accessible label, and visible focus state |
| Scroll affordance | Right-edge gradient hints that more object tools are available horizontally |

Batch 8 verification:

- Added static responsive/accessibility test coverage in `tests/toolbar-responsive-accessibility.cjs`.
- Updated `tests/performance-loading.cjs` so the static first-paint toolbar shell remains covered with the new accessible toolbar attributes.
- Production assets were rebuilt after the toolbar changes.
- Automated `.cjs` test suite passed after changes.
- Browser smoke test confirmed the runtime object palette exposes `role="toolbar"`, accessible label, keyboard focusability, focus-visible styling, and no console errors.
- Responsive tablet/mobile behavior is covered statically through CSS assertions for internal palette scroll, iOS touch scrolling, group snap alignment, and larger mobile touch targets.
- Browser smoke screenshot: `docs/ux_ui_fix_batch8_toolbar_smoke.png`.

### Practical Fix Batch 9 Standards

Task/property windows should support engineering review without interrupting rapid model assembly. Batch 9 treats object property windows as user task windows that can be minimized into a compact dock instead of staying open over the canvas.

Task Window dock behavior:

| Workflow | Behavior |
|---|---|
| Add equipment from toolbar | Object is placed and its properties task is minimized to the dock, keeping canvas wiring clear |
| Restore docked item | Reopens the exact object/pipe/tank task window and focuses it |
| Manual minimize | Adds the active object task to the dock and hides the large window |
| Ordinary object selection | Selects the object without force-reopening a docked task window |
| Open/clear/delete project | Clears or prunes stale dock entries |
| Responsive layout | Dock scrolls horizontally when many object tasks are minimized |

Batch 9 verification:

- Added static test coverage in `tests/task-window-dock.cjs`.
- Static test confirmed minimized object entries, compact labels, explicit restore/close actions, stale-entry pruning, and responsive horizontal dock scrolling.
- Static test confirmed newly added toolbar objects use the rightward placement sequence and auto-dock their property task window.
- Browser smoke test confirmed adding Source creates a visible dock entry while hiding the large Task Window.
- Browser smoke test confirmed restoring the dock entry opens `Source Object Properties` for `SRC-100` and focuses the Task Window.
- Browser smoke test confirmed manual minimize returns the Source task to the dock.
- Browser smoke test found no console errors in the checked flow.
- Browser smoke screenshot: `docs/ux_ui_fix_batch9_task_dock_smoke.png`.

### Practical Fix Batch 10 Standards

Export/file feedback should not interrupt modeling with blocking browser alerts. Batch 10 extends the nonblocking toast pattern to the Excel Calculation Trace export path, including the error fallback path.

Export notification behavior:

| Event | Behavior |
|---|---|
| Export starts | Shows a short nonblocking info toast |
| Export download begins | Shows a success toast with the generated workbook filename |
| Export fails | Shows a nonblocking error toast with the failure reason |
| Toast system unavailable | Excel export creates the same `ui-toast-region` fallback instead of calling `alert()` |
| Accessibility | Toast region uses `aria-live="polite"` and error toasts use `role="alert"` |

Batch 10 verification:

- Updated `ui/scenario-excel-export.js` so Excel export uses `showScenarioExportToast(...)` and has no `alert(...)` fallback.
- Updated `tests/scenario-excel-export-validation.cjs` to assert the nonblocking export toast helper, toast fallback surface, and absence of blocking alerts.
- Existing `tests/menu-toast-notification.cjs` continues to validate the shared menu/file toast surface.
- Production assets were rebuilt after the export notification change.
- Browser smoke test confirmed `showScenarioExportToast` and `exportScenarioCalculationTraceToExcel` are available in the production bundle, toast feedback renders in `#uiToastRegion`, and no console errors occur.
- Browser smoke screenshot: `docs/ux_ui_fix_batch10_export_toast_smoke.png`.

### Practical Fix Batch 11 Standards

Destructive actions should use the application's own confirmation UI instead of blocking browser dialogs. Batch 11 replaces the browser `confirm()` used by Clear Canvas with an accessible internal confirmation dialog.

Clear Canvas confirmation behavior:

| Interaction | Behavior |
|---|---|
| File/Edit > Clear Canvas | Opens an internal `role="dialog"` confirmation window |
| Initial focus | Lands on `Keep Model`, the safe cancel action |
| Escape / close / backdrop | Cancels without clearing the model |
| Clear Canvas button | Proceeds with the existing reset logic |
| Keyboard | Traps Tab focus inside the dialog while open |
| Mobile | Uses a bottom-sheet style full-width confirmation layout |

Batch 11 verification:

- Added `showUiConfirm(...)` in `toolbar/menu-bar.js`.
- Updated `clearSimulationCanvas()` to await the internal confirmation dialog instead of calling browser `confirm()`.
- Added responsive confirmation dialog styling in `style.css`.
- Added static test coverage in `tests/ui-confirm-dialog.cjs`.
- Production assets were rebuilt after the dialog change.
- Browser smoke test confirmed the dialog exposes `role="dialog"` and `aria-modal="true"`, focuses `Keep Model`, cancels with `Escape`, confirms with `Clear Canvas`, and never calls `window.confirm`.
- Browser smoke test found no console errors in the checked flow.
- Browser smoke screenshot: `docs/ux_ui_fix_batch11_confirm_dialog_smoke.png`.

### Practical Fix Batch 12 Standards

Top menu labels should either perform a clear action or open a clear dropdown. Batch 12 converts the previously inert `Simulate`, `Tools`, and `View` labels into real dropdown menus with explicit commands.

Top menu intent behavior:

| Menu | Commands |
|---|---|
| Simulate | `Run Hydraulic / NPSH Evaluation`; `Refresh Calculations & Connections` |
| Tools | `Fluid Basis & Unit Standard`; `Excel Calculation Trace (.xlsx)` |
| View | `Reset Canvas View`; `Show Warnings Panel` |

Batch 12 verification:

- Replaced inert `Simulate`, `Tools`, and `View` labels in `index.html` with accessible dropdown containers.
- Added shared menu helpers in `toolbar/menu-bar.js` for run/refresh, export trace, reset canvas view, and show warning panel.
- Added static test coverage in `tests/top-menu-intent.cjs`.
- Production assets were rebuilt after the top-menu change.
- Browser smoke test confirmed all three new dropdowns open with `role="menu"` and `aria-expanded="true"`.
- Browser smoke test confirmed `Simulate` runs the hydraulic/NPSH refresh path, `Tools` opens the Fluid Basis Task Window, and `View` provides reset/warning feedback.
- Browser smoke test found no console errors in the checked flow.
- Browser smoke screenshot: `docs/ux_ui_fix_batch12_menu_intent_smoke.png`.

### Practical Fix Batch 13 Standards

Async destructive confirmations must return an explicit result to callers. Batch 13 makes `Clear Canvas`, `New`, and `Close` respect cancel/confirm outcomes after the internal confirmation dialog introduced in Batch 11.

Confirmed-result behavior:

| User action | Result |
|---|---|
| Cancel `Clear Canvas` / `New` / `Close` | Model and current file handle are preserved |
| Confirm `Clear Canvas` | Canvas/model reset proceeds |
| Confirm `New` / `Close` | Canvas/model reset proceeds, then the current file handle is cleared |
| Browser confirm override | Must not be called |

Batch 13 verification:

- Updated `clearSimulationCanvas()` to return `false` on cancel and `true` after a confirmed reset.
- Updated `fileClose()` to await `clearSimulationCanvas()` and clear `currentFileHandle` only after confirmation.
- Updated File/Edit menu actions to await async destructive confirmations.
- Extended `tests/ui-confirm-dialog.cjs` to cover async result handling and file-state preservation.
- Production assets were rebuilt after the menu-flow change.
- Browser smoke test confirmed cancel preserves a sentinel file handle, confirm clears it after reset, model returns to `FLUID` + `SETTINGS`, and `window.confirm` is never called.
- Browser smoke test found no console errors in the checked flow.
- Browser smoke screenshot: `docs/ux_ui_fix_batch13_confirm_result_smoke.png`.

### Practical Fix Batch 14 Standards

The audit report should not keep original findings marked as active after practical fixes have closed them. Batch 14 updates the findings section, suggested fix order, and final audit status so this document can be used as a reliable progress checklist.

Audit-status closure behavior:

| Report area | Behavior |
|---|---|
| Findings | Original issue text is preserved, but status now names the resolving batch or residual backlog decision |
| Suggested fix order | Shows completed batch mapping instead of an old future plan |
| Browser checks | Separates original observations from post-fix verification |
| Final audit status | States that fixes were applied and verified, not that no code changed |

Batch 14 verification:

- Updated High/Medium/Low finding status lines to match practical fix batches.
- Updated Suggested Fix Order to show completed resolution mapping.
- Updated Browser checks and Final Audit Status to distinguish original audit observations from post-fix verification.
- Added static test coverage in `tests/ux-ui-audit-resolution.cjs`.

### Practical Fix Batch 15 Standards

Very small screens should not rely only on precision drag/drop. Batch 15 added a grouped `Objects` overflow menu on mobile-sized ribbons. Batch 21 superseded the earlier "hide the dense palette" rule: the object palette must remain visible as the primary compact horizontal-scroll strip on mobile. Batch 26 supersedes the visible `Objects` fallback button: the grouped menu markup/code may remain dormant, but the ribbon must not show the `Objects` button.

Grouped object overflow behavior:

| Screen / interaction | Behavior |
|---|---|
| Desktop/tablet wide | Existing grouped toolbar palette remains unchanged |
| Mobile | Compact horizontal object palette remains visible and scrollable; `Objects` button is hidden |
| Very narrow mobile | Compact horizontal palette remains visible and scrollable; grouped menu remains dormant |
| Menu item click | If the dormant menu is intentionally re-enabled later, it uses the existing rightward ribbon-click placement behavior |
| Accessibility | Hidden `Objects` button is not part of the active keyboard workflow; object tools remain accessible through the visible toolbar palette and context menus |

Batch 15 verification:

- Added grouped object menu structure in `index.html`.
- Added responsive menu styling and very-small-screen palette fallback in `style.css`.
- Added catalog-driven menu rendering in `ui/canvas-manager.js`.
- Added static test coverage in `tests/toolbar-object-overflow.cjs`.
- Browser smoke test at 390px mobile width originally confirmed `Objects` is visible and menu items are grouped from the toolbar catalog. Batch 21 later changed the primary mobile behavior so the object palette remains visible and horizontally scrollable at the same width. Batch 26 later hides the `Objects` button while preserving the direct palette.
- Browser smoke screenshot: `docs/ux_ui_fix_batch15_object_menu_smoke.png`.

### Practical Fix Batch 16 Standards

The grouped `Objects` menu originally supported no-precision pointer input. Batch 16 added keyboard movement inside the mobile object menu while keeping the same catalog-driven add behavior. Batch 26 makes that menu dormant because the visible ribbon should now prioritize the direct horizontal object palette.

Object menu keyboard behavior:

| Key | Behavior |
|---|---|
| Arrow Down / Arrow Right | Move focus to the next object item |
| Arrow Up / Arrow Left | Move focus to the previous object item |
| Home | Move focus to the first object item |
| End | Move focus to the last object item |
| Escape | Close the object menu and return focus to the `Objects` button |

Batch 16 verification:

- Added reusable object-menu item lookup and focus helpers in `ui/canvas-manager.js`.
- Added keyboard handling on the `Objects` button and grouped menu.
- Extended static test coverage in `tests/toolbar-object-overflow.cjs`.
- Browser smoke test at 390px mobile width confirmed Arrow Down opens the menu and focuses `Pump`, Arrow Down moves to `Tank`, End moves to `LIC`, Home returns to `Pump`, and Escape closes the menu with focus returned to the `Objects` button.
- Browser smoke screenshot: `docs/ux_ui_fix_batch16_object_menu_keyboard_smoke.png`.

### Practical Fix Batch 17 Standards

Keyboard accessibility coverage should protect every active surface that can start modeling work. Batch 17 originally folded the grouped mobile `Objects` menu into the general keyboard-accessibility regression test. Batch 26 changes the active requirement: the hidden `Objects` button must not appear in the ribbon, while object placement remains available through the visible horizontal palette and context-specific workflows.

Batch 17 verification:

- Extended `tests/keyboard-navigation-accessibility.cjs` to verify the legacy `Objects` menu compatibility hooks and the newer hidden-button lock.
- No production rebuild was required because Batch 17 only updates audit documentation and test coverage.

### Practical Fix Batch 18 Standards

Task Window close/minimize should not leave keyboard focus stranded after the visible window disappears. Batch 18 keeps the existing nonblocking dock model, then returns focus to the next useful control when the action is explicitly user-triggered.

Task Window focus-return behavior:

| User action | Focus target |
|---|---|
| Minimize object/tank/pipe task with the minimize button | Matching dock restore button |
| Close object/tank/pipe task with `X` or `Escape` | Matching `Show ...` task launcher, when that launcher is created |
| Programmatic close/minimize or outside-click auto-minimize | No forced focus steal |

Batch 18 verification:

- Added dock restore focus helper in `ui/task-window.js`.
- Added task launcher focus-return helper in `ui/task-window.js`.
- Updated user-triggered close/minimize paths to request focus return while leaving programmatic flows unchanged.
- Extended `tests/task-window-dock.cjs` and `tests/keyboard-navigation-accessibility.cjs`.

### Practical Fix Batch 19 Standards

The ribbon must not render the `Select` or `Connect Pipe` mode buttons. For this thesis application, the efficient modeling workflow is object-first: users right-click the relevant SRC, tank, pump, sink, pipe, valve, fitting, or instrument and choose the context-specific action such as `Connect`, `Start Pipe`, `Attach Tank/Vessel`, `Connect here`, or `Attach Level`.

The canvas still supports connect mode internally. When a context-menu action starts wiring, the canvas shows the connect hint and de-emphasizes live panels so ports remain readable. This preserves the hydraulic/semantic connection behavior while keeping the ribbon focused on basis setup, solve, object placement, and status.

Batch 19 verification:

- Removed `#btn-mode-select` and `#btn-mode-connect` from the ribbon markup in `index.html`.
- Updated `tests/connection-workflow-discoverability.cjs` so it fails if those ribbon buttons or labels return.
- The same test locks the right-click/context-menu workflow as the intended connection path.
- Production assets were rebuilt after the ribbon change.

### Practical Fix Batch 20 Standards

The canvas must not render the selected-object action bar (`#canvasSelectionActions`) or its floating `Properties`, `Attach Tank/Vessel`, `Attach Level`, `Connect Instrument`, or `Start Pipe` buttons. This is a thesis application optimized for efficient modeling on desktop and mobile: object-specific commands should come from the right-click/long-press context menu and task windows, not from a persistent floating button strip.

Expected behavior after Batch 20:

| Surface | Expected behavior |
|---|---|
| Left-click object selection | Selects the object and updates visual state only |
| Right-click/long-press object | Opens context-specific actions such as `User Task Object Properties`, `Connect`, `Connect here`, `Start Pipe`, `Attach Tank/Vessel`, or `Attach Level` |
| Legacy `#canvasSelectionActions` markup | Not present in `index.html`; if stale markup exists, JS/CSS keep it hidden |
| Mobile viewport | No selected-object floating action strip appears over the canvas |

Batch 20 verification:

- Confirmed `index.html` does not render `#canvasSelectionActions`, `#canvasActionProperties`, or `#canvasActionPrimary`.
- Updated `ui/canvas-manager.js` so any legacy selected-object action panel is immediately hidden.
- Updated `style.css` so `.canvas-selection-actions` is forcibly hidden if stale markup is present.
- Updated `tests/canvas-selection-actions.cjs`, `tests/connection-workflow-discoverability.cjs`, and the reusable first-run browser smoke to fail if the selected-object action panel returns.
- Production assets were rebuilt after the selected-object action panel removal.

### Practical Fix Batch 21 Standards

On cellular/mobile viewports, the ribbon must show the actual object palette directly. The primary mobile access pattern is a compact engineering toolbar strip with horizontal scrolling, not hiding all object tools behind the `Objects` dropdown.

Expected mobile ribbon behavior:

| Surface | Expected behavior |
|---|---|
| Object palette | Visible on iPhone/mobile widths, including around 375px and below 420px |
| Scroll behavior | Palette owns horizontal scroll with `overflow-x: auto`; page/ribbon do not create page-level horizontal overflow |
| Object tool size | Compact but readable object buttons; icons and short labels remain visible |
| Grouped `Objects` menu | Hidden from the ribbon; not part of the active mobile workflow |
| Forbidden regression | `.toolbar-palette` must not be set to `display: none` at very small mobile widths |

Batch 21 verification:

- Updated mobile CSS so the ribbon wraps and the object palette occupies a full-width horizontal-scroll row.
- Removed the prior very-small-screen rule that hid `.toolbar-palette`.
- Updated critical inline CSS in `index.html` so first paint matches the full stylesheet.
- Updated `tests/toolbar-object-overflow.cjs`, `tests/toolbar-responsive-accessibility.cjs`, and the reusable first-run browser smoke to fail if the mobile object palette is hidden or not horizontally scrollable.
- Production assets were rebuilt after the mobile object palette change.

### Practical Fix Batch 22 Standards

The `Pan / scroll canvas` pill must not render on iPhone/mobile, iPad/tablet, or desktop. The PFD canvas remains pannable/scrollable by native canvas overflow behavior, but the extra visual label is removed because it consumes useful canvas space on small screens.

Expected canvas behavior after Batch 22:

| Surface | Expected behavior |
|---|---|
| `#canvasPanHint` markup | Not present in `index.html` |
| `.canvas-pan-hint` legacy selector | Forced hidden if stale markup exists |
| Tablet/mobile CSS | Must not switch the pan hint to `display: block` |
| Browser smoke | Fails if `Pan / scroll canvas` appears in any checked viewport |

Batch 22 verification:

- Removed the `#canvasPanHint` markup from the canvas.
- Updated CSS and critical inline CSS to keep any legacy `.canvas-pan-hint` hidden.
- Updated `tests/canvas-pan-affordance.cjs` and the reusable first-run browser smoke to fail if the pan hint returns.
- Production assets were rebuilt after the pan hint removal.

### Practical Fix Batch 23 Standards

The ribbon thesis identity must be readable on desktop. The university line, restored thesis title, and author line should not appear visually cut off at the default desktop viewport.

Expected desktop ribbon behavior:

| Surface | Expected behavior |
|---|---|
| Thesis identity width | Uses proportional desktop width with stable min/max bounds |
| University line | Visible in the ribbon and preserved in a full tooltip |
| Thesis title | Preserves the original thesis wording and splits it across readable ribbon lines |
| Full thesis title | Preserved in the `aria-label` and tooltip for academic context |
| Browser smoke | Fails if visible thesis identity text is clipped on desktop |

Batch 23 verification:

- Increased the desktop thesis identity width allocation and aligned the text from the logo side.
- Restored the thesis title wording in the visible ribbon text and split it across readable lines without changing the title.
- Updated critical inline CSS in `index.html` so first paint matches the full stylesheet.
- Added `tests/academic-identity-layout.cjs` and extended the reusable first-run browser smoke to fail if desktop thesis identity text clips again.
- Production assets were rebuilt after the thesis identity layout change.

### Practical Fix Batch 24 Standards

The desktop ribbon thesis identity is now locked and must not change wording, line count, or line order without an intentional update to the tests and audit.

Approved desktop thesis identity:

```text
Sultan Ageng Tirtayasa University – Mechanical Engineering
Modeling & Simulation of a Pumping System for Evaluating Cavitation
Potential in Centrifugal Pumps Based on NPSH Analysis for Various Fluids.
Bachelor’s Thesis - Farid Azrighani et al.
```

Batch 24 verification:

- Strengthened `tests/academic-identity-layout.cjs` to assert the exact approved four-line desktop wording and order.
- Extended `tools/smoke-first-run-basis-flow.cjs` so browser smoke fails if the runtime desktop ribbon text differs from the approved four-line wording.
- Extended `tests/first-run-basis-flow.cjs` so the reusable browser smoke lock cannot be removed silently.

### Practical Fix Batch 25 Standards

The pump live parameter panel must remain readable on iPhone/mobile widths. The panel may be compact, but suction/discharge labels, values, and units must not visually stack or overwrite each other.

This behavior is locked. Do not narrow the mobile pump live panel, collapse the label/value/unit columns, or remove the overflow protection unless the audit and regression tests are intentionally updated for a new approved design.

Expected mobile pump live-panel behavior:

| Surface | Expected behavior |
|---|---|
| Pump live panel width | Keeps enough width for clear suction/discharge labels while staying within the viewport |
| Label/value/unit rows | Preserve separate label, value, and unit columns without overlap |
| Tight spaces | Labels may truncate cleanly, but values and units must remain readable |
| Regression lock | `pump-live-parameter-panel.cjs` fails if the mobile panel is narrowed back to the overlapping layout |

Batch 25 verification:

- Restored the pump-specific mobile live-panel width instead of inheriting the very narrow generic live-panel width.
- Restored the pump-specific mobile row grid: label column, numeric value column, and unit column.
- Added label overflow protection so text truncates cleanly instead of painting over realtime values.
- Extended `tests/pump-live-parameter-panel.cjs` to lock the mobile readability rule.

### Practical Fix Batch 26 Standards

The ribbon must not show the large `Objects` button with the plus icon. The direct engineering object palette remains the active mobile/tablet workflow and keeps horizontal scrolling.

This behavior is locked. Do not re-enable the `Objects` ribbon button unless the audit and regression tests are intentionally updated for a new approved design.

Expected behavior after Batch 26:

| Surface | Expected behavior |
|---|---|
| `Objects` plus button | Hidden on desktop, tablet, iPad, and mobile |
| Mobile/tablet object access | Uses the visible compact horizontal object palette |
| Legacy grouped menu markup/code | May remain dormant for compatibility, but must not render as a ribbon button |
| Critical CSS | Hides the `Objects` button before the full stylesheet loads |

Batch 26 verification:

- Updated `style.css` and critical inline CSS in `index.html` so `.toolbar-object-menu-container` stays `display: none !important`.
- Updated toolbar, keyboard, first-run smoke, and audit-resolution tests to lock the hidden `Objects` button.
- Preserved the direct object palette and its horizontal scroll behavior.

### Practical Fix Batch 27 Standards

Compact ribbons should use the empty space to the right of `Solve` for a concise academic identity. This compact identity is text-only, without logo, and is separate from the long desktop thesis identity.

Approved compact academic identity:

```text
UNTIRTA – Mechanical Engineering
Pumping Simulation for NPSH Analysis
Cavitation Potential in Centrifugal Pumps
Bachelor’s Thesis - Farid Azrighani et al.
```

Expected behavior after Batch 27:

| Surface | Expected behavior |
|---|---|
| Compact/tablet/mobile ribbon | Shows the four-line no-logo identity to the right of `Solve` with proportional larger type |
| Desktop long ribbon | Keeps the long thesis identity and existing desktop lock |
| Object palette | Remains visible below the top ribbon row and horizontally scrollable |
| Regression lock | Browser smoke validates compact identity wording, position right of `Solve`, and no clipping |

Batch 27 verification:

- Added `.academic-compact-identity` after `#btn-solve` in ribbon order.
- Added compact identity CSS in `style.css` and critical inline CSS in `index.html`.
- Increased compact identity typography with responsive bounds so the text uses available space without clipping.
- Extended `tests/academic-identity-layout.cjs` and `tools/smoke-first-run-basis-flow.cjs` to lock the compact identity wording and placement.

### Practical Fix Batch 28 Standards

The compact academic identity must not fall below the `Fluid Basis` and `Solve` top-row controls on iPhone SE sized screens. The locked viewport is 375 x 667.

Expected behavior after Batch 28:

| Surface | Expected behavior |
|---|---|
| iPhone SE 375 x 667 ribbon | `Fluid Basis`, `Solve`, and the compact academic identity stay on the same top row |
| Compact academic identity | Remains immediately to the right of `Solve`, keeps the approved four-line wording, and does not clip |
| Object palette | Remains on the second ribbon row and keeps horizontal scroll |
| Regression lock | Browser smoke includes `iphone-se` and fails if the compact identity drops below `Solve` |

Batch 28 verification:

- Updated the `max-width: 420px` ribbon CSS so the Fluid Basis/Solve buttons are compact enough for the identity to remain beside `Solve`.
- Updated `.academic-compact-identity` iPhone-width sizing in `style.css` and critical inline CSS in `index.html`.
- Extended `tools/smoke-first-run-basis-flow.cjs` with the `iphone-se` 375 x 667 viewport and `compactAcademicIdentitySameRowAsSolve` assertion.
- Extended `tests/academic-identity-layout.cjs` so this layout decision is locked in static regression coverage.

### Practical Fix Batch 29 Standards

The top menu bar must remain visible when the application is displayed on iPhone SE landscape size, 667 x 375. The earlier compact-landscape rule that hid `.menu-bar` is no longer approved for this viewport.

Expected behavior after Batch 29:

| Surface | Expected behavior |
|---|---|
| iPhone SE 667 x 375 menu bar | `File`, `Edit`, `Process`, `Simulate`, `Tools`, `View`, and `Help` remain visible in a compact top row |
| Ribbon | Stays below the menu bar with `Fluid Basis`, `Solve`, compact academic identity, and object palette readable |
| Object palette | Remains visible and usable under the compact identity row |
| Regression lock | Browser smoke includes `iphone-se-landscape` and fails if the menu bar is hidden |

Batch 29 verification:

- Updated the `max-height: 560px` landscape CSS so `.menu-bar` remains `display: flex` with compact height, padding, gap, and font size.
- Extended `tools/smoke-first-run-basis-flow.cjs` with the `iphone-se-landscape` 667 x 375 viewport and `menuBarVisible` assertion.
- Extended `tests/toolbar-responsive-accessibility.cjs` to lock the compact landscape menu bar rule.

## 2. Audit Method

### Static/code inspection

Reviewed relevant UI and workflow areas:

- `index.html`
- `style.css`
- `ui/canvas-manager.js`
- `ui/task-window.js`
- `ui/connections-renderer.js`
- `ui/context-menu.js`
- `toolbar/menu-bar.js`
- `core/unit-system.js`
- `core/simulation-engine.js`
- `properties/object-properties.js`
- object formula files for Tank, SRC, Sink, Pipe, Pump-related NPSH, Instrument, Heat Exchanger, Valve, Vessel H/V

### Browser smoke checks

Local app launched at:

```text
http://127.0.0.1:8826/
```

Browser checks performed:

- Fresh load / first setup behavior
- Apply Fluid Basis / Unit Standard
- Add Source, Tank, Pump, Sink, LIC
- Create SRC-to-Tank semantic attachment
- Attempt Tank-to-Pump and Pump-to-Sink hydraulic connection workflow
- Attempt LIC-to-Tank level attachment
- Open Help > Fluid Properties > NPSH Relevance & Academic Notes
- Change Unit Standard to US Customary after objects exist
- Responsive checks at:
  - 1280 x 720 desktop
  - 1024 x 768 tablet landscape
  - 768 x 1024 tablet portrait
  - 390 x 844 mobile

### Automated tests

All existing `.cjs` tests passed.

Key covered areas include:

- Fluid trace validation
- Unit system validation
- NPSH validation
- SRC boundary validation
- Source/Sink/Tank/Pump live panels
- Pipe delta label
- Tank/Vessel/Instrument/HX/Valve trace validation
- Task window dock behavior
- Warning panel behavior
- Performance/loading
- Accessibility labels for form fields

Result:

```text
ALL TESTS PASSED
```

## 3. Acceptance Criteria Result

| Acceptance item | Result | Notes |
|---|---:|---|
| No horizontal overflow | Pass with caveat | Page-level horizontal overflow was false on desktop/tablet/mobile. Canvas has internal horizontal scroll by design because workspace is wider than viewport. |
| Live panel labels clear | Pass after Batch 1 and Batch 25 | SRC/SNK/Pump/Tank boundary labels now use readable wording such as Outlet Flow, Source Press., Vapor Margin, and NPSH at Pump. Mobile pump label/value/unit columns are locked against overlap. |
| Unit changes realtime | Pass after Batch 1 | Browser smoke confirmed SRC, Tank, Pump, and Sink live panels switch units in realtime after Unit Standard changes. |
| Task Window does not cover canvas badly | Pass with dock caveat | Object tasks can minimize to dock and toolbar-added objects auto-dock their property task window; intentionally restored task windows can still cover canvas by user choice. |
| Warning actionable | Pass after Batch 4/7 | Canvas warnings use shorter summaries, retain full detail, open related task context, and append action guidance at the UI layer. |
| No console error | Pass | Browser audit found 0 console errors in checked flows. |
| Existing tests pass | Pass | All `.cjs` tests passed. |

## 4. Findings

### Critical

No Critical findings.

## High Findings

### H-01 - Unit standard change is not consistently reflected in live parameter panels

Location/component:
Canvas live parameter panels: SRC, Tank, Pump, Sink.

Problem:
In browser testing, after changing Unit Standard to `US Customary`, the SNK live panel updated to US units:

```text
Pout 14.692 psia
zSNK 0.0 ft
P-Pv +14.233 psi
```

But SRC, Tank, and unsolved Pump panels still displayed Metric units:

```text
SRC: Qout 9.5 m3/h, Psrc 1.013 bar a, zSRC 9.0 m
Tank: Surface Press. 1.013 bar a, Surface Elev. 9.00 m, Volume 58.9 m3
Pump: Fluid Vapor Press. 0.032 bar a
```

Impact to user:
This can lead to wrong interpretation of pressure, elevation, flow, and NPSH-related values when the user changes unit standard after modeling has started.

Recommendation:
Refresh all object live panels after `unitStandard` changes, including unsolved states. Ensure `updateAllObjectOperatingStatusVisuals()` or equivalent is called after the unit standard setter. Audit each panel for `getDisplayUnit()` and `convertToDisplay()` usage.

Status: **Resolved in Batch 1**

### H-02 - Hidden primary Connect mode makes hydraulic modeling hard to discover

Location/component:
Ribbon / connection workflow.

Problem:
Earlier audit work treated the hidden `#btn-mode-connect` button as a discoverability issue. The product decision is now different: the ribbon should not show general `Select` or `Connect Pipe` mode buttons, because hydraulic modeling should start from the actual object via right-click/context menu.

Impact to user:
The ribbon stays cleaner and object-specific actions are less ambiguous. The remaining risk is that context-menu affordance must stay clear through canvas hints, help guidance, and consistent right-click/long-press behavior.

Recommendation:
Do not render `Select` or `Connect Pipe` in the ribbon. Preserve these context-specific paths instead:

- right-click object context menu: `Connect`, `Connect here`, `Start Pipe`
- SRC semantic attachment actions: `Attach Tank/Vessel`
- LIC/instrument attachment actions: `Attach Level`, `Connect Instrument`
- canvas connect-mode hint while wiring is active

Status: **Resolved in Batch 2 and Batch 5; superseded and locked by Batch 19 and Batch 20**

### H-03 - Warning panel can cover objects and block interaction

Location/component:
Canvas warning panel, default object placement, LIC workflow.

Problem:
Browser testing showed the warning panel covering the default LIC placement area. `elementFromPoint()` on the LIC returned the warning panel content instead of the LIC object. This blocked right-clicking the LIC and prevented the user from selecting `Attach to tank/vessel level`.

Impact to user:
The user can be unable to attach LIC to a tank because the warning panel sits above the object. This feels like the object is broken or not selectable.

Recommendation:
Make the warning panel collapsible, closable, or auto-reposition it away from new objects. Also consider reserving object placement zones away from overlays.

Status: **Resolved in Batch 4; superseded and locked by Batch 22**

### H-04 - Default object placement and live panels can crowd click targets

Location/component:
Canvas object auto-placement and live parameter panels.

Problem:
Source, Tank, Pump, Sink, and LIC are placed close together on default add. Live panels expand object hit areas visually and can make right-click/selection ambiguous. During the browser scenario, attempts to right-click a source/nearby object could surface context menu content for the attached tank or another object.

Impact to user:
Users may choose the wrong context action or believe a connection command is inconsistent. This is especially problematic for SRC/Tank because dashed attachment vs solid pipe has engineering meaning.

Recommendation:
Increase default placement spacing when live panels are enabled, or offset panels more intelligently. Also consider hiding live panels while context menus are open or while the user is in connection mode.

Status: **Resolved in Batch 2 and Batch 5**

## Medium Findings

### M-01 - SRC and SNK live panel labels still use engineering abbreviations

Location/component:
Canvas live parameter panels for SRC and SNK.

Problem:
SRC/SNK labels still include:

```text
Qout, Psrc, zSRC, Hsrc, hLs, NPSHa@P
Pout, zSNK, HSNK, hLd, Pv, P-Pv, NPSHm
```

Impact to user:
These are compact but not self-explanatory. The user already requested clearer pump labels, so the same principle should apply to boundary panels.

Recommendation:
Rename to clearer labels, for example:

- `Qout` -> `Outlet Flow`
- `Psrc` -> `Source Press.`
- `zSRC` -> `Source Elev.`
- `Hsrc` -> `Source Head`
- `hLs` -> `Suction Loss`
- `NPSHa@P` -> `NPSH at Pump`
- `Pout` -> `Outlet Press.`
- `hLd` -> `Discharge Loss`
- `Pv` -> `Vapor Press.`
- `P-Pv` -> `Vapor Margin`

Status: **Resolved in Batch 1**

### M-02 - Unit Standard is less discoverable after the basis pill is hidden

Location/component:
Fluid Basis + Unit Standard setup, ribbon.

Problem:
After `Apply Basis / Start Modeling`, the basis status pill is hidden as requested. The Fluid Basis ribbon button still opens the setup, but the current active unit standard is no longer visible at a glance.

Impact to user:
Users may forget whether they are working in Metric, SI, or US units. This gets more risky once unit conversion works across every object.

Recommendation:
Keep the large setup pill hidden after Apply, but add a small non-interactive status text or compact badge, for example:

```text
Units: Metric
Fluid: Water @ 25 deg C
```

Or show it only in a status bar, not as a setup CTA.

Status: **Resolved in Batch 3**

### M-03 - Context menu is doing too much critical workflow work

Location/component:
Object right-click context menu.

Problem:
Important modeling actions depend heavily on context menu items:

- Source Type selection
- SRC semantic attachment
- Hydraulic pipe connection
- LIC level attachment
- Task window open

Impact to user:
Right-click is efficient for advanced users, but it is not obvious on touch/tablet/mobile and can be difficult when overlays cover objects.

Recommendation:
Keep context menu, but add visible affordances:

- toolbar connection mode
- object hover mini-actions
- clear "Start pipe" / "Attach" buttons inside selected object sidebar/task window

Status: **Resolved in Batch 2 and Batch 5**

### M-04 - Task Window opens correctly but can interrupt rapid canvas wiring

Location/component:
Task Window and object/context interaction.

Problem:
Object task windows are useful, but during browser interaction a task window could remain open or be hidden while still affecting workflow perception. Users wiring objects may not want property windows to open automatically.

Impact to user:
Modeling flow can feel interrupted when the user is trying to lay out and connect multiple objects quickly.

Recommendation:
Consider "modeling mode" behavior:

- single-click selects only
- double-click or explicit button opens task window
- context menu task open remains available

Status: **Resolved in Batch 9**

### M-05 - Help content is available, but Task Window `data-kind` is blank

Location/component:
Help > Fluid Properties > NPSH Relevance & Academic Notes.

Problem:
Help submenu opens the Task Window and content is readable. Browser audit showed title is correct, but `taskWindow.dataset.kind` is blank for help content.

Impact to user:
Minor visual impact, but it may limit styling/state logic for help windows and future responsive behavior.

Recommendation:
Set a stable kind such as `help` or `fluid-help` for help Task Window content.

Status: **Resolved in Batch 3**

### M-06 - Long warning messages can dominate the canvas

Location/component:
Warning panel.

Problem:
Pump incomplete warning text is useful but long:

```text
Complete pump inputs: Design Flow, Design Head, Design Efficiency, NPSHr @ BEP / Manual NPSHr, BEP Flow.
```

Impact to user:
The warning panel becomes visually dominant while the user is still assembling the model.

Recommendation:
Use a short warning summary on canvas and keep full detail in the clicked warning/task window.

Status: **Resolved in Batch 4 and Batch 7**

## Low Findings

### L-01 - Toolbar has dense labels on smaller screens

Location/component:
Ribbon toolbar.

Problem:
The toolbar remains usable at tested breakpoints, but the number of tools is high and labels are small.

Impact to user:
Mobile/tablet users may need more precision than expected, especially with drag/drop.

Recommendation:
Consider grouped overflow menus or segmented tool modes for small screens.

Status: **Resolved in Batch 8, Batch 15, and Batch 21**

### L-02 - Menu and context menu accessibility should be audited with keyboard-only navigation

Location/component:
Menu bar, Help submenu, context menu.

Problem:
Basic ARIA and labels exist in many areas, and form-field accessibility tests pass. However, keyboard-only traversal of nested menus/context menus was not exhaustively validated in the browser audit.

Impact to user:
Keyboard and assistive-technology users may have inconsistent access to advanced commands.

Recommendation:
Add a dedicated keyboard navigation test for menu bar, Help submenu, context menu, task window close/minimize, and warning panel focus.

Status: **Resolved in Batch 6**

### L-03 - Canvas internal horizontal scroll is expected but should be communicated

Location/component:
Canvas/PFD workspace.

Problem:
Page-level horizontal overflow is absent, but the canvas has internal horizontal scroll because the workspace is wider than the viewport.

Impact to user:
This is normal for a PFD workspace, but mobile/tablet users may not immediately know the canvas is pannable.

Recommendation:
Add subtle pan/scroll affordance on small screens, or keep the grid visible enough to imply workspace movement.

Status: **Resolved in Batch 4**

## 5. Positive Findings

- Fresh startup keeps canvas clean before modeling.
- Fluid Basis Task Window is responsive and readable across tested desktop/tablet/mobile viewports.
- Help > Fluid Properties submenu exists and opens NPSH notes in Task Window.
- Pump live panel labels are much clearer after recent changes.
- Tank live panel now focuses on NPSH/hydraulic-relevant values: surface pressure, surface elevation, outlet elevation, level, volume, outlet flow, net flow, trend.
- Warning messages are generally engineering-specific and actionable.
- Tests cover a broad range of calculation trace and unit behavior.
- Page-level horizontal overflow was not observed in tested breakpoints.
- No console errors were observed in browser smoke checks.

## 6. Regression Risk Notes

Areas with higher risk if changed:

- Unit-standard propagation touches many panels and task windows. Fixing H-01 should use a central refresh path, not per-panel manual patches only.
- Warning panel repositioning should not hide critical NPSH warnings; use collapse/minimize rather than simply suppressing warnings.
- Keeping connection controls out of the ribbon and selected-object canvas strip should preserve existing right-click and port-click workflows.
- Changing live panel labels should not break tests that assert existing label names.
- Increasing object spacing affects saved project layout only for newly added objects; do not migrate old coordinates unless explicitly required.

## 7. Suggested Fix Order

The original fix order has been executed through the practical fix batches:

1. Unit-standard refresh inconsistency: completed in Batch 1.
2. Warning panel collapse/reposition and concise warning display: completed in Batch 4, with action guidance in Batch 7.
3. Connection workflow and solid/dashed modeling guidance: completed in Batch 2 and Batch 5, then intentionally shifted to context-menu-first workflow in Batch 19 and selected-object action-panel removal in Batch 20.
4. SRC/SNK live-panel label clarity: completed in Batch 1.
5. Default object placement spacing and reduced live-panel click-target crowding: completed in Batch 2 and Batch 5.
6. Keyboard menu/context/task-window accessibility tests: completed in Batch 6.
7. Toolbar small-screen usability, grouped object overflow compatibility, object-menu keyboard compatibility, accessibility regression coverage, compact horizontal-scrolling mobile object palette, hidden `Objects` ribbon button, and compact academic identity beside `Solve`: completed in Batch 8, Batch 15, Batch 16, Batch 17, Batch 21, Batch 26, and Batch 27.
8. Nonblocking task-window docking and focus-return behavior: completed in Batch 9 and Batch 18.
9. Nonblocking export/menu feedback and destructive-action confirmation: completed in Batch 10, Batch 11, and Batch 13.
10. Top-menu intent clarity: completed in Batch 12.

Remaining optional backlog:

- None from the original practical UX/UI recommendation list. Future mobile usability testing may still suggest refinements, but the mobile object palette is now locked as visible/horizontally scrollable and the `Objects` ribbon button is locked hidden.

## 8. Verification Evidence

### Automated tests

All existing `.cjs` tests passed, including:

- `unit-system-validation.cjs`
- `first-run-basis-flow.cjs`
- `connection-workflow-discoverability.cjs`
- `source-boundary-validation.cjs`
- `source-live-parameter-panel.cjs`
- `sink-live-parameter-panel.cjs`
- `tank-live-parameter-panel.cjs`
- `pump-live-parameter-panel.cjs`
- `tank-trace-validation.cjs`
- `vessel-trace-validation.cjs`
- `vessel-v-trace-validation.cjs`
- `heat-exchanger-trace-validation.cjs`
- `valve-trace-validation.cjs`
- `instrument-trace-validation.cjs`
- `task-window-dock.cjs`
- `performance-loading.cjs`

### Browser checks

Observed:

- 0 console errors during checked flows.
- Desktop/tablet/mobile page-level horizontal overflow: false.
- Help submenu opens expected NPSH content.
- Original audit reproduced unit-change inconsistency after changing to US Customary; Batch 1 browser smoke later confirmed SRC, Tank, Pump, and Sink live panels update in realtime.
- Original audit reproduced warning panel overlap around default LIC placement; Batch 4 and Batch 5 later confirmed warning collapse, selection actions, and spaced placement reduce this blocker.
- Batch 8 to Batch 13 browser smoke checks found no console errors in the checked flows.
- Batch 18 browser smoke confirmed object Task Window focus return: minimize returns focus to the matching dock restore button, close returns focus to the visible `Show ...` launcher, with no console errors or horizontal overflow. Screenshot: `docs/ux_ui_fix_batch18_task_window_focus_smoke.png`.
- Batch 19 static verification and reusable browser smoke confirmed the ribbon no longer renders `Select` or `Connect Pipe`, while context-menu connection actions and connect-mode canvas hints remain covered.
- Batch 20 static verification and reusable browser smoke confirmed the selected-object canvas action panel no longer renders, while right-click/context-menu object properties and connection actions remain covered.
- Batch 21 static verification and reusable browser smoke confirmed the mobile ribbon keeps the object palette visible as a compact horizontally scrollable strip at iPhone/mobile width.
- Batch 22 static verification and reusable browser smoke confirmed the `Pan / scroll canvas` pill no longer renders on desktop, tablet landscape, or mobile.
- Batch 23 static verification and reusable browser smoke confirmed the desktop ribbon thesis identity remains visible without clipped text.
- Batch 24 static verification and reusable browser smoke locked the exact desktop Academic identity wording, order, and four-line structure.
- Batch 25 static verification locked the mobile pump live-panel width and label/value/unit overlap protection.
- Batch 26 static verification and reusable browser smoke locked the hidden `Objects` ribbon button while preserving the compact horizontal object palette.
- Batch 27 static verification and reusable browser smoke locked the compact no-logo academic identity to the right of `Solve` on small ribbons.
- Batch 28 static verification and reusable browser smoke locked the compact no-logo academic identity on the same row as `Solve` at iPhone SE 375 x 667.
- Batch 29 static verification and reusable browser smoke locked the compact landscape menu bar as visible at iPhone SE 667 x 375.
- Final viewport smoke confirmed the thesis startup and first-run basis flow on desktop, tablet landscape, iPhone SE portrait, iPhone SE landscape, and mobile: the Help > About dialog is mandatory-visible on browser open, the startup Fluid Basis shell remains available behind it with `Open Setup`, closing About does not minimize the setup shell, full setup shows `Apply Basis / Start Modeling`, Apply hides the setup window and ribbon setup pill, startup canvas stays clean, and no console errors or page-level horizontal overflow were observed. About screenshots: `docs/ux_ui_final_smoke_about_desktop.png`, `docs/ux_ui_final_smoke_about_tablet-landscape.png`, `docs/ux_ui_final_smoke_about_iphone-se.png`, `docs/ux_ui_final_smoke_about_iphone-se-landscape.png`, `docs/ux_ui_final_smoke_about_mobile.png`. Post-apply screenshots: `docs/ux_ui_final_smoke_desktop.png`, `docs/ux_ui_final_smoke_tablet-landscape.png`, `docs/ux_ui_final_smoke_iphone-se.png`, `docs/ux_ui_final_smoke_iphone-se-landscape.png`, `docs/ux_ui_final_smoke_mobile.png`.
- The final first-run basis smoke can be rerun with `node tools/smoke-first-run-basis-flow.cjs` from the project root. The tool uses `http://127.0.0.1:4173/` by default, starts the preview server if needed, and rewrites the three final viewport screenshots.

## 9. Final Audit Status

Audit complete, with practical UX/UI fixes applied and verified through Batch 29. The original findings are retained for traceability, and their status lines now identify the resolving batch or later product-decision supersession. Latest automated verification: context-menu-first connection workflow is locked in `tests/connection-workflow-discoverability.cjs`; selected-object action-panel removal is locked in `tests/canvas-selection-actions.cjs`; mobile object palette visibility, horizontal scroll, hidden `Objects` ribbon button, compact academic identity beside `Solve`, iPhone SE same-row compact identity behavior, and iPhone SE landscape menu bar visibility are locked in `tests/toolbar-object-overflow.cjs`, `tests/toolbar-responsive-accessibility.cjs`, `tests/academic-identity-layout.cjs`, and `tools/smoke-first-run-basis-flow.cjs`; canvas pan-hint removal is locked in `tests/canvas-pan-affordance.cjs`; desktop thesis identity readability is locked in `tests/academic-identity-layout.cjs` and `tools/smoke-first-run-basis-flow.cjs`; exact desktop thesis identity wording and line breaks are locked in `tests/academic-identity-layout.cjs` and `tools/smoke-first-run-basis-flow.cjs`; mobile pump live-panel readability is locked in `tests/pump-live-parameter-panel.cjs`; task-window focus-return coverage is included in `tests/task-window-dock.cjs` and `tests/keyboard-navigation-accessibility.cjs`; the full `.cjs` suite passed after Batch 29.
