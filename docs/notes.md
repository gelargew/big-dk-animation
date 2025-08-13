# Gallery interaction notes

## Goal states
- Default scale: 1.0
- Scrolling scale: 0.85–0.90 (current code uses 0.90)
- When selected: do NOT change container scale; change only the selected item's height to 70% of viewport and center it

## Non-negotiable rules to avoid perceptual stop/snap
- Anchor at viewport center when scaling container:
  - transformOrigin: '50% 0'
  - translateY: t = H/2 − scale × (displayedY + H/2)
- Use one source of truth for motion:
  - virtualY (target), displayedY (eased), targetScale, displayedScale
- Match easing time constants for translate and scale:
  - alpha = 1 − base^dt (frame-rate independent)
  - displayedY += (virtualY − displayedY) × alpha
  - displayedScale += (targetScale − displayedScale) × alpha
- Wheel handler should only set targets:
  - Update virtualY (clamped)
  - Set targetScale to scrolling value
  - Start/reset idle timer; idle returns targetScale to default
- Never change item heights during container scaling

## Selection behavior
- Change selected item height only (to 70% of viewport).
- Compute absolute tops using cumulative layout with baseItemHeight = slotHeight − GAP and add GAP between items.
- Center each frame using current displayed selectedHeight to avoid jumps.
- Optionally disable wheel during selection animation to prevent races.

## Gaps and parent height
- Top of item i: sum of previous (itemHeight + GAP)
- Parent height: total cumulative − GAP

## Troubleshooting playbook
- If scale looks ahead/behind translate: ensure transformOrigin and translateY formula are correct and easing constants match.
- If vertical jump on release: verify center anchoring (viewport) not content anchoring.
- If gaps vanish: confirm cumulative layout uses baseItemHeight and adds GAP every step.


