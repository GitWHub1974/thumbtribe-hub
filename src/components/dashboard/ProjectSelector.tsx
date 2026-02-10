import { ClientProject } from "@/hooks/useClientProjects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectSelectorProps {
  projects: ClientProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

const ProjectSelector = ({ projects, selectedId, onSelect, isLoading }: ProjectSelectorProps) => {
  if (isLoading) {
    return (
      <div className="h-10 w-64 rounded-md bg-muted animate-pulse" />
    );
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No projects assigned to your account.</p>
    );
  }

  return (
    <Select value={selectedId ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} ({p.jira_project_key})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ProjectSelector;
