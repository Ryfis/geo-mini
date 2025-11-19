import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Send, X, User } from 'lucide-react';
import { PostComment, supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from './Avatar';

interface PostCommentsChatProps {
  messageId: string;
  postTitle: string;
  parentType: 'message' | 'group';
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
}

export function PostCommentsChat({ messageId, postTitle, parentType, onBack, onViewProfile }: PostCommentsChatProps) {
  console.log('💬 PostCommentsChat Component Render - messageId:', messageId);
  
  const { user } = useAuth();
  console.log('👤 User in PostCommentsChat:', user?.id);
  
  // Кэш профилей для оптимизации
  const profilesCache = useRef<Map<string, Profile>>(new Map());
  
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Загрузка комментариев при монтировании
  useEffect(() => {
    if (messageId) {
      loadComments();
    }
  }, [messageId]);

  const loadUserProfile = async (userId: string) => {
    try {
      if (profilesCache.current.has(userId)) {
        const cachedProfile = profilesCache.current.get(userId)!;
        setProfiles(prev => ({...prev, [userId]: cachedProfile}));
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        profilesCache.current.set(userId, profileData);
        setProfiles(prev => ({...prev, [userId]: profileData}));
      }
    } catch (error) {
      console.error('Ошибка загрузки профиля пользователя:', error);
    }
  };

  const loadComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading comments:', error);
        return;
      }

      if (commentsData) {
        setComments(commentsData);
        
        // Загружаем профили для комментариев
        const userIds = [...new Set(commentsData.map(c => c.created_by).filter(Boolean))];
        userIds.forEach(userId => {
          if (!profilesCache.current.has(userId)) {
            loadUserProfile(userId);
          }
        });
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleSend = async () => {
    if (!newComment.trim() || isUploading) return;

    setIsUploading(true);

    try {
      // Определяем тип родителя из пропсов
      const tableName = parentType === 'group' ? 'groups' : 'messages';

      const { data: commentData, error: commentError } = await supabase
        .from('post_comments')
        .insert([
          {
            message_id: messageId,
            parent_type: parentType,
            parent_id: messageId,
            content: newComment.trim(),
            created_by: user?.id || null
          }
        ])
        .select()
        .single();

      if (commentError || !commentData) {
        alert('Не удалось добавить комментарий');
        setIsUploading(false);
        return;
      }

      // Обновляем счетчик комментариев в соответствующей таблице
      // Сначала получаем текущее значение счетчика
      const { data: currentItem, error: fetchError } = await supabase
        .from(tableName)
        .select('comment_count')
        .eq('id', messageId)
        .maybeSingle();

      if (fetchError) {
        console.error(`Ошибка получения ${parentType} для обновления счетчика:`, fetchError);
      } else if (currentItem) {
        const newCount = (currentItem.comment_count || 0) + 1;
        
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ comment_count: newCount })
          .eq('id', messageId);

        if (updateError) {
          console.error('Ошибка обновления счетчика комментариев:', updateError);
        }
      } else {
        console.warn(`${parentType} с ID ${messageId} не найдено для обновления счетчика комментариев`);
      }

      // Перезагружаем комментарии чтобы получить обновленный список
      await loadComments();

      setNewComment('');
    } catch (error) {
      console.error('Send error:', error);
      alert('Не удалось добавить комментарий');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getUsername = (comment: PostComment) => {
    if (comment.created_by && profiles[comment.created_by]) {
      return profiles[comment.created_by].username;
    }
    return 'Аноним';
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 overflow-hidden">
      {/* Шапка комментариев */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg truncate">Комментарии</h1>
          <p className="text-sm text-gray-600 truncate">К посту: {postTitle}</p>
        </div>
      </div>

      {/* Список комментариев */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Пока нет комментариев. Будьте первым!
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="flex-shrink-0">
                <button onClick={() => onViewProfile?.(comment.created_by!)} className="hover:opacity-80 transition">
                  <Avatar
                    src={profiles[comment.created_by]?.avatar_thumbnail_url || profiles[comment.created_by]?.avatar_url}
                    alt={getUsername(comment)}
                    size="sm"
                    onClick={() => onViewProfile?.(comment.created_by!)}
                  />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <button 
                      onClick={() => onViewProfile?.(comment.created_by!)}
                      className="font-medium text-sm text-gray-900 hover:underline"
                    >
                      {getUsername(comment)}
                    </button>
                    <span className="text-xs text-gray-500">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-800 text-sm whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Поле ввода комментария */}
      <div className="bg-white border-t p-4 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Написать комментарий..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              disabled={isUploading}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!newComment.trim() || isUploading}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
