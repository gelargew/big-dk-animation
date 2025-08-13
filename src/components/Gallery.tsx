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
    const displayedScaleRef = useRef(1)
    const targetScaleRef = useRef(1)
    const lastWheelTsRef = useRef<number>(performance.now())
    const rafIdRef = useRef<number | null>(null)
    const resetScaleTimerRef = useRef<number | null>(null)

    // Desired visual gap between items
    const GAP_PX = 24
    // Note: buffer not needed with parent-scaling approach

    // Slot height is measured from the rendered first item height + GAP_PX
    const [slotHeight, setSlotHeight] = useState<number>(300 + GAP_PX)

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
        // Position children at their baseY; parent will handle scroll and scale transforms
        for (let i = 0; i < parent.children.length; i += 1) {
            const child = parent.children[i] as HTMLElement
            const baseY = i * slotHeight
            child.style.position = 'absolute'
            child.style.left = '0px'
            child.style.top = `${baseY}px`
            child.style.transform = 'none'
            child.style.transformOrigin = 'center'
        }
    // Set parent height to unscaled total so layout math remains stable
    parent.style.height = `${slotHeight * galleryItems.length}px`
    parent.style.willChange = 'transform'
    // Center horizontally; anchor vertical scaling at current displayed Y to avoid jumps
    parent.style.left = '50%'
    const anchorY = displayedYRef.current
    parent.style.transformOrigin = `50% ${anchorY}px`
    const t = -displayedYRef.current
    parent.style.transform = `translateX(-50%) translateY(${t}px) scale(${scale})`
    }, [slotHeight])
    // Tempus-driven easing loop (translate and scale based on velocity)
    useEffect(() => {
        if (!Tempus.isPlaying) Tempus.play()
        const unsubscribe = Tempus.add((_: number, dtArg: number) => {
            let dt = typeof dtArg === 'number' ? dtArg : 0
            if (dt > 1) dt = dt / 1000
            if (dt <= 0) return
            // Ease Y toward target with critically damped spring-like lerp
            const posAlpha = 1 - Math.pow(0.001, dt) // frame-rate independent
            const dy = virtualYRef.current - displayedYRef.current
            if (Math.abs(dy) > 0.01) {
                displayedYRef.current += dy * posAlpha
            } else {
                displayedYRef.current = virtualYRef.current
            }
            // Ease scale toward target
            const scaleAlpha = 1 - Math.pow(0.05, dt)
            const ds = targetScaleRef.current - displayedScaleRef.current
            if (Math.abs(ds) > 0.001) {
                displayedScaleRef.current += ds * scaleAlpha
            } else {
                displayedScaleRef.current = targetScaleRef.current
            }
            renderPositions()
        }, { label: 'gallery-ease' })
        return () => { if (unsubscribe) unsubscribe() }
    }, [renderPositions])

    // Wheel input: update target position and scale target from instantaneous velocity
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            if (maxVirtualYRef.current <= 0) return
            e.preventDefault()
            const now = performance.now()
            const dt = Math.max(1e-3, (now - lastWheelTsRef.current) / 1000)
            lastWheelTsRef.current = now
            const next = Math.max(0, Math.min(maxVirtualYRef.current, virtualYRef.current + e.deltaY))
            if (next !== virtualYRef.current) virtualYRef.current = next
            // Velocity in px/s from delta
            const velocity = Math.abs(e.deltaY) / dt
            // Map to [0,1] then to [1,0.9]
            const speedFrac = Math.min(1, velocity / 3000)
            targetScaleRef.current = 1 - 0.1 * speedFrac
            // Reset scale back to 1 shortly after idle
            if (resetScaleTimerRef.current) window.clearTimeout(resetScaleTimerRef.current)
            resetScaleTimerRef.current = window.setTimeout(() => { targetScaleRef.current = 1 }, 150)
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => {
            el.removeEventListener('wheel', onWheel)
            if (resetScaleTimerRef.current) window.clearTimeout(resetScaleTimerRef.current)
        }
    }, [maxVirtualYRef])

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
                {galleryItems.map(item => {
                    return (
                        <article
                            className='gallery-item'
                            key={item.id}
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
