import { useState, useEffect, useRef } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Play, Eye, X, Terminal, ChevronRight, Folder, FolderOpen, BarChart3, FileUp, File } from "lucide-react";

interface EnvVar { key: string; value: string; }

// Recursively count all requests in a Postman collection
function countRequests(items: any[]): number {
  let count = 0;
  for (const item of items) {
    if (item.request) {
      count++;
    }
    if (item.item && Array.isArray(item.item)) {
      count += countRequests(item.item);
    }
  }
  return count;
}

// Recursively flatten all requests with folder path
function flattenRequests(items: any[], path: string[] = []): { name: string; method: string; url: string; path: string[]; }[] {
  const result: any[] = [];
  for (const item of items) {
    if (item.request) {
      const method = item.request.method || "GET";
      const url = typeof item.request.url === "string"
        ? item.request.url
        : item.request?.url?.raw || item.name;
      result.push({ name: item.name, method, url, path });
    }
    if (item.item && Array.isArray(item.item)) {
      result.push(...flattenRequests(item.item, [...path, item.name]));
    }
  }
  return result;
}

// Render collection tree recursively
function CollectionTree({ items, depth = 0 }: { items: any[]; depth?: number }) {
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-1">
      {items.map((item: any, i: number) => {
        const isFolder = item.item && Array.isArray(item.item);
        const isOpen = openFolders[i] ?? true;

        if (isFolder) {
          return (
            <div key={i}>
              <button
                onClick={() => setOpenFolders((p) => ({ ...p, [i]: !isOpen }))}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                {isOpen ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium">{item.name}</span>
                <Badge variant="outline" className="ml-auto text-xs">{countRequests(item.item)} requests</Badge>
              </button>
              {isOpen && <CollectionTree items={item.item} depth={depth + 1} />}
            </div>
          );
        }

        const method = item.request?.method || "GET";
        const url = typeof item.request?.url === "string" ? item.request.url : item.request?.url?.raw || item.name;
        const methodColor: Record<string, string> = {
          GET: "secondary", POST: "default", PUT: "outline", DELETE: "destructive", PATCH: "outline",
        };

        return (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <Badge variant={(methodColor[method] || "secondary") as any} className="text-xs min-w-[55px] justify-center font-mono">
              {method}
            </Badge>
            <span className="font-mono text-xs truncate text-muted-foreground">{url}</span>
          </div>
        );
      })}
    </div>
  );
}

// CLI Output Viewer component
function CliViewer({ logs, isRunning }: { logs: string[]; isRunning: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/50">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">CLI Output</span>
        {isRunning && (
          <Badge variant="outline" className="ml-auto text-xs animate-pulse">
            Running...
          </Badge>
        )}
      </div>
      <div
        ref={scrollRef}
        className="bg-background font-mono text-xs p-4 h-[400px] overflow-auto whitespace-pre-wrap"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" }}
      >
        {logs.length === 0 ? (
          <span className="text-muted-foreground">Waiting for test execution...</span>
        ) : (
          logs.map((line, i) => {
            let className = "text-foreground";
            if (line.includes("✓") || line.includes("PASS") || line.includes("passed")) className = "text-primary";
            else if (line.includes("✗") || line.includes("FAIL") || line.includes("failed") || line.includes("Error")) className = "text-destructive";
            else if (line.includes("→") || line.includes("running") || line.startsWith("newman")) className = "text-muted-foreground";
            else if (line.startsWith("┌") || line.startsWith("│") || line.startsWith("└") || line.startsWith("├")) className = "text-muted-foreground";

            return (
              <div key={i} className={className}>
                {line}
              </div>
            );
          })
        )}
        {isRunning && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1">▌</span>}
      </div>
    </div>
  );
}

export default function Newman() {
  const { currentProject } = useProjects();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);

  // Env editor state
  const [envName, setEnvName] = useState("");
  const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: "", value: "" }]);
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<any>(null);

  // Run state
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runCollectionId, setRunCollectionId] = useState("");
  const [runEnvironmentId, setRunEnvironmentId] = useState("");
  const [runFolderName, setRunFolderName] = useState("");
  const [running, setRunning] = useState(false);
  const [skipSsl, setSkipSsl] = useState(true);

  // CLI viewer state
  const [cliLogs, setCliLogs] = useState<string[]>([]);
  const [showCli, setShowCli] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Collection files state
  const [collectionFiles, setCollectionFiles] = useState<Record<string, any[]>>({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [fileDialogCollectionId, setFileDialogCollectionId] = useState<string | null>(null);

  const pid = currentProject?.id;

  const fetchData = async () => {
    if (!pid) return;
    const [c, e, r, f] = await Promise.all([
      supabase.from("newman_collections").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
      supabase.from("newman_environments").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
      supabase.from("newman_test_runs").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
      supabase.from("newman_collection_files").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
    ]);
    setCollections((c.data || []) as any[]);
    setEnvironments((e.data || []) as any[]);
    setTestRuns((r.data || []) as any[]);
    // Group files by collection_id
    const filesMap: Record<string, any[]> = {};
    (f.data || []).forEach((file: any) => {
      if (!filesMap[file.collection_id]) filesMap[file.collection_id] = [];
      filesMap[file.collection_id].push(file);
    });
    setCollectionFiles(filesMap);
  };

  useEffect(() => { fetchData(); }, [pid]);

  const handleUploadCollection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pid || !e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const name = json.info?.name || file.name.replace(".json", "");
        await supabase.from("newman_collections").insert({
          project_id: pid, name, collection_data: json,
        });
      } catch {
        toast.error(`Failed to parse ${file.name}`);
      }
    }
    toast.success(`${files.length} collection(s) uploaded`);
    fetchData();
    e.target.value = "";
  };

  const deleteCollection = async (id: string) => {
    // Delete associated files from storage
    const files = collectionFiles[id] || [];
    if (files.length > 0) {
      await supabase.storage.from("newman-files").remove(files.map((f: any) => f.storage_path));
    }
    await supabase.from("newman_collections").delete().eq("id", id);
    fetchData();
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>, collectionId: string) => {
    if (!pid || !e.target.files) return;
    setUploadingFiles(true);
    const files = Array.from(e.target.files);
    for (const file of files) {
      // Use webkitRelativePath if available (folder upload), otherwise just filename
      const relativePath = (file as any).webkitRelativePath || file.name;
      const storagePath = `${pid}/${collectionId}/${relativePath}`;
      const { error: uploadError } = await supabase.storage.from("newman-files").upload(storagePath, file, { upsert: true });
      if (uploadError) {
        toast.error(`Failed to upload ${relativePath}: ${uploadError.message}`);
        continue;
      }
      await supabase.from("newman_collection_files").insert({
        collection_id: collectionId,
        project_id: pid,
        file_path: relativePath,
        storage_path: storagePath,
        file_size: file.size,
      });
    }
    toast.success(`${files.length} file(s) uploaded`);
    setUploadingFiles(false);
    fetchData();
    e.target.value = "";
  };

  const deleteFile = async (fileRecord: any) => {
    await supabase.storage.from("newman-files").remove([fileRecord.storage_path]);
    await supabase.from("newman_collection_files").delete().eq("id", fileRecord.id);
    fetchData();
  };

  const saveEnvironment = async () => {
    if (!pid || !envName.trim()) return;
    const filtered = envVars.filter((v) => v.key.trim()).map((v) => ({ key: v.key, value: v.value } as Record<string, string>));
    if (editingEnv) {
      await supabase.from("newman_environments").update({ name: envName, values: filtered as any }).eq("id", editingEnv.id);
    } else {
      await supabase.from("newman_environments").insert({ project_id: pid, name: envName, values: filtered as any });
    }
    setEnvDialogOpen(false);
    setEnvName("");
    setEnvVars([{ key: "", value: "" }]);
    setEditingEnv(null);
    fetchData();
  };

  const deleteEnvironment = async (id: string) => {
    await supabase.from("newman_environments").delete().eq("id", id);
    fetchData();
  };

  const openEditEnv = (env: any) => {
    setEditingEnv(env);
    setEnvName(env.name);
    setEnvVars(env.values?.length ? env.values : [{ key: "", value: "" }]);
    setEnvDialogOpen(true);
  };

  // Trigger Newman via GitHub Actions
  const executeNewmanRun = async (runId: string) => {
    setCliLogs(["Triggering GitHub Actions workflow...", ""]);
    setShowCli(true);
    setActiveRunId(runId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Not authenticated");
      setRunning(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("trigger-newman-github", {
        body: { run_id: runId, skip_ssl: skipSsl, folder_name: (runFolderName && runFolderName !== "__all__") ? runFolderName : undefined },
      });

      if (error) {
        toast.error(`Failed to trigger: ${error.message}`);
        setCliLogs((prev) => [...prev, `✗ Error: ${error.message}`]);
        setRunning(false);
        return;
      }

      setCliLogs((prev) => [
        ...prev,
        "✓ GitHub Actions workflow triggered successfully!",
        "",
        "Newman is running on GitHub Actions with --insecure flag.",
        "Results will appear automatically when the workflow completes.",
        "",
        "⏳ Waiting for results (this may take 1-3 minutes)...",
      ]);

      // Poll for results
      const pollInterval = setInterval(async () => {
        const { data: updatedRun } = await supabase
          .from("newman_test_runs")
          .select("status, result_data")
          .eq("id", runId)
          .single();

        if (updatedRun && (updatedRun as any).status !== "running" && (updatedRun as any).status !== "pending") {
          clearInterval(pollInterval);
          setRunning(false);
          fetchData();

          const results = (updatedRun as any).result_data as any;
          if (results?.error) {
            setCliLogs((prev) => [...prev, "", `✗ ${results.error}`]);
          } else if (results?.summary) {
            const cliLines: string[] = [];
            if (results.cli_output) {
              cliLines.push(...results.cli_output.split("\n"));
              cliLines.push("");
            }
            cliLines.push(
              "✓ Newman run completed!",
              "",
              `┌─────────────────────────────────────────┐`,
              `│                 summary                 │`,
              `├─────────────────────────────────────────┤`,
              `│       requests:  ${(results.summary.total_requests || 0).toString().padStart(3)} total            │`,
              `│     assertions:  ${(results.assertions?.total || 0).toString().padStart(3)} total            │`,
              `│         passed:  ${(results.assertions?.passed || 0).toString().padStart(3)}                  │`,
              `│         failed:  ${(results.assertions?.failed || 0).toString().padStart(3)}                  │`,
              `└─────────────────────────────────────────┘`,
            );
            setCliLogs(cliLines);
          }
        }
      }, 5000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (running) {
          setRunning(false);
          setCliLogs((prev) => [...prev, "", "⚠ Timeout: workflow may still be running. Refresh to check results."]);
          fetchData();
        }
      }, 300000);

    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setCliLogs((prev) => [...prev, `✗ Error: ${String(err)}`]);
      setRunning(false);
    }
  };

  const runTest = async () => {
    if (!pid || !runCollectionId) return;
    setRunning(true);
    setCliLogs([]);

    const { data, error } = await supabase.from("newman_test_runs").insert({
      project_id: pid,
      collection_id: runCollectionId,
      environment_id: runEnvironmentId || null,
      folder_name: (runFolderName && runFolderName !== "__all__") ? runFolderName : null,
      status: "running",
      started_at: new Date().toISOString(),
    } as any).select().single();

    if (error) {
      toast.error(error.message);
      setRunning(false);
      return;
    }

    setRunDialogOpen(false);
    fetchData();

    // Execute real Newman run via edge function
    executeNewmanRun((data as any).id);
  };

  // View past run results in CLI
  const viewRunResults = (run: any) => {
    const collection = collections.find((c) => c.id === run.collection_id);
    const environment = environments.find((e) => e.id === run.environment_id);
    const results = run.result_data;

    if (!results) {
      toast.info("No result data available for this run");
      return;
    }

    const lines: string[] = [
      `newman - Results Replay`,
      ``,
      `Collection: ${collection?.name || "Unknown"}`,
      `Environment: ${environment?.name || "None"}`,
      `Status: ${run.status}`,
      `Started: ${run.started_at ? new Date(run.started_at).toLocaleString() : "—"}`,
      `Completed: ${run.completed_at ? new Date(run.completed_at).toLocaleString() : "—"}`,
      ``,
    ];

    // Show CLI output if available
    if (results.cli_output) {
      lines.push(...results.cli_output.split("\n"));
      lines.push("");
    }

    lines.push(
      `┌─────────────────────────────────────────┐`,
      `│                 summary                 │`,
      `├─────────────────────────────────────────┤`,
      `│            requests:  ${(results.summary?.total_requests || results.total_requests || 0).toString().padStart(3)} total          │`,
      `│         assertions:  ${(results.assertions?.total || results.assertions || 0).toString().padStart(3)} total          │`,
      `│      passed:  ${(results.assertions?.passed || results.passed || 0).toString().padStart(3)}                        │`,
      `│      failed:  ${(results.assertions?.failed || results.failed || 0).toString().padStart(3)}                        │`,
      `└─────────────────────────────────────────┘`,
    );

    setCliLogs(lines);
    setShowCli(true);
  };

  if (!pid) return <p className="text-muted-foreground p-6">Select a project first.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Newman API Testing</h1>
        <p className="text-muted-foreground">Manage Postman collections, environments, and run tests</p>
      </div>

      <Tabs defaultValue="collections">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="runs">Test Runs</TabsTrigger>
        </TabsList>

        {/* Collections Tab */}
        <TabsContent value="collections" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Upload Collections
                <input type="file" accept=".json" multiple className="hidden" onChange={handleUploadCollection} />
              </label>
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Folders</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No collections uploaded yet</TableCell></TableRow>
                ) : collections.map((c) => {
                  const items = c.collection_data?.item || [];
                  const totalRequests = countRequests(items);
                  const folderCount = items.filter((i: any) => i.item && Array.isArray(i.item)).length;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="secondary">{totalRequests} requests</Badge></TableCell>
                      <TableCell><Badge variant="outline">{folderCount} folders</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="cursor-pointer" onClick={() => setFileDialogCollectionId(c.id)}>
                          {(collectionFiles[c.id] || []).length} files
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedCollection(c)} title="View requests">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setFileDialogCollectionId(c.id)} title="Manage files">
                            <FileUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteCollection(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Collection Preview Dialog - now with tree view */}
          <Dialog open={!!selectedCollection} onOpenChange={(v) => !v && setSelectedCollection(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedCollection?.name}
                  <Badge variant="secondary" className="text-xs">
                    {countRequests(selectedCollection?.collection_data?.item || [])} requests
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 max-h-[60vh]">
                <CollectionTree items={selectedCollection?.collection_data?.item || []} />
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* File Management Dialog */}
          <Dialog open={!!fileDialogCollectionId} onOpenChange={(v) => !v && setFileDialogCollectionId(null)}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5" />
                  Test Files
                  <span className="text-sm font-normal text-muted-foreground">
                    ({collections.find(c => c.id === fileDialogCollectionId)?.name})
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" disabled={uploadingFiles}>
                    <label className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingFiles ? "Uploading..." : "Upload Files"}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => fileDialogCollectionId && handleUploadFiles(e, fileDialogCollectionId)}
                      />
                    </label>
                  </Button>
                  <Button asChild variant="outline" size="sm" disabled={uploadingFiles}>
                    <label className="cursor-pointer">
                      <Folder className="mr-2 h-4 w-4" />
                      Upload Folder
                      {/* @ts-ignore */}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => fileDialogCollectionId && handleUploadFiles(e, fileDialogCollectionId)}
                        {...{ webkitdirectory: "", directory: "" } as any}
                      />
                    </label>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload file yang direferensikan di collection (misal: <code>./test-file/httpbin/PNG.png</code>). 
                  Path relatif akan dipertahankan.
                </p>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {(collectionFiles[fileDialogCollectionId || ""] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Belum ada file yang diupload</p>
                  ) : (
                    (collectionFiles[fileDialogCollectionId || ""] || []).map((f: any) => (
                      <div key={f.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-muted/50">
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs truncate flex-1">{f.file_path}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{(f.file_size / 1024).toFixed(1)}KB</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteFile(f)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Environments Tab */}
        <TabsContent value="environments" className="space-y-4">
          <div className="flex items-center gap-2">
            <Dialog open={envDialogOpen} onOpenChange={(v) => { setEnvDialogOpen(v); if (!v) { setEditingEnv(null); setEnvName(""); setEnvVars([{ key: "", value: "" }]); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New Environment</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingEnv ? "Edit" : "New"} Environment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={envName} onChange={(e) => setEnvName(e.target.value)} placeholder="e.g. Development" />
                  </div>
                  <div className="space-y-2">
                    <Label>Variables</Label>
                    {envVars.map((v, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="Key" value={v.key} onChange={(e) => { const n = [...envVars]; n[i].key = e.target.value; setEnvVars(n); }} />
                        <Input placeholder="Value" value={v.value} onChange={(e) => { const n = [...envVars]; n[i].value = e.target.value; setEnvVars(n); }} />
                        <Button variant="ghost" size="icon" onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}>
                      <Plus className="mr-1 h-3 w-3" />Add Variable
                    </Button>
                  </div>
                  <Button onClick={saveEnvironment} className="w-full">Save Environment</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button asChild variant="outline">
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Import from Postman
                <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                  if (!pid || !e.target.files?.[0]) return;
                  try {
                    const text = await e.target.files[0].text();
                    const json = JSON.parse(text);
                    const name = json.name || e.target.files[0].name.replace(".json", "");
                    const values = (json.values || [])
                      .filter((v: any) => v.enabled !== false)
                      .map((v: any) => ({ key: v.key, value: v.value }));
                    await supabase.from("newman_environments").insert({
                      project_id: pid, name, values: values as any,
                    });
                    toast.success(`Environment "${name}" imported`);
                    fetchData();
                  } catch {
                    toast.error("Failed to parse environment file");
                  }
                  e.target.value = "";
                }} />
              </label>
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {environments.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No environments yet</TableCell></TableRow>
                ) : environments.map((env) => (
                  <TableRow key={env.id}>
                    <TableCell className="font-medium">{env.name}</TableCell>
                    <TableCell><Badge variant="secondary">{(env.values as any[])?.length || 0} vars</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditEnv(env)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEnvironment(env.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Test Runs Tab */}
        <TabsContent value="runs" className="space-y-4">
          <div className="flex items-center gap-2">
            <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
              <DialogTrigger asChild>
                <Button><Play className="mr-2 h-4 w-4" />Run Test</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Run Newman Test</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Collection</Label>
                    <Select value={runCollectionId} onValueChange={(v) => { setRunCollectionId(v); setRunFolderName(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select collection" /></SelectTrigger>
                      <SelectContent>
                        {collections.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Environment (optional)</Label>
                    <Select value={runEnvironmentId} onValueChange={setRunEnvironmentId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        {environments.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Folder (optional - run specific folder only)</Label>
                    <Select value={runFolderName} onValueChange={setRunFolderName}>
                      <SelectTrigger><SelectValue placeholder="All folders (entire collection)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All folders</SelectItem>
                        {runCollectionId && (() => {
                          const col = collections.find(c => c.id === runCollectionId);
                          const folders = (col?.collection_data?.item || [])
                            .filter((i: any) => i.item && Array.isArray(i.item))
                            .map((i: any) => i.name);
                          return folders.map((f: string) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skipSsl"
                      checked={skipSsl}
                      onChange={(e) => setSkipSsl(e.target.checked)}
                      className="rounded border-input"
                    />
                    <Label htmlFor="skipSsl" className="text-sm font-normal">
                      Skip SSL verification (untuk self-signed certificate)
                    </Label>
                  </div>
                  <Button onClick={runTest} className="w-full" disabled={running || !runCollectionId}>
                    {running ? "Starting..." : "Run Test"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {showCli && (
              <Button variant="outline" onClick={() => setShowCli(false)}>
                <X className="mr-2 h-4 w-4" />Hide CLI
              </Button>
            )}
          </div>

          {/* CLI Output Viewer */}
          {showCli && <CliViewer logs={cliLogs} isRunning={running} />}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Folder</TableHead>
                  <TableHead>Environment</TableHead>
                   <TableHead>Results</TableHead>
                   <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testRuns.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No test runs yet</TableCell></TableRow>
                ) : testRuns.map((r) => {
                  const results = r.result_data as any;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "passed" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{collections.find((c) => c.id === r.collection_id)?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(r as any).folder_name || "All"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{environments.find((e) => e.id === r.environment_id)?.name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {results ? (
                          <span>
                            <span className="text-primary">{results.passed}✓</span>
                            {" / "}
                            <span className="text-destructive">{results.failed}✗</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/newman/report/${r.id}`)} title="View Report">
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => viewRunResults(r)} title="CLI Output">
                            <Terminal className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
