const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function applyMigration() {
  try {
    console.log('Применяем миграцию для добавления полей последнего сообщения...');
    
    // Добавляем поля в таблицу messages
    const { error: messagesError } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS last_message_text text,
        ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
        ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
        ADD COLUMN IF NOT EXISTS last_message_username text;
      `
    });
    
    if (messagesError) {
      console.error('Ошибка при добавлении полей в messages:', messagesError);
    } else {
      console.log('✓ Поля добавлены в таблицу messages');
    }
    
    // Добавляем поля в таблицу groups
    const { error: groupsError } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE groups
        ADD COLUMN IF NOT EXISTS last_message_text text,
        ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
        ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
        ADD COLUMN IF NOT EXISTS last_message_username text;
      `
    });
    
    if (groupsError) {
      console.error('Ошибка при добавлении полей в groups:', groupsError);
    } else {
      console.log('✓ Поля добавлены в таблицу groups');
    }
    
    // Создаем функцию для обновления полей последнего сообщения
    const { error: functionError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE OR REPLACE FUNCTION update_last_message_fields()
        RETURNS TRIGGER AS $$
        DECLARE
          parent_table TEXT;
          parent_id UUID;
        BEGIN
          -- Определяем какую таблицу обновить на основе parent_type
          IF NEW.parent_type = 'message' THEN
            parent_table := 'messages';
          ELSIF NEW.parent_type = 'group' THEN
            parent_table := 'groups';
          ELSE
            RETURN NEW;
          END IF;
          
          parent_id := NEW.parent_id;
          
          -- Обновляем поля последнего сообщения в родительской таблице
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
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (functionError) {
      console.error('Ошибка при создании функции:', functionError);
    } else {
      console.log('✓ Функция обновления создана');
    }
    
    // Создаем триггер
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      query: `
        DROP TRIGGER IF EXISTS update_last_message_trigger ON chat_messages;
        CREATE TRIGGER update_last_message_trigger
          AFTER INSERT ON chat_messages
          FOR EACH ROW
          EXECUTE FUNCTION update_last_message_fields();
      `
    });
    
    if (triggerError) {
      console.error('Ошибка при создании триггера:', triggerError);
    } else {
      console.log('✓ Триггер создан');
    }
    
    console.log('✅ Миграция успешно применена!');
    
  } catch (error) {
    console.error('Ошибка при применении миграции:', error);
  }
}

applyMigration();