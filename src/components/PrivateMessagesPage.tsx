import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, PrivateMessage } from '../lib/supabase';
import { ArrowLeft, User } from 'lucide-react';
import { PrivateChatPage } from './PrivateChatPage';

interface PrivateMessagesPageProps {
  onBack: () => void;
}

type ConversationPreview = {
  profile: Profile;
  lastMessage: PrivateMessage | null;
  unreadCount: number;
};

export function PrivateMessagesPage({ onBack }: PrivateMessagesPageProps) {
  console.log('💬 PrivateMessagesPage Rendered');
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    // Get all unique user IDs that have exchanged messages with current user
    const { data: messagesData } = await supabase
      .from('private_messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (!messagesData) return;

    // Get unique user IDs excluding current user
    const otherUserIds = [...new Set(
      messagesData.flatMap(msg => 
        msg.sender_id === user.id ? [msg.receiver_id] : [msg.sender_id]
      )
    )];

    if (otherUserIds.length === 0) return;

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', otherUserIds);

    if (!profilesData) return;

    const conversationPreviews: ConversationPreview[] = await Promise.all(
      profilesData.map(async (profile) => {
        const { data: messagesData } = await supabase
          .from('private_messages')
          .select('*')
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`
          )
          .order('created_at', { ascending: false })
          .limit(1);

        const { count } = await supabase
          .from('private_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', profile.id)
          .eq('receiver_id', user.id)
          .eq('read', false);

        return {
          profile,
          lastMessage: messagesData?.[0] || null,
          unreadCount: count || 0,
        };
      })
    );

    conversationPreviews.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || '0';
      const bTime = b.lastMessage?.created_at || '0';
      return bTime.localeCompare(aTime);
    });

    setConversations(conversationPreviews);
  };

  if (selectedFriend) {
    return (
      <PrivateChatPage
        friend={selectedFriend}
        onBack={() => {
          setSelectedFriend(null);
          loadConversations();
        }}
      />
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
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-2">
        {conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No conversations yet. Add friends to start chatting!
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.profile.id}
              onClick={() => setSelectedFriend(conv.profile)}
              className="w-full bg-white rounded-lg p-4 flex items-center gap-3  hover: transition"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {conv.profile.avatar_url ? (
                    <img
                      src={conv.profile.avatar_url}
                      alt={conv.profile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={28} className="text-gray-400" />
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">{conv.profile.username}</p>
                {conv.lastMessage && (
                  <p className="text-sm text-gray-600 truncate">
                    {conv.lastMessage.sender_id === user?.id ? 'You: ' : ''}
                    {conv.lastMessage.message || 'Photo'}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
