import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatar } from "@/hooks/useAvatar";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, LogOut, Shield, Bell, Camera, Trash2, Loader2, Globe, ExternalLink, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { bookmarkService } from "@/services/bookmarks";
import { authService } from "@/services/auth";
import { socialService } from "@/services/social";
import { fcmService } from "@/services/fcm";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { avatarUrl, uploading, uploadAvatar, deleteAvatar } = useAvatar();
  const { isSearchOpen, openSearch, closeSearch } = useSearchShortcut();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const { data: publicProfile } = useQuery({
    queryKey: ['public-profile', user?.uid],
    queryFn: () => socialService.getUserPublicProfile(user!.uid),
    enabled: !!user,
  });

  useEffect(() => {
    if (publicProfile) {
      setDisplayName(publicProfile.display_name || '');
      setBio(publicProfile.bio || '');
      if (typeof publicProfile.push_enabled === 'boolean') {
        setPushEnabled(publicProfile.push_enabled);
      }
    }
  }, [publicProfile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    const result = await uploadAvatar(file);
    if (result) {
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      });
    } else {
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAvatar = async () => {
    const success = await deleteAvatar();
    if (success) {
      toast({
        title: "Avatar removed",
        description: "Your profile picture has been removed.",
      });
    } else {
      toast({
        title: "Delete failed",
        description: "Failed to remove avatar. Please try again.",
        variant: "destructive",
      });
    }
  };
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords match.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      await authService.updatePassword(newPassword);
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Failed to update password", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    setPushLoading(true);
    try {
      if (enabled) {
        const token = await fcmService.requestPermissionAndGetToken();
        if (token) {
          setPushEnabled(true);
          toast({ title: "Push notifications enabled" });
        } else {
          toast({ title: "Permission denied", description: "Please allow notifications in your browser settings.", variant: "destructive" });
        }
      } else {
        await fcmService.disablePushNotifications();
        setPushEnabled(false);
        toast({ title: "Push notifications disabled" });
      }
    } catch (err: any) {
      toast({ title: "Failed to update notifications", description: err.message, variant: "destructive" });
    } finally {
      setPushLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await socialService.savePublicProfile({ display_name: displayName || null, bio: bio || null });
      toast({ title: "Profile saved", description: "Your public profile has been updated." });
    } catch (error: any) {
      toast({ title: "Failed to save profile", description: error.message, variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleResetViaEmail = async () => {
    if (!user?.email) return;
    try {
      await authService.resetPassword(user.email);
      toast({ title: "Reset email sent", description: "Check your inbox for a password reset link." });
    } catch (error: any) {
      toast({ title: "Failed to send reset email", description: error.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleExportCSV = () => {
    const headers = ["Title", "Type", "Provider", "Status", "Runtime (min)", "Year", "My Rating", "Notes", "Source URL", "Added"];
    const rows = bookmarks.map((b) => [
      `"${(b.title || "").replace(/"/g, '""')}"`,
      b.type,
      b.provider,
      b.status,
      b.runtime_minutes ?? "",
      b.release_year ?? "",
      b.user_rating ?? "",
      `"${(b.notes || "").replace(/"/g, '""')}"`,
      b.source_url ?? "",
      b.created_at ? new Date(b.created_at).toLocaleDateString() : "",
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchmarks-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export downloaded", description: `${bookmarks.length} bookmarks exported.` });
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/auth");
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav onSearchClick={openSearch} />
      
      <div className="pt-20 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-2xl">
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile
                </CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                    >
                      <Camera className="w-6 h-6 text-foreground" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? "Uploading..." : "Change avatar"}
                    </Button>
                    {avatarUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteAvatar}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      value={user?.email || ""} 
                      disabled 
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input
                    value={user?.uid || ""}
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Member since</Label>
                  <Input
                    value={user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preferences Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Preferences
                </CardTitle>
                <CardDescription>Customize your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive reminders for scheduled content
                    </p>
                  </div>
                  <Switch disabled />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when it's time to watch
                    </p>
                  </div>
                  <Switch
                    checked={pushEnabled}
                    onCheckedChange={handlePushToggle}
                    disabled={pushLoading || !("Notification" in window)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Public Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Public Profile
                </CardTitle>
                <CardDescription>
                  Customize how others see you when you share bookmarks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input
                      id="display-name"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell others about yourself..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {user && (
                      <a
                        href={`/u/${user.uid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View public profile
                      </a>
                    )}
                    <Button type="submit" size="sm" disabled={profileLoading}>
                      {profileLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                      ) : "Save profile"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Security Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security
                </CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Min. 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full" disabled={passwordLoading}>
                    {passwordLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</>
                    ) : "Update password"}
                  </Button>
                </form>
                <Separator />
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleResetViaEmail}>
                  Send password reset email instead
                </Button>
              </CardContent>
            </Card>

            {/* Export */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Data
                </CardTitle>
                <CardDescription>Download your watchlist as a CSV file</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={handleExportCSV} disabled={bookmarks.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV ({bookmarks.length} bookmarks)
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </CardTitle>
                <CardDescription>
                  Sign out of your account on this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Signing out..." : "Sign out"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        bookmarks={bookmarks}
      />
    </div>
  );
};

export default Settings;
