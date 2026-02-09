import { Bell, Search } from "lucide-react";

const DashboardHeader = () => {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back, Sarah</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm rounded-lg bg-muted border-none outline-none focus:ring-2 focus:ring-primary/30 w-56 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">SC</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
