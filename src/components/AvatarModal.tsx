import { X } from 'lucide-react';
import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl: string;
  username: string;
}

export function AvatarModal({ isOpen, onClose, avatarUrl, username }: AvatarModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition"
        >
          <X size={24} />
        </button>
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <LoadingSpinner size="lg" />
          </div>
        )}
        
        <img
          src={avatarUrl}
          alt={`${username}'s avatar`}
          className="max-w-full max-h-[80vh] object-contain"
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
        
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold text-gray-800">{username}</h3>
        </div>
      </div>
    </div>
  );
}