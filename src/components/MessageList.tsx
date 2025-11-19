import { useState, useEffect } from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { Message, Group, ChatMessage, Profile, Category, PostAttachment, supabase } from '../lib/supabase';
import { PhotoViewerModal } from './PhotoViewerModal';
import { ImageWithLoader } from './ImageWithLoader';

interface MessageListProps {
  messages: Message[];
  groups: Group[];
  isExpanded: boolean;
  onToggle: () => void;
  onItemClick: (id: string, type: 'message' | 'group', title: string, location?: [number, number], slug?: string) => void;
  userLocation: [number, number] | null;
}

const CATEGORY_LABELS: Record<Category | 'all', string> = {
  all: 'Все',
  buy: 'Куплю',
  sell: 'Продам',
  dating: 'Знакомства',
  help: 'Помощь',
  events: 'События',
  uncategorized: 'Без рубрики'
};

export function MessageList({ messages, groups, isExpanded, onToggle, onItemClick, userLocation }: MessageListProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [postAttachments, setPostAttachments] = useState<Record<string, PostAttachment[]>>({});
  const [viewerPhotos, setViewerPhotos] = useState<string[] | null>(null);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const allItems = [
    ...messages.map(m => ({ ...m, type: 'message' as const })),
    ...groups.map(g => ({ ...g, type: 'group' as const }))
  ];

  const filteredItems = allItems
    .filter(item => selectedCategory === 'all' || item.category === selectedCategory)
    .sort((a, b) => {
      const aTime = a.last_message_created_at ? new Date(a.last_message_created_at).getTime() : new Date(a.created_at).getTime();
      const bTime = b.last_message_created_at ? new Date(b.last_message_created_at).getTime() : new Date(b.created_at).getTime();
      return bTime - aTime;
    });

  useEffect(() => {
    loadPostAttachments();
  }, [messages, groups]);

  const loadPostAttachments = async () => {
    const postIds = [...messages.map(m => m.id), ...groups.map(g => g.id)];
    if (postIds.length === 0) return;

    const { data: attachmentsData } = await supabase
      .from('post_attachments')
      .select('*')
      .in('post_id', postIds)
      .order('display_order', { ascending: true });

    if (attachmentsData) {
      const attachmentMap: Record<string, PostAttachment[]> = {};
      attachmentsData.forEach(att => {
        if (!attachmentMap[att.post_id]) {
          attachmentMap[att.post_id] = [];
        }
        attachmentMap[att.post_id].push(att);
      });
      setPostAttachments(attachmentMap);
    }
  };

  const getCategoryCount = (category: Category | 'all') => {
    if (category === 'all') return allItems.length;
    return allItems.filter(item => item.category === category).length;
  };

  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'минуту' : diffMins < 5 ? 'минуты' : 'минут'} назад`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'час' : diffHours < 5 ? 'часа' : 'часов'} назад`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней'} назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const openPhotoViewer = (photos: string[], index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
  };

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl  transition-all duration-300 z-10 ${
        isExpanded ? 'h-[80vh]' : 'h-[30vh]'
      }`}
    >
      <div
        className="flex justify-center py-3 cursor-pointer"
        onClick={onToggle}
      >
        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
      </div>

      <div className="px-4 pb-4 h-full overflow-hidden flex flex-col">
        <div className="mb-3">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {(['all', 'buy', 'sell', 'dating', 'help', 'events', 'uncategorized'] as const).map((category) => {
              const count = getCategoryCount(category);
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {CATEGORY_LABELS[category]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No posts visible in this area
            </div>
          ) : (
            filteredItems.map((item) => {
              const attachments = postAttachments[item.id] || [];
              const photoUrls = attachments.map(att => att.file_url);
              const thumbnailUrls = attachments.map(att => att.thumbnail_url).filter(url => url !== null);

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => onItemClick(item.id, item.type, item.title, [item.latitude, item.longitude], item.slug)}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {item.type === 'message' ? (
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <MessageSquare size={20} className="text-green-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users size={20} className="text-blue-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {item.title}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {item.description}
                        </p>
                      )}

                      {photoUrls.length > 0 && (
                        <div className="mb-3 mt-3">
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {photoUrls.map((url, index) => {
                              const thumbnailUrl = thumbnailUrls[index] || url;
                              return (
                                <ImageWithLoader
                                  key={index}
                                  src={thumbnailUrl}
                                  alt={`Фото ${index + 1}`}
                                  className="rounded-lg object-cover cursor-pointer hover:opacity-80 transition flex-shrink-0 shadow-sm border border-gray-200"
                                  style={{ width: '120px', height: '140px' }}
                                  onClick={(e) => openPhotoViewer(photoUrls, index, e)}
                                  loading="lazy"
                                  spinnerSize="sm"
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {item.last_message_text && (
                        <div className="mb-2 border-l-2 border-gray-200 pl-3">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-gray-700">
                                {item.last_message_username || 'Anonymous'}:
                              </span>{' '}
                              <span className="line-clamp-1">{item.last_message_text}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-gray-400">
                        {getRelativeTime(item.last_message_created_at || item.created_at)}
                        {userLocation && (
                          <>
                            {' • '}
                            {calculateDistance(userLocation[0], userLocation[1], item.latitude, item.longitude)}
                          </>
                        )}
                        {item.message_count > 0 && (
                          <>
                            {' • '}
                            <span className="font-medium text-blue-600">
                              {item.message_count} {item.message_count === 1 ? 'сообщение' : item.message_count < 5 ? 'сообщения' : 'сообщений'}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {viewerPhotos && (
        <PhotoViewerModal
          photos={viewerPhotos}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerPhotos(null)}
        />
      )}
    </div>
  );
}
