import { User } from 'lucide-react';
import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  originalSrc?: string | null;
}

export function Avatar({ src, alt, size = 'md', className = '', onClick, originalSrc }: AvatarProps) {
  const [isLoading, setIsLoading] = useState(!!src);
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 32
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center overflow-hidden relative ${className} ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      onClick={onClick}
    >
      {src && !hasError ? (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
              <LoadingSpinner size="sm" />
            </div>
          )}
          <img
            src={src}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={handleLoad}
            onError={handleError}
          />
        </>
      ) : (
        <User size={iconSizes[size]} className="text-gray-400" />
      )}
    </div>
  );
}
