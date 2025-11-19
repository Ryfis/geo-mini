import React, { useState } from 'react';

export default function SimpleGeolocationTest() {
  const [testLog, setTestLog] = useState<string>('Готов к геолокации');
  const [locationStatus, setLocationStatus] = useState<string>('Не определена');

  const handleGeolocationClick = () => {
    console.log('🎯🎯🎯 КНОПКА ГЕОЛОКАЦИИ НАЖАТА! 🎯🎯🎯');
    setTestLog('Получаем ваше местоположение...');
    
    if (!navigator.geolocation) {
      alert('❌ Геолокация не поддерживается вашим браузером');
      setLocationStatus('Не поддерживается');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        console.log('✅ ГЕОЛОКАЦИЯ ПОЛУЧЕНА:', lat, lng);
        alert(`✅ Геолокация получена!\nШирота: ${lat}\nДолгота: ${lng}`);
        
        setLocationStatus(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setTestLog('Геолокация успешно получена!');
      },
      (error) => {
        console.error('❌ Ошибка геолокации:', error);
        alert('❌ Ошибка геолокации: ' + error.message);
        setLocationStatus('Ошибка: ' + error.message);
        setTestLog('Ошибка при получении геолокации');
      },
      {
        timeout: 5000,
        enableHighAccuracy: true
      }
    );
  };

  return (
    <div className="p-8 bg-green-200 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">🎯 ПРОСТАЯ ГЕОЛОКАЦИЯ 🎯</h1>
      
      <div className="mb-4 p-4 bg-white rounded">
        <p><strong>Статус:</strong> {testLog}</p>
        <p><strong>Местоположение:</strong> {locationStatus}</p>
        <p><strong>Console.log тест:</strong> Откройте консоль и кликните кнопку</p>
      </div>

      <button
        onClick={handleGeolocationClick}
        className="bg-blue-500 text-white px-6 py-3 rounded text-xl font-bold hover:bg-blue-600"
      >
        🎯 ОПРЕДЕЛИТЬ МОЕ МЕСТОПОЛОЖЕНИЕ
      </button>
      
      <div className="mt-8 p-4 bg-yellow-200 rounded">
        <h3>Инструкции:</h3>
        <ol className="list-decimal list-inside">
          <li>Откройте консоль браузера (F12)</li>
          <li>Кликните синюю кнопку "ОПРЕДЕЛИТЬ МОЕ МЕСТОПОЛОЖЕНИЕ"</li>
          <li>Разрешите доступ к геолокации</li>
          <li>Должен появиться alert() с координатами</li>
          <li>Должен быть console.log в консоли</li>
          <li>Проверьте обновление статуса на странице</li>
        </ol>
      </div>
    </div>
  );
}