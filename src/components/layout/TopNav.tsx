import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, X, ChevronDown, Sparkles, Loader2, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatar } from "@/hooks/useAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TopNavProps {
  notificationCount?: number;
  onSearchClick?: () => void;
  leftContent?: React.ReactNode;
  vaultedCount?: number;
}

const primaryLinks: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/library", label: "Library", exact: true },
  { href: "/tonight", label: "Tonight" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

const moreLinks: Array<{ href: string; label: string }> = [];

export function TopNav({ notificationCount = 0, onSearchClick, leftContent, vaultedCount = 0 }: TopNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();
  const { avatarUrl } = useAvatar();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    let activeTarget: Window | HTMLElement | null = null;

    const getScrollTarget = (): Window | HTMLElement => {
      const scrollContainer = document.getElementById("main-scroll-container");
      const canUseContainerScroll =
        !!scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 1;
      return canUseContainerScroll ? scrollContainer : window;
    };

    const handleScroll = () => {
      const target = activeTarget ?? getScrollTarget();
      const scrollY = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      setScrolled(scrollY > 24);
    };

    const rebindScrollTarget = () => {
      const nextTarget = getScrollTarget();
      if (activeTarget !== nextTarget) {
        if (activeTarget) activeTarget.removeEventListener("scroll", handleScroll);
        activeTarget = nextTarget;
        activeTarget.addEventListener("scroll", handleScroll, { passive: true });
      }
      handleScroll();
    };

    rebindScrollTarget();
    window.addEventListener("resize", rebindScrollTarget);
    return () => {
      if (activeTarget) activeTarget.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", rebindScrollTarget);
    };
  }, []);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast({ title: "Signed out", description: "You have been successfully signed out." });
      navigate("/auth");
    } catch {
      toast({ title: "Error signing out", variant: "destructive" });
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSearchIconClick = () => {
    if (onSearchClick) {
      onSearchClick();
      return;
    }
    setSearchExpanded((v) => !v);
    if (!searchExpanded) setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const openPickForMe = () => navigate("/tonight");

  return (
    <>
      <nav
        aria-label="Site navigation"
        className={cn(
          "fixed top-0 inset-x-0 z-50 h-[72px] transition-all duration-500",
          "animate-in fade-in slide-in-from-top-2 duration-500",
          scrolled
            ? "bg-black/40 supports-[backdrop-filter]:bg-black/30 backdrop-blur-2xl border-b border-white/[0.05] shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
            : "bg-gradient-to-b from-black/70 via-black/20 to-transparent"
        )}
      >
        <div className="flex items-center h-full px-4 md:px-8 lg:px-12 gap-2">

          {/* Logo */}
          <Link
            to="/library"
            className="shrink-0 flex items-center gap-2 mr-2 md:mr-4 lg:mr-6 group"
          >
            <span className="text-[#C8A96B] font-black text-[1.7rem] leading-none tracking-tight">W</span>
            <div className="hidden sm:flex flex-col gap-0.5">
              <span className="text-white font-semibold text-base tracking-tight leading-none">WatchMarks</span>
              <div className="h-px w-full bg-[#C8A96B] opacity-50 transition-opacity duration-300 group-hover:opacity-80" />
            </div>
          </Link>

          {/* Desktop primary nav */}
          <nav className="hidden md:flex items-center h-full" aria-label="Primary navigation">
            {primaryLinks.map((link) => {
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center px-4 h-full text-sm font-medium transition-colors duration-200",
                    "after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px]",
                    "after:rounded-full after:transition-opacity after:duration-200",
                    active
                      ? "text-white after:bg-[#C8A96B] after:opacity-100"
                      : "text-white/55 hover:text-white after:opacity-0"
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {link.label}
                    {link.href === "/vault" && vaultedCount > 0 && (
                      <span className="rounded-full bg-[#C8A96B] px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
                        {vaultedCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}

            {moreLinks.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-4 h-full text-sm font-medium text-white/45 hover:text-white transition-colors duration-200"
                    aria-label="More pages"
                  >
                    More <ChevronDown className="w-3.5 h-3.5 mt-px" />
                    {notificationCount > 0 && (
                      <span className="ml-0.5 rounded-full bg-[#C8A96B] w-1.5 h-1.5 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="bg-[#111114]/95 border-white/[0.06] backdrop-blur-2xl w-52"
                >
                  {moreLinks.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link
                          to={link.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "w-full text-sm flex items-center justify-between",
                            active ? "text-white font-medium" : "text-white/65"
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {link.label}
                            {link.href === "/notifications" && notificationCount > 0 && (
                              <span className="rounded-full bg-[#C8A96B] px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
                                {notificationCount > 99 ? "99+" : notificationCount}
                              </span>
                            )}
                          </span>
                          {active && <Check className="w-3.5 h-3.5 text-[#C8A96B] shrink-0" aria-hidden="true" />}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Flexible spacer / optional injected content */}
          <div className="flex-1 min-w-0">{leftContent}</div>

          {/* Desktop utility actions */}
          <div className="hidden md:flex items-center gap-1.5">
            {/* Search */}
            {searchExpanded && !onSearchClick ? (
              <div className="flex items-center gap-2 bg-black/50 border border-white/[0.08] rounded-full px-4 py-2 backdrop-blur-2xl">
                <Search className="w-4 h-4 text-white/50 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Titles, people, genres"
                  className="bg-transparent text-white text-sm w-40 outline-none placeholder:text-white/30"
                  onKeyDown={(e) => { if (e.key === "Escape") setSearchExpanded(false); }}
                />
                <button
                  type="button"
                  onClick={() => setSearchExpanded(false)}
                  aria-label="Close search"
                  className="text-white/50 hover:text-white flex items-center justify-center min-w-[20px] min-h-[20px]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSearchIconClick}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-white/[0.06] bg-white/[0.03] text-white/60 backdrop-blur-xl transition-all duration-200 hover:bg-white/[0.07] hover:text-white"
                aria-label="Search (Ctrl+K)"
              >
                <Search className="w-[18px] h-[18px]" />
              </button>
            )}

            {/* Pick for Me */}
            <Button
              type="button"
              onClick={openPickForMe}
              className="h-9 px-5 text-sm font-semibold rounded-full"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Pick for Me
            </Button>

            {/* Add */}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/new")}
              className="h-9 px-4 text-sm font-semibold rounded-full border-white/10 text-white hover:text-white hover:bg-white/[0.07]"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add
            </Button>

            {/* Avatar / account */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2.5 h-10 pl-1 pr-4 rounded-full border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl transition-all duration-200 hover:bg-white/[0.07] group ml-1"
                    aria-label="Account menu"
                  >
                    <Avatar className="h-7 w-7 cursor-pointer rounded-full ring-1 ring-white/10 group-hover:ring-white/20 transition-all duration-200">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-[#C8A96B]/20 text-[#C8A96B] text-xs rounded-full font-semibold">
                        {user.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:block text-[13px] text-white/70 group-hover:text-white transition-colors duration-200">
                      Account
                    </span>
                    <ChevronDown className="w-3 h-3 text-white/35 group-hover:text-white/60 transition-all duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#111114]/95 border-white/[0.06] backdrop-blur-2xl">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="text-white/75 hover:text-white cursor-pointer">
                      Account & Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="text-white/45 hover:text-white cursor-pointer"
                  >
                    {isSigningOut ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Signing out...
                      </>
                    ) : (
                      "Sign Out"
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm" className="rounded-full">Sign In</Button>
              </Link>
            )}
          </div>

          {/* Mobile utility */}
          <div className="md:hidden flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openPickForMe}
              className="h-8 px-3 text-xs font-semibold rounded-full"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Pick
            </Button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center" aria-label="Account menu">
                    <Avatar className="h-7 w-7 cursor-pointer rounded-full ring-1 ring-white/10">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-[#C8A96B]/20 text-[#C8A96B] text-xs rounded-full font-semibold">
                        {user.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-[#111114]/95 border-white/[0.06] backdrop-blur-2xl">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="text-white/75 hover:text-white cursor-pointer">
                      Account & Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="text-white/45 hover:text-white cursor-pointer"
                  >
                    {isSigningOut ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Signing out...
                      </>
                    ) : (
                      "Sign Out"
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      {user && (
        <BottomNav onSearchClick={onSearchClick} onAddClick={() => navigate("/new")} />
      )}
    </>
  );
}
