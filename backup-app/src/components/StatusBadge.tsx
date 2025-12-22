import type { BackupStatus } from '../types';

interface StatusBadgeProps {
  status: BackupStatus;
}

const statusConfig: Record<BackupStatus, { label: string; bgColor: string; dotColor: string; textColor: string }> = {
  idle: { label: 'Ожидание', bgColor: 'bg-gray-500', dotColor: 'bg-gray-500', textColor: 'text-gray-300' },
  loading: { label: 'Загрузка', bgColor: 'bg-blue-500', dotColor: 'bg-blue-500', textColor: 'text-blue-300' },
  scanning: { label: 'Сканирование', bgColor: 'bg-blue-500', dotColor: 'bg-blue-500', textColor: 'text-blue-300' },
  downloading: { label: 'Скачивание', bgColor: 'bg-green-500', dotColor: 'bg-green-500', textColor: 'text-green-300' },
  saving: { label: 'Сохранение', bgColor: 'bg-purple-500', dotColor: 'bg-purple-500', textColor: 'text-purple-300' },
  completed: { label: 'Завершено', bgColor: 'bg-green-600', dotColor: 'bg-green-600', textColor: 'text-green-300' },
  error: { label: 'Ошибка', bgColor: 'bg-red-500', dotColor: 'bg-red-500', textColor: 'text-red-300' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} bg-opacity-20 ${config.textColor}`}>
      <div className={`w-2 h-2 rounded-full ${config.dotColor} mr-2`} />
      {config.label}
    </div>
  );
}

