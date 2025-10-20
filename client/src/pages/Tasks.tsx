import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Tasks() {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery();

  const utils = trpc.useUtils();
  const toggleTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success("Task updated");
    },
  });

  const filteredTasks = tasks?.filter((task) => {
    if (filter === "completed") return task.completed;
    if (filter === "pending") return !task.completed;
    return true;
  });

  const handleToggle = (taskId: string, completed: boolean) => {
    toggleTask.mutate({
      id: taskId,
      completed: !completed,
      completedAt: !completed ? new Date() : undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground mt-1">Manage production and follow-up tasks</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "pending" ? "default" : "outline"}
                onClick={() => setFilter("pending")}
              >
                Pending
              </Button>
              <Button
                variant={filter === "completed" ? "default" : "outline"}
                onClick={() => setFilter("completed")}
              >
                Completed
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading tasks...</p>
              </div>
            ) : filteredTasks && filteredTasks.length > 0 ? (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg ${
                      task.completed ? "bg-muted/30" : ""
                    }`}
                  >
                    <Checkbox
                      checked={task.completed || false}
                      onCheckedChange={() => handleToggle(task.id, task.completed || false)}
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                        {task.name}
                      </p>
                      {task.notes && (
                        <p className="text-sm text-muted-foreground">{task.notes}</p>
                      )}
                      {task.dueDate && (
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        task.priority === "urgent"
                          ? "bg-red-500"
                          : task.priority === "high"
                          ? "bg-orange-500"
                          : task.priority === "medium"
                          ? "bg-yellow-500"
                          : "bg-gray-500"
                      }
                    >
                      {task.priority}
                    </Badge>
                    {task.completed && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No tasks found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {showForm && <TaskForm onClose={() => setShowForm(false)} />}
      </div>
    </DashboardLayout>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    notes: "",
    priority: "medium",
    dueDate: "",
  });

  const utils = trpc.useUtils();
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      utils.tasks.list.invalidate();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTask.mutate({
      name: formData.name,
      notes: formData.notes || undefined,
      priority: formData.priority as any,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
    });
  };

  return (
    <Card className="fixed inset-0 m-auto max-w-lg h-fit z-50 shadow-2xl">
      <CardHeader>
        <h2 className="text-xl font-bold">New Task</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Task Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">Create Task</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
