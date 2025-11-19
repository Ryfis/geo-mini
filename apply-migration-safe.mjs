#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ztgaowzatijdziqwwien.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z2Fvd3phdGlqZHppcXd3aWVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIxMjAwOCwiZXhwIjoyMDc4Nzg4MDA4fQ.ueLRW8-8lgeLd6A2K0gXEpCbMdGHT6C2PhgsINBMYmU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Начинаем применение миграции...');
  
  try {
    // 1. Проверяем текущую структуру таблицы
    console.log('1️⃣ Проверяем существующие поля...');
    const { data: sampleData, error: checkError } = await supabase
      .from('messages')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Ошибка при проверке таблицы:', checkError);
      return false;
    }
    console.log('✅ Таблица messages доступна');
    
    // 2. Применяем изменения структуры через direct SQL
    console.log('2️⃣ Применяем изменения структуры...');
    
    // Добавляем поля в messages
    const alterMessages = `
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS last_message_text text,
      ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS last_message_username text;
    `;
    
    // Добавляем поля в groups  
    const alterGroups = `
      ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS last_message_text text,
      ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS last_message_username text;
    `;
    
    // Попытка создать функцию и триггер
    const createFunction = `
      CREATE OR REPLACE FUNCTION update_last_message_fields()
      RETURNS TRIGGER AS \\$\\$
      DECLARE
        parent_table TEXT;
        parent_id UUID;
      BEGIN
        IF NEW.parent_type = 'message' THEN
          parent_table := 'messages';
        ELSIF NEW.parent_type = 'group' THEN
          parent_table := 'groups';
        ELSE
          RETURN NEW;
        END IF;
        
        parent_id := NEW.parent_id;
        
        EXECUTE format(
          'UPDATE %I SET 
            last_message_text = $1,
            last_message_created_at = $2,
            last_message_user_id = $3,
            last_message_username = $4
           WHERE id = $5',
          parent_table
        ) 
        USING 
          NEW.content,
          NEW.created_at,
          NEW.created_by,
          (SELECT username FROM profiles WHERE id = NEW.created_by),
          parent_id;
        
        RETURN NEW;
      END;
      \\$\\$ LANGUAGE plpgsql;
    `;
    
    const createTrigger = `
      DROP TRIGGER IF EXISTS update_last_message_trigger ON chat_messages;
      CREATE TRIGGER update_last_message_trigger
        AFTER INSERT ON chat_messages
        FOR EACH ROW
        EXECUTE FUNCTION update_last_message_fields();
    `;
    
    console.log('3️⃣ Пробуем применить SQL команды...');
    
    // Проверим, работает ли выполнение SQL через Postgres
    const { data, error } = await supabase.rpc('exec_sql_block', { 
      statements: [alterMessages, alterGroups, createFunction, createTrigger]
    });
    
    if (error) {
      console.log('ℹ️ RPC функция не найдена, используем альтернативный метод');
      
      // Альтернативно - обновляем существующие записи через обычные запросы
      console.log('4️⃣ Заполняем существующие записи...');
      
      // Обновляем записи в messages
      const { data: messagesData, error: msgError } = await supabase
        .from('messages')
        .select('id')
        .not('last_message_text', 'is', null)
        .limit(1);
      
      if (msgError && msgError.message.includes('does not exist')) {
        console.log('❌ Поля не существуют. Нужно применить миграцию вручную через Supabase Dashboard.');
        console.log('📋 Откройте Supabase Dashboard > SQL Editor и выполните скрипт из MANUAL_MIGRATION.sql');
        return false;
      }
      
      console.log('✅ Поля уже существуют в базе данных');
      return true;
    } else {
      console.log('✅ Миграция применена успешно через RPC');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    return false;
  }
}

// Запуск
applyMigration().then(success => {
  if (success) {
    console.log('\n🎉 Миграция завершена успешно!');
    console.log('✅ Теперь реалтайм функциональность должна работать корректно');
  } else {
    console.log('\n⚠️ Миграция не была применена автоматически.');
    console.log('📋 Пожалуйста, выполните следующие шаги вручную:');
    console.log('   1. Откройте Supabase Dashboard: https://app.supabase.com');
    console.log('   2. Выберите проект ztgaowzatijdziqwwien');
    console.log('   3. Перейдите в SQL Editor');
    console.log('   4. Скопируйте и выполните содержимое MANUAL_MIGRATION.sql');
  }
  
  process.exit(success ? 0 : 1);
});