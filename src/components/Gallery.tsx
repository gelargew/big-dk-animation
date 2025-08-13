import { useCallback, useEffect, useRef, useState } from 'react'
import { useWindowSize } from 'hamo'
import './Gallery.css'
import { galleryItems } from './DATA'


export default function Gallery() {
    // Viewport size via hamo
    const { width, height } = useWindowSize()

    // Virtual scroll position driven purely by wheel events (imperative)
    const virtualYRef = useRef(0)
    const rafIdRef = useRef<number | null>(null)
    const currentScaleRef = useRef(1)
    const scrollEndTimerRef = useRef<number | null>(null)

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
        const scale = currentScaleRef.current
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
    // Center horizontally and anchor scale at horizontal center, vertical center of viewport
    const H = typeof height === 'number' ? height : 800
    parent.style.left = '50%'
    parent.style.transformOrigin = '50% 0'
    const anchorBaseY = virtualYRef.current + H / 2
    const t = H / 2 - scale * anchorBaseY
    parent.style.transform = `translateX(-50%) translateY(${t}px) scale(${scale})`
    }, [slotHeight, height])
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const handleWheel = (e: WheelEvent) => {
            if (maxVirtualYRef.current <= 0) return
            e.preventDefault()
            const next = Math.max(
                0,
                Math.min(
                    maxVirtualYRef.current,
                    virtualYRef.current + e.deltaY,
                ),
            )
            if (next === virtualYRef.current) return
            virtualYRef.current = next
            // set scrolling scale
            currentScaleRef.current = 0.9
            if (scrollEndTimerRef.current != null)
                window.clearTimeout(scrollEndTimerRef.current)
            scrollEndTimerRef.current = window.setTimeout(() => {
                currentScaleRef.current = 1
                // schedule render to restore scale to 1
                if (rafIdRef.current == null) {
                    rafIdRef.current = requestAnimationFrame(() => {
                        rafIdRef.current = null
                        renderPositions()
                    })
                }
            }, 180)
            if (rafIdRef.current == null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = null
                    renderPositions()
                })
            }
        }
        el.addEventListener('wheel', handleWheel, { passive: false })
        return () => {
            el.removeEventListener('wheel', handleWheel)
            if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current)
            if (scrollEndTimerRef.current != null)
                window.clearTimeout(scrollEndTimerRef.current)
        }
    }, [renderPositions])

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
