# Aquavelle design system

## River atlas and rainwater workspaces

The national map is the primary canvas, with stable district filters above it and a list or evidence inspector beside it. Map colors distinguish mapped sites, priority leads, historical samples and modelled river lines. Mobile stacks the map over the same evidence controls. The rainwater calculator uses measured input labels, a seasonal shortfall chart with a matching table, and selectable original drawings on a plain white sheet.

## Current V4 task surface · Operate

Preserve daylight green/white and locally hosted Manrope. A compact header offers Find water, Check rivers and Plan supply; records and evidence are secondary. Water search uses a selectable list, literal map and source inspector rather than KPI cards. Rivers use real channel geometry beside dated measurements, visible association gaps and sampling next steps. Supply shows a water-conserving daily calculation with a readable table. Primary controls are at least 44px high, form text 16px, keyboard focus visible; at phone width each task becomes one column with horizontal table overflow where necessary. New styles are scoped under `.water-platform` and explicitly reset legacy navigation direction. Map/list selection, meaningful result status, error recovery and safe retry behavior matter more than decorative motion.

## Direction

Daylight service desk. A printed service timetable becomes a responsive operating console: open surfaces, precise ruled rows, an infrastructure schematic and clearly separated confirmed/proposed states. User delegated the direction and chose code-first.

Grounded candidates considered: field notebook, coastal survey atlas, public notice board, utility control room, scientific field report, municipal task register, public-service timetable. Assigned seventh direction retained. Airport wayfinding contributes obvious next action; orienteering contributes distinction between terrain and interventions. Streaming catalogue and ornamental tile systems lose product clarity. No decorative geographic claims.

## Tokens

Canvas #f3f5ef; surface #ffffff; ink #183b35; secondary #52675f; muted #60736d; rule #d8e2d9; green #176b4c; green wash #e5f1df; teal #357e8d; amber #996013; warning wash #fff2dc; critical #9c4035.
Typeface: locally hosted Manrope; fallback sans-serif. Body 15px; heading 34px; major number 36px. Tabular numerals for quantities. Corner radius 12px for panels, 7px for inputs. Grid spacing 8/16/24/32. Border-driven panels; no decorative shadows.

## Interaction

One action recalculates the graph, coverage bars, stock trace and task list. Changes invalidate prior confirmation and receipt. Receipt tampering returns a visible verification failure. Focus rings are 3px green; motion obeys reduced-motion preferences.

## Responsive

Wide screens use navigation, work area and outcome panel. Under 1000px collapse the sidebar to a top navigation. Under 700px use one column and horizontal table overflow with labelled headings. Preserve all task controls.

## V3 surface: operate, map first

The map is the primary work area; one compact region/scenario toolbar, one delivery action, one point inspector. Source truth is visible in short labels, with detailed reasoning in disclosure. Preserve the daylight palette and Manrope, but remove the dashboard sidebar, redundant intros, large hero and competing workflows. Secondary input/evidence/GPS controls reveal only when requested. At phone width the map precedes the point panel; tables/fields stay keyboard accessible. No decorative motion: only labelled road-following playback and real device location when explicitly requested.
