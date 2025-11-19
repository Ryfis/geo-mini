-- SQL миграция для добавления полей последнего сообщения
-- Выполните этот скрипт в Supabase Dashboard > SQL Editor

-- 1. Добавляем поля в таблицу messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS last_message_text text,
ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_message_username text;

-- 2. Добавляем поля в таблицу groups
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS last_message_text text,
ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_message_username text;

-- 3. Создаем функцию для автоматического обновления полей
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

-- 4. Создаем триггер для автоматического обновления
DROP TRIGGER IF EXISTS update_last_message_trigger ON chat_messages;
CREATE TRIGGER update_last_message_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_last_message_fields();

-- 5. Заполняем существующие записи последними сообщениями
-- Для сообщений
WITH last_messages AS (
  SELECT 
    parent_id,
    content,
    created_at,
    created_by,
    ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY created_at DESC) as rn
  FROM chat_messages
  WHERE parent_type = 'message'
)
UPDATE messages 
SET 
  last_message_text = lm.content,
  last_message_created_at = lm.created_at,
  last_message_user_id = lm.created_by,
  last_message_username = p.username
FROM last_messages lm
LEFT JOIN profiles p ON p.id = lm.created_by
WHERE messages.id = lm.parent_id AND lm.rn = 1;

-- Для групп
WITH last_messages AS (
  SELECT 
    parent_id,
    content,
    created_at,
    created_by,
    ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY created_at DESC) as rn
  FROM chat_messages
  WHERE parent_type = 'group'
)
UPDATE groups 
SET 
  last_message_text = lm.content,
  last_message_created_at = lm.created_at,
  last_message_user_id = lm.created_by,
  last_message_username = p.username
FROM last_messages lm
LEFT JOIN profiles p ON p.id = lm.created_by
WHERE groups.id = lm.parent_id AND lm.rn = 1;

-- Сообщение об успешном выполнении
SELECT 'Миграция успешно применена!' as result;