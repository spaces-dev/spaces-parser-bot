import type { SaveMode } from '../types';

interface SaveModeSelectorProps {
  mode: SaveMode;
  onChange: (mode: SaveMode) => void;
  disabled?: boolean;
}

export function SaveModeSelector({ mode, onChange, disabled }: SaveModeSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white">Режим сохранения</h3>
      <div className="grid grid-cols-2 gap-3">
        <label
          className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
            mode === 'structure'
              ? 'bg-blue-500 bg-opacity-20 border-blue-500'
              : 'bg-dark-hover border-dark-border hover:border-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="saveMode"
            value="structure"
            checked={mode === 'structure'}
            onChange={() => onChange('structure')}
            disabled={disabled}
            className="mb-2"
          />
          <div className="text-white font-medium">Структура папок</div>
          <div className="text-sm text-gray-400">Сохраняет папки и подпапки</div>
        </label>
        
        <label
          className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
            mode === 'flat'
              ? 'bg-blue-500 bg-opacity-20 border-blue-500'
              : 'bg-dark-hover border-dark-border hover:border-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="saveMode"
            value="flat"
            checked={mode === 'flat'}
            onChange={() => onChange('flat')}
            disabled={disabled}
            className="mb-2"
          />
          <div className="text-white font-medium">Все файлы</div>
          <div className="text-sm text-gray-400">Все файлы в одну папку</div>
        </label>
      </div>
    </div>
  );
}

