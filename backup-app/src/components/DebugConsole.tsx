import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { logger, type LogEntry } from '../utils/logger';

interface DebugConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebugConsole({ isOpen, onClose }: DebugConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<LogEntry['level'] | 'all'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 1024, height: 640 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const savedPosition = localStorage.getItem('debugConsole_position');
    const savedSize = localStorage.getItem('debugConsole_size');
    
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch {}
    }
    
    if (savedSize) {
      try {
        setSize(JSON.parse(savedSize));
      } catch {}
    }

    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });

    setLogs(logger.getLogs());

    return unsubscribe;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && (position.x !== 0 || position.y !== 0)) {
      localStorage.setItem('debugConsole_position', JSON.stringify(position));
    }
  }, [position, isOpen]);

  useEffect(() => {
    if (isOpen) {
      localStorage.setItem('debugConsole_size', JSON.stringify(size));
    }
  }, [size, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = position.x + (e.clientX - dragStart.x);
        const newY = position.y + (e.clientY - dragStart.y);
        setPosition({ x: newX, y: newY });
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(400, resizeStart.width + deltaX);
        const newHeight = Math.max(300, resizeStart.height + deltaY);
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, position, dragStart, resizeStart, size, isOpen]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height });
  };

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const filteredLogs = logs.filter(log => {
    const matchesText = filter === '' || log.message.toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesText && matchesLevel;
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour12: false });
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLevelBg = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'bg-red-500 bg-opacity-10';
      case 'warn':
        return 'bg-yellow-500 bg-opacity-10';
      case 'info':
        return 'bg-blue-500 bg-opacity-10';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div
        ref={containerRef}
        className="bg-dark-surface border border-dark-border rounded-lg flex flex-col shadow-2xl pointer-events-auto"
        style={{
          position: 'absolute',
          left: position.x || '50%',
          top: position.y || '50%',
          transform: position.x || position.y ? 'none' : 'translate(-50%, -50%)',
          width: `${size.width}px`,
          height: `${size.height}px`,
          maxWidth: '95vw',
          maxHeight: '95vh',
        }}
      >
        <div
          className="flex items-center justify-between p-4 border-b border-dark-border cursor-move select-none"
          onMouseDown={handleDragStart}
        >
          <h2 className="text-xl font-semibold text-white">Debug Console</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => logger.clear()}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Очистить
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-dark-border flex gap-2">
          <input
            type="text"
            placeholder="Поиск в логах..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-3 py-2 bg-dark-hover border border-dark-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LogEntry['level'] | 'all')}
            className="px-3 py-2 bg-dark-hover border border-dark-border rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              {logs.length === 0 ? 'Логи отсутствуют' : 'Нет логов, соответствующих фильтрам'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded ${getLevelBg(log.level)} hover:bg-dark-hover transition-colors`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 flex-shrink-0">
                      {formatTime(log.timestamp)}
                    </span>
                    <span className={`flex-shrink-0 font-semibold ${getLevelColor(log.level)}`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-gray-300 flex-1 break-words">
                      {log.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-dark-border text-xs text-gray-500 text-center">
          Всего логов: {logs.length} | Отфильтровано: {filteredLogs.length}
        </div>
        
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[12px] border-l-transparent border-b-[12px] border-b-gray-600 group-hover:border-b-gray-500 transition-colors" />
          <div className="absolute bottom-1 right-1 w-0 h-0 border-l-[8px] border-l-transparent border-b-[8px] border-b-gray-700 group-hover:border-b-gray-600 transition-colors" />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

