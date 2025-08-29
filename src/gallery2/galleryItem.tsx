import type { GalleryItem as GalleryItemType } from '../components/DATA'
import { DUMMY_IITEMS } from '../DUMMY'
import { ProjectSection } from './projectIItem'

interface GalleryItemProps {
    item: GalleryItemType
    onItemClick: (el: HTMLElement) => void
}

export const GalleryItem = ({ item, onItemClick }: GalleryItemProps) => {
    return (
        <article
            className='w-[500px] max-w-[500px] overflow-visible '
            key={item.id}
            style={{
                willChange: 'transform',
                WebkitTransform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
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
                            className='w-full flex-shrink-0 max-w-[1400px] h-full object-contain object-left'
                        />
                    </div>
                    <div data-project-section className='gap-4 w-fit max-w-[99999px] hidden'>
                        {DUMMY_IITEMS.sections.map((section, index) => (
                            <ProjectSection key={index} section={section} />
                        ))}
                    </div>
                </div>
            </div>
        </article>
    )
}

