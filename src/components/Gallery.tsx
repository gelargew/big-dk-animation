import { useCallback, useEffect, useRef, useState } from 'react';
import Tempus from 'tempus';
import { useWindowSize } from 'hamo';
import './Gallery.css';
import { galleryItems } from './DATA';
import { ProjectSection } from './projectIItem';

// Centralized interaction/config constants (single source of truth)
const CONFIG = {
	CONTAINER_WIDTH: 700,
	GAP_PX: 24,
	TOP_PAD_FRAC: 0.2,
	BOTTOM_PAD_FRAC: 0.4,
	SLOT_BASE_HEIGHT_PX: 500,
	// Wheel/touchpad sensitivity
	// When a wheel event looks like a traditional mouse (large deltas or line/page mode),
	// multiply the delta by this scale to reduce sensitivity. Touchpads remain unchanged.
	WHEEL_MOUSE_THRESHOLD_PX: 40,
	WHEEL_MOUSE_SCALE: 0.6,
	// Scale states
	SCALE_DEFAULT: 0.75,
	SCALE_SCROLLING_MIN: 0.65,
	SCALE_SCROLL_EASE_BASE: 0.05, // alpha base for scrolling scale
	// Translate lerp when not selected
	TRANSLATE_LERP_BASE: 0.001,
	// Selection behavior
	SELECTED_HEIGHT_FRAC: 0.6, // 60% of viewport height
	SELECT_DURATION_MS: 1500, // change once → height+centering+selected-scale
} as const;

export default function Gallery() {
	// Viewport size via hamo
	const { width, height } = useWindowSize();

	// Virtual scroll position driven purely by wheel events (imperative)
	const virtualYRef = useRef(0); // target position
	const displayedYRef = useRef(0); // eased position
	const displayedScaleRef = useRef<number>(CONFIG.SCALE_DEFAULT);
	const targetScaleRef = useRef<number>(CONFIG.SCALE_DEFAULT);
	const lastWheelTsRef = useRef<number>(performance.now());
	const rafIdRef = useRef<number | null>(null);
	const resetScaleTimerRef = useRef<number | null>(null);
	// Selection (step 3: smooth height easing + centering + persistent expansion)
	const selectedIndexRef = useRef<number | null>(null);
	const targetSelectedHeightRef = useRef<number | null>(null);
	const displayedSelectedHeightRef = useRef<number | null>(null);
	const expandedHeightsRef = useRef<Map<number, number>>(new Map());
	// Track current parent content height for better clamping during centering and wheel
	const parentHeightRef = useRef(0);
	// Selection animation timing/anchors
	const selAnimStartTsRef = useRef<number | null>(null);
	const selAnimFromHRef = useRef<number | null>(null);
	const centerFromYRef = useRef<number | null>(null);
	const centerToYRef = useRef<number | null>(null);
	const selectedScaleFromRef = useRef<number | null>(null);

	// Note: buffer not needed with parent-scaling approach

	// Slot height is measured from the rendered first item height + GAP_PX
	const [slotHeight, setSlotHeight] = useState<number>(
		CONFIG.SLOT_BASE_HEIGHT_PX + CONFIG.GAP_PX
	);

	const viewportHeight = typeof height === 'number' ? height : 800;
	const totalHeight = slotHeight * galleryItems.length;
	const maxVirtualYRef = useRef<number>(
		Math.max(0, totalHeight - viewportHeight)
	);
	useEffect(() => {
		maxVirtualYRef.current = Math.max(
			0,
			slotHeight * galleryItems.length - viewportHeight
		);
	}, [slotHeight, viewportHeight]);

	// Attach a non-passive wheel listener so we can preventDefault without warnings
	const containerRef = useRef<HTMLElement | null>(null);
	const itemsContainerRef = useRef<HTMLDivElement | null>(null);

		const renderPositions = useCallback(() => {
		const parent = itemsContainerRef.current;
		if (!parent) return;
		const scale = displayedScaleRef.current;
		// Cumulative layout to support a single selected item with 70% viewport height
		const baseItemHeight = Math.max(0, slotHeight - CONFIG.GAP_PX);
		const Hloc1 = typeof height === 'number' ? height : 800;
		const topPad = Math.round(Hloc1 * CONFIG.TOP_PAD_FRAC);
		const selectedIdx = selectedIndexRef.current;
		const selectedHeight =
			displayedSelectedHeightRef.current ??
			Math.round(Hloc1 * CONFIG.SELECTED_HEIGHT_FRAC);
		let cumulativeTop = topPad;
		for (let i = 0; i < parent.children.length; i += 1) {
			const child = parent.children[i] as HTMLElement;
			const isSel = selectedIdx !== null && i === selectedIdx;
			const persisted = expandedHeightsRef.current.get(i);
			const itemH = isSel ? selectedHeight : persisted ?? baseItemHeight;
			child.style.position = 'absolute';
				child.style.left = `0px`;
			child.style.top = `${cumulativeTop}px`;
			child.style.height = `${itemH}px`;
				// Let width flow naturally with content; do not set explicit width
			child.style.transform = 'none';
			child.style.transformOrigin = 'center';
			cumulativeTop += itemH + CONFIG.GAP_PX;
		}
		// Set parent height; when selected, add bottom padding to allow centering near end
		const Hloc2 = typeof height === 'number' ? height : 800;
		const bottomPad = Math.round(Hloc2 * CONFIG.BOTTOM_PAD_FRAC);
		const parentHeight = Math.max(0, cumulativeTop - CONFIG.GAP_PX) + bottomPad;
		parent.style.height = `${parentHeight}px`;
		parentHeightRef.current = parentHeight;
			parent.style.willChange = 'transform';
			// Do not center horizontally; keep parent at left 0
			parent.style.left = '0px';
			const anchorY = displayedYRef.current;
			parent.style.transformOrigin = `0% ${anchorY}px`;
			const t = -displayedYRef.current;
			parent.style.transform = `translateY(${t}px) scale(${scale})`;
	}, [slotHeight, height]);
	// Tempus-driven easing loop (translate and scale based on velocity)
	useEffect(() => {
		if (!Tempus.isPlaying) Tempus.play();
		const unsubscribe = Tempus.add(
			(_: number, dtArg: number) => {
				let dt = typeof dtArg === 'number' ? dtArg : 0;
				if (dt > 1) dt = dt / 1000;
				if (dt <= 0) return;
				// When selected: drive height, centering, and scale with the same duration/easing
				if (selectedIndexRef.current !== null) {
					const Hloc = typeof height === 'number' ? height : 800;
					const baseH = Math.max(0, slotHeight - CONFIG.GAP_PX);
					const hTarget =
						targetSelectedHeightRef.current ??
						Math.round(Hloc * CONFIG.SELECTED_HEIGHT_FRAC);
					targetSelectedHeightRef.current = hTarget;
					const hCurrent = displayedSelectedHeightRef.current ?? baseH;
					// Power4.out easing based on Tempus time (monotonic)
					const nowTs = performance.now();
					if (!selAnimStartTsRef.current) selAnimStartTsRef.current = nowTs;
					if (selAnimFromHRef.current == null) selAnimFromHRef.current = hCurrent;
					const tSel = Math.max(
						0,
						Math.min(
							1,
							(nowTs - selAnimStartTsRef.current) / CONFIG.SELECT_DURATION_MS
						)
					);
					const easeSel = 1 - Math.pow(1 - tSel, 4);
					const fromH = selAnimFromHRef.current ?? hCurrent;
					const nextH = fromH + (hTarget - fromH) * easeSel;
					displayedSelectedHeightRef.current = nextH;
					// Compute final desired center Y ONCE (based on FUTURE hTarget) and ease to it with the same easing
					if (centerFromYRef.current == null)
						centerFromYRef.current = displayedYRef.current;
					if (centerToYRef.current == null) {
						const topPadLoc = Math.round(Hloc * CONFIG.TOP_PAD_FRAC);
						let sumPrev = 0;
						for (let j = 0; j < (selectedIndexRef.current ?? 0); j += 1) {
							const persisted = expandedHeightsRef.current.get(j);
							const prevH = persisted ?? baseH;
							sumPrev += prevH + CONFIG.GAP_PX;
						}
						const selectedTop = topPadLoc + sumPrev;
						const desiredYFinal = selectedTop - (Hloc / 2 - hTarget / 2);
						const dynMaxY = Math.max(0, parentHeightRef.current - Hloc);
						centerToYRef.current = Math.max(0, Math.min(dynMaxY, desiredYFinal));
					}
					const fromY = centerFromYRef.current ?? displayedYRef.current;
					const toY = centerToYRef.current ?? virtualYRef.current;
					displayedYRef.current = fromY + (toY - fromY) * easeSel;
					virtualYRef.current = toY;
					// Also sync container scale to the same easing (from current to selected target)
					const selectedScaleTarget = 1.0;
					const fromScale =
						selectedScaleFromRef.current ?? displayedScaleRef.current;
					displayedScaleRef.current =
						fromScale + (selectedScaleTarget - fromScale) * easeSel;
					targetScaleRef.current = selectedScaleTarget;
					// Do not auto-deselect; persistence happens on wheel
				} else if (displayedSelectedHeightRef.current != null) {
					const baseH = Math.max(0, slotHeight - CONFIG.GAP_PX);
					const hCurrent = displayedSelectedHeightRef.current;
					const dh = baseH - hCurrent;
					const hAlpha = 1 - Math.pow(CONFIG.TRANSLATE_LERP_BASE, dt);
					const nextH = Math.abs(dh) > 0.1 ? hCurrent + dh * hAlpha : baseH;
					displayedSelectedHeightRef.current = nextH;
					if (Math.abs(nextH - baseH) <= 0.1) {
						displayedSelectedHeightRef.current = null;
						targetSelectedHeightRef.current = null;
						selAnimStartTsRef.current = null;
						selAnimFromHRef.current = null;
						centerFromYRef.current = null;
						centerToYRef.current = null;
						selectedScaleFromRef.current = null;
					}
				} else {
					// Ease Y toward target with critically damped spring-like lerp when not selected
					const posAlpha = 1 - Math.pow(CONFIG.TRANSLATE_LERP_BASE, dt);
					const dy = virtualYRef.current - displayedYRef.current;
					if (Math.abs(dy) > 0.01) {
						displayedYRef.current += dy * posAlpha;
					} else {
						displayedYRef.current = virtualYRef.current;
					}
				}
				// When not selected, ease scale toward target with scrolling scale alpha
				if (selectedIndexRef.current == null) {
					const scaleAlpha = 1 - Math.pow(CONFIG.SCALE_SCROLL_EASE_BASE, dt);
					const ds = targetScaleRef.current - displayedScaleRef.current;
					if (Math.abs(ds) > 0.001) {
						displayedScaleRef.current += ds * scaleAlpha;
					} else {
						displayedScaleRef.current = targetScaleRef.current;
					}
				}
				renderPositions();
			},
			{ label: 'gallery-ease' }
		);
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [renderPositions, height, slotHeight]);

	// Wheel input: update target position and scale target from instantaneous velocity
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (maxVirtualYRef.current <= 0) return;
			e.preventDefault();
			// If selected, persist current height and clear selection on first wheel
			if (selectedIndexRef.current != null) {
				const idx = selectedIndexRef.current;
				const baseH = Math.max(0, slotHeight - CONFIG.GAP_PX);
				const currentH = displayedSelectedHeightRef.current ?? baseH;
				const Hloc = typeof height === 'number' ? height : 800;
				const targetH =
					targetSelectedHeightRef.current ??
					Math.round(Hloc * CONFIG.SELECTED_HEIGHT_FRAC);
				// Persist whichever is closer to target for stability
				const persistH = Math.abs(currentH - targetH) < 1 ? targetH : currentH;
				expandedHeightsRef.current.set(idx, persistH);
				// Clear selection state
				selectedIndexRef.current = null;
				displayedSelectedHeightRef.current = null;
				targetSelectedHeightRef.current = null;
				// Return container scale model to scrolling/default handling
				targetScaleRef.current = CONFIG.SCALE_DEFAULT;
				// Clear selection-related anchors
				selAnimStartTsRef.current = null;
				selAnimFromHRef.current = null;
				centerFromYRef.current = null;
				centerToYRef.current = null;
				selectedScaleFromRef.current = null;
			}
			const now = performance.now();
			const dt = Math.max(1e-3, (now - lastWheelTsRef.current) / 1000);
			lastWheelTsRef.current = now;
			// Reduce sensitivity for mouse-like wheel events; keep touchpad as-is
			const rawDeltaY = e.deltaY;
			const isMouseLike =
				e.deltaMode === 1 ||
				e.deltaMode === 2 ||
				Math.abs(rawDeltaY) >= CONFIG.WHEEL_MOUSE_THRESHOLD_PX;
			const deltaY = isMouseLike
				? rawDeltaY * CONFIG.WHEEL_MOUSE_SCALE
				: rawDeltaY;
			const Hloc = typeof height === 'number' ? height : 800;
			const dynMaxY = Math.max(0, parentHeightRef.current - Hloc);
			const next = Math.max(0, Math.min(dynMaxY, virtualYRef.current + deltaY));
			if (next !== virtualYRef.current) virtualYRef.current = next;
			// Scroll scale only when not in selection scale state
			if (selectedIndexRef.current == null) {
				const velocity = Math.abs(deltaY) / dt;
				const speedFrac = Math.min(1, velocity / 3000);
				targetScaleRef.current =
					CONFIG.SCALE_DEFAULT -
					(CONFIG.SCALE_DEFAULT - CONFIG.SCALE_SCROLLING_MIN) * speedFrac;
			}
			// Reset scale back to 1 shortly after idle
			if (resetScaleTimerRef.current)
				window.clearTimeout(resetScaleTimerRef.current);
			resetScaleTimerRef.current = window.setTimeout(() => {
				if (selectedIndexRef.current == null)
					targetScaleRef.current = CONFIG.SCALE_DEFAULT;
			}, 150);
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			el.removeEventListener('wheel', onWheel);
			if (resetScaleTimerRef.current)
				window.clearTimeout(resetScaleTimerRef.current);
		};
	}, [maxVirtualYRef, height, slotHeight]);

	// Click to select only (no deselect on click); if a selection is active, ignore clicks

	const onItemClick = useCallback(
		(index: number) => {
			if (selectedIndexRef.current != null) return;
			const Hloc = typeof height === 'number' ? height : 800;
			const baseH = Math.max(0, slotHeight - CONFIG.GAP_PX);
			selectedIndexRef.current = index;
			targetSelectedHeightRef.current = Math.round(
				Hloc * CONFIG.SELECTED_HEIGHT_FRAC
			);
			const persisted = expandedHeightsRef.current.get(index);
			if (displayedSelectedHeightRef.current == null)
				displayedSelectedHeightRef.current = persisted ?? baseH;
			// Start selection height animation clock
			selAnimFromHRef.current = displayedSelectedHeightRef.current ?? baseH;
			selAnimStartTsRef.current = performance.now();
			// Centering anchors
			centerFromYRef.current = displayedYRef.current;
			centerToYRef.current = null; // recomputed in tick with final target
			selectedScaleFromRef.current = displayedScaleRef.current;
			// Selection scale state: container scale to 1.0
			targetScaleRef.current = 1.0;
		},
		[height, slotHeight]
	);

	// Measure first item height when viewport changes (or on mount)
	useEffect(() => {
		const parent = itemsContainerRef.current;
		if (!parent || parent.children.length === 0) return;
		const first = parent.children[0] as HTMLElement;
		const prev = first.style.transform;
		first.style.transform = '';
		const rect = first.getBoundingClientRect();
		first.style.transform = prev;
		const measured = Math.round(rect.height);
		const next = measured + CONFIG.GAP_PX;
		if (Number.isFinite(next) && next > 0 && next !== slotHeight) {
			setSlotHeight(next);
		}
	}, [width, height, slotHeight]);

	// Recompute positions when layout changes
	useEffect(() => {
		if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
		rafIdRef.current = requestAnimationFrame(() => {
			rafIdRef.current = null;
			renderPositions();
		});
	}, [slotHeight, renderPositions]);
	return (
    <div className='overflow-hidden'>
		<section
			className="gallery"
			style={{ height: '100vh', overflow: 'visible', position: 'relative' }}
			ref={containerRef as React.RefObject<HTMLElement>}
		>
			<div
				id="items"
				ref={itemsContainerRef}
				style={{ position: 'relative', height: '100%', width: 500, overflow: 'visible' }}
			>
				{galleryItems.map((item, index) => {
					return (
						<article
							className="gallery-item w-fit max-w-[99999px] overflow-visible"
							key={item.id}
							onClick={() => onItemClick(index)}
							style={{
								position: 'absolute',
								left: 0,
								top: 0,
								willChange: 'transform',
							}}
						>
							<div className="w-fit max-w-[99999px] flex">
								<div className="label">
									<div className="title">{item.title}</div>
									<div className="subtitle">{item.subtitle}</div>
								</div>
								<div className="image-wrapper w-[600px]">
									<img
										src={item.imageUrl}
										alt={`${item.title} — ${item.subtitle}`}
										loading="lazy"
									/>
								</div>
								<div className="gap-4 w-fit max-w-[99999px] hidden">
									{DUMMY_IITEMS.sections.map((section, index) => (
										<ProjectSection key={index} section={section} />
									))}
								</div>
							</div>
						</article>
					);
				})}
			</div>
		</section>
    </div>
	);
}

const DUMMY_IITEMS = {
	sections: [
		{
			type: 'text',
			heading: 'Escape Guideline',
			text: `The site is located in Janda Baik, Mukim Bentong. Janda Baik (incidentally means good widow) is a small village about 50 km from Kuala Lumpur, capital of Malaysia. The site included existing fruit trees (durian, rambutan, jackfruit and mangosteen), fish farm and located adjacent to a small river, Sungai Nerong and surrounded by vegetable gardens owned by the local villagers.

Our approach is to take advantage of its special qualities, not imposing on the setting but enhancing and directing attention to the features of the landscape. The path, tents & buildings are sculptured fit into the site with minimum disturbance and embrace the rocks and slopes and trees, not see them as obstacles. The beauty and integrity of the landscape and its special qualities shine through each tent location.

We have created the design for Glamping and treehouse within as an integrated construction process, adjusting pathway design as we discovered each rock and preserve the beauty of the natural site.`,
		},
		{
			type: 'gallery',
			images: [
				'/projects/1/2-a.png',
				'/projects/1/2-b.png',
				'/projects/1/2-c.png',
			],
		},
		{
			type: 'image',
			image: '/projects/1/3.png',
		},
		{
			type: 'text',
			heading: 'Creating Place',
			text: `As more travelers explore the world so does the expectation to create unique local experience. Our approach to any site is to take advantage of its natural qualities, not imposing on the setting but enhancing and directing attention to the landscape features. The buildings fit into the site with minimum disturbance and embrace the rocks, slopes and trees, not see them as obstacles. The beauty and integrity of the land and its special qualities shine through each concept.

Tiarasa Escape resort is intended to "touch the earth" lightly, "teach the stories of the forest" and "discover the life within a traditional kampung setting" all within a modern luxury escape.`,
		},
		{
			type: 'image',
			image: '/projects/1/4.png',
		},
		{
			type: 'image',
			image: '/projects/1/5.png',
		},

		{
			type: 'text',
			heading: 'Integrated Within The Site',
			text: `Each of our glamping resorts has a design vision. We take the basic elements we know make resorts work and mix them with unique elements as well as specific client requests to create one overall feeling through the landscape and outdoor spaces. The landscape is designed at multiple scales so a guest will get a certain feeling upon arrival and continue discovering special features throughout their stay.

Private spaces and large scale gathering areas both envelop the guest in the landscape which surrounds.`,
		},
		{
			type: 'image',
			image: '/projects/1/6.png',
		},
		{
			type: 'image',
			image: '/projects/1/7.png',
		},
		{
			type: 'text',
			heading: 'Immerse In Nature',
			text: `We subscribe to the belief that plants make the space. Our planting design is based on extensive understanding of the local environments and the desire to enhance native communities while inviting human inhabitation and enjoyment. Native fruit trees, productive planting and a focus on endangered species create places and enhance the environmental significance.

The planting design at Tiarasa Escapes glamping, pictured here, is based on the concept of the 'Rainforest Orchard.' Previously a kampung orchard, the site has mature Durian, Longan and Mangosteen trees which were all protected during construction. Further planting of native rainforest fruiting trees supports the enjoyment of the guests as well as ecological benefits for the other floral and fauna communities.`,
		},
		{
			type: 'image',
			image: '/projects/1/7.png',
		},
		{
			type: 'info',
			Client: 'Enfiniti Vision Media Sdn Bhd',
			Collaboration: [
				'WHZ Environmental Design Sdn Bhd',
				'R Shankar Planning',
				'SK Fong Architect',
				'TC Lim & Co.',
				'KSD & Associates Sdn Bhd',
				'Allan Tung',
			],
			Engaged: 2019,
			Completion: 2019,
			Scope: 'Design & Build',
			Area: '40,000 m2',
		},
	],
} as const;
