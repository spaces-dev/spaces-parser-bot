import type { User } from '../types';
import { clearCookies } from '../utils/storage';

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const handleLogout = () => {
    clearCookies();
    onLogout();
  };

  return (
    <div className="w-64 bg-dark-surface bg-opacity-50 backdrop-blur-sm border-r border-dark-border p-6 min-h-screen flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Spcs Backup</h1>
      </div>
      
      <div className="flex-1 space-y-6">
        {user ? (
          <>
            <div className="text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center overflow-hidden bg-gray-700 border-2 border-gray-600">
                {user.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.username}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.avatar-placeholder')) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'avatar-placeholder w-full h-full flex items-center justify-center bg-gray-600';
                        placeholder.innerHTML = '<svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-600">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="text-white font-semibold text-lg">{user.username}</h3>
              <p className="text-gray-400 text-sm mt-1">
                {user.isCurrentUser ? 'Ваш аккаунт' : 'Другой пользователь'}
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
            >
              Выйти
            </button>
          </>
        ) : (
          <div className="text-center text-gray-400">
            <p className="text-sm">Не авторизован</p>
          </div>
        )}
      </div>
    </div>
  );
}

