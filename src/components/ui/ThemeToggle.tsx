import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "", showLabel = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} mode`}
      title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
      className={`group relative flex items-center gap-1.5 rounded-full p-1.5 transition-all duration-200 cursor-pointer ${
        isDark 
          ? "bg-white/10 hover:bg-white/20 text-amber-300" 
          : "bg-slate-200/80 hover:bg-slate-300 text-amber-600"
      } ${className}`}
    >
      <div className="relative flex h-5 w-5 items-center justify-center">
        {isDark ? (
          <Moon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-rotate-12 text-blue-300" />
        ) : (
          <Sun className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45 text-amber-500" />
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-medium pr-1">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </button>
  );
};

export const ThemeFloatingToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? "Light" : "Dark"} mode`}
        title={`Current: ${isDark ? "Dark" : "Light"} Mode. Click to switch.`}
        className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium shadow-2xl backdrop-blur-md border transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 ${
          isDark
            ? "bg-[#0E1526]/90 border-[#1B2335] text-gray-200 hover:text-white shadow-black/80"
            : "bg-white border-slate-300 text-slate-900 hover:text-black shadow-slate-300/40"
        }`}
      >
        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
          isDark ? "bg-blue-400/10 text-blue-300" : "bg-amber-100 text-amber-600"
        }`}>
          {isDark ? (
            <Moon className="h-3.5 w-3.5" />
          ) : (
            <Sun className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-gray-200">
          {isDark ? "Dark Mode" : "Light Mode"}
        </span>
      </button>
    </div>
  );
};
