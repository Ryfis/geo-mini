import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import { Plus, Navigation, Search, RefreshCw, Filter, MessageCircle, User, Bookmark, MapPin } from 'lucide-react';
import { Message, Group, ChatMessage, supabase, Profile, uploadPostAttachment } from '../lib/supabase';
import { getCachedLocation, cacheLocation, DEFAULT_LOCATION } from '../lib/location';
import { CreatePostModal } from './CreatePostModal';
import { MessageList } from './MessageList';
import { ChatPage } from './ChatPage';
import { ViewProfilePage } from './ViewProfilePage';
import { PrivateChatPage } from './PrivateChatPage';
import { SaveLocationModal } from './SaveLocationModal';
import { SavedLocationsPage } from './SavedLocationsPage';
import { MarkerType } from '../types';
import { useRealtime } from '../hooks/useRealtime';
import '../styles/map-optimization.css';

// Функция для генерации уникального slug
const generateSlug = (title: string): string => {
  // Приводим к нижнему регистру и заменяем пробелы на дефисы
  let slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // удаляем специальные символы
    .replace(/[\s_-]+/g, '-') // заменяем пробелы, подчеркивания и множественные дефисы
    .replace(/^-+|-+$/g, ''); // удаляем дефисы в начале и конце
  
  // Добавляем случайное число для уникальности
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  return `${slug}-${timestamp}${randomStr}`;
};

type FilterType = 'all' | 'hour' | 'day' | 'week' | 'month';
type ViewType = 'map' | 'chat' | 'profile' | 'privateChat' | 'savedLocations';

// Функции для сохранения/загрузки города при перезагрузке
const CITY_STORAGE_KEY = 'geochat_last_city';

const saveCityToStorage = (center: [number, number], zoom: number) => {
  try {
    const cityData = {
      center,
      zoom,
      timestamp: Date.now()
    };
    localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(cityData));
    console.log('💾 Город сохранен в localStorage:', cityData);
  } catch (error) {
    console.warn('Ошибка сохранения города в localStorage:', error);
  }
};

const loadCityFromStorage = (): {center: [number, number], zoom: number} | null => {
  try {
    const stored = localStorage.getItem(CITY_STORAGE_KEY);
    if (stored) {
      const cityData = JSON.parse(stored);
      // Проверяем, что данные не старше 30 дней
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - cityData.timestamp < thirtyDaysInMs) {
        console.log('Город загружен из localStorage:', cityData);
        return cityData;
      } else {
        console.log('Сохраненные данные города устарели, удаляем');
        localStorage.removeItem(CITY_STORAGE_KEY);
      }
    }
  } catch (error) {
    console.warn('Ошибка загрузки города из localStorage:', error);
  }
  return null;
};

const messageIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#10b981" stroke="white" stroke-width="3"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const groupIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#3b82f6" stroke="white" stroke-width="3"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Предзагрузка иконок для ускорения рендеринга
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="#f30"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white"/>
    </svg>
  `),
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="#f30"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white"/>
    </svg>
  `),
  shadowUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="41" height="41" viewBox="0 0 41 41">
      <ellipse cx="20.5" cy="40" rx="16" ry="4" fill="rgba(0,0,0,0.3)"/>
    </svg>
  `)
});

function MapUpdater({ center, zoom, isInitialized }: { center: [number, number]; zoom: number; isInitialized: boolean }) {
  const map = useMap();
  const hasInitialized = useRef(false);
  const lastUpdate = useRef<{center: [number, number], zoom: number} | null>(null);

  useEffect(() => {
    // Всегда обновляем вид карты при изменении центра или зума
    const shouldUpdate = !lastUpdate.current || 
                        lastUpdate.current.center[0] !== center[0] ||
                        lastUpdate.current.center[1] !== center[1] ||
                        lastUpdate.current.zoom !== zoom;
    
    if (shouldUpdate) {
      console.log('Обновляем вид карты:', { center, zoom, isInitialized });
      map.setView(center, zoom, { animate: true, duration: 0.5 });
      lastUpdate.current = { center, zoom };
      
      if (!hasInitialized.current) {
        hasInitialized.current = true;
        console.log('MapUpdater: Первая инициализация завершена');
      }
    }
  }, [map, center, zoom, isInitialized]);

  return null;
}

function MapController({ onCenterChange, onBoundsChange, onZoomChange }: {
  onCenterChange: (center: [number, number]) => void;
  onBoundsChange: (bounds: {north: number, south: number, east: number, west: number}) => void;
  onZoomChange?: (zoom: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handleMove = () => {
      const center = map.getCenter();
      onCenterChange([center.lat, center.lng]);
    };

    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    };

    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      console.log('Изменение зума:', zoom);
      if (onZoomChange) {
        onZoomChange(zoom);
      }
    };

    map.on('move', handleMove);
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('move', handleMove);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onCenterChange, onBoundsChange, onZoomChange]);

  return null;
}

interface MapViewProps {
  unreadMessageCount: number;
  onNavigateToMessages: () => void;
  onNavigateToProfile: () => void;
}

export function MapView({ unreadMessageCount, onNavigateToMessages, onNavigateToProfile }: MapViewProps) {
  const { user } = useAuth();
  
  // Простое реалтайм подключение
  const { isConnected: isRealtimeConnected, lastMessage, testConnection } = useRealtime();
  
  // Приоритет загрузки городов при инициализации
  const getInitialCity = (): {center: [number, number], zoom: number} | null => {
    // 1. localStorage (сохраненное состояние)
    const savedCity = loadCityFromStorage();
    if (savedCity) {
      console.log('Загружаем город из localStorage:', savedCity);
      return savedCity;
    }
    
    // 2. Кэшированное местоположение
    const cachedLocation = getCachedLocation();
    if (cachedLocation) {
      console.log('Загружаем кэшированное местоположение:', cachedLocation);
      return { center: cachedLocation, zoom: 18 };
    }
    
    // 3. Дефолтные координаты
    console.log('Используем дефолтные координаты:', DEFAULT_LOCATION);
    return { center: DEFAULT_LOCATION, zoom: 10 };
  };
  
  const initialCity = getInitialCity();
  
  // Локальные состояния для компонента
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  // Используем кэшированную локацию если она есть, иначе DEFAULT_LOCATION
  const [centerLocation, setCenterLocation] = useState<[number, number]>(() => {
    const cached = getCachedLocation();
    console.log('🏠 Инициализация centerLocation:', cached ? 'используем кэш' : 'используем дефолт', cached || DEFAULT_LOCATION);
    return cached || DEFAULT_LOCATION;
  });
  const [mapZoomLocal, setMapZoomLocal] = useState(10);
  const [mapBounds, setMapBounds] = useState<{north: number, south: number, east: number, west: number} | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<{center: [number, number], zoom: number} | null>(initialCity);
  const [initializationComplete, setInitializationComplete] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaveLocationModalOpen, setIsSaveLocationModalOpen] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<ViewType>('map');
  const [selectedChat, setSelectedChat] = useState<{id: string, type: 'message' | 'group', title: string, location?: [number, number]} | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [chatWithProfile, setChatWithProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  // Сохранение состояния карты при переключении на другой вид
  useEffect(() => {
    if (currentView !== 'map' && centerLocation && mapZoomLocal) {
      setLastSavedState({
        center: centerLocation,
        zoom: mapZoomLocal
      });
    }
  }, [currentView, centerLocation, mapZoomLocal]);

  // Восстановление состояния карты при возврате на карту
  useEffect(() => {
    if (currentView === 'map' && lastSavedState && !isMapInitialized) {
      console.log('Восстанавливаем состояние карты при возврате на карту:', lastSavedState);
      setCenterLocation(lastSavedState.center);
      setMapZoomLocal(lastSavedState.zoom);
      // Принудительно обновляем карту при возврате
      setIsMapInitialized(false);
      setTimeout(() => setIsMapInitialized(true), 100);
    }
  }, [currentView, lastSavedState, isMapInitialized]);

  // Инициализация карты только один раз при загрузке
  useEffect(() => {
    if (!initializationComplete && currentView === 'map') {
      const initializeMap = () => {
        console.log('Инициализация карты...', { initialCity, currentView });
        
        if (initialCity) {
          console.log('Используем сохраненные координаты:', initialCity);
          setCenterLocation(initialCity.center);
          setMapZoomLocal(initialCity.zoom);
          setUserLocation(initialCity.center);
        } else {
          console.log('Используем дефолтные координаты:', DEFAULT_LOCATION);
          setCenterLocation(DEFAULT_LOCATION);
          setMapZoomLocal(10);
          setUserLocation(DEFAULT_LOCATION);
        }
        
        setIsMapInitialized(true);
        setInitializationComplete(true);
      };
      
      initializeMap();
    }
  }, [initializationComplete, currentView, initialCity]);

  useEffect(() => {
    // Загружаем маркеры сразу после инициализации центра карты
    if (centerLocation[0] && centerLocation[1]) {
      loadMarkers();
    }
  }, [centerLocation]);

  // Автозакрытие индикатора загрузки маркеров через 3 секунды
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // Автоматическое сохранение города при изменении центра карты
  useEffect(() => {
    if (centerLocation && mapZoomLocal) {
      saveCityToStorage(centerLocation, mapZoomLocal);
    console.log('🏙️ Город автоматически сохранен:', { center: centerLocation, zoom: mapZoomLocal });
    }
  }, [centerLocation, mapZoomLocal]);

  const loadMarkers = async () => {
    if (isLoading) return; // Предотвращаем дублирующие запросы
    setIsLoading(true);
    
    // Используем текущие границы карты или дефолтные
    let currentBounds = mapBounds;
    
    // Если границы не определены, используем дефолтные границы вокруг центра карты
    if (!currentBounds) {
      const center = centerLocation;
      const delta = 0.02; // Увеличил радиус для лучшего охвата
      currentBounds = {
        north: center[0] + delta,
        south: center[0] - delta,
        east: center[1] + delta,
        west: center[1] - delta
      };
    }

    // Логирование для отладки
    console.log('🔍 Загружаем сообщения для области:', {
      center: centerLocation,
      bounds: currentBounds,
      south: currentBounds.south,
      north: currentBounds.north,
      west: currentBounds.west,
      east: currentBounds.east
    });

    let messagesQuery = supabase
      .from('messages')
      .select('*')
      .gte('latitude', currentBounds.south)
      .lte('latitude', currentBounds.north)
      .gte('longitude', currentBounds.west)
      .lte('longitude', currentBounds.east)
      .order('created_at', { ascending: false })
      .limit(50); // Снизил лимит для быстрой загрузки

    let groupsQuery = supabase
      .from('groups')
      .select('*')
      .gte('latitude', currentBounds.south)
      .lte('latitude', currentBounds.north)
      .gte('longitude', currentBounds.west)
      .lte('longitude', currentBounds.east)
      .order('created_at', { ascending: false })
      .limit(50); // Снизил лимит для быстрой загрузки

    if (filter !== 'all') {
      const now = new Date();
      let timeThreshold = new Date();

      switch (filter) {
        case 'hour':
          timeThreshold.setHours(now.getHours() - 1);
          break;
        case 'day':
          timeThreshold.setDate(now.getDate() - 1);
          break;
        case 'week':
          timeThreshold.setDate(now.getDate() - 7);
          break;
        case 'month':
          timeThreshold.setMonth(now.getMonth() - 1);
          break;
      }

      messagesQuery = messagesQuery.gte('created_at', timeThreshold.toISOString());
      groupsQuery = groupsQuery.gte('created_at', timeThreshold.toISOString());
    }

    if (searchQuery.trim()) {
      messagesQuery = messagesQuery.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      groupsQuery = groupsQuery.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    try {
      console.log('Загрузка маркеров...');
      const [messagesResult, groupsResult] = await Promise.all([
        messagesQuery,
        groupsQuery
      ]);

      const { data: messagesData, error: messagesError } = messagesResult;
      const { data: groupsData, error: groupsError } = groupsResult;

      if (messagesError) {
        console.error('Ошибка загрузки сообщений:', messagesError);
        setMessages([]);
      } else {
        console.log(`Загружено ${messagesData?.length || 0} сообщений`);
        setMessages(messagesData || []);
      }

      if (groupsError) {
        console.error('Ошибка загрузки групп:', groupsError);
        setGroups([]);
      } else {
        console.log(`Загружено ${groupsData?.length || 0} групп`);
        setGroups(groupsData || []);
      }

    } catch (error) {
      console.error('Критическая ошибка загрузки маркеров:', error);
      setMessages([]);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePost = async (data: { 
    type: MarkerType; 
    title: string; 
    description: string; 
    category: string; 
    photos: File[];
    allowAnyoneToPost?: boolean;
    allowComments?: boolean;
  }) => {
    const postData: any = {
      title: data.title,
      description: data.description,
      category: data.category,
      latitude: centerLocation[0],
      longitude: centerLocation[1],
      slug: generateSlug(data.title),
      created_by: user?.id || null
    };

    // Добавляем админские поля для групп
    if (data.type === 'group') {
      postData.is_admin = true; // Создатель группы становится администратором
      postData.allow_anyone_to_post = data.allowAnyoneToPost ?? true;
      postData.allow_comments = data.allowComments ?? true;
    }

    try {
      const tableName = data.type === 'message' ? 'messages' : 'groups';
      const { data: insertedPost, error } = await supabase
        .from(tableName)
        .insert([postData])
        .select()
        .single();

      if (error || !insertedPost) {
        console.error('Error creating post:', error);
        return;
      }

      if (data.photos.length > 0) {
        const uploadPromises = data.photos.map((photo, index) =>
          uploadPostAttachment(photo, insertedPost.id, data.type, index)
        );
        
        const results = await Promise.all(uploadPromises);
        const successfulUploads = results.filter(result => result !== null).length;
        
        if (successfulUploads === 0) {
          console.error('Failed to upload any photos');
        } else if (successfulUploads < data.photos.length) {
          console.warn(`Only ${successfulUploads} out of ${data.photos.length} photos were uploaded`);
        }
      }

      loadMarkers();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleSaveLocation = async (name: string) => {
    if (!user) {
      alert('You must be logged in to save locations');
      return;
    }

    const { error } = await supabase
      .from('saved_locations')
      .insert([{
        user_id: user.id,
        name,
        latitude: centerLocation[0],
        longitude: centerLocation[1]
      }]);

    if (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location');
    } else {
      alert('Location saved successfully!');
      setIsSaveLocationModalOpen(false);
    }
  };

  const handleGoToLocation = (latitude: number, longitude: number) => {
    setCenterLocation([latitude, longitude]);
    setMapZoomLocal(18); // Максимальный зум для геолокации
    // Город будет сохранен автоматически через useEffect
  };

  // 🎯 ИНТЕГРИРОВАННАЯ ПРОСТАЯ ГЕОЛОКАЦИЯ ИЗ SimpleGeolocationTest
  const handleGoToUserLocation = () => {
    console.log('🎯 КНОПКА ГЕОЛОКАЦИИ НАЖАТА!');
    setIsLocationLoading(true);
    
    if (!navigator.geolocation) {
      alert('❌ Геолокация не поддерживается вашим браузером');
      setIsLocationLoading(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        console.log('✅ ГЕОЛОКАЦИЯ ПОЛУЧЕНА:', lat, lng);
        
        const newLocation: [number, number] = [lat, lng];
        
        // ✅ 1. ОБНОВЛЯЕМ centerLocation
        setCenterLocation(newLocation);
        setMapZoomLocal(18);
        setUserLocation(newLocation);
        
        // ✅ 2. СОХРАНЯЕМ В localStorage
        cacheLocation(newLocation);
        
        // ✅ 3. ПЕРЕЗАГРУЖАЕМ МАРКЕРЫ
        loadMarkers();
        
        console.log('🔄 ГЕОЛОКАЦИЯ ЗАВЕРШЕНА - центр обновлен, координаты сохранены, маркеры перезагружены');
        
        setIsLocationLoading(false);
      },
      (error) => {
        console.error('❌ Ошибка геолокации:', error);
        alert('❌ Ошибка геолокации: ' + error.message);
        setIsLocationLoading(false);
      },
      {
        timeout: 5000,
        enableHighAccuracy: true
      }
    );
  };

  const handleSearch = () => {
    loadMarkers();
  };

  const handleListItemClick = async (id: string, type: 'message' | 'group', title: string, location?: [number, number], slug?: string) => {
    if (slug && typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', `/chat/${slug}`);
    }
    setSelectedChat({ id, type, title, location });
    setCurrentView('chat');
  };

  const getFilterLabel = () => {
    switch (filter) {
      case 'all':
        return 'За все время';
      case 'hour':
        return 'За час';
      case 'day':
        return 'За день';
      case 'week':
        return 'За неделю';
      case 'month':
        return 'За месяц';
    }
  };

  const handleFilterSelect = (selectedFilter: FilterType) => {
    setFilter(selectedFilter);
    setIsFilterMenuOpen(false);
  };

  useEffect(() => {
    if (mapBounds) {
      loadMarkers();
    }
  }, [filter, searchQuery]);

  // Простое реагирование на новые сообщения через useRealtime хук
  useEffect(() => {
    if (lastMessage) {
      console.log('🎯 Обновляем карту из-за нового реалтайм события:', lastMessage);
      
      // Обновляем маркеры через небольшую задержку
      setTimeout(() => {
        console.log('📍 Перезагружаем маркеры после реалтайм события');
        loadMarkers();
      }, 300);
    }
  }, [lastMessage]);

  // Автоматическое тестирование реалтайм подключения при загрузке
  useEffect(() => {
    if (isRealtimeConnected) {
      console.log('✅ Реалтайм подключение активно - проводим тестирование');
      setTimeout(() => {
        testConnection();
      }, 2000); // Ждём 2 секунды после подключения
    }
  }, [isRealtimeConnected]);

  const handleCenterChange = (center: [number, number]) => {
    setCenterLocation(center);
  };

  const handleBoundsChange = (bounds: {north: number, south: number, east: number, west: number}) => {
    setMapBounds(bounds);
    loadMarkers();
  };

  const handleZoomChange = (zoom: number) => {
    console.log('Зум изменился на:', zoom);
    setMapZoomLocal(zoom);
    // Автоматически сохраняем город при изменении зума
    saveCityToStorage(centerLocation, zoom);
  };

  if (currentView === 'savedLocations') {
    return (
      <SavedLocationsPage
        onBack={() => setCurrentView('map')}
        onSelectLocation={handleGoToLocation}
        onOpenChat={(id, type, title) => {
          setSelectedChat({ id, type, title });
          setCurrentView('chat');
        }}
      />
    );
  }

  if (currentView === 'chat' && selectedChat) {
    return (
      <ChatPage
        parentType={selectedChat.type}
        parentId={selectedChat.id}
        title={selectedChat.title}
        onBack={() => {
          setCurrentView('map');
          setSelectedChat(null);
          // Обновляем список сообщений при возврате с чата
          loadMarkers();
        }}
        onViewProfile={(userId) => {
          setViewingUserId(userId);
          setCurrentView('profile');
        }}
        onShowLocation={() => {
          if (selectedChat.location) {
            setCenterLocation(selectedChat.location);
            setMapZoomLocal(18);
            setFilter(selectedChat.type);
            setCurrentView('map');
            // Город будет сохранен автоматически через useEffect
          }
        }}
      />
    );
  }

  if (currentView === 'profile' && viewingUserId) {
    return (
      <ViewProfilePage
        userId={viewingUserId}
        onBack={() => {
          setViewingUserId(null);
          if (selectedChat) {
            setCurrentView('chat');
          } else {
            setCurrentView('map');
          }
        }}
        onStartChat={(profile) => {
          setChatWithProfile(profile);
          setCurrentView('privateChat');
        }}
      />
    );
  }

  if (currentView === 'privateChat' && chatWithProfile) {
    return (
      <PrivateChatPage
        friend={chatWithProfile}
        onBack={() => {
          setChatWithProfile(null);
          setCurrentView('map');
        }}
      />
    );
  }

  const messagesToShow = messages;
  const groupsToShow = groups;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Прелоадер карты */}
      {!centerLocation[0] && !centerLocation[1] && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-[1000]">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка карты...</p>
          </div>
        </div>
      )}
      
      <MapContainer
        center={centerLocation}
        zoom={mapZoomLocal}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={true}
        zoomControlOptions={{
          position: 'bottomright'
        }}
        worldCopyJump={true}
        preferCanvas={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
        whenReady={(map) => {
          // Принудительно устанавливаем зум при готовности карты
          map.target.setZoom(mapZoomLocal);
        }}
      >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            minZoom={3}
            detectRetina={true}
            updateWhenZoom={false}
            updateWhenIdle={true}
            keepBuffer={5}
            maxNativeZoom={19}
            tileSize={256}
            retryAttempts={3}
            crossOrigin={true}
          />
          <MapUpdater center={centerLocation} zoom={mapZoomLocal} isInitialized={isMapInitialized} />
          <MapController
            onCenterChange={handleCenterChange}
            onBoundsChange={handleBoundsChange}
            onZoomChange={handleZoomChange}
          />

          <MarkerClusterGroup
            maxClusterRadius={100}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
          >
            {messagesToShow.map((message) => (
              <Marker
                key={message.id}
                position={[message.latitude, message.longitude]}
                icon={messageIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold mb-1">{message.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{message.description}</p>
                    <button
                      onClick={() => handleListItemClick(message.id, 'message', message.title, [message.latitude, message.longitude], message.slug)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Open
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {groupsToShow.map((group) => (
              <Marker
                key={group.id}
                position={[group.latitude, group.longitude]}
                icon={groupIcon}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold mb-1">{group.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                    
                    {/* Информация о правах доступа */}
                    <div className="text-xs text-gray-500 mb-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          group.is_admin ? 'bg-blue-500' : 'bg-gray-400'
                        }`}></span>
                        <span>{group.is_admin ? 'Вы администратор' : 'Вы участник'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          group.allow_anyone_to_post ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></span>
                        <span>{group.allow_anyone_to_post ? 'Все могут писать' : 'Только админ может писать'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          group.allow_comments ? 'bg-green-500' : 'bg-gray-400'
                        }`}></span>
                        <span>{group.allow_comments ? 'Комментарии включены' : 'Комментарии отключены'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle size={12} />
                        <span>{group.message_count} сообщений</span>
                        {group.comment_count > 0 && (
                          <span>• {group.comment_count} комментариев</span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleListItemClick(group.id, 'group', group.title, [group.latitude, group.longitude], group.slug)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Открыть
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]"
            style={{ zIndex: 1000 }}
          >
            <div className="relative">
              <div className="w-8 h-8 border-4 border-red-500 rounded-full bg-transparent" />
              <div className="absolute top-1/2 left-1/2 w-0.5 h-8 bg-red-500 transform -translate-x-1/2 -translate-y-full" />
              <div className="absolute top-1/2 left-1/2 w-8 h-0.5 bg-red-500 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
        </MapContainer>

      {/* Индикаторы загрузки */}
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg px-4 py-2 z-[2000]">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            Загрузка маркеров...
          </div>
        </div>
      )}

      {isLocationLoading && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-[2000] animate-pulse">
          <div className="flex items-center gap-2 text-sm">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            Определение местоположения...
          </div>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 bg-white z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">GeoChat</h1>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={() => setCurrentView('savedLocations')}
                  className="w-10 h-10 bg-gray-100 rounded-full transition hover:bg-gray-200 flex items-center justify-center"
                >
                  <Bookmark size={20} className="text-gray-700" />
                </button>
                <button
                  onClick={onNavigateToMessages}
                  className="relative w-10 h-10 bg-gray-100 rounded-full transition hover:bg-gray-200 flex items-center justify-center"
                >
                  <MessageCircle size={20} className="text-gray-700" />
                  {unreadMessageCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </div>
                  )}
                </button>
                <button
                  onClick={onNavigateToProfile}
                  className="w-10 h-10 bg-gray-100 rounded-full transition hover:bg-gray-200 flex items-center justify-center"
                >
                  <User size={20} className="text-gray-700" />
                </button>
              </>
            ) : (
              <>
                <a
                  href="/register"
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
                >
                  Регистрация
                </a>
                <a
                  href="/login"
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Войти
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-20 left-4 right-4 z-10">
        <div className="flex gap-2 mb-2">
          <div className="relative">
            <button
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition"
            >
              <Filter size={18} />
              <span className="text-sm font-medium">{getFilterLabel()}</span>
            </button>

            {isFilterMenuOpen && (
              <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl overflow-hidden min-w-[180px] z-20">
                <button
                  onClick={() => handleFilterSelect('all')}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition ${
                    filter === 'all' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  За все время
                </button>
                <button
                  onClick={() => handleFilterSelect('hour')}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition ${
                    filter === 'hour' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  За час
                </button>
                <button
                  onClick={() => handleFilterSelect('day')}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition ${
                    filter === 'day' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  За день
                </button>
                <button
                  onClick={() => handleFilterSelect('week')}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition ${
                    filter === 'week' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  За неделю
                </button>
                <button
                  onClick={() => handleFilterSelect('month')}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition ${
                    filter === 'month' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  За месяц
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition"
          >
            <Search size={18} />
            <span className="text-sm font-medium">Найти</span>
          </button>

          <button
            onClick={loadMarkers}
            disabled={isLoading}
            className="p-2 bg-white rounded-full shadow-md hover:shadow-lg transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {isSearchOpen && (
          <div className="bg-white rounded-lg shadow-lg p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder="Поиск сообщений..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        )}
      </div>

      <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex flex-col gap-3 z-10">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-14 h-14 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition flex items-center justify-center"
        >
          <Plus size={28} />
        </button>
        <button
          onClick={() => setIsSaveLocationModalOpen(true)}
          className="w-10 h-10 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition flex items-center justify-center shadow-md"
        >
          <Bookmark size={18} />
        </button>
      </div>

      <div className="absolute bottom-[35vh] right-4 flex flex-col gap-2 z-10">
        <button
          onClick={handleGoToUserLocation}
          className="w-12 h-12 bg-red-500 text-white rounded-full transition flex items-center justify-center shadow-md hover:shadow-lg hover:bg-red-600 disabled:opacity-50 z-50"
          title="🎯 Найти мое местоположение"
          style={{ zIndex: 9999, position: 'relative' }}
        >
          <Navigation size={20} className={isLocationLoading ? 'animate-spin' : ''} />
        </button>
        
        {isLocationLoading && (
          <button
            onClick={() => {
              setIsLocationLoading(false);
              console.log('Геолокация пропущена пользователем');
            }}
            className="px-3 py-2 bg-white text-gray-700 text-xs rounded-full shadow-md hover:bg-gray-50 transition border border-gray-300"
            title="Пропустить определение местоположения"
          >
            Пропустить
          </button>
        )}
      </div>

      <MessageList
        messages={messages}
        groups={groups}
        isExpanded={isListExpanded}
        onToggle={() => setIsListExpanded(!isListExpanded)}
        onItemClick={handleListItemClick}
        userLocation={userLocation}
      />

      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePost}
        latitude={centerLocation[0]}
        longitude={centerLocation[1]}
      />

      <SaveLocationModal
        isOpen={isSaveLocationModalOpen}
        onClose={() => setIsSaveLocationModalOpen(false)}
        onSave={handleSaveLocation}
        latitude={centerLocation[0]}
        longitude={centerLocation[1]}
      />
    </div>
  );
}

export default MapView;