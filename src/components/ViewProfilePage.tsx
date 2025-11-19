import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, Friendship, Group } from '../lib/supabase';
import { ArrowLeft, UserPlus, MessageSquare, UserCheck, User, Users, Shield } from 'lucide-react';

interface ViewProfilePageProps {
  userId: string;
  onBack: () => void;
  onStartChat: (profile: Profile) => void;
}

export function ViewProfilePage({ userId, onBack, onStartChat }: ViewProfilePageProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [adminGroups, setAdminGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    loadFriendship();
    loadAdminGroups();
  }, [userId]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    setProfile(data);
    setLoading(false);
  };

  const loadFriendship = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
      .maybeSingle();

    setFriendship(data);
  };

  const loadAdminGroups = async () => {
    try {
      const { data: groupsData, error } = await supabase
        .from('groups')
        .select('*')
        .eq('created_by', userId)
        .eq('is_admin', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading admin groups:', error);
        return;
      }

      if (groupsData) {
        setAdminGroups(groupsData);
      }
    } catch (error) {
      console.error('Error loading admin groups:', error);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user || !profile) return;

    const { error } = await supabase.from('friendships').insert([
      {
        user_id: user.id,
        friend_id: profile.id,
        status: 'pending',
      },
    ]);

    if (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request');
    } else {
      alert('Friend request sent!');
      loadFriendship();
    }
  };

  const handleAcceptRequest = async () => {
    if (!friendship) return;

    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendship.id);

    if (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request');
    } else {
      loadFriendship();
    }
  };

  const handleStartChat = () => {
    if (profile) {
      onStartChat(profile);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white  sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <ArrowLeft size={24} />
            </button>
          </div>
        </div>
        <div className="text-center py-12 text-gray-600">User not found</div>
      </div>
    );
  }

  const isOwnProfile = user?.id === userId;
  const isFriend = friendship?.status === 'accepted';
  const hasPendingRequest = friendship?.status === 'pending';
  const receivedRequest = friendship?.friend_id === user?.id && hasPendingRequest;

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
          <h1 className="text-xl font-bold">Profile</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="bg-white rounded-2xl  p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mb-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={48} className="text-gray-400" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">{profile.username}</h2>
            {profile.bio && (
              <p className="text-gray-600 text-center">{profile.bio}</p>
            )}
          </div>

          {!isOwnProfile && (
            <div className="space-y-3">
              {!friendship && (
                <button
                  onClick={handleSendFriendRequest}
                  className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                >
                  <UserPlus size={20} />
                  Добавить в друзья
                </button>
              )}

              {receivedRequest && (
                <button
                  onClick={handleAcceptRequest}
                  className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition flex items-center justify-center gap-2"
                >
                  <UserCheck size={20} />
                  Принять заявку
                </button>
              )}

              {hasPendingRequest && !receivedRequest && (
                <div className="w-full bg-gray-100 text-gray-600 py-3 rounded-lg font-semibold text-center">
                  Заявка отправлена
                </div>
              )}

              {isFriend && (
                <div className="text-center text-sm text-green-600 font-medium mb-2">
                  У вас в друзьях
                </div>
              )}

              <button
                onClick={handleStartChat}
                className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                <MessageSquare size={20} />
                Написать сообщение
              </button>

              {!profile.allow_messages && !isFriend && (
                <p className="text-sm text-gray-500 text-center">
                  Этот пользователь принимает сообщения только от друзей
                </p>
              )}
            </div>
          )}
        </div>

        {/* Секция "Мои группы" - только для текущего пользователя */}
        {user?.id === userId && adminGroups.length > 0 && (
          <div className="bg-white rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Созданные группы</h2>
            </div>
            <div className="space-y-3">
              {adminGroups.map((group) => (
                <div
                  key={group.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{group.title}</h3>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          Администратор
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{group.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {group.message_count} сообщений
                        </span>
                        <span>
                          {group.allow_anyone_to_post ? 'Все могут писать' : 'Только админ может писать'}
                        </span>
                        <span>
                          {group.allow_comments ? 'Комментарии включены' : 'Комментарии отключены'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Если текущий пользователь просматривает свой профиль, но у него нет групп */}
        {user?.id === userId && adminGroups.length === 0 && (
          <div className="bg-white rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="text-gray-400" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Созданные группы</h2>
            </div>
            <p className="text-gray-500 text-center py-8">
              Вы еще не создали ни одной группы
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
