/**
 * Optimized Image component with responsive design, lazy loading, and error handling
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { PhotoIcon } from '@heroicons/react/24/outline';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onError?: () => void;
  fallbackIcon?: boolean;
  aspectRatio?: 'square' | '4:3' | '16:9' | 'auto';
}

const ASPECT_RATIO_CLASSES = {
  'square': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  'auto': ''
};

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  className = '',
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  onError,
  fallbackIcon = true,
  aspectRatio = 'auto'
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    setImageError(true);
    setIsLoading(false);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // If image failed to load and fallback is enabled
  if (imageError && fallbackIcon) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${aspectRatio !== 'auto' ? ASPECT_RATIO_CLASSES[aspectRatio] : ''} ${className}`}>
        <PhotoIcon className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  // If image failed to load and no fallback
  if (imageError) {
    return null;
  }

  const imageClasses = `
    ${className}
    ${isLoading ? 'animate-pulse bg-gray-200' : ''}
    transition-opacity duration-300
  `.trim();

  const containerClasses = `
    relative overflow-hidden
    ${aspectRatio !== 'auto' ? ASPECT_RATIO_CLASSES[aspectRatio] : ''}
    ${fill ? 'w-full h-full' : ''}
  `.trim();

  if (fill) {
    return (
      <div className={containerClasses}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className={imageClasses}
          priority={priority}
          quality={quality}
          placeholder={placeholder}
          blurDataURL={blurDataURL}
          onError={handleError}
          onLoad={handleLoad}
        />
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={imageClasses}
        priority={priority}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
}

// Utility function to generate blur data URL for placeholder
export function generateBlurDataURL(width: number = 10, height: number = 10): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Create a simple gradient blur effect
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f3f4f6');
    gradient.addColorStop(1, '#e5e7eb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  return canvas.toDataURL();
}

// Hook for responsive image sizes
export function useResponsiveImageSizes(breakpoints: {
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  default: string;
}): string {
  const { sm, md, lg, xl, default: defaultSize } = breakpoints;
  
  const sizes = [];
  if (sm) sizes.push(`(max-width: 640px) ${sm}`);
  if (md) sizes.push(`(max-width: 768px) ${md}`);
  if (lg) sizes.push(`(max-width: 1024px) ${lg}`);
  if (xl) sizes.push(`(max-width: 1280px) ${xl}`);
  sizes.push(defaultSize);
  
  return sizes.join(', ');
}