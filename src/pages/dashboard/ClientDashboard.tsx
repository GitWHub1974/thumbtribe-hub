import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const ClientDashboard = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-heading font-bold text-sm">T</span>
          </div>
          <h1 className="text-xl font-heading font-bold text-foreground">Client Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>
      <main className="p-8">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-2">
            Client portal ready
          </h2>
          <p className="text-muted-foreground">
            Project selector, Gantt chart, and time tracking will be built in Phase 2.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ClientDashboard;
