-- Добавление поля allow_messages в таблицу profiles
-- По умолчанию true - разрешить сообщения от всех

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS allow_messages BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN profiles.allow_messages IS 'Если true, то писать могут все. Если false, то только друзья.';
