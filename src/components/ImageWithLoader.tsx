import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  loading?: 'lazy' | 'eager';
  spinnerSize?: 'sm' | 'md' | 'lg';
}

export function ImageWithLoader({
  src,
  alt,
  className = '',
  style,
  onClick,
  loading = 'lazy',
  spinnerSize = 'sm'
}: ImageWithLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className="relative" style={style}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <LoadingSpinner size={spinnerSize} />
        </div>
      )}
      
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-gray-400 text-sm text-center px-2">
            Не удалось загрузить
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}
          style={style}
          onClick={onClick}
          onLoad={handleLoad}
          onError={handleError}
          loading={loading}
        />
      )}
    </div>
  );
}
