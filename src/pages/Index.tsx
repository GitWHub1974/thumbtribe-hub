import { Users, TrendingUp, DollarSign, Target } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import EngagementChart from "@/components/EngagementChart";
import RecentActivity from "@/components/RecentActivity";

const stats = [
  { title: "Total Clients", value: "1,284", change: "+12.5% from last month", changeType: "positive" as const, icon: Users },
  { title: "Active Campaigns", value: "42", change: "+3 new this week", changeType: "positive" as const, icon: Target },
  { title: "Revenue", value: "$84.2K", change: "+8.1% from last month", changeType: "positive" as const, icon: DollarSign },
  { title: "Engagement Rate", value: "67.4%", change: "-2.3% from last month", changeType: "negative" as const, icon: TrendingUp },
];

const Index = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {stats.map((stat, i) => (
              <StatCard key={stat.title} {...stat} index={i} />
            ))}
          </div>

          {/* Chart + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <EngagementChart />
            </div>
            <RecentActivity />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
