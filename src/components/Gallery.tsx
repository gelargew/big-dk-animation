import { useCallback, useEffect, useRef, useState } from 'react'
import Tempus from 'tempus'
import { useWindowSize } from 'hamo'
import './Gallery.css'
import { galleryItems } from './DATA'


export default function Gallery() {
    // Viewport size via hamo
    const { width, height } = useWindowSize()

    // Virtual scroll position driven purely by wheel events (imperative)
    const virtualYRef = useRef(0) // target position
    const displayedYRef = useRef(0) // eased position
    const displayedScaleRef = useRef(0.75)
    const targetScaleRef = useRef(0.75)
    const lastWheelTsRef = useRef<number>(performance.now())
    const rafIdRef = useRef<number | null>(null)
    const resetScaleTimerRef = useRef<number | null>(null)
    // Selection (step 3: smooth height easing + centering + persistent expansion)
    const selectedIndexRef = useRef<number | null>(null)
    const targetSelectedHeightRef = useRef<number | null>(null)
    const displayedSelectedHeightRef = useRef<number | null>(null)
    const expandedHeightsRef = useRef<Map<number, number>>(new Map())
    // Track current parent content height for better clamping during centering and wheel
    const parentHeightRef = useRef(0)
    // Selection animation timing/anchors
    const selAnimStartTsRef = useRef<number | null>(null)
    const selAnimFromHRef = useRef<number | null>(null)
    const selAnimDurMsRef = useRef<number>(2000)
    const centerFromYRef = useRef<number | null>(null)
    const centerToYRef = useRef<number | null>(null)

    // Desired visual gap between items
    const GAP_PX = 24
    const GAP = 24
    const TIME_SCALE = 4 // 4x longer animations for translate/scale easing
    // Note: buffer not needed with parent-scaling approach

    // Slot height is measured from the rendered first item height + GAP_PX
    const [slotHeight, setSlotHeight] = useState<number>(500 + GAP_PX)

    const viewportHeight = typeof height === 'number' ? height : 800
    const totalHeight = slotHeight * galleryItems.length
    const maxVirtualYRef = useRef<number>(
        Math.max(0, totalHeight - viewportHeight),
    )
    useEffect(() => {
        maxVirtualYRef.current = Math.max(
            0,
            slotHeight * galleryItems.length - viewportHeight,
        )
    }, [slotHeight, viewportHeight])

    // Attach a non-passive wheel listener so we can preventDefault without warnings
    const containerRef = useRef<HTMLElement | null>(null)
    const itemsContainerRef = useRef<HTMLDivElement | null>(null)

    const renderPositions = useCallback(() => {
        const parent = itemsContainerRef.current
        if (!parent) return
        const scale = displayedScaleRef.current
        // Cumulative layout to support a single selected item with 70% viewport height
        const baseItemHeight = Math.max(0, slotHeight - GAP)
        const Hloc1 = typeof height === 'number' ? height : 800
        const topPad = Math.round(Hloc1 * 0.2)
        const selectedIdx = selectedIndexRef.current
        const selectedHeight = displayedSelectedHeightRef.current ?? Math.round(Hloc1 * 0.6)
        const containerWidth = 500
        const baseRatio = baseItemHeight > 0 ? containerWidth / baseItemHeight : 0
        let cumulativeTop = topPad
        for (let i = 0; i < parent.children.length; i += 1) {
            const child = parent.children[i] as HTMLElement
            const isSel = selectedIdx !== null && i === selectedIdx
            const persisted = expandedHeightsRef.current.get(i)
            const itemH = isSel ? selectedHeight : (persisted ?? baseItemHeight)
            const itemW = baseRatio > 0 ? Math.round(baseRatio * itemH) : containerWidth
            const leftPx = Math.round((containerWidth - itemW) / 2)
            child.style.position = 'absolute'
            child.style.left = `${leftPx}px`
            child.style.top = `${cumulativeTop}px`
            child.style.height = `${itemH}px`
            child.style.width = `${itemW}px`
            child.style.transform = 'none'
            child.style.transformOrigin = 'center'
            cumulativeTop += itemH + GAP
        }
        // Set parent height; when selected, add bottom padding to allow centering near end
        const Hloc2 = typeof height === 'number' ? height : 800
        const bottomPad = Math.round(Hloc2 * 0.4)
        const parentHeight = Math.max(0, cumulativeTop - GAP) + bottomPad
        parent.style.height = `${parentHeight}px`
        parentHeightRef.current = parentHeight
        parent.style.willChange = 'transform'
        // Center horizontally; anchor vertical scaling at current displayed Y to avoid jumps
        parent.style.left = '50%'
        const anchorY = displayedYRef.current
        parent.style.transformOrigin = `50% ${anchorY}px`
        const t = -displayedYRef.current
        parent.style.transform = `translateX(-50%) translateY(${t}px) scale(${scale})`
    }, [slotHeight, height])
    // Tempus-driven easing loop (translate and scale based on velocity)
    useEffect(() => {
        if (!Tempus.isPlaying) Tempus.play()
        const unsubscribe = Tempus.add((_: number, dtArg: number) => {
            let dt = typeof dtArg === 'number' ? dtArg : 0
            if (dt > 1) dt = dt / 1000
            if (dt <= 0) return
            // When selected: drive height and centering with the same 2000ms easing
            if (selectedIndexRef.current !== null) {
                const Hloc = typeof height === 'number' ? height : 800
                const baseH = Math.max(0, slotHeight - GAP)
                const hTarget = targetSelectedHeightRef.current ?? Math.round(Hloc * 0.6)
                targetSelectedHeightRef.current = hTarget
                const hCurrent = displayedSelectedHeightRef.current ?? baseH
                // Power4.out easing based on Tempus time (monotonic)
                const nowTs = performance.now()
                if (!selAnimStartTsRef.current) selAnimStartTsRef.current = nowTs
                if (selAnimFromHRef.current == null) selAnimFromHRef.current = hCurrent
                const tSel = Math.max(0, Math.min(1, (nowTs - selAnimStartTsRef.current) / selAnimDurMsRef.current))
                const easeSel = 1 - Math.pow(1 - tSel, 4)
                const fromH = selAnimFromHRef.current ?? hCurrent
                const nextH = fromH + (hTarget - fromH) * easeSel
                displayedSelectedHeightRef.current = nextH
                // Compute final desired center Y ONCE (based on FUTURE hTarget) and ease to it with the same easing
                if (centerFromYRef.current == null) centerFromYRef.current = displayedYRef.current
                if (centerToYRef.current == null) {
                    const topPadLoc = Math.round(Hloc * 0.2)
                    let sumPrev = 0
                    for (let j = 0; j < (selectedIndexRef.current ?? 0); j += 1) {
                        const persisted = expandedHeightsRef.current.get(j)
                        const prevH = persisted ?? baseH
                        sumPrev += prevH + GAP
                    }
                    const selectedTop = topPadLoc + sumPrev
                    const desiredYFinal = selectedTop - (Hloc / 2 - hTarget / 2)
                    const dynMaxY = Math.max(0, parentHeightRef.current - Hloc)
                    centerToYRef.current = Math.max(0, Math.min(dynMaxY, desiredYFinal))
                }
                const fromY = centerFromYRef.current ?? displayedYRef.current
                const toY = centerToYRef.current ?? virtualYRef.current
                displayedYRef.current = fromY + (toY - fromY) * easeSel
                virtualYRef.current = toY
                // Do not auto-deselect; persistence happens on wheel
            } else if (displayedSelectedHeightRef.current != null) {
                const baseH = Math.max(0, slotHeight - GAP)
                const hCurrent = displayedSelectedHeightRef.current
                const dh = baseH - hCurrent
                const hAlpha = 1 - Math.pow(0.001, dt)
                const nextH = Math.abs(dh) > 0.1 ? hCurrent + dh * hAlpha : baseH
                displayedSelectedHeightRef.current = nextH
                if (Math.abs(nextH - baseH) <= 0.1) {
                    displayedSelectedHeightRef.current = null
                    targetSelectedHeightRef.current = null
                    selAnimStartTsRef.current = null
                    selAnimFromHRef.current = null
                    centerFromYRef.current = null
                    centerToYRef.current = null
                }
            } else {
                // Ease Y toward target with critically damped spring-like lerp when not selected
                const posAlpha = 1 - Math.pow(0.001, dt)
                const dy = virtualYRef.current - displayedYRef.current
                if (Math.abs(dy) > 0.01) {
                    displayedYRef.current += dy * posAlpha
                } else {
                    displayedYRef.current = virtualYRef.current
                }
            }
            // Ease scale toward target; slow ONLY when selected to match selection height timing
            const scaleAlpha = selectedIndexRef.current !== null
                ? (1 - Math.pow(0.001, dt / TIME_SCALE))
                : (1 - Math.pow(0.05, dt))
            const ds = targetScaleRef.current - displayedScaleRef.current
            if (Math.abs(ds) > 0.001) {
                displayedScaleRef.current += ds * scaleAlpha
            } else {
                displayedScaleRef.current = targetScaleRef.current
            }
            renderPositions()
        }, { label: 'gallery-ease' })
        return () => { if (unsubscribe) unsubscribe() }
    }, [renderPositions, height, slotHeight])

    // Wheel input: update target position and scale target from instantaneous velocity
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            if (maxVirtualYRef.current <= 0) return
            e.preventDefault()
            // If selected, persist current height and clear selection on first wheel
            if (selectedIndexRef.current != null) {
                const idx = selectedIndexRef.current
                const baseH = Math.max(0, slotHeight - GAP_PX)
                const currentH = displayedSelectedHeightRef.current ?? baseH
                const Hloc = typeof height === 'number' ? height : 800
                const targetH = targetSelectedHeightRef.current ?? Math.round(Hloc * 0.6)
                // Persist whichever is closer to target for stability
                const persistH = Math.abs((currentH) - targetH) < 1 ? targetH : currentH
                expandedHeightsRef.current.set(idx, persistH)
                // Clear selection state
                selectedIndexRef.current = null
                displayedSelectedHeightRef.current = null
                targetSelectedHeightRef.current = null
                // Return container scale model to scrolling/default handling
                targetScaleRef.current = 0.75
            }
            const now = performance.now()
            const dt = Math.max(1e-3, (now - lastWheelTsRef.current) / 1000)
            lastWheelTsRef.current = now
            const Hloc = typeof height === 'number' ? height : 800
            const dynMaxY = Math.max(0, parentHeightRef.current - Hloc)
            const next = Math.max(0, Math.min(dynMaxY, virtualYRef.current + e.deltaY))
            if (next !== virtualYRef.current) virtualYRef.current = next
            // Scroll scale only when not in selection scale state
            if (selectedIndexRef.current == null) {
                const velocity = Math.abs(e.deltaY) / dt
                const speedFrac = Math.min(1, velocity / 3000)
                targetScaleRef.current = 0.75 - 0.1 * speedFrac // 0.75 → 0.65
            }
            // Reset scale back to 1 shortly after idle
            if (resetScaleTimerRef.current) window.clearTimeout(resetScaleTimerRef.current)
            resetScaleTimerRef.current = window.setTimeout(() => {
                if (selectedIndexRef.current == null) targetScaleRef.current = 0.75
            }, 150)
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => {
            el.removeEventListener('wheel', onWheel)
            if (resetScaleTimerRef.current) window.clearTimeout(resetScaleTimerRef.current)
        }
    }, [maxVirtualYRef, height, slotHeight])

    // Click to select only (no deselect on click); if a selection is active, ignore clicks

    const onItemClick = useCallback((index: number) => {
        if (selectedIndexRef.current != null) return
        const Hloc = typeof height === 'number' ? height : 800
        const baseH = Math.max(0, slotHeight - GAP)
        selectedIndexRef.current = index
        targetSelectedHeightRef.current = Math.round(Hloc * 0.6)
        const persisted = expandedHeightsRef.current.get(index)
        if (displayedSelectedHeightRef.current == null) displayedSelectedHeightRef.current = persisted ?? baseH
        // Start selection height animation clock
        selAnimFromHRef.current = displayedSelectedHeightRef.current ?? baseH
        selAnimStartTsRef.current = performance.now()
        // Centering anchors
        centerFromYRef.current = displayedYRef.current
        centerToYRef.current = null // recomputed in tick with final target
        // Selection scale state: container scale to 1.0
        targetScaleRef.current = 1.0
    }, [height, slotHeight])

    // Measure first item height when viewport changes (or on mount)
    useEffect(() => {
        const parent = itemsContainerRef.current
        if (!parent || parent.children.length === 0) return
        const first = parent.children[0] as HTMLElement
        const prev = first.style.transform
        first.style.transform = ''
        const rect = first.getBoundingClientRect()
        first.style.transform = prev
        const measured = Math.round(rect.height)
        const next = measured + GAP_PX
        if (Number.isFinite(next) && next > 0 && next !== slotHeight) {
            setSlotHeight(next)
        }
    }, [width, height, slotHeight])

    // Recompute positions when layout changes
    useEffect(() => {
        if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null
            renderPositions()
        })
    }, [slotHeight, renderPositions])
    return (
        <section
            className='gallery'
            style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}
            ref={containerRef as React.RefObject<HTMLElement>}
        >
            <div
                id='items'
                ref={itemsContainerRef}
                style={{ position: 'relative', height: '100%', width: 500 }}
            >
                {galleryItems.map((item, index) => {
                    return (
                        <article
                            className='gallery-item'
                            key={item.id}
                            onClick={() => onItemClick(index)}
                            style={{ position: 'absolute', left: 0, top: 0, width: '100%', willChange: 'transform' }}
                        >
                            <div className='label'>
                                <div className='title'>{item.title}</div>
                                <div className='subtitle'>{item.subtitle}</div>
                            </div>
                            <div className='image-wrapper'>
                                <img
                                    src={item.imageUrl}
                                    alt={`${item.title} — ${item.subtitle}`}
                                    loading='lazy'
                                />
                            </div>
                        </article>
                    )
                })}
            </div>
        </section>
    )
}
