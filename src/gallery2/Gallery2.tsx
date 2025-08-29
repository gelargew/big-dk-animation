import { galleryItems } from '../components/DATA'
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { useLenis } from 'lenis/react'
import { useRect } from 'hamo'
import { GalleryItem } from './galleryItem'

// Constants for reusable styles and animations
const WEBKIT_TRANSFORM_STYLES = {
    transformStyle: 'preserve-3d' as const,
    WebkitTransformStyle: 'preserve-3d' as const,
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
    transformOrigin: 'center center' as const,
    WebkitTransformOrigin: 'center center' as const,
}

const GSAP_3D_CONFIG = {
    force3D: true,
}

const getPerspectiveOriginConfig = (y: string) => ({
    perspectiveOrigin: `center ${y}`,
    webkitPerspectiveOrigin: `center ${y}`,
})

export const Gallery2 = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    const itemsRef = useRef<HTMLDivElement>(null)
    const sectionRef = useRef<HTMLElement>(null)
    const zState = useRef(-600)
    const [setRectRef] = useRect()
    const selectedItem = useRef<HTMLElement | null>(null)

    // Initial slide-up animation to fix Safari 3D transform bug
    useEffect(() => {
        if (sectionRef.current) {
            lenis?.stop()
            const tl = gsap.timeline()
            tl.to(sectionRef.current, {
                perspective: 1000,
                webkitPerspective: 1000,
                duration: 0.1,
                ...GSAP_3D_CONFIG,
                ...getPerspectiveOriginConfig('0%'),
            })
            tl.fromTo(
                itemsRef.current,
                {
                    transform: 'none',
                },
                {
                    transform: 'translate3d(0, 0, 0)',
                    duration: 0.3,
                    ...GSAP_3D_CONFIG,
                },
            )
            tl.to(itemsRef.current, {
                transform: 'translate3d(0, 0, -601px)',
                duration: 0.1,
                ...GSAP_3D_CONFIG,
                onComplete: () => {
                    lenis?.scrollTo(0)
                    lenis?.start()
                    sectionRef.current?.setAttribute('data-active', 'true')
                },
            })

        }
    }, [])

    const lenis = useLenis(({ velocity, scroll, limit }) => {
        const itemsElement = itemsRef.current
        const sectionElement = sectionRef.current

        if (
            !itemsElement ||
            !sectionElement ||
            !sectionElement.hasAttribute('data-active') ||
            zState.current > -300
        )
            return

        // Map velocity to translateZ: faster scroll = more negative (up to -40px)
        // Default is -20px when not scrolling
        const maxVelocity = 200 // Adjust this to control sensitivity
        const normalizedVelocity = Math.min(Math.abs(velocity) / maxVelocity, 1)
        const newTranslateZ = zState.current - normalizedVelocity * 1000 // -20 to -1000 range

        gsap.to(itemsElement, {
            z: newTranslateZ,
            duration: 0.5,
            ease: 'power4.out',
            ...GSAP_3D_CONFIG,
        })

        // Calculate scroll progress (0 to 1)
        const scrollProgress = scroll / limit
        const perspectiveY = scrollProgress * 100 // 0% to 100%

        // Update perspective origin directly without animation
        gsap.set(sectionElement, {
            ...getPerspectiveOriginConfig(`${perspectiveY}%`),
        })
    })

    const onItemClick = (el: HTMLElement) => {
        // Get the element's position and calculate center for vertical scrolling
        const elementRect = el.getBoundingClientRect()
        const futureHeight = window.innerHeight * 0.7 // 70vh
        const elementCenter = elementRect.top + futureHeight / 2
        const viewportCenter = window.innerHeight / 2
        const scrollOffset = elementCenter - viewportCenter

        // Use Lenis to scroll to center the element vertically
        if (lenis) {
            lenis.scrollTo(window.scrollY + scrollOffset, {
                duration: 1,
                easing: (t: number) => 1 - Math.pow(1 - t, 3), // expo.out
            })
        }
        containerRef.current?.setAttribute('data-scale', '1')
        selectedItem.current = el
        // Check if element is already scaled to avoid recalculation
        if (el.hasAttribute('data-scaled')) {
            return
        }

        // Find the main image to calculate horizontal centering
        const mainImage = el.querySelector(
            '[data-main-image]',
        ) as HTMLImageElement
        let translateX = 0

        if (mainImage) {
            const currentImageWidth = mainImage.offsetWidth
            const currentImageHeight = mainImage.offsetHeight

            // Calculate the scaled image dimensions
            const futureImageHeight = window.innerHeight * 0.7 // 70vh
            const aspectRatio = currentImageWidth / currentImageHeight
            const futureImageWidth = futureImageHeight * aspectRatio

            // Calculate how much to move left to center the scaled image
            const widthDifference = futureImageWidth - currentImageWidth
            translateX = -widthDifference / 2
        }

        gsap.to(el, {
            height: '70vh',
            duration: 1,
            ease: 'power2.out',
            width: 5000,
            maxWidth: 5000,
            x: translateX,
            ...GSAP_3D_CONFIG,
            onComplete: () => {
                // Mark element as scaled to prevent future recalculations
                el.setAttribute('data-scaled', 'true')
                el.setAttribute('data-scrollable', 'true')

                // Animate project section fade in and slide from right
                const projectSection = el.querySelector(
                    '[data-project-section]',
                ) as HTMLElement
                console.log(projectSection, 'section')
                if (projectSection) {
                    gsap.fromTo(
                        projectSection,
                        {
                            autoAlpha: 0,
                            x: 50,
                            display: 'hidden',
                        },
                        {
                            autoAlpha: 1,
                            x: 0,
                            duration: 0.8,
                            ease: 'power2.out',
                            delay: 0.2,
                            display: 'flex',
                            ...GSAP_3D_CONFIG,
                        },
                    )
                }
            },
        })
        gsap.to(zState, {
            current: 0,
            duration: 1,
            ease: 'power2.out',
        })
    }

    return (
        <div ref={containerRef} className='overflow-hidden'>
            <section
                ref={el => {
                    sectionRef.current = el
                    setRectRef(el)
                }}
                className='perspective-distant py-16'
                style={{
                    overflow: 'visible',
                    position: 'relative',
                    willChange: 'transform',
                    WebkitTransform: 'translateZ(0)',
                    ...WEBKIT_TRANSFORM_STYLES,
                }}
            >
                <div
                    ref={itemsRef}
                    id='items'
                    className='mx-auto space-y-4 '
                    style={{
                        position: 'relative',
                        width: 500,
                        overflow: 'visible',
                        ...WEBKIT_TRANSFORM_STYLES,
                    }}
                >
                    {galleryItems.map(item => (
                        <GalleryItem
                            key={item.id}
                            item={item}
                            onItemClick={onItemClick}
                        />
                    ))}
                </div>
            </section>
        </div>
    )
}
