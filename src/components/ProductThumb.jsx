import { useState } from 'react'
import logoYuvarlak from '../assets/logo-yuvarlak.png'
import { withImageCacheBust } from '../lib/productImages'

export default function ProductThumb({
  src,
  alt = '',
  className = 'w-full h-36',
  imgClassName = 'w-full h-full object-cover',
  rounded = false,
}) {
  const [failed, setFailed] = useState(false)
  const url = src && !failed ? withImageCacheBust(src) : null

  if (!url) {
    return (
      <div
        className={`${className} bg-[#580F1C]/8 flex items-center justify-center ${rounded ? 'rounded-sm overflow-hidden' : ''}`}
      >
        <img
          src={logoYuvarlak}
          alt=""
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
        loading="lazy"
        className={imgClassName}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
