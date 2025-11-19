import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/Auth/LoginPage';
import { RegisterPage } from './components/Auth/RegisterPage';
import { ProfilePage } from './components/ProfilePage';
import { FriendsPage } from './components/FriendsPage';
import { PrivateMessagesPage } from './components/PrivateMessagesPage';
import { ChatPage } from './components/ChatPage';
import { ViewProfilePage } from './components/ViewProfilePage';
import { SavedLocationsPage } from './components/SavedLocationsPage';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import MapViewWrapper from './components/MapViewWrapper';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();
  const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    console.log('🔔 [Notifications] Router useEffect triggered with user:', user?.id);
    
    if (!user) {
      console.log('🔔 [Notifications] No user in useEffect, returning');
      return;
    }

    console.log('🔔 [Notifications] Starting to load notification counts for user:', user.id);
    loadNotificationCounts();

    const friendRequestsSubscription = supabase
      .channel('friend_requests_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`
        },
        () => {
          loadNotificationCounts();
        }
      )
      .subscribe();

    const messagesSubscription = supabase
      .channel('private_messages_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.receiver_id === user.id) {
            loadNotificationCounts();
          }
        }
      )
      .subscribe();

    return () => {
      friendRequestsSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
    };
  }, [user]);

  const loadNotificationCounts = async () => {
    if (!user) {
      console.log('🔔 [Notifications] No user, skipping notification load');
      return;
    }

    console.log('🔔 [Notifications] Loading notification counts for user:', user.id);

    // Use regular SELECT with limit instead of HEAD to get count reliably
    const { count: friendRequests, error: friendError } = await supabase
      .from('friendships')
      .select('*', { count: 'exact' })
      .eq('friend_id', user.id)
      .eq('status', 'pending')
      .limit(0);

    if (friendError) {
      console.log('🔔 [Notifications] Friend requests error:', friendError);
      setPendingFriendRequestCount(0);
    } else {
      console.log('🔔 [Notifications] Friend requests count:', friendRequests);
      setPendingFriendRequestCount(friendRequests || 0);
    }

    // Use regular SELECT with limit instead of HEAD to get count reliably
    const { count: unreadMessages, error: messagesError } = await supabase
      .from('private_messages')
      .select('*', { count: 'exact' })
      .eq('receiver_id', user.id)
      .eq('read', false)
      .limit(0);

    if (messagesError) {
      console.log('🔔 [Notifications] Messages error:', messagesError);
      setUnreadMessageCount(0);
    } else {
      console.log('🔔 [Notifications] Unread messages count:', unreadMessages);
      setUnreadMessageCount(unreadMessages || 0);
    }
    
    console.log('🔔 [Notifications] Current counts - Friend requests:', friendRequests || 0, 'Messages:', unreadMessages || 0);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <RegisterPage
                onBack={() => window.location.href = '/'}
                onSuccess={() => window.location.href = '/'}
              />
            )
          }
        />

        <Route
          path="/"
          element={
            <MapViewWrapper
              pendingFriendRequestCount={pendingFriendRequestCount}
              unreadMessageCount={unreadMessageCount}
            />
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePageWrapper
                pendingFriendRequestCount={pendingFriendRequestCount}
                unreadMessageCount={unreadMessageCount}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile/:slug"
          element={
            <ProtectedRoute>
              <ViewProfilePageWrapper />
            </ProtectedRoute>
          }
        />

        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPageWrapper />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <PrivateMessagesPageWrapper />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat/:slug"
          element={<ChatPageWrapper />}
        />

        <Route
          path="/locations"
          element={
            <ProtectedRoute>
              <SavedLocationsPageWrapper />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProfilePageWrapper({ pendingFriendRequestCount, unreadMessageCount }: { pendingFriendRequestCount: number; unreadMessageCount: number }) {
  const navigate = useNavigate();
  
  console.log('🔔 [ProfilePageWrapper] Props received - Friend requests:', pendingFriendRequestCount, 'Messages:', unreadMessageCount);
  
  return (
    <ProfilePage
      onBack={() => navigate('/')}
      onNavigateToFriends={() => navigate('/friends')}
      onNavigateToMessages={() => navigate('/messages')}
      pendingFriendRequestCount={pendingFriendRequestCount}
      unreadMessageCount={unreadMessageCount}
    />
  );
}

function ViewProfilePageWrapper() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (data) setUserId(data.id);
    };
    fetchProfile();
  }, [slug]);

  if (!userId) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <ViewProfilePage
      userId={userId}
      onBack={() => navigate(-1)}
      onStartChat={(profile) => navigate(`/messages`)}
    />
  );
}

function FriendsPageWrapper() {
  const navigate = useNavigate();
  return <FriendsPage onBack={() => navigate('/profile')} />;
}

function PrivateMessagesPageWrapper() {
  const navigate = useNavigate();
  return <PrivateMessagesPage onBack={() => navigate(-1)} />;
}

function ChatPageWrapper() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [chatData, setChatData] = useState<{ type: 'message' | 'group'; id: string; title: string } | null>(null);

  useEffect(() => {
    const fetchChat = async () => {
      if (!slug) return;

      let { data: message } = await supabase
        .from('messages')
        .select('id, title')
        .eq('slug', slug)
        .maybeSingle();

      if (message) {
        setChatData({ type: 'message', id: message.id, title: message.title });
        return;
      }

      let { data: group } = await supabase
        .from('groups')
        .select('id, title')
        .eq('slug', slug)
        .maybeSingle();

      if (group) {
        setChatData({ type: 'group', id: group.id, title: group.title });
      }
    };
    fetchChat();
  }, [slug]);

  if (!chatData) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <ChatPage
      parentType={chatData.type}
      parentId={chatData.id}
      title={chatData.title}
      onBack={() => navigate('/')}
      onViewProfile={(userId) => {
        supabase
          .from('profiles')
          .select('slug')
          .eq('id', userId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) navigate(`/profile/${data.slug}`);
          });
      }}
      onShowLocation={() => navigate('/')}
    />
  );
}

function SavedLocationsPageWrapper() {
  const navigate = useNavigate();

  const handleOpenChat = async (id: string, type: 'message' | 'group', title: string) => {
    try {
      // Получаем slug для навигации к чату
      const tableName = type === 'message' ? 'messages' : 'groups';
      const { data } = await supabase
        .from(tableName)
        .select('slug')
        .eq('id', id)
        .maybeSingle();

      if (data?.slug) {
        navigate(`/chat/${data.slug}`);
      } else {
        console.error('Slug not found for chat');
        alert('Не удалось открыть чат');
      }
    } catch (error) {
      console.error('Error navigating to chat:', error);
      alert('Не удалось открыть чат');
    }
  };

  const handleSelectLocation = (latitude: number, longitude: number) => {
    // Здесь можно сохранить локацию в localStorage или передать через state
    // и навигировать на главную страницу с локацией
    localStorage.setItem('selectedLocation', JSON.stringify({ latitude, longitude }));
    navigate('/');
  };

  return (
    <SavedLocationsPage
      onBack={() => navigate('/')}
      onSelectLocation={handleSelectLocation}
      onOpenChat={handleOpenChat}
    />
  );
}

export default Router;
