import { Bell, LogOut, Shield, User } from "lucide-react";

type Props = {
  notificationCount?: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
};

export function AdminHeader({
  notificationCount = 0,
  onOpenNotifications,
  onOpenProfile,
  onLogout,
}: Props) {
  return (
    <header className="bg-[#01411C] text-white shadow-md">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-semibold">Admin Dashboard</h1>
              <p className="text-sm text-green-100">LawFlow Management Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenNotifications}
              className="text-white hover:bg-white/10 relative rounded-lg p-2"
              type="button"
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenProfile}
              className="text-white hover:bg-white/10 rounded-lg p-2"
              type="button"
            >
              <User className="h-5 w-5" />
            </button>

            <button
              onClick={onLogout}
              className="text-white hover:bg-white/10 rounded-lg p-2"
              type="button"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
