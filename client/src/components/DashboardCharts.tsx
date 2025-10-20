/**
 * Dashboard Charts Component
 * 
 * Advanced analytics and visualizations for the dashboard
 */

import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RevenueData {
  month: string;
  revenue: number;
  quotes: number;
  invoices: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface TopCustomer {
  name: string;
  revenue: number;
}

interface DashboardChartsProps {
  revenueData: RevenueData[];
  quoteStatusData: StatusData[];
  invoiceStatusData: StatusData[];
  topCustomers: TopCustomer[];
}

const COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 84%, 60%)",
  info: "hsl(199, 89%, 48%)",
};

export function DashboardCharts({
  revenueData,
  quoteStatusData,
  invoiceStatusData,
  topCustomers,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Revenue Trend Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--foreground))"
              style={{ fontSize: "12px" }}
            />
            <YAxis 
              stroke="hsl(var(--foreground))"
              style={{ fontSize: "12px" }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={COLORS.primary}
              strokeWidth={2}
              dot={{ fill: COLORS.primary, r: 4 }}
              activeDot={{ r: 6 }}
              name="Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Quote vs Invoice Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quote vs Invoice Activity</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--foreground))"
              style={{ fontSize: "12px" }}
            />
            <YAxis 
              stroke="hsl(var(--foreground))"
              style={{ fontSize: "12px" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Bar dataKey="quotes" fill={COLORS.info} name="Quotes" />
            <Bar dataKey="invoices" fill={COLORS.success} name="Invoices" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Quote Status Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quote Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={quoteStatusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {quoteStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      {/* Invoice Status Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Invoice Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={invoiceStatusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {invoiceStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      {/* Top Customers */}
      <Card className="p-6 md:col-span-2">
        <h3 className="text-lg font-semibold mb-4">Top Customers by Revenue</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topCustomers} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number" 
              stroke="hsl(var(--foreground))"
              style={{ fontSize: "12px" }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              stroke="hsl(var(--foreground))"
              style={{ fontSize: "12px" }}
              width={150}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
            />
            <Bar dataKey="revenue" fill={COLORS.primary} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/**
 * Generate sample revenue data for the last 6 months
 */
export function generateSampleRevenueData(): RevenueData[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  return months.map((month) => ({
    month,
    revenue: Math.floor(Math.random() * 50000) + 20000,
    quotes: Math.floor(Math.random() * 30) + 10,
    invoices: Math.floor(Math.random() * 25) + 5,
  }));
}

/**
 * Generate sample status data
 */
export function generateSampleStatusData(type: "quote" | "invoice"): StatusData[] {
  if (type === "quote") {
    return [
      { name: "Draft", value: 15, color: COLORS.info },
      { name: "Sent", value: 25, color: COLORS.warning },
      { name: "Approved", value: 35, color: COLORS.success },
      { name: "Rejected", value: 10, color: COLORS.danger },
    ];
  } else {
    return [
      { name: "Pending", value: 20, color: COLORS.warning },
      { name: "Paid", value: 60, color: COLORS.success },
      { name: "Overdue", value: 15, color: COLORS.danger },
      { name: "Cancelled", value: 5, color: "hsl(var(--muted))" },
    ];
  }
}

/**
 * Generate sample top customers data
 */
export function generateSampleTopCustomers(): TopCustomer[] {
  return [
    { name: "ABC Corporation", revenue: 45000 },
    { name: "XYZ Industries", revenue: 38000 },
    { name: "Smith & Co", revenue: 32000 },
    { name: "Johnson LLC", revenue: 28000 },
    { name: "Williams Inc", revenue: 25000 },
  ];
}

