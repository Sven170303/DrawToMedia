import React from 'react';
import { Language, User, ViewState } from '../types';
import { TRANSLATIONS } from '../constants';
import { Globe, LogOut, Coins, History, PlusSquare } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  lang: Language;
  setLang: (l: Language) => void;
  setView: (v: ViewState) => void;
  onLogout: () => void;
  currentView: ViewState;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  lang, 
  setLang, 
  setView, 
  onLogout,
  currentView
}) => {
  const t = (key: string) => TRANSLATIONS[key][lang];

  return (
    <nav className="border-b-2 border-black bg-white/80 backdrop-blur-sm sticky top-0 z-50 px-4 py-3 flex justify-between items-center">
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => setView(user ? ViewState.GENERATE : ViewState.HOME)}
      >
        <div className="w-8 h-8 bg-black rounded-full text-white flex items-center justify-center font-serif text-xl">D</div>
        <h1 className="font-serif text-xl md:text-2xl font-bold tracking-tight hidden sm:block">
          {t('appTitle')}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Language Selector */}
        <div className="relative group">
            <button className="flex items-center gap-1 font-sans font-bold text-sm border-2 border-black px-2 py-1 rounded bg-paper hover:bg-gray-100">
                <Globe size={16} />
                {lang.toUpperCase()}
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-white border-2 border-black rounded shadow-lg min-w-[80px]">
                {(['en', 'de', 'fr'] as Language[]).map((l) => (
                    <button 
                        key={l}
                        onClick={() => setLang(l)}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 font-sans ${lang === l ? 'font-bold bg-gray-50' : ''}`}
                    >
                        {l.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>

        {user && (
            <>
                <div 
                  className="flex items-center gap-1 font-sans font-bold text-sm cursor-pointer hover:text-pencil-blue"
                  onClick={() => setView(ViewState.CREDITS)}
                >
                    <Coins size={16} className="text-yellow-600" />
                    <span>{user.credits}</span>
                </div>

                <div className="hidden md:flex gap-2">
                   <button 
                    onClick={() => setView(ViewState.GENERATE)}
                    className={`p-2 rounded hover:bg-gray-100 ${currentView === ViewState.GENERATE ? 'bg-gray-200' : ''}`}
                    title={t('generate')}
                   >
                     <PlusSquare size={20} />
                   </button>
                   <button 
                    onClick={() => setView(ViewState.HISTORY)}
                    className={`p-2 rounded hover:bg-gray-100 ${currentView === ViewState.HISTORY ? 'bg-gray-200' : ''}`}
                    title={t('history')}
                   >
                     <History size={20} />
                   </button>
                </div>

                <button onClick={onLogout} className="text-red-500 hover:text-red-700" title={t('logout')}>
                    <LogOut size={20} />
                </button>
            </>
        )}
      </div>
    </nav>
  );
};