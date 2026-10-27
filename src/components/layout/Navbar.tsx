import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthNavControls } from "./AuthNavControls";

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const navItems = [
    { label: "Landing", path: "/" },
    { label: "Sourcing", path: "/sourcing" },
    { label: "Seller Hub", path: "/seller" },
    { label: "Buyer Agents", path: "/agents" },
    { label: "FalkorDB Graph", path: "/graph" },
    { label: "Workflow", targetId: "how-it-works" },
  ];

  const handleNavClick = (item: { label: string; path?: string; targetId?: string }) => {
    if (item.path) {
      navigate(item.path);
    } else if (item.targetId) {
      if (location.pathname === "/") {
        const el = document.getElementById(item.targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        navigate("/");
        setTimeout(() => {
          const el = document.getElementById(item.targetId!);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 120);
      }
    }
  };

  return (
    <nav className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
      <div 
        className={`flex items-center gap-2 rounded-full border backdrop-blur-xl px-3.5 py-1.5 sm:gap-4 md:gap-6 md:px-6 transition-all duration-300 ${
          isDark
            ? "border-white/10 bg-black/85 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-[#E1E0CC]"
            : "border-slate-200/90 bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.08)] text-slate-800"
        }`}
      >
        {navItems.map((item) => {
          const isActive = item.path && location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => handleNavClick(item)}
              className={`text-[10px] sm:text-xs md:text-sm font-medium transition-colors cursor-pointer rounded-full px-2 py-1 ${
                isActive
                  ? isDark 
                    ? "text-[#E1E0CC] font-bold bg-white/5" 
                    : "text-blue-600 font-bold bg-blue-50"
                  : isDark
                    ? "text-[#E1E0CC]/70 hover:text-[#E1E0CC]"
                    : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}

        {/* Auth Role / Google Login Controls */}
        <div className={`h-4 w-[1px] ${isDark ? "bg-white/15" : "bg-slate-300"}`} />
        <AuthNavControls />

        {/* Separator & Theme Toggle */}
        <div className={`h-4 w-[1px] ${isDark ? "bg-white/15" : "bg-slate-300"}`} />
        <ThemeToggle />
      </div>
    </nav>
  );
};

