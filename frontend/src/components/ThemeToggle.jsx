import React from 'react';
import { useTheme } from '../contexts/useTheme';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = ({ className = '', showLabels = false }) => {
  const { theme, toggleTheme, setLightTheme, setDarkTheme } = useTheme();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabels && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Theme:
        </span>
      )}
      
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {/* Light Mode Button */}
        <button
          onClick={setLightTheme}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
            theme === 'light'
              ? 'bg-white text-yellow-500 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
          title="Light mode"
        >
          <Sun className="w-4 h-4" />
        </button>

        {/* Dark Mode Button */}
        <button
          onClick={setDarkTheme}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-gray-700 text-blue-400 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
          title="Dark mode"
        >
          <Moon className="w-4 h-4" />
        </button>
      </div>

      {showLabels && (
        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
          {theme}
        </span>
      )}
    </div>
  );
};

// Alternative compact toggle button
export const ThemeToggleButton = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  const handleToggle = () => {
    toggleTheme();
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${className}`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="relative w-5 h-5">
        <Sun
          className={`absolute inset-0 w-5 h-5 text-yellow-500 transition-all duration-300 ${
            theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'
          }`}
        />
        <Moon
          className={`absolute inset-0 w-5 h-5 text-blue-400 transition-all duration-300 ${
            theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'
          }`}
        />
      </div>
    </button>
  );
};

export default ThemeToggle;
