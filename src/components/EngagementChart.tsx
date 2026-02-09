import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", clients: 42, revenue: 24 },
  { month: "Feb", clients: 53, revenue: 32 },
  { month: "Mar", clients: 61, revenue: 38 },
  { month: "Apr", clients: 58, revenue: 41 },
  { month: "May", clients: 72, revenue: 48 },
  { month: "Jun", clients: 85, revenue: 55 },
  { month: "Jul", clients: 94, revenue: 62 },
];

const EngagementChart = () => {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: "320ms" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-heading font-semibold text-card-foreground">Client Engagement</h3>
          <p className="text-sm text-muted-foreground mt-1">Active clients & revenue over time</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Clients</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-chart-2" />
            <span className="text-muted-foreground">Revenue</span>
          </div>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(220, 13%, 91%)",
                borderRadius: "0.75rem",
                fontSize: "0.875rem",
              }}
            />
            <Area type="monotone" dataKey="clients" stroke="hsl(25, 95%, 53%)" fillOpacity={1} fill="url(#colorClients)" strokeWidth={2} />
            <Area type="monotone" dataKey="revenue" stroke="hsl(200, 80%, 50%)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EngagementChart;
