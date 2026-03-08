import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, Calendar, Plus, Sparkles, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatar } from "@/hooks/useAvatar";
import { useToast } from "@/hooks/use-toast";
import { useWatchStreak } from "@/hooks/useWatchStreak";
import { QuickAddBar } from "@/components/QuickAddBar";
import { BottomNav } from "@/components/layout/BottomNav";

interface TopNavProps {
  notificationCount?: number;
  onSearchClick?: () => void;
}

export function TopNav({ notificationCount = 0, onSearchClick }: TopNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { avatarUrl } = useAvatar();
  const { streak } = useWatchStreak();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed out", description: "You have been successfully signed out." });
      navigate("/auth");
    } catch {
      toast({ title: "Error signing out", description: "Something went wrong.", variant: "destructive" });
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/dashboard",  label: "Home" },
    { href: "/tonight",    label: "Tonight", icon: Sparkles },
    { href: "/plans",      label: "Plans" },
    { href: "/calendar",   label: "Calendar", icon: Calendar },
  ];

  const handleMobileAdd = () => {
    navigate("/new");
  };

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-background/95 backdrop-blur-md border-b border-border"
            : "bg-gradient-to-b from-background to-transparent"
        )}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">W</span>
              <span className="text-xl font-semibold hidden sm:inline">WatchMarks</span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-foreground",
                    location.pathname === link.href ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {link.icon && <link.icon className="w-4 h-4" />}
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <Button
                variant="ghost"
                onClick={onSearchClick}
                className="text-muted-foreground hover:text-foreground gap-2"
                aria-label="Search (⌘K)"
              >
                <Search className="w-5 h-5" />
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>

              {/* Add button — desktop: popover with QuickAddBar */}
              <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="default" size="sm" className="hidden sm:flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 p-4" sideOffset={8}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Quick Add</p>
                      <button
                        type="button"
                        onClick={() => setAddPopoverOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close add popover"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <QuickAddBar />
                    <div className="text-center pt-1">
                      <Link
                        to="/new"
                        onClick={() => setAddPopoverOpen(false)}
                        className="text-xs text-primary hover:underline"
                      >
                        Open full add page →
                      </Link>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Streak indicator */}
              {user && streak >= 2 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-orange-500 font-bold px-2 hover:text-orange-400"
                      aria-label={`${streak} day watch streak`}
                    >
                      🔥 {streak}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-4">
                    <p className="font-semibold text-sm mb-1">🔥 {streak}-day streak!</p>
                    <p className="text-xs text-muted-foreground">
                      You've watched something {streak} days in a row. Keep it up!
                    </p>
                    <Link to="/stats" className="text-xs text-primary hover:underline block mt-3">
                      View your stats →
                    </Link>
                  </PopoverContent>
                </Popover>
              )}

              {/* Notifications */}
              <Link to="/notifications" className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={notificationCount > 0 ? `${notificationCount} unread notifications` : "Notifications"}
                >
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </Button>
              </Link>

              {/* Avatar + Sign out */}
              {user ? (
                <div className="flex items-center gap-2">
                  <Link to="/settings">
                    <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {user.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="text-muted-foreground hover:text-foreground hidden md:flex"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Link to="/auth">
                  <Button variant="secondary" size="sm">Sign In</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      {user && (
        <BottomNav
          onSearchClick={onSearchClick}
          onAddClick={handleMobileAdd}
        />
      )}
    </>
  );
}
