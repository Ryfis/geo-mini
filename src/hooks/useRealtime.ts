import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Хук для простого реалтайм подключения
export const useRealtime = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    console.log('🔄 Инициализация простого реалтайм подключения');
    
    // Создаём простой канал без фильтров
    const channel = supabase.channel('global_realtime');
    
    console.log('📡 Подключение к реалтайм каналу: global_realtime');
    
    channel
      // Слушаем ВСЕ изменения в chat_messages
      .on(
        'postgres_changes',
        {
          event: '*', // Все события: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          console.log('🎉 Реалтайм событие получено!', {
            event: payload.eventType,
            new: payload.new,
            old: payload.old
          });
          
          setLastMessage({
            event: payload.eventType,
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          });
        }
      )
      // Также слушаем изменения в messages
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'messages'
        },
        (payload) => {
          console.log('📋 Изменение в messages таблице:', {
            event: payload.eventType,
            data: payload.new
          });
        }
      )
      // Подписываемся на канал
      .subscribe((status, err) => {
        console.log(`📊 Статус реалтайм подключения: ${status}`, err ? `Ошибка: ${err}` : '');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Реалтайм подключение успешно установлено!');
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Ошибка реалтайм канала:', err);
          setIsConnected(false);
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Таймаут реалтайм подключения');
          setIsConnected(false);
        } else if (status === 'CLOSED') {
          console.log('🔒 Реалтайм подключение закрыто');
          setIsConnected(false);
        }
      });

    // Очистка при размонтировании
    return () => {
      console.log('🛑 Закрытие реалтайм подключения');
      channel.unsubscribe();
    };
  }, []);

  return {
    isConnected,
    lastMessage,
    // Функция для принудительного тестирования
    testConnection: async () => {
      console.log('🧪 Тестирование реалтайм подключения...');
      
      // Вставляем тестовое сообщение
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          content: 'Тестовое сообщение для проверки реалтайм',
          parent_type: 'message',
          parent_id: 'test',
          created_by: null, // Анонимное сообщение для теста
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка вставки тестового сообщения:', error);
        return false;
      }
      
      console.log('✅ Тестовое сообщение вставлено:', data);
      
      // Удаляем тестовое сообщение через 2 секунды
      setTimeout(async () => {
        await supabase
          .from('chat_messages')
          .delete()
          .eq('id', data.id);
        
        console.log('🗑️ Тестовое сообщение удалено');
      }, 2000);
      
      return true;
    }
  };
};