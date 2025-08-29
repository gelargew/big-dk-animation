import { galleryItems } from '../components/DATA'
import { useRef } from 'react'
import { gsap } from 'gsap'
import { useLenis } from 'lenis/react'
import { useRect } from 'hamo'

export const Gallery2 = () => {
    const itemsRef = useRef<HTMLDivElement>(null)
    const sectionRef = useRef<HTMLElement>(null)
    const zState = useRef(-600)
    const [setRectRef] = useRect()

    const lenis = useLenis(({ velocity, scroll, limit }) => {
        const itemsElement = itemsRef.current
        const sectionElement = sectionRef.current

        if (!itemsElement || !sectionElement) return
        console.log('SCROLLING - Height:', itemsRef.current?.offsetHeight)
        // Map velocity to translateZ: faster scroll = more negative (up to -40px)
        // Default is -20px when not scrolling
        const maxVelocity = 200 // Adjust this to control sensitivity
        const normalizedVelocity = Math.min(Math.abs(velocity) / maxVelocity, 1)
        const newTranslateZ = zState.current - normalizedVelocity * 1000 // -20 to -1000 range

        gsap.to(itemsElement, {
            z: newTranslateZ,
            duration: 0.5,
            ease: 'power4.out',
        })

        // Calculate scroll progress (0 to 1)
        const scrollProgress = scroll / limit
        const perspectiveY = scrollProgress * 100 // 0% to 100%

        // Update perspective origin directly without animation
        gsap.set(sectionElement, {
            perspectiveOrigin: `center ${perspectiveY}%`,
        })
    })

    const onItemClick = (el: HTMLElement) => {
        // Get the element's position and calculate future center after animation
        const elementRect = el.getBoundingClientRect()
        const futureHeight = window.innerHeight * 0.7 // 70vh
        const elementCenter = elementRect.top + futureHeight / 2
        const viewportCenter = window.innerHeight / 2
        const scrollOffset = elementCenter - viewportCenter

        // Use Lenis to scroll to center the element
        if (lenis) {
            lenis.scrollTo(window.scrollY + scrollOffset, {
                duration: 1,
                easing: (t: number) => 1 - Math.pow(1 - t, 3), // expo.out
            })
        }

        gsap.to(el, {
            height: '70vh',
            duration: 1,
            ease: 'power2.out',
            width: 5000,
            maxWidth: 5000,
        })
        gsap.to(zState, {
            current: 0,
            duration: 1,
            ease: 'power2.out',
        })
    }

    return (
        <div className='overflow-hidden'>
            <section
                ref={el => {
                    sectionRef.current = el
                    setRectRef(el)
                }}
                className='perspective-distant py-16'
                style={{
                    overflow: 'visible',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
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
                    }}
                >
                    {galleryItems.map(item => {
                        return (
                            <article
                                className='w-[500px] max-w-[500px] overflow-visible '
                                key={item.id}
                                style={{
                                    willChange: 'transform',
                                }}
                            >
                                <div
                                    onClick={e =>
                                        onItemClick(
                                            e.currentTarget as HTMLElement,
                                        )
                                    }
                                >
                                    <div className='w-fit relative max-w-[99999px] max-h-full flex'>
                                        <div className='label absolute -left-40 top-0'>
                                            <div className=''>{item.title}</div>
                                            <div className=''>
                                                {item.subtitle}
                                            </div>
                                        </div>
                                        <div>
                                            <img
                                                src={item.imageUrl}
                                                alt={`${item.title} — ${item.subtitle}`}
                                                data-main-image
                                                loading='lazy'
                                                className='w-full max-w-[1200px] h-full object-contain object-left'
                                            />
                                        </div>
                                        <div className='gap-4 w-fit max-w-[99999px] hidden'>
                                            {/* {DUMMY_IITEMS.sections.map((section, index) => (
										<ProjectSection key={index} section={section} />
									))} */}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
