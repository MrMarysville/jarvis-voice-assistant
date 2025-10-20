import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

export default function Calendar() {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: invoices = [] } = trpc.invoices.list.useQuery();
  const { data: tasks = [] } = trpc.tasks.list.useQuery();

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isToday = (day: number) => {
    return day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear();
  };

  // Get items for a specific date
  const getItemsForDate = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    
    const dayInvoices = invoices.filter(inv => {
      if (!inv.productionDueDate) return false;
      const invDate = new Date(inv.productionDueDate).toISOString().split('T')[0];
      return invDate === dateStr;
    });

    const dayTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate).toISOString().split('T')[0];
      return taskDate === dateStr;
    });

    return { invoices: dayInvoices, tasks: dayTasks };
  };

  // Generate calendar days
  const calendarDays = [];
  
  // Empty cells before first day
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="min-h-32 border border-border bg-muted/20" />);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const { invoices: dayInvoices, tasks: dayTasks } = getItemsForDate(day);
    const hasItems = dayInvoices.length > 0 || dayTasks.length > 0;

    calendarDays.push(
      <div
        key={day}
        className={`min-h-32 border border-border p-2 ${
          isToday(day) ? "bg-primary/10 border-primary" : "bg-background"
        } ${hasItems ? "cursor-pointer hover:bg-muted/50" : ""}`}
        onClick={() => hasItems && setLocation(`/calendar/${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
      >
        <div className={`text-sm font-semibold mb-2 ${isToday(day) ? "text-primary" : ""}`}>
          {day}
        </div>
        <div className="space-y-1">
          {dayInvoices.slice(0, 2).map((inv) => (
            <div
              key={inv.id}
              className="text-xs p-1 rounded bg-blue-500/10 border border-blue-500/20 truncate"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/invoices/${inv.id}`);
              }}
            >
              <Badge className="status-in-production text-xs mr-1">INV</Badge>
              {inv.invoiceNumber}
            </div>
          ))}
          {dayTasks.slice(0, 2).map((task) => (
            <div
              key={task.id}
              className="text-xs p-1 rounded bg-orange-500/10 border border-orange-500/20 truncate"
            >
              <Badge className="status-pending text-xs mr-1">TASK</Badge>
              {task.name}
            </div>
          ))}
          {(dayInvoices.length + dayTasks.length > 2) && (
            <div className="text-xs text-muted-foreground">
              +{dayInvoices.length + dayTasks.length - 2} more
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Calendar</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-48 text-center">
              {monthNames[month]} {year}
            </div>
            <Button variant="outline" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCurrentDate(new Date())}>Today</Button>
          </div>
        </div>

        {/* Legend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/40" />
                <span className="text-sm">Invoices/Orders</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500/40" />
                <span className="text-sm">Tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary/20 border border-primary" />
                <span className="text-sm">Today</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="p-3 text-center text-sm font-semibold bg-muted/50"
                >
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Items */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invoices
                  .filter(inv => inv.productionDueDate && new Date(inv.productionDueDate) >= today)
                  .sort((a, b) => new Date(a.productionDueDate!).getTime() - new Date(b.productionDueDate!).getTime())
                  .slice(0, 5)
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted/50"
                      onClick={() => setLocation(`/invoices/${inv.id}`)}
                    >
                      <div>
                        <p className="font-medium">{inv.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {inv.productionDueDate ? new Date(inv.productionDueDate).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <Badge className={`status-${inv.status}`}>{inv.status}</Badge>
                    </div>
                  ))}
                {invoices.filter(inv => inv.productionDueDate && new Date(inv.productionDueDate) >= today).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming orders
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks
                  .filter(task => task.dueDate && new Date(task.dueDate) >= today)
                  .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                  .slice(0, 5)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <p className="font-medium">{task.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <Badge className={task.completed ? "status-completed" : "status-pending"}>
                        {task.completed ? "Completed" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                {tasks.filter(task => task.dueDate && new Date(task.dueDate) >= today).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming tasks
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
