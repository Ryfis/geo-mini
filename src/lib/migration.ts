import { supabase } from './supabase';

// Функция для применения миграции к базе данных
export async function applyMigration(): Promise<boolean> {
  try {
    console.log('Применяем миграцию для добавления полей последнего сообщения...');
    
    // Сначала проверим, есть ли уже поля в таблице
    const { data: testMessage } = await supabase
      .from('messages')
      .select('last_message_text')
      .limit(1);

    if (testMessage && testMessage.length > 0 && testMessage[0].last_message_text !== undefined) {
      console.log('✓ Поля уже существуют в базе данных');
      return true;
    }

    // Если поля не существуют, показываем сообщение пользователю
    alert('Для корректной работы функции отображения последних сообщений необходимо обновить базу данных. Обратитесь к администратору для применения миграции.');
    
    return false;
  } catch (error) {
    console.error('Ошибка при применении миграции:', error);
    return false;
  }
}

// Функция для обновления полей последнего сообщения (если триггер не работает)
export async function updateLastMessageFields(content: string, username: string, createdAt: string, createdBy: string, parentType: 'message' | 'group', parentId: string) {
  try {
    // Обновляем поля в родительской таблице напрямую без дополнительных запросов
    const tableName = parentType === 'message' ? 'messages' : 'groups';
    await supabase
      .from(tableName)
      .update({
        last_message_text: content,
        last_message_created_at: createdAt,
        last_message_user_id: createdBy,
        last_message_username: username
      })
      .eq('id', parentId);
  } catch (error) {
    console.error('Ошибка при обновлении полей последнего сообщения:', error);
  }
}

// Хук для автоматического обновления полей при добавлении сообщения
export function useLastMessageUpdater() {
  const updateAfterNewMessage = (content: string, username: string, createdAt: string, createdBy: string, parentType: 'message' | 'group', parentId: string) => {
    // Небольшая задержка для обеспечения, что сообщение уже сохранено
    setTimeout(() => {
      updateLastMessageFields(content, username, createdAt, createdBy, parentType, parentId);
    }, 500);
  };

  return { updateAfterNewMessage };
}