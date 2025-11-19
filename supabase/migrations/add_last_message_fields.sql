-- Add last_message fields to messages and groups tables
-- This migration adds fields to store the last message information for chat lists

-- Add last_message fields to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS last_message_text text,
ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_message_username text;

-- Add last_message fields to groups table  
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS last_message_text text,
ADD COLUMN IF NOT EXISTS last_message_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_message_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_message_username text;

-- Create function to update last message fields
CREATE OR REPLACE FUNCTION update_last_message_fields()
RETURNS TRIGGER AS $$
DECLARE
  parent_table TEXT;
  parent_id UUID;
BEGIN
  -- Determine which table to update based on parent_type
  IF NEW.parent_type = 'message' THEN
    parent_table := 'messages';
  ELSIF NEW.parent_type = 'group' THEN
    parent_table := 'groups';
  ELSE
    RETURN NEW;
  END IF;
  
  parent_id := NEW.parent_id;
  
  -- Update the last message fields in the parent table
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

-- Create trigger to automatically update last message fields
DROP TRIGGER IF EXISTS update_last_message_trigger ON chat_messages;
CREATE TRIGGER update_last_message_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_last_message_fields();