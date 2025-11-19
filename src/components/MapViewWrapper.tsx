import React from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from './MapView';

interface MapViewWrapperProps {
  pendingFriendRequestCount: number;
  unreadMessageCount: number;
}

export default function MapViewWrapper({ pendingFriendRequestCount, unreadMessageCount }: MapViewWrapperProps) {
  console.log('🗺️ MapViewWrapper Rendered - Friend requests:', pendingFriendRequestCount, 'Messages:', unreadMessageCount);
  const navigate = useNavigate();

  const handleNavigateToMessages = () => {
    navigate('/messages');
  };

  const handleNavigateToProfile = () => {
    navigate('/profile');
  };

  return (
    <MapView
      unreadMessageCount={unreadMessageCount}
      onNavigateToMessages={handleNavigateToMessages}
      onNavigateToProfile={handleNavigateToProfile}
    />
  );
}