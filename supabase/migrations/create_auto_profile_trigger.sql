-- Функция для автоматического создания профиля при регистрации пользователя
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, slug, username, avatar_url, avatar_thumbnail_url, bio, allow_messages)
  VALUES (
    NEW.id,
    -- Генерируем slug из email или ID
    COALESCE(
      LOWER(SPLIT_PART(NEW.email, '@', 1)) || '-' || SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 8),
      'user-' || SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 12)
    ),
    -- Username из email или "User" + случайная строка
    COALESCE(
      SPLIT_PART(NEW.email, '@', 1),
      'User' || SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 8)
    ),
    NULL,
    NULL,
    NULL,
    true
  );
  RETURN NEW;
END;
$$;

-- Удаляем триггер если существует
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Создаём триггер на создание пользователя
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
