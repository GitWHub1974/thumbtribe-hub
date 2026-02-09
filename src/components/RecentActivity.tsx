import { cn } from "@/lib/utils";

const activities = [
  {
    initials: "JD",
    name: "John Doe",
    action: "completed onboarding",
    time: "2 min ago",
    color: "bg-success/10 text-success",
  },
  {
    initials: "MK",
    name: "Maria Kim",
    action: "submitted a new project brief",
    time: "15 min ago",
    color: "bg-chart-2/10 text-chart-2",
  },
  {
    initials: "TP",
    name: "Tom Park",
    action: "scheduled a follow-up call",
    time: "1 hour ago",
    color: "bg-chart-4/10 text-chart-4",
  },
  {
    initials: "AL",
    name: "Amy Lin",
    action: "updated billing information",
    time: "3 hours ago",
    color: "bg-warning/10 text-warning",
  },
  {
    initials: "RJ",
    name: "Raj Joshi",
    action: "left a 5-star review",
    time: "5 hours ago",
    color: "bg-primary/10 text-primary",
  },
];

const RecentActivity = () => {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <h3 className="font-heading font-semibold text-card-foreground mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0", activity.color)}>
              {activity.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-card-foreground">
                <span className="font-semibold">{activity.name}</span>{" "}
                <span className="text-muted-foreground">{activity.action}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;
