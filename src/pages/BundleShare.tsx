import { useState, useEffect } from "react";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Share2, Package, Check, FlaskConical, Zap, ChevronDown } from "lucide-react";

export default function BundleShare() {
  const { currentProject } = useProjects();
  const { toast } = useToast();
  const pid = currentProject?.id;

  const [newmanRuns, setNewmanRuns] = useState<any[]>([]);
  const [k6Runs, setK6Runs] = useState<any[]>([]);
  const [newmanCollections, setNewmanCollections] = useState<any[]>([]);
  const [newmanEnvs, setNewmanEnvs] = useState<any[]>([]);
  const [k6Configs, setK6Configs] = useState<any[]>([]);
  const [k6Envs, setK6Envs] = useState<any[]>([]);

  const [selected, setSelected] = useState<{ runner_type: string; run_id: string }[]>([]);
  const [bundleTitle, setBundleTitle] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (!pid) return;
    Promise.all([
      supabase.from("newman_test_runs").select("*").eq("project_id", pid).in("status", ["passed", "failed"]).order("created_at", { ascending: false }).limit(50),
      supabase.from("k6_test_runs").select("*").eq("project_id", pid).in("status", ["passed", "failed"]).order("created_at", { ascending: false }).limit(50),
      supabase.from("newman_collections").select("id, name").eq("project_id", pid),
      supabase.from("newman_environments").select("id, name").eq("project_id", pid),
      supabase.from("k6_test_configs").select("id, name").eq("project_id", pid),
      supabase.from("k6_environments").select("id, name").eq("project_id", pid),
    ]).then(([nr, kr, nc, ne, kc, ke]) => {
      setNewmanRuns((nr.data || []) as any[]);
      setK6Runs((kr.data || []) as any[]);
      setNewmanCollections((nc.data || []) as any[]);
      setNewmanEnvs((ne.data || []) as any[]);
      setK6Configs((kc.data || []) as any[]);
      setK6Envs((ke.data || []) as any[]);
    });
  }, [pid]);

  const toggleSelection = (runner_type: string, run_id: string) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.runner_type === runner_type && s.run_id === run_id);
      if (exists) return prev.filter((s) => !(s.runner_type === runner_type && s.run_id === run_id));
      return [...prev, { runner_type, run_id }];
    });
  };

  const isSelected = (runner_type: string, run_id: string) =>
    selected.some((s) => s.runner_type === runner_type && s.run_id === run_id);

  const handleCreateBundle = async () => {
    if (selected.length === 0) return;
    setSharing(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: bundle, error } = await supabase
        .from("shared_report_bundles" as any)
        .insert({
          title: bundleTitle || `Bundle - ${new Date().toLocaleDateString()}`,
          created_by: user.user?.id,
        } as any)
        .select("id, share_token")
        .single();

      if (error) throw error;

      const items = selected.map((s) => ({
        bundle_id: (bundle as any).id,
        runner_type: s.runner_type,
        run_id: s.run_id,
      }));

      const { error: itemsError } = await supabase
        .from("shared_report_bundle_items" as any)
        .insert(items as any);

      if (itemsError) throw itemsError;

      const link = `${window.location.origin}/shared/report?token=${(bundle as any).share_token}&type=bundle`;
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      toast({ title: "Bundle share link copied!", description: `${selected.length} reports bundled and link copied to clipboard.` });
    } catch (e: any) {
      toast({ title: "Failed to create bundle", description: e.message, variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  if (!pid) return <p className="text-muted-foreground p-6">Select a project first.</p>;

  const getNewmanLabel = (run: any) => {
    const col = newmanCollections.find((c) => c.id === run.collection_id);
    const env = newmanEnvs.find((e) => e.id === run.environment_id);
    return `${col?.name || "Unknown"} ${env ? `• ${env.name}` : ""}`;
  };

  const getK6Label = (run: any) => {
    const cfg = k6Configs.find((c) => c.id === run.test_config_id);
    const env = k6Envs.find((e) => e.id === run.environment_id);
    return `${cfg?.name || "Unknown"} ${env ? `• ${env.name}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          Bundle Share
        </h1>
        <p className="text-muted-foreground">Select multiple test runs across Newman and k6 to share as a single link</p>
      </div>

      {/* Title + Action */}
      <Card>
        <CardContent className="py-4 flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label>Bundle Title (optional)</Label>
            <Input
              value={bundleTitle}
              onChange={(e) => setBundleTitle(e.target.value)}
              placeholder="e.g. Sprint 12 Test Results"
            />
          </div>
          <Button onClick={handleCreateBundle} disabled={sharing || selected.length === 0}>
            {shareLink ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
            {sharing ? "Creating..." : shareLink ? "Link Copied!" : `Share ${selected.length} Report${selected.length !== 1 ? "s" : ""}`}
          </Button>
        </CardContent>
      </Card>

      {shareLink && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center gap-3">
            <Check className="h-5 w-5 text-primary shrink-0" />
            <code className="text-xs font-mono flex-1 truncate">{shareLink}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(shareLink); toast({ title: "Copied!" }); }}
            >
              Copy
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4 space-y-2">
          {/* Newman Runs */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 rounded-md hover:bg-muted/50 transition-colors group">
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold flex-1 text-left">Newman</span>
              <Badge variant="secondary" className="text-xs">{newmanRuns.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-6 border-l border-border pl-3 mt-1">
                {newmanRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No completed Newman runs</p>
                ) : newmanRuns.map((run) => (
                  <label
                    key={run.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-md hover:bg-muted/50 transition-colors ${isSelected("newman", run.id) ? "bg-primary/5" : ""}`}
                  >
                    <Checkbox
                      checked={isSelected("newman", run.id)}
                      onCheckedChange={() => toggleSelection("newman", run.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getNewmanLabel(run)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p>
                    </div>
                    <Badge variant={run.status === "passed" ? "secondary" : "destructive"} className="text-xs shrink-0">
                      {run.status}
                    </Badge>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* K6 Runs */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 rounded-md hover:bg-muted/50 transition-colors group">
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold flex-1 text-left">k6</span>
              <Badge variant="secondary" className="text-xs">{k6Runs.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-6 border-l border-border pl-3 mt-1">
                {k6Runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No completed k6 runs</p>
                ) : k6Runs.map((run) => (
                  <label
                    key={run.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-md hover:bg-muted/50 transition-colors ${isSelected("k6", run.id) ? "bg-primary/5" : ""}`}
                  >
                    <Checkbox
                      checked={isSelected("k6", run.id)}
                      onCheckedChange={() => toggleSelection("k6", run.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getK6Label(run)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p>
                    </div>
                    <Badge variant={run.status === "passed" ? "secondary" : "destructive"} className="text-xs shrink-0">
                      {run.status}
                    </Badge>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}
