import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, PrivateMessage, uploadPhoto } from '../lib/supabase';
import { ArrowLeft, Send, Camera, X, User } from 'lucide-react';

interface PrivateChatPageProps {
  friend: Profile;
  onBack: () => void;
}

export function PrivateChatPage({ friend, onBack }: PrivateChatPageProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadMessages();
      markMessagesAsRead();
      checkFriendship();
    }
  }, [user, friend]);

  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`private_chat:${user.id}:${friend.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `sender_id=eq.${friend.id}`,
        },
        (payload) => {
          const newMsg = payload.new as PrivateMessage;
          if (newMsg.receiver_id === user.id) {
            setMessages((prev) => [...prev, newMsg]);
            markMessagesAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, friend]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('private_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    setMessages(data || []);
  };

  const checkFriendship = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${user.id})`)
      .eq('status', 'accepted')
      .maybeSingle();

    setIsFriend(!!data);
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    await supabase
      .from('private_messages')
      .update({ read: true })
      .eq('sender_id', friend.id)
      .eq('receiver_id', user.id)
      .eq('read', false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearPhoto = () => {
    setSelectedPhoto(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedPhoto) || isUploading || !user) return;

    // Проверка приватности: если allow_messages = false и не друзья
    if (!friend.allow_messages && !isFriend) {
      alert('Этот пользователь принимает сообщения только от друзей. Отправьте заявку в друзья.');
      return;
    }

    setIsUploading(true);
    let photoUrl = null;

    if (selectedPhoto) {
      photoUrl = await uploadPhoto(selectedPhoto);
      if (!photoUrl) {
        alert('Failed to upload photo');
        setIsUploading(false);
        return;
      }
    }

    const { error } = await supabase.from('private_messages').insert([
      {
        sender_id: user.id,
        receiver_id: friend.id,
        message: newMessage.trim(),
        photo_url: photoUrl,
        read: false,
      },
    ]);

    if (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } else {
      setNewMessage('');
      clearPhoto();
      loadMessages();
    }

    setIsUploading(false);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white ">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {friend.avatar_url ? (
              <img
                src={friend.avatar_url}
                alt={friend.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={20} className="text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{friend.username}</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  isMine
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-800 '
                }`}
              >
                {msg.photo_url && (
                  <img
                    src={msg.photo_url}
                    alt="Message attachment"
                    className="rounded-lg mb-2 max-w-full"
                  />
                )}
                {msg.message && <p className="break-words">{msg.message}</p>}
                <p
                  className={`text-xs mt-1 ${
                    isMine ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {previewUrl && (
        <div className="px-4 py-2 bg-white border-t">
          <div className="relative inline-block">
            <img
              src={previewUrl}
              alt="Preview"
              className="h-20 w-20 object-cover rounded-lg"
            />
            <button
              onClick={clearPhoto}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border-t p-4">
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition"
            disabled={isUploading}
          >
            <Camera size={24} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isUploading}
          />
          <button
            onClick={handleSend}
            disabled={(!newMessage.trim() && !selectedPhoto) || isUploading}
            className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
