-- Создание таблицы для сохранения чатов пользователя
CREATE TABLE IF NOT EXISTS user_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL,
  chat_type VARCHAR(20) NOT NULL CHECK (chat_type IN ('message', 'group')),
  chat_title VARCHAR(255),
  chat_latitude DOUBLE PRECISION,
  chat_longitude DOUBLE PRECISION,
  chat_category VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, chat_id, chat_type)
);

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_user_chats_user_id ON user_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_updated_at ON user_chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_chats_chat_type ON user_chats(chat_type);

-- RLS политики
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chats" ON user_chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chats" ON user_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chats" ON user_chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats" ON user_chats
  FOR DELETE USING (auth.uid() = user_id);
