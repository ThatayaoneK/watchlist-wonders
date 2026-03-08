import { Link, useLocation } from "react-router-dom";
import { Home, Search, Plus, BarChart2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onSearchClick?: () => void;
  onAddClick?: () => void;
}

export function BottomNav({ onSearchClick, onAddClick }: BottomNavProps) {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Home */}
        <Link
          to="/dashboard"
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
            location.pathname === "/dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Search */}
        <button
          type="button"
          onClick={onSearchClick}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-medium">Search</span>
        </button>

        {/* Add — prominent center button */}
        <button
          type="button"
          onClick={onAddClick}
          className="flex flex-col items-center gap-1 -mt-4"
        >
          <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all">
            <Plus className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground mt-0.5">Add</span>
        </button>

        {/* Stats */}
        <Link
          to="/stats"
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
            location.pathname === "/stats" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Stats</span>
        </Link>

        {/* Settings */}
        <Link
          to="/settings"
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
            location.pathname === "/settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
