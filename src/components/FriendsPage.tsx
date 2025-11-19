import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, Friendship } from '../lib/supabase';
import { ArrowLeft, UserPlus, Check, X, Search, User } from 'lucide-react';

interface FriendsPageProps {
  onBack: () => void;
}

type FriendWithProfile = Friendship & {
  profile: Profile;
};

export function FriendsPage({ onBack }: FriendsPageProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [requests, setRequests] = useState<FriendWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadRequests();
    }
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;

    const { data: friendshipsData } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (friendshipsData) {
      const friendIds = friendshipsData.map((f) =>
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds);

      if (profilesData) {
        const friendsWithProfiles = friendshipsData.map((friendship) => ({
          ...friendship,
          profile: profilesData.find(
            (p) => p.id === (friendship.user_id === user.id ? friendship.friend_id : friendship.user_id)
          )!,
        }));
        setFriends(friendsWithProfiles);
      }
    }
  };

  const loadRequests = async () => {
    if (!user) return;

    const { data: requestsData } = await supabase
      .from('friendships')
      .select('*')
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (requestsData) {
      const requesterIds = requestsData.map((r) => r.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', requesterIds);

      if (profilesData) {
        const requestsWithProfiles = requestsData.map((request) => ({
          ...request,
          profile: profilesData.find((p) => p.id === request.user_id)!,
        }));
        setRequests(requestsWithProfiles);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;

    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', user.id)
      .limit(20);

    setSearchResults(data || []);
    setLoading(false);
  };

  const handleSendRequest = async (friendId: string) => {
    if (!user) return;

    const { error } = await supabase.from('friendships').insert([
      {
        user_id: user.id,
        friend_id: friendId,
        status: 'pending',
      },
    ]);

    if (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request');
    } else {
      alert('Friend request sent!');
      setSearchResults(searchResults.filter((p) => p.id !== friendId));
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request');
    } else {
      loadFriends();
      loadRequests();
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('Error rejecting request:', error);
    } else {
      loadRequests();
    }
  };

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
          <h1 className="text-xl font-bold">Friends</h1>
          <div className="w-10"></div>
        </div>

        <div className="flex border-t">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === 'friends'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-gray-500'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === 'requests'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-gray-500'
            }`}
          >
            Requests ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === 'search'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-gray-500'
            }`}
          >
            Search
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {activeTab === 'friends' && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No friends yet. Search for users to add!
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="bg-white rounded-lg p-4 flex items-center gap-3 "
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {friend.profile.avatar_url ? (
                      <img
                        src={friend.profile.avatar_url}
                        alt={friend.profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{friend.profile.username}</p>
                    {friend.profile.bio && (
                      <p className="text-sm text-gray-600 truncate">{friend.profile.bio}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No pending requests
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-lg p-4 flex items-center gap-3 "
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {request.profile.avatar_url ? (
                      <img
                        src={request.profile.avatar_url}
                        alt={request.profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{request.profile.username}</p>
                    {request.profile.bio && (
                      <p className="text-sm text-gray-600 truncate">{request.profile.bio}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAcceptRequest(request.id)}
                    className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
                  >
                    <Check size={20} />
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by username"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
              >
                <Search size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {searchResults.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-white rounded-lg p-4 flex items-center gap-3 "
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{profile.username}</p>
                    {profile.bio && (
                      <p className="text-sm text-gray-600 truncate">{profile.bio}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSendRequest(profile.id)}
                    className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
                  >
                    <UserPlus size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
