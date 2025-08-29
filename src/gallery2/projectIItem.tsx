import { useEffect, useState } from "react"

// Individual section components
type ProjectSectionType = {
  type: 'text' | 'image' | 'gallery' | 'info'
  heading?: string
  text?: string
  image?: string
  images?: readonly string[]
  [key: string]: string | readonly string[] | number | undefined
}

export const ProjectSection = ({
  section,

}: {
  section: ProjectSectionType
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showFlash, setShowFlash] = useState(false)

  // Gallery image rotation effect
  useEffect(() => {
      if (
          section.type === 'gallery' &&
          section.images &&
          section.images.length > 1
      ) {
          const interval = setInterval(() => {
              setShowFlash(true)
              setTimeout(() => {
                  setCurrentImageIndex(
                      prev => (prev + 1) % (section.images?.length || 1),
                  )
                  setShowFlash(false)
              }, 150) // Flash duration
          }, 2000) // Change every 2 seconds

          return () => clearInterval(interval)
      }
  }, [section])


  if (section.type === 'text') {
      return (
          <div
              className=' flex-shrink-0 px-6'
              style={{ pointerEvents: 'none' }}

          >
              <div>
                  {section.heading && (
                      <h3 className='text-foreground text-2xl leading-[28px]  mb-3'>
                          {section.heading}
                      </h3>
                  )}
                  <p className='text-sm text-[#2B2B2B] leading-[20px] whitespace-pre-line'>
                      {section.text}
                  </p>
              </div>
          </div>
      )
  }

  if (section.type === 'image') {
      return (
          <div
              className='flex-shrink-0 flex items-center justify-center h-full relative'
              style={{ pointerEvents: 'none' }}
          >
              <img
                  src={section.image || '/placeholder.png'}
                  alt='Project image'
                  width={1200}
                  height={800}
                  loading='lazy'
                  className='h-full w-fit object-cover select-none'
                  style={{ userSelect: 'none' }}
                  draggable={false}
              />
          </div>
      )
  }

  if (section.type === 'gallery') {
      return (
          <div
              className='flex-shrink-0 flex items-center justify-center h-full relative'
              style={{ pointerEvents: 'none' }}
          >
              {section.images?.map((image: string, index: number) => (
                  <img
                      key={index}
                      src={image || '/placeholder.png'}
                      alt={`Gallery image ${index + 1}`}
                      width={800}
                      height={600}
                      loading='lazy'
                      className={`h-full w-auto object-contain select-none absolute inset-0 transition-opacity duration-300 ${
                          index === currentImageIndex
                              ? 'opacity-100'
                              : 'opacity-0'
                      }`}
                      style={{ userSelect: 'none' }}
                      draggable={false}
                  />
              ))}
              {/* White flash overlay */}
              {showFlash && (
                  <div className='absolute inset-0 bg-white opacity-80 pointer-events-none' />
              )}
          </div>
      )
  }

  if (section.type === 'info') {
      return (
          <div
              className='flex flex-shrink-0 px-6'
              style={{ pointerEvents: 'none' }}
          >
              <div className='space-y-3'>
                  {Object.entries(section).map(([key, value]) => {
                      if (key === 'type') return null
                      return (
                          <div key={key} className='space-y-1'>
                              <div className='text-xs text-secondary uppercase tracking-wider'>
                                  {key}
                              </div>
                              {Array.isArray(value) ? (
                                  value.map((item, index) => (
                                      <div
                                          key={index}
                                          className='text-sm text-foreground'
                                      >
                                          {item}
                                      </div>
                                  ))
                              ) : (
                                  <div className='text-sm text-foreground'>
                                      {value as string}
                                  </div>
                              )}
                          </div>
                      )
                  })}
              </div>
          </div>
      )
  }

  return null
}

