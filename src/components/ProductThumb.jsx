import { useState } from 'react'
import logoThumb from '../assets/logo-thumb.webp'
import { toProductThumbUrl } from '../lib/productImages'

export default function ProductThumb({
  src,
  alt = '',
  className = 'w-full h-36',
  imgClassName = 'w-full h-full object-cover',
  rounded = false,
  thumbWidth = 320,
}) {
  const [failed, setFailed] = useState(false)
  const url = src && !failed ? toProductThumbUrl(src, thumbWidth) : null

  if (!url) {
    return (
      <div
        className={`${className} bg-[#580F1C]/8 flex items-center justify-center ${rounded ? 'rounded-sm overflow-hidden' : ''}`}
      >
        <img
          src={logoThumb}
          alt=""
          width={80}
          height={80}
          decoding="async"
          aria-hidden="true"
          className="w-1/2 max-w-[5rem] h-auto rounded-full object-cover opacity-90 ring-2 ring-white/30"
        />
      </div>
    )
  }

  return (
    <div className={`${className} bg-[#580F1C]/5 overflow-hidden ${rounded ? 'rounded-sm' : ''}`}>
      <img
        src={url}
        alt={alt}
        width={thumbWidth}
        height={thumbWidth}
        loading="lazy"
        decoding="async"
        className={imgClassName}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
