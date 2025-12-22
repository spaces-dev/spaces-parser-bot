import type { UserSection } from '../types';

interface SectionSelectorProps {
  sections: UserSection[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function SectionSelector({ sections, selected, onChange, disabled }: SectionSelectorProps) {
  const toggleSection = (id: string) => {
    if (disabled) return;
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const toggleAll = () => {
    if (disabled) return;
    if (selected.length === sections.length) {
      onChange([]);
    } else {
      onChange(sections.map(s => s.id));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Выберите разделы для бэкапа</h3>
        <button
          onClick={toggleAll}
          disabled={disabled}
          className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {selected.length === sections.length ? 'Снять все' : 'Выбрать все'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map(section => (
          <label
            key={section.id}
            className={`flex items-center p-4 rounded-lg border cursor-pointer transition-colors ${
              selected.includes(section.id)
                ? 'bg-blue-500 bg-opacity-20 border-blue-500'
                : 'bg-dark-hover border-dark-border hover:border-gray-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(section.id)}
              onChange={() => toggleSection(section.id)}
              disabled={disabled}
              className="w-4 h-4 text-blue-600 bg-dark-surface border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <div className="ml-3 flex-1">
              <div className="text-white font-medium">{section.name}</div>
              <div className="text-sm text-gray-400">
                {section.count > 0 ? `${section.count} элементов` : 'Нет данных'}
              </div>
            </div>
          </label>
        ))}
      </div>
      
      {sections.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Разделы не найдены. Проверьте cookies и URL.
        </div>
      )}
    </div>
  );
}

