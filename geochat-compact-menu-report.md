# Компактное меню с переключателем дизайна - GeoChat

## Выполненные изменения

### 1. Создан переключатель версий дизайна
- Добавлена константа `DESIGN_VERSION` в `ChatPage.tsx`
- Созданы функции для управления стилями:
  - `getHeaderStyles()` - стили шапки
  - `getPostContainerStyles()` - стили контейнера поста
  - `getInputContainerStyles()` - стили поля ввода
  - `getTopPadding()` - отступ сверху

### 2. Компактный дизайн (текущий)
- **Шапка чата:** `py-1.5` вместо `py-3`
- **Поле ввода:** `py-2` вместо `py-3`
- **Контейнер поста:** `py-1.5` вместо `py-3`
- **Предпросмотр фотографий:** `py-1.5` вместо `py-2`
- **Общий отступ сверху:** `pt-2.5` для небольшого зазора

### 3. Оригинальный дизайн (для возврата)
- Все отступы восстановлены к исходным значениям
- Убран отступ сверху (`pt-0`)

## Как переключиться обратно

В файле `src/components/ChatPage.tsx` измените строку:

```typescript
const DESIGN_VERSION = 'compact' as 'compact' | 'old';  // Текущий компактный
```

На:

```typescript
const DESIGN_VERSION = 'old' as 'compact' | 'old';     // Возврат к оригиналу
```

## Подробные изменения в коде

### Функции стилей:
```typescript
const getHeaderStyles = () => {
  if (DESIGN_VERSION === 'old') {
    return 'px-4 py-3'; // Старый дизайн
  }
  return 'px-4 py-1.5'; // Компактный дизайн (новый)
};
```

### Применение стилей:
- Шапка: `<div className={`bg-white border-b ${getHeaderStyles()} flex items-center gap-3 flex-shrink-0 relative z-50`}>`
- Поле ввода: `<div className={`bg-white border-t ${getInputContainerStyles()} flex-shrink-0`}>`
- Контейнер поста: `<button className={`w-full ${getPostContainerStyles()} flex items-center gap-3 hover:bg-blue-100 transition`}>`

## Результат
- **Новый URL:** https://wfdnundh26p4.space.minimax.io
- Меню сдвинуто ближе к верху экрана
- Уменьшены отступы для более компактного вида
- Сохранена возможность легко вернуться к оригинальному дизайну
- Добавлена подробная документация по переключению

## Файлы
- **Основной файл:** `src/components/ChatPage.tsx`
- **Инструкции:** `design-switcher-instructions.md`

Дата изменения: 2025-11-17 02:02:38
