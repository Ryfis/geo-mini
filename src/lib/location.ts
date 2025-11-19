// Утилиты для геолокации

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface LocationOptions {
  timeout?: number;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
}

// Дефолтное местоположение (Сан-Франциско)
export const DEFAULT_LOCATION: [number, number] = [37.7749, -122.4194];

// Улучшенная функция получения геолокации
export const getLocation = (): Promise<LocationResult | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Геолокация не поддерживается');
      resolve(null);
      return;
    }

    // Быстрый fallback
    const timeout = setTimeout(() => {
      console.log('Таймаут геолокации');
      resolve(null);
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        const result: LocationResult = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        console.log('Геолокация получена:', result);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeout);
        console.log('Ошибка геолокации:', error.message);
        resolve(null);
      },
      {
        timeout: 3500,
        enableHighAccuracy: false,
        maximumAge: 300000 // 5 минут кэша
      }
    );
  });
};

// Получение последнего известного местоположения (если доступно)
export const getLastKnownLocation = async (): Promise<[number, number]> => {
  try {
    const location = await getLocation();
    if (location) {
      return [location.latitude, location.longitude];
    }
  } catch (error) {
    console.warn('Не удалось получить последнее известное местоположение:', error);
  }
  
  return DEFAULT_LOCATION;
};

// Функция для кэширования местоположения
export const cacheLocation = (location: [number, number]) => {
  try {
    localStorage.setItem('cached_location', JSON.stringify({
      location,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Не удалось кэшировать местоположение:', error);
  }
};

// Функция для получения кэшированного местоположения
export const getCachedLocation = (maxAge: number = 300000): [number, number] | null => {
  try {
    const cached = localStorage.getItem('cached_location');
    if (cached) {
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      if (age < maxAge) {
        return data.location;
      }
    }
  } catch (error) {
    console.warn('Не удалось получить кэшированное местоположение:', error);
  }
  
  return null;
};