import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { MarketplaceProvider } from "@/context/MarketplaceContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Navbar } from "@/components/layout/Navbar";
import { ThemeFloatingToggle } from "@/components/ui/ThemeToggle";
import { LandingPage } from "@/pages/LandingPage";
import { AISourcingPage } from "@/pages/AISourcingPage";
import { SellerHubPage } from "@/pages/SellerHubPage";
import { BuyerAgentsPage } from "@/pages/BuyerAgentsPage";
import { FalkorDBGraphPage } from "@/pages/FalkorDBGraphPage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MarketplaceProvider>
          <BrowserRouter>
          <div className="min-h-screen bg-[#F8FAFC] dark:bg-black text-slate-900 dark:text-[#E1E0CC] selection:bg-blue-600 selection:text-white dark:selection:bg-[#E1E0CC] dark:selection:text-black flex flex-col font-sans transition-colors duration-200">
            {/* Global Sticky Navigation Bar with Theme Toggle */}
            <Navbar />

            {/* Core Route Views */}
            <div className="flex-1">
              <Routes>
                {/* 01. Landing page — / (Hero, how-it-works, metrics, CTAs) */}
                <Route path="/" element={<LandingPage />} />

                {/* 02. AI Sourcing — /sourcing (Chat structure on top + products below) */}
                <Route path="/sourcing" element={<AISourcingPage />} />

                {/* 03. Seller Hub — /seller (Registered Seller Dashboard with Left Sidebar matching screenshot) */}
                <Route path="/seller" element={<SellerHubPage />} />

                {/* 04. Buyer Agents — /agents (Configure procurement preferences, budgets & permissions) */}
                <Route path="/agents" element={<BuyerAgentsPage />} />

                {/* 05. FalkorDB Graph — /graph (Explore supplier relationships, orders & Cypher queries) */}
                <Route path="/graph" element={<FalkorDBGraphPage />} />
              </Routes>
            </div>

            {/* Persistent Quick Theme Switch Option */}
            <ThemeFloatingToggle />
          </div>
        </BrowserRouter>
      </MarketplaceProvider>
    </AuthProvider>
  </ThemeProvider>
  );
}
