import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Category = 'buy' | 'sell' | 'dating' | 'help' | 'events' | 'uncategorized';

export interface Message {
  id: string;
  slug: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: Category;
  created_at: string;
  created_by: string | null;
  last_message_text?: string | null;
  last_message_created_at?: string | null;
  last_message_user_id?: string | null;
  last_message_username?: string | null;
  message_count: number;
  comment_count: number;
}

export interface Group {
  id: string;
  slug: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: Category;
  created_at: string;
  created_by: string | null;
  last_message_text?: string | null;
  last_message_created_at?: string | null;
  last_message_user_id?: string | null;
  last_message_username?: string | null;
  message_count: number;
  is_admin: boolean;
  allow_anyone_to_post: boolean;
  allow_comments: boolean;
}

export interface ChatMessage {
  id: string;
  parent_type: 'message' | 'group';
  parent_id: string;
  content: string;
  photo_url: string | null;
  created_at: string;
  created_by: string | null;
  comment_count: number;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_url: string;
  file_type: string;
  file_size: number;
  thumbnail_url: string | null;
  created_at: string;
}

export interface PostAttachment {
  id: string;
  post_type: 'message' | 'group';
  post_id: string;
  file_url: string;
  thumbnail_url: string | null;
  file_type: string;
  file_size: number;
  display_order: number;
  created_at: string;
}

export interface PostComment {
  id: string;
  message_id: string;
  parent_type: 'message' | 'group';
  parent_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  comment_count?: number; // Поле может быть добавлено при join запросах
}

export interface Profile {
  id: string;
  slug: string;
  username: string;
  avatar_url: string | null;
  avatar_thumbnail_url: string | null;
  bio: string | null;
  allow_messages: boolean;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface PrivateMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  photo_url: string | null;
  read: boolean;
  created_at: string;
}

export interface SavedLocation {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export async function uploadPhoto(file: File): Promise<string | null> {
  const fileName = `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('photos')
    .upload(fileName, file);

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

async function createThumbnail(file: File, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      canvas.width = size;
      canvas.height = size;

      const aspectRatio = img.width / img.height;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;

      if (aspectRatio > 1) {
        sourceWidth = img.height;
        sourceX = (img.width - img.height) / 2;
      } else {
        sourceHeight = img.width;
        sourceY = (img.height - img.width) / 2;
      }

      ctx?.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, size, size
      );

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create thumbnail'));
        }
      }, 'image/jpeg', 0.8);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string; thumbnailUrl: string } | null> {
  try {
    const fileName = `${Date.now()}-${file.name}`;
    const thumbnailFileName = `${Date.now()}-thumb-${file.name}`;

    const thumbnailBlob = await createThumbnail(file, 32);

    const [fullUpload, thumbUpload] = await Promise.all([
      supabase.storage.from('photos').upload(fileName, file),
      supabase.storage.from('photos').upload(thumbnailFileName, thumbnailBlob)
    ]);

    if (fullUpload.error || thumbUpload.error) {
      console.error('Upload error:', fullUpload.error || thumbUpload.error);
      return null;
    }

    const { data: fullUrlData } = supabase.storage.from('photos').getPublicUrl(fullUpload.data.path);
    const { data: thumbUrlData } = supabase.storage.from('photos').getPublicUrl(thumbUpload.data.path);

    return {
      avatarUrl: fullUrlData.publicUrl,
      thumbnailUrl: thumbUrlData.publicUrl
    };
  } catch (error) {
    console.error('Avatar upload error:', error);
    return null;
  }
}

export async function uploadMessageAttachment(file: File, messageId: string): Promise<{ fileUrl: string; thumbnailUrl: string } | null> {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return null;

    // Создаем миниатюру
    const thumbnailFile = await createPostThumbnail(file);

    const timestamp = Date.now();
    const baseFileName = `${user.data.user.id}/${timestamp}-${file.name}`;
    const thumbnailFileName = `${user.data.user.id}/${timestamp}-thumb_${file.name}`;

    // Загружаем оригинальное изображение
    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(baseFileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    // Загружаем миниатюру
    const { data: thumbnailData, error: thumbnailError } = await supabase.storage
      .from('message-attachments')
      .upload(thumbnailFileName, thumbnailFile);

    if (thumbnailError) {
      console.error('Thumbnail upload error:', thumbnailError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(data.path);

    const { data: thumbnailUrlData } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(thumbnailData.path);

    await supabase.from('message_attachments').insert({
      message_id: messageId,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
      thumbnail_url: thumbnailUrlData.publicUrl
    });

    return {
      fileUrl: urlData.publicUrl,
      thumbnailUrl: thumbnailUrlData.publicUrl
    };
  } catch (error) {
    console.error('Attachment upload error:', error);
    return null;
  }
}

/**
 * Создает миниатюру изображения размером 150x150 пикселей
 */
async function createPostThumbnail(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Устанавливаем размеры миниатюры
      canvas.width = 150;
      canvas.height = 150;

      // Вычисляем размеры для сохранения пропорций
      const scale = Math.min(150 / img.width, 150 / img.height);
      const newWidth = img.width * scale;
      const newHeight = img.height * scale;

      // Центрируем изображение
      const x = (150 - newWidth) / 2;
      const y = (150 - newHeight) / 2;

      // Очищаем canvas и рисуем изображение
      ctx?.clearRect(0, 0, 150, 150);
      ctx?.drawImage(img, x, y, newWidth, newHeight);

      // Конвертируем в Blob и создаем File
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create thumbnail'));
          return;
        }

        const thumbnailFile = new File([blob], `thumb_${file.name}`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });

        resolve(thumbnailFile);
      }, 'image/jpeg', 0.8);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadPostAttachment(
  file: File,
  postId: string,
  postType: 'message' | 'group',
  displayOrder: number
): Promise<{ mainUrl: string; thumbnailUrl: string } | null> {
  try {
    const timestamp = Date.now();
    const fileName = `${postType}/${postId}/${timestamp}-${file.name}`;
    const thumbnailFileName = `${postType}/${postId}/thumbnails/${timestamp}-${file.name}`;

    // Создаем миниатюру
    const thumbnailFile = await createPostThumbnail(file);

    // Загружаем основное изображение
    const { data: mainData, error: mainError } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, file);

    if (mainError) {
      console.error('Main image upload error:', mainError);
      return null;
    }

    // Загружаем миниатюру
    const { data: thumbnailData, error: thumbnailError } = await supabase.storage
      .from('message-attachments')
      .upload(thumbnailFileName, thumbnailFile);

    if (thumbnailError) {
      console.error('Thumbnail upload error:', thumbnailError);
      // Продолжаем, даже если миниатюра не загрузилась
    }

    // Получаем публичные URLs
    const { data: mainUrlData } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(mainData.path);

    const { data: thumbnailUrlData } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(thumbnailData?.path || mainData.path);

    await supabase.from('post_attachments').insert({
      post_type: postType,
      post_id: postId,
      file_url: mainUrlData.publicUrl,
      thumbnail_url: thumbnailUrlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
      display_order: displayOrder
    });

    return {
      mainUrl: mainUrlData.publicUrl,
      thumbnailUrl: thumbnailUrlData.publicUrl
    };
  } catch (error) {
    console.error('Post attachment upload error:', error);
    return null;
  }
}
