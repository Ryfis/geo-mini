import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, X, User, ChevronDown, ChevronUp, MapPin, ChevronDown as ScrollDown, MessageCircle } from 'lucide-react';
import { ChatMessage, supabase, uploadMessageAttachment, Profile, Message, Group, MessageAttachment, PostAttachment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PhotoGallery } from './PhotoGallery';
import { PhotoViewerModal } from './PhotoViewerModal';
import { ImageWithLoader } from './ImageWithLoader';
import { Avatar } from './Avatar';
import { useLastMessageUpdater } from '../lib/migration';
import { useRealtime } from '../hooks/useRealtime';
import { PostCommentsChat } from './PostCommentsChat';

interface ChatPageProps {
  parentType: 'message' | 'group';
  parentId: string;
  title: string;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
  onShowLocation?: () => void;
}

// ПЕРЕКЛЮЧАТЕЛЬ ВЕРСИЙ ДИЗАЙНА - ИЗМЕНИТЬ НА 'old' ДЛЯ ВОЗВРАТА К ПРЕДЫДУЩЕМУ ДИЗАЙНУ
const DESIGN_VERSION = 'compact' as 'compact' | 'old';

// Стили для разных версий дизайна
const getHeaderStyles = () => {
  if (DESIGN_VERSION === 'old') {
    return 'px-4 py-3'; // Старый дизайн
  }
  return 'px-4 py-1.5 bg-green-100'; // Компактный дизайн (новый) - зеленый фон для проверки
};

const getPostContainerStyles = () => {
  if (DESIGN_VERSION === 'old') {
    return 'px-4 py-3'; // Старый дизайн
  }
  return 'px-4 py-1.5'; // Компактный дизайн (новый)
};

const getInputContainerStyles = () => {
  if (DESIGN_VERSION === 'old') {
    return 'px-4 py-3'; // Старый дизайн
  }
  return 'px-4 py-2'; // Компактный дизайн (новый)
};

const getTopPadding = () => {
  if (DESIGN_VERSION === 'old') {
    return 'pt-0'; // Старый дизайн
  }
  return 'pt-2.5'; // Небольшой отступ сверху в новом дизайне
};

export function ChatPage({ parentType, parentId, title, onBack, onViewProfile, onShowLocation }: ChatPageProps) {
  console.log('🎯 ChatPage Component Render - parentType:', parentType, 'parentId:', parentId);
  
  const { user } = useAuth();
  console.log('👤 User in ChatPage:', user?.id);
  
  // Кэш профилей для оптимизации
  const profilesCache = useRef<Map<string, Profile>>(new Map());
  
  // Состояния для кнопки прокрутки
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Простое реалтайм подключение
  const { isConnected: isRealtimeConnected, lastMessage } = useRealtime();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<Record<string, MessageAttachment[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [postData, setPostData] = useState<Message | Group | null>(null);
  const [postAttachments, setPostAttachments] = useState<PostAttachment[]>([]);
  const [isPostExpanded, setIsPostExpanded] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[] | null>(null);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [showCommentsChat, setShowCommentsChat] = useState<string | null>(null); // messageId для которого открыты комментарии
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateAfterNewMessage } = useLastMessageUpdater();

  // Загрузка начальных данных параллельно
  useEffect(() => {
    console.log('🔥 ChatPage useEffect START - parentType:', parentType, 'parentId:', parentId);
    Promise.all([
      loadMessages(),
      loadPostData()
    ]);
  }, [parentType, parentId]);

  // Реагирование на новые сообщения через useRealtime с проверкой дубликатов
  useEffect(() => {
    if (lastMessage && lastMessage.data && 
        lastMessage.data.parent_id === parentId && 
        lastMessage.data.parent_type === parentType) {
      console.log('💬 Получено новое сообщение для текущего чата:', lastMessage.data);
      
      if (lastMessage.event === 'INSERT') {
        const newMsg = lastMessage.data as ChatMessage;
        
        setMessages((prev) => {
          // Проверяем, нет ли уже такого сообщения - это предотвратит дублирование
          const exists = prev.some(msg => msg.id === newMsg.id);
          if (exists) {
            console.log('⚠️ Сообщение уже существует, пропускаем:', newMsg.id);
            return prev;
          }
          console.log('✅ Добавляем новое сообщение:', newMsg.id);
          return [...prev, newMsg];
        });
        
        // Профили уже загружены, не нужны дополнительные запросы
      } else if (lastMessage.event === 'UPDATE') {
        const updatedMsg = lastMessage.data as ChatMessage;
        setMessages((prev) => 
          prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg)
        );
      }
    }
  }, [lastMessage, parentId, parentType, profiles, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
  }, [messages]);

  // Отслеживание прокрутки для показа кнопки
  const handleScroll = (container: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(isNearBottom);
    setShowScrollButton(!isNearBottom && messages.length > 0);
  };

  const loadPostData = async () => {
    const tableName = parentType === 'message' ? 'messages' : 'groups';
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', parentId)
      .maybeSingle();

    if (data) {
      setPostData(data);
      
      // Загружаем фотографии поста
      const { data: attachmentsData } = await supabase
        .from('post_attachments')
        .select('*')
        .eq('post_id', parentId)
        .eq('post_type', parentType)
        .order('display_order', { ascending: true });

      if (attachmentsData) {
        setPostAttachments(attachmentsData);
      }
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      // Проверяем кэш - ИСПОЛЬЗУЕМ КЭШ ВМЕСТО НОВОГО ЗАПРОСА
      if (profilesCache.current.has(userId)) {
        const cachedProfile = profilesCache.current.get(userId)!;
        console.log('💾 Используем кэш для профиля:', userId);
        setProfiles(prev => ({...prev, [userId]: cachedProfile}));
        return;
      }

      console.log('🔍 Загружаем профиль по сети:', userId);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        // Сохраняем в кэш
        profilesCache.current.set(userId, profileData);
        setProfiles(prev => ({...prev, [userId]: profileData}));
      }
    } catch (error) {
      console.error('Ошибка загрузки профиля пользователя:', error);
    }
  };

  const loadMessages = async () => {
    console.log('📦 Загрузка сообщений для:', parentType, parentId);
    
    // Загружаем сообщения БЕЗ JOIN из-за отсутствия foreign key constraint
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, parent_type, parent_id, content, photo_url, created_at, created_by, comment_count')
      .eq('parent_type', parentType)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки сообщений:', error);
      setMessages([]);
      return;
    }

    console.log('📦 Сообщения загружены:', data?.length || 0);
    setMessages(data || []);

    if (data && data.length > 0) {
      const messageIds = data.map(m => m.id);
      
      // Загружаем вложения
      console.log('🖼️ Загружаем вложения для:', messageIds.length, 'сообщений');
      
      const { data: attachmentsData } = await supabase
        .from('message_attachments')
        .select('*')
        .in('message_id', messageIds);

      // Обрабатываем вложения
      if (attachmentsData) {
        const attachmentMap: Record<string, MessageAttachment[]> = {};
        attachmentsData.forEach(att => {
          if (!attachmentMap[att.message_id]) {
            attachmentMap[att.message_id] = [];
          }
          attachmentMap[att.message_id].push(att);
        });
        setMessageAttachments(attachmentMap);
      }

      // Загружаем уникальные профили БЕЗ JOIN - оптимизированно через кэш
      const uniqueUserIds = [...new Set(data.map(msg => msg.created_by).filter(Boolean))];
      console.log('👥 Уникальные пользователи для профилей:', uniqueUserIds.length);
      
      const profilesToLoad = uniqueUserIds.filter(id => !profilesCache.current.has(id));
      
      if (profilesToLoad.length > 0) {
        console.log('🔄 Загружаем профили:', profilesToLoad.length);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', profilesToLoad);
        
        if (profilesData) {
          const newProfiles: Record<string, Profile> = {};
          profilesData.forEach(profile => {
            profilesCache.current.set(profile.id, profile);
            newProfiles[profile.id] = profile;
          });
          setProfiles(prev => ({...prev, ...newProfiles}));
          console.log('✅ Профили загружены и закэшированы:', profilesData.length);
        }
      } else {
        console.log('💾 Все профили уже в кэше');
      }
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Проверяем лимит
    const availableSlots = 6 - selectedPhotos.length;
    if (files.length > availableSlots) {
      alert(`Вы можете загрузить максимум 6 фотографий. Выбрано ${files.length}, доступно ${availableSlots}.`);
      return;
    }

    // Добавляем новые файлы
    const newFiles = files.filter(file => file.type.startsWith('image/'));
    if (newFiles.length !== files.length) {
      alert('Поддерживаются только изображения.');
    }

    setSelectedPhotos(prev => [...prev, ...newFiles]);
    
    // Создаем URL для предпросмотра
    newFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      setPreviewUrls(prev => [...prev, url]);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearPhotos = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedPhotos([]);
    setPreviewUrls([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && selectedPhotos.length === 0) || isUploading) return;

    // Проверяем права доступа для групп
    if (parentType === 'group' && postData && 'is_admin' in postData) {
      const groupData = postData as any;
      const isAdmin = groupData.is_admin === true;
      const allowAnyoneToPost = groupData.allow_anyone_to_post !== false; // по умолчанию true
      
      if (!allowAnyoneToPost && !isAdmin) {
        alert('Только администратор группы может писать сообщения');
        return;
      }
    }

    setIsUploading(true);

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Загружаем профиль пользователя ПЕРЕД отправкой сообщения
    if (user?.id && !profilesCache.current.has(user.id)) {
      console.log('🔄 Загружаем профиль пользователя перед отправкой сообщения:', user.id);
      await loadUserProfile(user.id);
    }

    try {
      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .insert([
          {
            parent_type: parentType,
            parent_id: parentId,
            content: newMessage.trim(),
            photo_url: null,
            created_by: user?.id || null
          }
        ])
        .select()
        .single();

      if (messageError || !messageData) {
        alert('Не удалось отправить сообщение');
        setIsUploading(false);
        return;
      }

      // Загружаем все фотографии и обновляем локальное состояние
      if (selectedPhotos.length > 0) {
        const uploadResults = await Promise.all(
          selectedPhotos.map(photo => uploadMessageAttachment(photo, messageData.id))
        );
        
        // Обновляем локальные вложения для немедленного отображения
        const successfulUploads = uploadResults.filter(result => result !== null);
        if (successfulUploads.length > 0) {
          const newAttachments = successfulUploads.map(result => ({
            message_id: messageData.id,
            file_url: result!.fileUrl,
            file_type: selectedPhotos[uploadResults.indexOf(result!)].type,
            file_size: selectedPhotos[uploadResults.indexOf(result!)].size,
            thumbnail_url: result!.thumbnailUrl
          }));
          
          setMessageAttachments(prev => ({
            ...prev,
            [messageData.id]: newAttachments
          }));
        }
      }

      // Получаем username из кэша или используем значение по умолчанию
      let username = 'Anonymous';
      if (user?.id) {
        try {
          // Используем кэш профилей ВМЕСТО нового запроса
          const cachedProfile = profilesCache.current.get(user.id);
          if (cachedProfile?.username) {
            username = cachedProfile.username;
            console.log('✅ Username найден в кэше:', username, 'для пользователя:', user.id);
          } else {
            // Если в кэше все еще нет username, используем email или ID как fallback
            console.log('⚠️ Username не найден в кэше для:', user.id);
            if (user.email) {
              username = user.email.split('@')[0]; // Используем часть email до @
            } else {
              username = `User-${user.id.substring(0, 8)}`;
            }
          }
        } catch (error) {
          console.warn('Не удалось получить имя пользователя из кэша:', error);
          // Fallback к email или ID
          if (user.email) {
            username = user.email.split('@')[0];
          } else {
            username = `User-${user.id.substring(0, 8)}`;
          }
        }
      }

      const updateData = {
        last_message_text: newMessage.trim(),
        last_message_created_at: messageData.created_at,
        last_message_user_id: user?.id || null,
        last_message_username: username
      };

      // Оптимизированный запрос: объединяем обновление метаданных и увеличение счетчика
      await supabase.rpc('send_message_optimized', {
        p_parent_type: parentType,
        p_parent_id: parentId,
        p_last_message_text: updateData.last_message_text,
        p_last_message_created_at: updateData.last_message_created_at,
        p_last_message_user_id: updateData.last_message_user_id,
        p_last_message_username: updateData.last_message_username
      });

      // Обновляем поля последнего сообщения оптимизированно
      updateAfterNewMessage(newMessage.trim(), username, messageData.created_at, user?.id || '', parentType, parentId);

      // НЕ добавляем сообщение локально - пусть realtime добавит его автоматически
      // Это избегает дублирования
      
      setNewMessage('');
      clearPhotos();
    } catch (error) {
      console.error('Send error:', error);
      alert('Не удалось отправить сообщение');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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

  const openPhotoViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
  };

  const postPhotoUrls = postAttachments.map(att => att.file_url);
  const postThumbnailUrls = postAttachments.map(att => att.thumbnail_url).filter(url => url !== null);

  // Показываем чат комментариев если включен
  if (showCommentsChat && postData) {
    const message = messages.find(m => m.id === showCommentsChat);
    return (
      <PostCommentsChat
        messageId={showCommentsChat}
        postTitle={message?.content?.substring(0, 50) || postData.title}
        parentType="message"
        onBack={() => setShowCommentsChat(null)}
        onViewProfile={onViewProfile}
      />
    );
  }

  return (
    <div className={`flex flex-col h-[100dvh] bg-gray-50 overflow-hidden ${getTopPadding()}`}>
      {/* Шапка чата */}
      <div className={`bg-white border-b ${getHeaderStyles()} flex items-center gap-3 flex-shrink-0 relative z-50`}>
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg truncate">{title}</h1>
          {postData && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{getCategoryLabel(postData.category)}</span>
              {parentType === 'group' && 'is_admin' in postData && (
                <span className="flex items-center gap-1">
                  {(() => {
                    const groupData = postData as any;
                    const isAdmin = groupData.is_admin === true;
                    const allowAnyoneToPost = groupData.allow_anyone_to_post !== false;
                    return (
                      <>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isAdmin ? 'Админ' : 'Участник'}
                        </span>
                        {!allowAnyoneToPost && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            Только админ может писать
                          </span>
                        )}
                      </>
                    );
                  })()}
                </span>
              )}
            </div>
          )}
        </div>
        {postData && (
          <button
            onClick={onShowLocation}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            title="Показать на карте"
          >
            <MapPin size={24} className="text-blue-500" />
          </button>
        )}
      </div>

      {/* Контейнер с описанием поста */}
      {postData && (postData.description || postPhotoUrls.length > 0) && (
        <div className="bg-blue-50 border-b flex-shrink-0">
          <button
            onClick={() => setIsPostExpanded(!isPostExpanded)}
            className={`w-full ${getPostContainerStyles()} flex items-center gap-3 hover:bg-blue-100 transition`}
          >
            <div className="flex-1 text-left">
              {postData.description && (
                !isPostExpanded ? (
                  <p className="text-sm text-gray-700 truncate">{postData.description}</p>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{postData.description}</p>
                )
              )}
              
              {isPostExpanded && postPhotoUrls.length > 0 && (
                <div className="mt-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
                    {postPhotoUrls.map((url, index) => {
                      const thumbnailUrl = postThumbnailUrls[index] || url;
                      return (
                        <ImageWithLoader
                          key={index}
                          src={thumbnailUrl}
                          alt={`Фото ${index + 1}`}
                          className="rounded-lg object-cover cursor-pointer hover:opacity-80 transition flex-shrink-0 shadow-sm border border-gray-200"
                          style={{ width: '150px', height: '150px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openPhotoViewer(postPhotoUrls, index);
                          }}
                          loading="lazy"
                          spinnerSize="md"
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {isPostExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      )}

      {/* Контейнер с сообщениями */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        onScroll={(e) => handleScroll(e.currentTarget)}
      >
        {messages.map((msg) => {
          const isOwnMessage = msg.created_by === user?.id;
          const profile = msg.created_by ? profiles[msg.created_by] : null;
          const attachments = messageAttachments[msg.id] || [];
          const photoUrls = attachments.map(att => att.file_url);
          const thumbnailUrls = attachments.map(att => att.thumbnail_url).filter(url => url !== null);

          // Для группового чата используем новую структуру с аватаркой и юзернеймом без ссылки
          if (parentType === 'group') {
            return (
              <div key={msg.id} className="flex gap-3 bg-white p-4 rounded-xl shadow">
                <button
                  onClick={() => onViewProfile?.(msg.created_by!)}
                  className="w-9 h-9 rounded-full overflow-hidden bg-gray-300 flex-shrink-0 hover:opacity-80 transition"
                >
                  <img
                    src={profile?.avatar_thumbnail_url || profile?.avatar_url || '/default-avatar.png'}
                    alt={profile?.username || 'User'}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="max-w-[75%] rounded-xl overflow-hidden border border-gray-200">
                  <div className="px-3 py-2 bg-blue-50 flex justify-between items-center">
                    <button
                      onClick={() => onViewProfile?.(msg.created_by!)}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      {profile?.username || 'Пользователь'}
                    </button>
                    <span className="text-[10px] text-gray-500">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    {msg.content && (
                      <div className="break-words whitespace-pre-wrap mb-2">{msg.content}</div>
                    )}
                    {photoUrls.length > 0 && (
                      <div className="mt-2">
                        <PhotoGallery
                          photos={photoUrls}
                          thumbnails={thumbnailUrls.length > 0 ? thumbnailUrls : undefined}
                          onClick={(index) => openPhotoViewer(photoUrls, index)}
                        />
                      </div>
                    )}
                  </div>
                  {/* Комментарии только для групп с разрешенными комментариями */}
                  {postData && 'allow_comments' in postData && (postData as any).allow_comments && (
                    <div className="px-3 pb-3 text-xs text-blue-600">
                      <button
                        onClick={() => setShowCommentsChat(msg.id)}
                        className="hover:underline"
                      >
                        Комментарии
                        {msg.comment_count > 0 && (
                          <span className="bg-blue-100 text-blue-700 px-1 rounded-full ml-1">
                            {msg.comment_count}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Для личных чатов оставляем текущую структуру
          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              {!isOwnMessage && msg.created_by && (
                <button
                  onClick={() => onViewProfile?.(msg.created_by!)}
                  className="flex-shrink-0 hover:opacity-80 transition"
                >
                  <Avatar
                    src={profile?.avatar_thumbnail_url || profile?.avatar_url}
                    alt={profile?.username || 'User'}
                    size="sm"
                  />
                </button>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  isOwnMessage
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-900 rounded-bl-sm '
                }`}
              >
                {profile && msg.created_by && (
                  <button
                    onClick={() => onViewProfile?.(msg.created_by!)}
                    className={`text-xs font-semibold mb-1 hover:underline ${
                      isOwnMessage ? 'text-blue-100' : 'text-blue-600'
                    }`}
                  >
                    {profile.username}
                  </button>
                )}
                {msg.content && (
                  <div className="break-words whitespace-pre-wrap mb-2">{msg.content}</div>
                )}
                {photoUrls.length > 0 && (
                  <div className="mt-2">
                    <PhotoGallery
                      photos={photoUrls}
                      thumbnails={thumbnailUrls.length > 0 ? thumbnailUrls : undefined}
                      onClick={(index) => openPhotoViewer(photoUrls, index)}
                    />
                  </div>
                )}
                
                <div
                  className={`text-xs mt-1 ${
                    isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {formatTime(msg.created_at)}
                </div>
              </div>
              {isOwnMessage && msg.created_by && (
                <button
                  onClick={() => onViewProfile?.(msg.created_by!)}
                  className="flex-shrink-0 hover:opacity-80 transition"
                >
                  <Avatar
                    src={profile?.avatar_thumbnail_url || profile?.avatar_url}
                    alt={profile?.username || 'User'}
                    size="sm"
                  />
                </button>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        
        {/* Кнопка прокрутки к последнему сообщению */}
        {showScrollButton && (
          <button
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="fixed bottom-24 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition z-10"
            title="К последнему сообщению"
          >
            <ScrollDown size={20} />
          </button>
        )}
      </div>

      {/* Предпросмотр фотографий */}
      {previewUrls.length > 0 && (
        <div className={`${getPostContainerStyles()} bg-white border-t flex-shrink-0`}>
          <PhotoGallery
            photos={previewUrls}
            onRemove={removePhoto}
            editable
          />
        </div>
      )}

      {/* Поле ввода сообщения */}
      <div className={`bg-white border-t ${getInputContainerStyles()} flex-shrink-0`}>
        {user ? (
          <>
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition"
                disabled={isUploading || selectedPhotos.length >= 6}
              >
                <ImageIcon size={24} />
              </button>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Введите сообщение..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full resize-none focus:outline-none focus:border-blue-500 max-h-32"
                rows={1}
                disabled={isUploading}
              />
              <button
                onClick={handleSend}
                disabled={(!newMessage.trim() && selectedPhotos.length === 0) || isUploading}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={24} />
              </button>
            </div>
            {selectedPhotos.length > 0 && (
              <div className="text-xs text-gray-500 mt-2 text-center">
                {selectedPhotos.length} / 6 фото выбрано
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-600 mb-3">Войдите чтобы ответить</p>
            <div className="flex gap-3 justify-center">
              <a
                href="/register"
                className="px-6 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition"
              >
                Регистрация
              </a>
              <a
                href="/login"
                className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Войти
              </a>
            </div>
          </div>
        )}
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
