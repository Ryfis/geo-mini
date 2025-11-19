import { useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, Users } from 'lucide-react';
import { supabase, Message, Group } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { applyMigration } from '../lib/migration';

interface ChatListPageProps {
  onBack: () => void;
  onOpenChat: (id: string, type: 'message' | 'group', title: string) => void;
}

export function ChatListPage({ onBack, onOpenChat }: ChatListPageProps) {
  console.log('📋 ChatListPage Rendered');
  
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationApplied, setMigrationApplied] = useState<boolean | null>(null);

  useEffect(() => {
    loadChats();
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    const applied = await applyMigration();
    setMigrationApplied(applied);
  };

  const loadChats = async () => {
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .order('last_message_created_at', { ascending: false });

    const { data: groupsData } = await supabase
      .from('groups')
      .select('*')
      .order('last_message_created_at', { ascending: false });

    setMessages(messagesData || []);
    setGroups(groupsData || []);
    setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white  sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Chats</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {migrationApplied === false && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Требуется обновление базы данных
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Для отображения последних сообщений необходимо обновить структуру базы данных.</p>
                  <p className="mt-1">Обратитесь к администратору или попробуйте добавить новое сообщение в чат.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && groups.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
            <p>Нет доступных чатов</p>
          </div>
        )}

        {messages.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-2 px-2 text-gray-700">Messages</h2>
            <div className="space-y-2">
              {messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => onOpenChat(message.id, 'message', message.title)}
                  className="w-full bg-white rounded-xl p-4 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <MessageSquare size={24} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-800 truncate">{message.title}</h3>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {getRelativeTime(message.last_message_created_at || message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-2">{message.description}</p>
                      
                      {message.last_message_text && (
                        <div className="border-l-2 border-gray-200 pl-3">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-gray-700">
                                {message.last_message_username || 'Anonymous'}:
                              </span>{' '}
                              <span className="line-clamp-1">{message.last_message_text}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-2 px-2 text-gray-700">Groups</h2>
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => onOpenChat(group.id, 'group', group.title)}
                  className="w-full bg-white rounded-xl p-4 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <Users size={24} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-800 truncate">{group.title}</h3>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {getRelativeTime(group.last_message_created_at || group.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-2">{group.description}</p>
                      
                      {group.last_message_text && (
                        <div className="border-l-2 border-gray-200 pl-3">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-gray-700">
                                {group.last_message_username || 'Anonymous'}:
                              </span>{' '}
                              <span className="line-clamp-1">{group.last_message_text}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
