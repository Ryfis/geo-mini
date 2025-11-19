import { useState, useRef } from 'react';
import { X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { MarkerType } from '../types';
import { Category } from '../lib/supabase';
import { PhotoGallery } from './PhotoGallery';
import { useAuth } from '../contexts/AuthContext';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { 
    type: MarkerType; 
    title: string; 
    description: string; 
    category: Category; 
    photos: File[];
    allowAnyoneToPost?: boolean;
    allowComments?: boolean;
  }) => void;
  latitude: number;
  longitude: number;
}

const CATEGORIES = [
  { value: 'buy' as Category, label: 'Куплю' },
  { value: 'sell' as Category, label: 'Продам' },
  { value: 'dating' as Category, label: 'Знакомства' },
  { value: 'help' as Category, label: 'Помощь' },
  { value: 'events' as Category, label: 'События' },
  { value: 'uncategorized' as Category, label: 'Без рубрики' }
];

type AuthMode = 'signin' | 'signup';

export function CreatePostModal({ isOpen, onClose, onSubmit, latitude, longitude }: CreatePostModalProps) {
  const { user, signIn, signUp } = useAuth();
  
  // Post creation states
  const [type, setType] = useState<MarkerType>('message');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('uncategorized');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [allowAnyoneToPost, setAllowAnyoneToPost] = useState<boolean>(true);
  const [allowComments, setAllowComments] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth states
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 6 - selectedPhotos.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
      alert(`Вы можете загрузить максимум 6 фотографий. ${files.length - remainingSlots} фото не были добавлены.`);
    }

    const newPhotos = filesToAdd.map(file => file);
    const newUrls = filesToAdd.map(file => URL.createObjectURL(file));

    setSelectedPhotos(prev => [...prev, ...newPhotos]);
    setPreviewUrls(prev => [...prev, ...newUrls]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({ 
      type, 
      title, 
      description, 
      category, 
      photos: selectedPhotos,
      allowAnyoneToPost,
      allowComments
    });

    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setTitle('');
    setDescription('');
    setType('message');
    setCategory('uncategorized');
    setSelectedPhotos([]);
    setPreviewUrls([]);
    setAllowAnyoneToPost(true);
    setAllowComments(true);
    onClose();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        if (password !== confirmPassword) {
          setAuthError('Пароли не совпадают');
          setAuthLoading(false);
          return;
        }

        if (password.length < 6) {
          setAuthError('Пароль должен содержать минимум 6 символов');
          setAuthLoading(false);
          return;
        }

        if (!username.trim()) {
          setAuthError('Введите имя пользователя');
          setAuthLoading(false);
          return;
        }

        const { error } = await signUp(email, password, username);
        if (error) {
          setAuthError(error.message || 'Ошибка регистрации');
        } else {
          // Успешная регистрация
          setAuthError('');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setUsername('');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setAuthError(error.message || 'Ошибка входа');
        } else {
          // Успешный вход
          setAuthError('');
          setEmail('');
          setPassword('');
        }
      }
    } catch (error) {
      setAuthError('Произошла ошибка. Попробуйте снова.');
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
    setAuthError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
  };

  // Если пользователь не авторизован - показываем форму авторизации
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
            <h2 className="text-xl font-semibold">
              {authMode === 'signup' ? 'Регистрация' : 'Вход'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-4">
            {/* Информационное сообщение */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Добавлять посты могут только зарегистрированные пользователи. 
                Пожалуйста, войдите в систему или создайте аккаунт.
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {authError}
                </div>
              )}

              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Имя пользователя *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Введите имя"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@mail.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Пароль *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                />
              </div>

              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Подтвердите пароль *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Повторите пароль"
                    required
                    minLength={6}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Загрузка...' : (authMode === 'signup' ? 'Зарегистрироваться' : 'Войти')}
              </button>

              <button
                type="button"
                onClick={toggleAuthMode}
                className="w-full px-4 py-2 text-blue-600 hover:text-blue-700 text-sm transition"
              >
                {authMode === 'signup' ? 'У меня уже есть аккаунт' : 'Создать новый аккаунт'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Если пользователь авторизован - показываем форму создания поста
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">Создать пост</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="text-sm text-gray-600">
            Местоположение: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="message"
                  checked={type === 'message'}
                  onChange={(e) => setType(e.target.value as MarkerType)}
                  className="mr-2"
                />
                <span className="text-green-600 font-medium">Сообщение</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="group"
                  checked={type === 'group'}
                  onChange={(e) => setType(e.target.value as MarkerType)}
                  className="mr-2"
                />
                <span className="text-blue-600 font-medium">Группа</span>
              </label>
            </div>
          </div>

          {/* Опции для групп */}
          {type === 'group' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Настройки группы:</h3>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAnyoneToPost}
                  onChange={(e) => setAllowAnyoneToPost(e.target.checked)}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-blue-700">
                  Каждый может писать сообщения
                </span>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-blue-700">
                  Разрешить комментарии к постам
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Заголовок *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Введите заголовок"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Введите описание"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Категория *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Фотографии (до 6)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={selectedPhotos.length >= 6}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition flex items-center justify-center gap-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <ImageIcon size={20} />
              <div className="flex flex-col items-center">
                <span>Добавить фото</span>
                <span className="text-xs opacity-75">{selectedPhotos.length}/6 выбрано</span>
              </div>
            </button>
            {selectedPhotos.length > 0 && (
              <div className="mt-2">
                <PhotoGallery
                  photos={previewUrls}
                  onRemove={removePhoto}
                  editable
                />
                <div className="text-xs text-gray-500 mt-2 text-center">
                  {selectedPhotos.length} / 6 фото выбрано
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
