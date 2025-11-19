import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Применяем миграцию для добавления полей последнего сообщения...');

    // Добавляем поля в таблицу messages
    const { error: messagesError } = await supabaseClient.rpc('exec_sql', {
      sql: `
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
    const { error: groupsError } = await supabaseClient.rpc('exec_sql', {
      sql: `
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
    const { error: functionError } = await supabaseClient.rpc('exec_sql', {
      sql: `
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
    const { error: triggerError } = await supabaseClient.rpc('exec_sql', {
      sql: `
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

    // Заполняем существующие записи последними сообщениями
    console.log('Заполняем существующие записи...');
    
    // Для сообщений
    const { error: updateMessagesError } = await supabaseClient.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (updateMessagesError) {
      console.error('Ошибка при обновлении messages:', updateMessagesError);
    } else {
      console.log('✓ Существующие сообщения обновлены');
    }

    // Для групп
    const { error: updateGroupsError } = await supabaseClient.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (updateGroupsError) {
      console.error('Ошибка при обновлении groups:', updateGroupsError);
    } else {
      console.log('✓ Существующие группы обновлены');
    }

    console.log('✅ Миграция успешно применена!');

    return new Response(
      JSON.stringify({ success: true, message: 'Миграция применена успешно' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Ошибка при применении миграции:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Ошибка при применении миграции',
        details: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});