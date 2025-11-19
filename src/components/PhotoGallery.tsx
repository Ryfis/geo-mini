import { X } from 'lucide-react';
import { ImageWithLoader } from './ImageWithLoader';

interface PhotoGalleryProps {
  photos: string[];
  thumbnails?: string[];
  onRemove?: (index: number) => void;
  onClick?: (index: number) => void;
  editable?: boolean;
}

export function PhotoGallery({ photos, thumbnails, onRemove, onClick, editable = false }: PhotoGalleryProps) {
  if (photos.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="horizontal-scroll flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory" style={{
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
        scrollBehavior: 'smooth'
      }}>
        {photos.map((photo, index) => {
          const thumbnail = thumbnails?.[index] || photo;
          return (
            <div
              key={index}
              className="relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
              style={{ width: '120px', height: '120px', minWidth: '120px' }}
            >
              <ImageWithLoader
                src={thumbnail}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition"
                onClick={() => onClick?.(index)}
                loading="lazy"
                spinnerSize="sm"
              />
              {editable && onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition z-10"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
