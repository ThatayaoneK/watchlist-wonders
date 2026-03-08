import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import PageTransition from "@/components/layout/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationListenerMount } from "@/hooks/useNotificationListener";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const NewBookmark = lazy(() => import("./pages/NewBookmark"));
const TonightPick = lazy(() => import("./pages/TonightPick"));
const Plans = lazy(() => import("./pages/Plans"));
const PlanDetail = lazy(() => import("./pages/PlanDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Calendar = lazy(() => import("./pages/Calendar"));
const BookmarkDetail = lazy(() => import("./pages/BookmarkDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const ShareView = lazy(() => import("./pages/ShareView"));
const Stats = lazy(() => import("./pages/Stats"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <NotificationListenerMount />
          <div className="dark">
            <PageTransition>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                  <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  {/* Public routes */}
                  <Route path="/u/:uid" element={<ErrorBoundary><PublicProfile /></ErrorBoundary>} />
                  <Route path="/share/:token" element={<ErrorBoundary><ShareView /></ErrorBoundary>} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                    <Route path="/new" element={<ErrorBoundary><NewBookmark /></ErrorBoundary>} />
                    <Route path="/tonight" element={<ErrorBoundary><TonightPick /></ErrorBoundary>} />
                    <Route path="/plans" element={<ErrorBoundary><Plans /></ErrorBoundary>} />
                    <Route path="/plans/:id" element={<ErrorBoundary><PlanDetail /></ErrorBoundary>} />
                    <Route path="/notifications" element={<ErrorBoundary><Notifications /></ErrorBoundary>} />
                    <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
                    <Route path="/b/:id" element={<ErrorBoundary><BookmarkDetail /></ErrorBoundary>} />
                    <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                    <Route path="/stats" element={<ErrorBoundary><Stats /></ErrorBoundary>} />
                  </Route>
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
                </Routes>
              </Suspense>
            </PageTransition>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
