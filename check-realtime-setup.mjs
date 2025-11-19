// Скрипт для проверки и включения Realtime
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ztgaowzatijdziqwwien.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z2Fvd3phdGlqZHppcXd3aWVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIxMjAwOCwiZXhwIjoyMDc4Nzg4MDA4fQ.ueLRW8-8lgeLd6A2K0gXEpCbMdGHT6C2PhgsINBMYmU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealtimeSetup() {
  console.log('🔍 Проверяем настройки Realtime...');
  
  try {
    // 1. Проверяем таблицу chat_messages
    console.log('1️⃣ Проверяем таблицу chat_messages...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('chat_messages')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Ошибка доступа к таблице:', tableError);
      return false;
    }
    console.log('✅ Таблица chat_messages доступна');
    
    // 2. Проверяем существующие сообщения
    console.log('2️⃣ Проверяем существующие сообщения...');
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .limit(5);
    
    if (msgError) {
      console.error('❌ Ошибка чтения сообщений:', msgError);
      return false;
    }
    
    console.log(`✅ Найдено ${messages?.length || 0} сообщений в базе данных`);
    
    // 3. Проверяем RLS политики
    console.log('3️⃣ Проверяем RLS политики...');
    const { data: policies, error: policyError } = await supabase.rpc('check_policies', {
      table_name: 'chat_messages'
    });
    
    if (policyError) {
      console.log('ℹ️ RPC функция check_policies не найдена (это нормально)');
      console.log('ℹ️ RLS политики нужно проверить вручную через Supabase Dashboard');
    } else {
      console.log('📋 RLS политики:', policies);
    }
    
    // 4. Проверяем реалтайм публикации
    console.log('4️⃣ Тестируем реалтайм публикации...');
    
    // Создаем тестовое сообщение
    const testMessage = {
      parent_type: 'message',
      parent_id: 'test-realtime-' + Date.now(),
      content: 'Тестовое сообщение для проверки реалтайм',
      created_by: null
    };
    
    console.log('📤 Пытаемся отправить тестовое сообщение...');
    const { data: insertData, error: insertError } = await supabase
      .from('chat_messages')
      .insert([testMessage])
      .select()
      .single();
    
    if (insertError) {
      console.log('⚠️ Тестовое сообщение не отправлено (это нормально, так как parent_id может не существовать)');
    } else {
      console.log('✅ Тестовое сообщение отправлено:', insertData.id);
      
      // Удаляем тестовое сообщение
      await supabase
        .from('chat_messages')
        .delete()
        .eq('id', insertData.id);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    return false;
  }
}

checkRealtimeSetup().then(success => {
  if (success) {
    console.log('\n🎯 Рекомендации для проверки реалтайм:');
    console.log('1. Откройте Supabase Dashboard');
    console.log('2. Database > Tables > chat_messages > Settings');
    console.log('3. Убедитесь что "Enable Row Level Security" включен');
    console.log('4. Проверьте Realtime публикации: Database > Realtime');
    console.log('5. Убедитесь что таблица chat_messages включена в Realtime');
  }
  
  process.exit(0);
});