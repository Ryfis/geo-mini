import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface PhotoViewerModalProps {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoViewerModal({ photos, initialIndex, onClose }: PhotoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Блокируем прокрутку body при открытии модального окна
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [currentIndex]);

  const handleNext = () => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevious = () => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
  }, [currentIndex]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Закрываем только при клике на фон, не на изображение
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-95 z-[200] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition z-10"
        aria-label="Закрыть"
      >
        <X size={32} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-2 md:left-4 text-white p-2 hover:bg-white/10 rounded-full transition z-10"
            aria-label="Предыдущее фото"
          >
            <ChevronLeft size={36} className="md:w-12 md:h-12" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 md:right-4 text-white p-2 hover:bg-white/10 rounded-full transition z-10"
            aria-label="Следующее фото"
          >
            <ChevronRight size={36} className="md:w-12 md:h-12" />
          </button>
        </>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}
      
      <img
        src={photos[currentIndex]}
        alt={`Фото ${currentIndex + 1} из ${photos.length}`}
        className={`max-w-full max-h-[85vh] md:max-h-[90vh] object-contain rounded-lg transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
        onLoad={handleImageLoad}
      />

      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black/70 px-4 py-2 rounded-full text-sm md:text-base">
          {currentIndex + 1} / {photos.length}
        </div>
      )}
    </div>
  );
}
