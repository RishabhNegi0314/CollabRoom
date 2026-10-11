import React, { useState } from "react";
import { KanbanTask } from "../types.js";
import { ListTodo, CheckSquare, Plus, ArrowRight, ArrowLeft, Trash2, Calendar, User, TrendingUp, Sparkles, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TaskBoardProps {
  tasks: KanbanTask[];
  onTaskUpdate: (id: string, updates: Partial<KanbanTask>) => void;
  onTaskCreate: (title: string, description: string, assignee: string, priority: "low" | "medium" | "high", points: number) => void;
  onTaskDelete: (id: string) => void;
}

export default function TaskBoard({ tasks, onTaskUpdate, onTaskCreate, onTaskDelete }: TaskBoardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("Rishabh (You)");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [points, setPoints] = useState(3);

  const columns: { id: KanbanTask["status"]; title: string; color: string; bg: string }[] = [
    { id: "todo", title: "To Do", color: "text-zinc-400 border-zinc-800", bg: "bg-[#0a0a0a]" },
    { id: "in_progress", title: "In Progress", color: "text-indigo-400 border-zinc-800", bg: "bg-indigo-950/5" },
    { id: "review", title: "In Review", color: "text-amber-400 border-zinc-800", bg: "bg-amber-950/5" },
    { id: "done", title: "Completed", color: "text-emerald-400 border-zinc-800", bg: "bg-emerald-950/5" }
  ];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onTaskCreate(title.trim(), description.trim(), assignee, priority, points);
    setTitle("");
    setDescription("");
    setShowCreate(false);
  };

  const moveTask = (task: KanbanTask, direction: "next" | "prev") => {
    const statuses: KanbanTask["status"][] = ["todo", "in_progress", "review", "done"];
    const curIdx = statuses.indexOf(task.status);
    let nextIdx = curIdx + (direction === "next" ? 1 : -1);
    if (nextIdx >= 0 && nextIdx < statuses.length) {
      onTaskUpdate(task.id, { status: statuses[nextIdx] });
    }
  };

  // Compile statistics for progress tracking
  const teamMembers = ["Sarah (Tech Lead)", "Alex (UX Designer)", "Rishabh (You)"];
  
  const memberProgress = teamMembers.map((member) => {
    const memberTasks = tasks.filter((t) => t.assignee === member);
    const completedTasks = memberTasks.filter((t) => t.status === "done");
    const totalPoints = memberTasks.reduce((sum, t) => sum + t.points, 0);
    const completedPoints = completedTasks.reduce((sum, t) => sum + t.points, 0);
    const activeTasks = memberTasks.filter((t) => t.status !== "done").length;

    return {
      name: member,
      completed: completedTasks.length,
      total: memberTasks.length,
      points: completedPoints,
      totalPoints,
      active: activeTasks,
      // For short display
      shortName: member.split(" ")[0]
    };
  });

  // Recharts data format
  const chartData = memberProgress.map((m) => ({
    name: m.shortName,
    "Completed Points": m.points,
    "Pending Points": m.totalPoints - m.points
  }));

  return (
    <div id="collab-task-board-section" className="space-y-6">
      
      {/* Upper stats / team velocity indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Progress tracks bar widgets */}
        <div className="lg:col-span-2 bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Team Member Progress & Velocity</h3>
            </div>
            
            <div className="space-y-4">
              {memberProgress.map((m) => {
                const completionPercentage = m.totalPoints > 0 ? Math.round((m.points / m.totalPoints) * 100) : 0;
                return (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">{m.name}</span>
                      <span className="font-mono text-zinc-500">
                        {m.points} / {m.totalPoints} pts completed ({completionPercentage}%)
                      </span>
                    </div>

                    {/* Visual custom progress track */}
                    <div className="relative h-2 bg-[#050505] rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="absolute h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-550 font-mono">
                      <span>{m.active} active tasks remaining</span>
                      <span className="flex items-center gap-0.5 text-emerald-500 font-bold">
                        <CheckSquare className="w-3 h-3" /> {m.completed} tasks done
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 text-[10px] text-zinc-600 font-mono">
            Automatic tracking based on status transitions
          </div>
        </div>

        {/* Recharts chart widget */}
        <div className="bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 flex flex-col justify-between min-h-[220px] shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Burn-up points distribution</h4>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-4 font-sans">
              Graph compiling earned sprint points (completed task value weightings) across core developers.
            </p>
          </div>

          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#050505", borderColor: "#27272a" }}
                  labelStyle={{ color: "#f4f4f5", fontSize: 11 }}
                  itemStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="Completed Points" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Pending Points" stackId="a" fill="#312e81" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 justify-center text-[10px] font-mono text-zinc-500 mt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> Completed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-900 rounded-full" /> Pending</span>
          </div>
        </div>
      </div>

      {/* Main Kanban Columns */}
      <div className="bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Sprint Kanban Board</h3>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add task
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreateSubmit} className="mb-6 bg-black/40 p-4 rounded-xl border border-zinc-800 max-w-xl space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Create sprint task</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Set up dev environment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Assignee</label>
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  {teamMembers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Description</label>
              <textarea
                placeholder="Draft exact specifications..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Priority Badge</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Complexity Points</label>
                <input
                  type="number"
                  min={1}
                  max={13}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Save Task
              </button>
            </div>
          </form>
        )}

        {/* Board column structures */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-2">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className={`flex flex-col rounded-2xl p-3 border ${col.bg} border-zinc-800 min-h-[380px]`}>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-850">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${col.color}`}>{col.title}</span>
                  <span className="text-[10px] bg-[#050505] border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-mono">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center border border-dashed border-zinc-850 rounded-xl p-4 text-center">
                      <span className="text-[10px] text-zinc-650 font-mono">Column Empty</span>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      return (
                        <div key={task.id} className="bg-[#050505] border border-zinc-800 rounded-xl p-3.5 hover:border-zinc-700 transition flex flex-col justify-between space-y-2.5 group">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                                task.priority === "high"
                                  ? "bg-rose-500/10 text-rose-400"
                                  : task.priority === "medium"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-zinc-900 text-zinc-400"
                              }`}>
                                {task.priority}
                              </span>
                              <span className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-950/20 px-1.5 rounded-md">
                                {task.points} pts
                              </span>
                            </div>
                            <h4 className="text-xs font-semibold text-zinc-200 line-clamp-1">{task.title}</h4>
                            <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed font-sans">
                              {task.description || "No description provided."}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-zinc-900 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-sans">
                              <User className="w-3 h-3 text-zinc-600" />
                              <span className="truncate max-w-[80px]">{task.assignee.split(" ")[0]}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {/* Move Controls */}
                              {col.id !== "todo" && (
                                <button
                                  onClick={() => moveTask(task, "prev")}
                                  className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-md transition"
                                  title="Move Left"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                              )}
                              {col.id !== "done" && (
                                <button
                                  onClick={() => moveTask(task, "next")}
                                  className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-md transition"
                                  title="Move Right"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm(`Delete task "${task.title}"?`)) {
                                    onTaskDelete(task.id);
                                  }
                                }}
                                className="p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 rounded-md transition"
                                title="Delete Task"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
