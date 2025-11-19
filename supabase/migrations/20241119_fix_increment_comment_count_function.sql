-- Миграция для исправления функции increment_comment_count
-- Удаляем существующие перегруженные функции и создаем единую функцию с UUID

-- Удаляем все существующие функции increment_comment_count
DROP FUNCTION IF EXISTS public.increment_comment_count(text);
DROP FUNCTION IF EXISTS public.increment_comment_count(uuid);

-- Создаем единую функцию для работы с UUID
CREATE OR REPLACE FUNCTION public.increment_comment_count(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.messages 
    SET comment_count = comment_count + 1 
    WHERE id = p_message_id;
    
    -- Дополнительная проверка - убеждаемся, что обновление прошло успешно
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message with id % not found', p_message_id;
    END IF;
END;
$$;

-- Устанавливаем права доступа
GRANT EXECUTE ON FUNCTION public.increment_comment_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_comment_count(uuid) TO authenticated;