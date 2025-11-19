import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, uploadAvatar } from '../lib/supabase';
import { Camera, Save, ArrowLeft, LogOut, User, Users, MessageSquare } from 'lucide-react';
import { AvatarModal } from './AvatarModal';

interface ProfilePageProps {
  onBack: () => void;
  onNavigateToFriends: () => void;
  onNavigateToMessages: () => void;
  pendingFriendRequestCount: number;
  unreadMessageCount: number;
}

export function ProfilePage({ onBack, onNavigateToFriends, onNavigateToMessages, pendingFriendRequestCount, unreadMessageCount }: ProfilePageProps) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarThumbnailUrl, setAvatarThumbnailUrl] = useState('');
  const [allowMessages, setAllowMessages] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setUsername(data.username);
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || '');
      setAvatarThumbnailUrl(data.avatar_thumbnail_url || '');
      setAllowMessages(data.allow_messages ?? true);
    } else if (error) {
      console.error('Error loading profile:', error);
    }

    setLoading(false);
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const result = await uploadAvatar(file);
    if (result) {
      setAvatarUrl(result.avatarUrl);
      setAvatarThumbnailUrl(result.thumbnailUrl);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        bio,
        avatar_url: avatarUrl,
        avatar_thumbnail_url: avatarThumbnailUrl,
        allow_messages: allowMessages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } else {
      alert('Profile updated successfully!');
      loadProfile();
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
          <h1 className="text-xl font-bold">Profile</h1>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-gray-100 rounded-full transition text-red-500"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="bg-white rounded-2xl  p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div 
                className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => {
                  if (avatarUrl) {
                    setShowAvatarModal(true);
                  }
                }}
              >
                {avatarThumbnailUrl ? (
                  <img src={avatarThumbnailUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition disabled:opacity-50"
              >
                <Camera size={20} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              {avatarUrl && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm border">
                    Tap to view original
                  </span>
                </div>
              )}
            </div>
            {uploading && (
              <p className="text-sm text-gray-500 mt-2">Uploading...</p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Tell us about yourself"
                rows={4}
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">Писать могут только друзья</p>
                  <p className="text-sm text-gray-600">Ограничить сообщения от незнакомцев</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowMessages(!allowMessages)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    !allowMessages ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      !allowMessages ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onNavigateToFriends}
            className="bg-white rounded-2xl  p-6 hover: transition flex flex-col items-center gap-3 relative"
          >
            {pendingFriendRequestCount > 0 && (
              <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {pendingFriendRequestCount > 9 ? '9+' : pendingFriendRequestCount}
              </div>
            )}
            <Users size={32} className="text-blue-500" />
            <span className="font-semibold text-gray-800">Friends</span>
          </button>

          <button
            onClick={onNavigateToMessages}
            className="bg-white rounded-2xl  p-6 hover: transition flex flex-col items-center gap-3 relative"
          >
            {unreadMessageCount > 0 && (
              <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
              </div>
            )}
            <MessageSquare size={32} className="text-green-500" />
            <span className="font-semibold text-gray-800">Messages</span>
          </button>
        </div>
      </div>
      
      <AvatarModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        avatarUrl={avatarUrl}
        username={username}
      />
    </div>
  );
}
