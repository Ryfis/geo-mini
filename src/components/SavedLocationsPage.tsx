import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Trash2, MessageSquare, Users, MessageCircle } from 'lucide-react';
import { supabase, SavedLocation, ChatMessage, Message, Group } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SavedLocationsPageProps {
  onBack: () => void;
  onSelectLocation: (latitude: number, longitude: number) => void;
  onOpenChat?: (id: string, type: 'message' | 'group', title: string) => void;
}

interface UserChat {
  id: string;
  type: 'message' | 'group';
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: string;
  last_message_text?: string;
  last_message_created_at?: string;
  last_message_username?: string;
  slug: string;
  unreadCount?: number;
}

export function SavedLocationsPage({ onBack, onSelectLocation, onOpenChat }: SavedLocationsPageProps) {
  const { user } = useAuth();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [userChats, setUserChats] = useState<UserChat[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'locations' | 'chats'>('chats'); // Изменено: сначала чаты

  useEffect(() => {
    loadLocations();
    loadUserChats();
  }, []);

  const loadLocations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setLocations(data);
    } else if (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadUserChats = async () => {
    if (!user) return;

    try {
      console.log('🔍 Начинаем загрузку чатов пользователя:', user.id);
      
      // Получаем данные из таблицы user_chats
      const { data: userChatsData, error } = await supabase
        .from('user_chats')
        .select(`
          id,
          chat_id,
          chat_type,
          chat_title,
          chat_latitude,
          chat_longitude,
          chat_category,
          updated_at,
          last_visited_at
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      console.log('📦 Данные из user_chats:', userChatsData?.length || 0, 'записей');
      console.log('📋 Загруженные записи:', userChatsData);

      if (error) {
        console.error('❌ Ошибка загрузки user chats:', error);
        return;
      }

      if (!userChatsData || userChatsData.length === 0) {
        console.log('⚠️ Пользователь не участвовал ни в одном чате');
        setUserChats([]);
        return;
      }

      // Получаем подробную информацию о чатах с последними сообщениями
      const chats: UserChat[] = [];
      
      // Параллельно запрашиваем данные из messages и groups
      const messageChatIds = userChatsData?.filter(c => c.chat_type === 'message').map(c => c.chat_id) || [];
      const groupChatIds = userChatsData?.filter(c => c.chat_type === 'group').map(c => c.chat_id) || [];
      
      console.log('💬 Message chat IDs:', messageChatIds);
      console.log('👥 Group chat IDs:', groupChatIds);
      
      const [messageData, groupData] = await Promise.all([
        messageChatIds.length > 0 ? 
          supabase
            .from('messages')
            .select('id, title, description, latitude, longitude, category, last_message_text, last_message_created_at, last_message_username, slug, message_count')
            .in('id', messageChatIds) : 
          { data: [] },
        groupChatIds.length > 0 ?
          supabase
            .from('groups')
            .select('id, title, description, latitude, longitude, category, last_message_text, last_message_created_at, last_message_username, slug, message_count')
            .in('id', groupChatIds) :
          { data: [] }
      ]);

      console.log('📨 Messages data:', messageData.data?.length || 0, 'записей');
      console.log('👥 Groups data:', groupData.data?.length || 0, 'записей');

      // Обрабатываем сообщения
      if (messageData.data) {
        for (const postData of messageData.data) {
          const userChatEntry = userChatsData?.find(c => c.chat_id === postData.id && c.chat_type === 'message');
          if (userChatEntry) {
            chats.push({
              id: postData.id,
              type: 'message',
              title: postData.title,
              description: postData.description,
              latitude: postData.latitude,
              longitude: postData.longitude,
              category: postData.category,
              last_message_text: postData.last_message_text,
              last_message_created_at: postData.last_message_created_at,
              last_message_username: postData.last_message_username,
              slug: postData.slug
            });
          }
        }
      }

      // Обрабатываем группы
      if (groupData.data) {
        for (const postData of groupData.data) {
          const userChatEntry = userChatsData?.find(c => c.chat_id === postData.id && c.chat_type === 'group');
          if (userChatEntry) {
            chats.push({
              id: postData.id,
              type: 'group',
              title: postData.title,
              description: postData.description,
              latitude: postData.latitude,
              longitude: postData.longitude,
              category: postData.category,
              last_message_text: postData.last_message_text,
              last_message_created_at: postData.last_message_created_at,
              last_message_username: postData.last_message_username,
              slug: postData.slug
            });
          }
        }
      }

      // Загружаем счетчики непрочитанных сообщений с lazy-load
      await loadUnreadCounts(chats.map(c => ({ id: c.id, type: c.type })));

      console.log('✅ Итоговые чаты:', chats.length, 'записей');
      console.log('📋 Финальный список чатов:', chats);

      setUserChats(chats);
    } catch (error) {
      console.error('❌ Критическая ошибка при загрузке чатов:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCounts = async (chats: { id: string; type: string }[]) => {
    if (!user || chats.length === 0) return;

    console.log('🔢 Начинаем загрузку счетчиков непрочитанных сообщений для', chats.length, 'чатов');

    // Используем оптимизированный подход с готовыми счетчиками
    const counts: Record<string, number> = {};
    const tableName = chats.length > 0 && chats[0].type === 'message' ? 'messages' : 'groups';
    
    try {
      // Получаем готовые счетчики сообщений для всех чатов сразу
      const messageChats = chats.filter(c => c.type === 'message');
      const groupChats = chats.filter(c => c.type === 'group');
      
      const promises = [];
      
      if (messageChats.length > 0) {
        promises.push(
          supabase
            .from('messages')
            .select('id, message_count')
            .in('id', messageChats.map(c => c.id))
        );
      }
      
      if (groupChats.length > 0) {
        promises.push(
          supabase
            .from('groups')
            .select('id, message_count')
            .in('id', groupChats.map(c => c.id))
        );
      }
      
      const results = await Promise.all(promises);
      
      // Обрабатываем результаты
      results.forEach((result) => {
        if (result.data) {
          result.data.forEach((chat: any) => {
            counts[chat.id] = chat.message_count || 0;
          });
        }
      });
      
      console.log('✅ Загружены счетчики:', counts);
      
    } catch (error) {
      console.error('❌ Ошибка загрузки счетчиков:', error);
      // В случае ошибки устанавливаем счетчики в 0
      chats.forEach(chat => {
        counts[chat.id] = 0;
      });
    }

    setUnreadCounts(counts);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved location?')) return;

    const { error } = await supabase
      .from('saved_locations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    } else {
      loadLocations();
    }
  };

  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      buy: 'Куплю',
      sell: 'Продам', 
      dating: 'Знакомства',
      help: 'Помощь',
      events: 'События',
      uncategorized: 'Без рубрики'
    };
    return labels[category] || category;
  };

  const handleChatClick = (chat: UserChat) => {
    console.log('🔗 Клик по чату:', chat.id, chat.type, chat.title);
    if (onOpenChat) {
      onOpenChat(chat.id, chat.type, chat.title);
    } else {
      console.warn('⚠️ onOpenChat не определен');
    }
  };

  const handleDeleteChat = async (chatId: string, type: 'message' | 'group', event: React.MouseEvent) => {
    event.stopPropagation(); // Предотвращаем открытие чата
    
    if (!confirm('Удалить чат из списка?')) return;

    try {
      const { error } = await supabase
        .from('user_chats')
        .delete()
        .eq('user_id', user?.id)
        .eq('chat_id', chatId)
        .eq('chat_type', type);

      if (error) {
        console.error('Error deleting chat:', error);
        alert('Не удалось удалить чат');
      } else {
        // Обновляем список чатов
        setUserChats(prev => prev.filter(chat => chat.id !== chatId));
        // Удаляем счетчик непрочитанных
        setUnreadCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[chatId];
          return newCounts;
        });
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      alert('Не удалось удалить чат');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-semibold text-lg">Saved & Activity</h1>
      </div>

      {/* Вкладки */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('locations')}
            className={`flex-1 py-3 px-4 text-center font-medium transition ${
              activeTab === 'locations'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MapPin size={18} />
              <span>Локации ({locations.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-3 px-4 text-center font-medium transition ${
              activeTab === 'chats'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MessageCircle size={18} />
              <span>Мои чаты ({userChats.length})</span>
            </div>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : activeTab === 'locations' ? (
          <div className="p-4">
            {locations.length === 0 ? (
              <div className="text-center py-8">
                <MapPin size={48} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 mb-2">Нет сохраненных локаций</p>
                <p className="text-sm text-gray-500">
                  Используйте кнопку закладки на карте для сохранения локаций
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => {
                          console.log('📍 Клик по локации:', location.latitude, location.longitude);
                          onSelectLocation(location.latitude, location.longitude);
                        }}
                        className="flex-1 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin size={18} className="text-blue-500 flex-shrink-0" />
                          <h3 className="font-semibold text-gray-900">{location.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 font-mono">
                          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Сохранено {new Date(location.created_at).toLocaleDateString()}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDelete(location.id)}
                        className="p-2 hover:bg-red-50 rounded-full transition text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            {userChats.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare size={48} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 mb-2">Нет активных чатов</p>
                <p className="text-sm text-gray-500">
                  Начните общаться в чатах, чтобы они появились здесь
                </p>
              </div>
            ) : (
              <div className="space-y-3 group">                {userChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="relative"
                  >
                    <button
                      onClick={() => handleChatClick(chat)}
                      className="w-full bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                          chat.type === 'group' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {chat.type === 'group' ? (
                            <Users size={20} className="text-blue-600" />
                          ) : (
                            <MessageSquare size={20} className="text-green-600" />
                          )}
                          {/* Счетчик непрочитанных сообщений */}
                          {unreadCounts[chat.id] > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                              {unreadCounts[chat.id] > 99 ? '99+' : unreadCounts[chat.id]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">{chat.title}</h3>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {chat.last_message_created_at ? getRelativeTime(chat.last_message_created_at) : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>{chat.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                              {getCategoryLabel(chat.category)}
                            </span>
                            {chat.last_message_text && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 max-w-[200px]">
                                <span className="font-medium">
                                  {chat.last_message_username || 'Anonymous'}:
                                </span>
                                <span className="truncate">{chat.last_message_text}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    
                    {/* Кнопка удаления */}
                    <button
                      onClick={(e) => handleDeleteChat(chat.id, chat.type, e)}
                      className="absolute top-2 right-2 p-1.5 hover:bg-red-50 rounded-full transition text-red-500 opacity-0 group-hover:opacity-100 z-10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
