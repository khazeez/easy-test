import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TopBar() {
  const { user } = useAuth();
  const { projects, currentProject, setCurrentProject, createProject } = useProjects();
  const [newProjectName, setNewProjectName] = useState("");
  const [open, setOpen] = useState(false);

  const initials = user?.email?.slice(0, 2).toUpperCase() || "U";

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName("");
    setOpen(false);
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger />

      <div className="flex items-center gap-2">
        <Select
          value={currentProject?.id || ""}
          onValueChange={(id) => {
            const p = projects.find((x) => x.id === id);
            if (p) setCurrentProject(p);
          }}
        >
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="My API Project" />
              </div>
              <Button onClick={handleCreate} className="w-full">Create Project</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
