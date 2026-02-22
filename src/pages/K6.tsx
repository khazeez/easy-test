import { useState, useEffect } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Play, Eye, X, Code, BarChart3 } from "lucide-react";

interface EnvVar { key: string; value: string; }

export default function K6() {
  const { currentProject } = useProjects();
  const navigate = useNavigate();
  const [swaggerFiles, setSwaggerFiles] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [testConfigs, setTestConfigs] = useState<any[]>([]);
  const [testRuns, setTestRuns] = useState<any[]>([]);

  // Env editor
  const [envName, setEnvName] = useState("");
  const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: "", value: "" }]);
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<any>(null);

  // Config editor
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configName, setConfigName] = useState("");
  const [configVus, setConfigVus] = useState(10);
  const [configDuration, setConfigDuration] = useState("30s");
  const [configSwaggerId, setConfigSwaggerId] = useState("");
  const [configScript, setConfigScript] = useState("");
  const [manualEndpoints, setManualEndpoints] = useState<{ method: string; url: string; body: string }[]>([]);

  // Run state
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runConfigId, setRunConfigId] = useState("");
  const [runEnvId, setRunEnvId] = useState("");
  const [running, setRunning] = useState(false);

  const pid = currentProject?.id;

  const fetchData = async () => {
    if (!pid) return;
    const [s, e, c, r] = await Promise.all([
      supabase.from("k6_swagger_files").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
      supabase.from("k6_environments").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
      supabase.from("k6_test_configs").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
      supabase.from("k6_test_runs").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
    ]);
    setSwaggerFiles((s.data || []) as any[]);
    setEnvironments((e.data || []) as any[]);
    setTestConfigs((c.data || []) as any[]);
    setTestRuns((r.data || []) as any[]);
  };

  useEffect(() => { fetchData(); }, [pid]);

  const handleUploadSwagger = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pid || !e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const name = json.info?.title || file.name.replace(/\.(json|yaml|yml)$/, "");
        await supabase.from("k6_swagger_files").insert({
          project_id: pid, name, swagger_data: json,
        });
      } catch {
        toast.error(`Failed to parse ${file.name}`);
      }
    }
    toast.success("Swagger file(s) uploaded");
    fetchData();
    e.target.value = "";
  };

  const deleteSwagger = async (id: string) => {
    await supabase.from("k6_swagger_files").delete().eq("id", id);
    fetchData();
  };

  const generateK6Script = (swagger: any) => {
    const paths = swagger?.swagger_data?.paths || {};
    let script = `import http from 'k6/http';\nimport { check, sleep } from 'k6';\n\nexport const options = {\n  vus: ${configVus},\n  duration: '${configDuration}',\n};\n\nexport default function () {\n  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';\n\n`;
    Object.entries(paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, _]: [string, any]) => {
        if (method === "get") {
          script += `  const res_${path.replace(/[^a-zA-Z]/g, '_')} = http.get(\`\${BASE_URL}${path}\`);\n`;
          script += `  check(res_${path.replace(/[^a-zA-Z]/g, '_')}, { 'status is 200': (r) => r.status === 200 });\n`;
        } else if (method === "post") {
          script += `  const res_${path.replace(/[^a-zA-Z]/g, '_')} = http.post(\`\${BASE_URL}${path}\`, JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } });\n`;
        }
      });
    });
    script += `  sleep(1);\n}\n`;
    return script;
  };

  const handleGenerateScript = () => {
    const swagger = swaggerFiles.find((s) => s.id === configSwaggerId);
    if (swagger) setConfigScript(generateK6Script(swagger));
  };

  const generateFromManualEndpoints = () => {
    if (manualEndpoints.length === 0) return;
    let script = `import http from 'k6/http';\nimport { check, sleep } from 'k6';\n\nexport const options = {\n  vus: ${configVus},\n  duration: '${configDuration}',\n};\n\nexport default function () {\n  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';\n\n`;
    manualEndpoints.forEach((ep, i) => {
      const varName = `res_${i}`;
      const fullUrl = ep.url.startsWith("http") ? `\`${ep.url}\`` : `\`\${BASE_URL}${ep.url}\``;
      if (ep.method === "GET") {
        script += `  const ${varName} = http.get(${fullUrl});\n`;
      } else if (ep.method === "DELETE") {
        script += `  const ${varName} = http.del(${fullUrl});\n`;
      } else {
        const body = ep.body.trim() || "{}";
        script += `  const ${varName} = http.${ep.method.toLowerCase()}(${fullUrl}, JSON.stringify(${body}), { headers: { 'Content-Type': 'application/json' } });\n`;
      }
      script += `  check(${varName}, { '${ep.method} ${ep.url} status is 200': (r) => r.status === 200 });\n`;
    });
    script += `  sleep(1);\n}\n`;
    setConfigScript(script);
  };

  const saveConfig = async () => {
    if (!pid || !configName.trim()) return;
    await supabase.from("k6_test_configs").insert({
      project_id: pid, name: configName, vus: configVus,
      duration: configDuration, swagger_file_id: configSwaggerId || null,
      script: configScript,
    });
    setConfigDialogOpen(false);
    setConfigName("");
    setConfigScript("");
    fetchData();
  };

  const deleteConfig = async (id: string) => {
    await supabase.from("k6_test_configs").delete().eq("id", id);
    fetchData();
  };

  const saveEnvironment = async () => {
    if (!pid || !envName.trim()) return;
    const filtered = envVars.filter((v) => v.key.trim()).map((v) => ({ key: v.key, value: v.value } as Record<string, string>));
    if (editingEnv) {
      await supabase.from("k6_environments").update({ name: envName, values: filtered as any }).eq("id", editingEnv.id);
    } else {
      await supabase.from("k6_environments").insert({ project_id: pid, name: envName, values: filtered as any });
    }
    setEnvDialogOpen(false);
    setEnvName("");
    setEnvVars([{ key: "", value: "" }]);
    setEditingEnv(null);
    fetchData();
  };

  const deleteEnvironment = async (id: string) => {
    await supabase.from("k6_environments").delete().eq("id", id);
    fetchData();
  };

  const runTest = async () => {
    if (!pid || !runConfigId) return;
    setRunning(true);

    try {
      // 1. Create the run record with "pending" status
      const { data: newRun, error: insertError } = await supabase.from("k6_test_runs").insert({
        project_id: pid,
        test_config_id: runConfigId,
        environment_id: runEnvId || null,
        status: "pending",
      }).select().single();

      if (insertError || !newRun) {
        toast.error(insertError?.message || "Failed to create run");
        setRunning(false);
        return;
      }

      // 2. Trigger GitHub Actions workflow via edge function
      const { data: triggerResult, error: triggerError } = await supabase.functions.invoke("trigger-k6-github", {
        body: { run_id: newRun.id },
      });

      if (triggerError) {
        toast.error("Failed to trigger k6: " + triggerError.message);
        await supabase.from("k6_test_runs").update({ status: "failed" }).eq("id", newRun.id);
        setRunning(false);
        fetchData();
        return;
      }

      toast.success("k6 test triggered! Waiting for results from GitHub Actions...");
      setRunDialogOpen(false);
      fetchData();

      // 3. Poll for results
      const pollInterval = setInterval(async () => {
        const { data: updated } = await supabase
          .from("k6_test_runs")
          .select("status")
          .eq("id", newRun.id)
          .single();

        if (updated && updated.status !== "pending" && updated.status !== "running") {
          clearInterval(pollInterval);
          setRunning(false);
          fetchData();
          if (updated.status === "passed") {
            toast.success("k6 test passed! View the report for details.");
          } else if (updated.status === "failed") {
            toast.error("k6 test failed. Check the report for details.");
          } else {
            toast.info("k6 test completed with status: " + updated.status);
          }
        }
      }, 5000);

      // Stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setRunning(false);
        fetchData();
      }, 600000);
    } catch (e) {
      toast.error("Error: " + String(e));
      setRunning(false);
    }
  };

  if (!pid) return <p className="text-muted-foreground p-6">Select a project first.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">k6 Load Testing</h1>
        <p className="text-muted-foreground">Import Swagger, configure tests, and run via GitHub Actions</p>
      </div>

      <Tabs defaultValue="swagger">
        <TabsList>
          <TabsTrigger value="swagger">Swagger Files</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="configs">Test Configs</TabsTrigger>
          <TabsTrigger value="runs">Test Runs</TabsTrigger>
        </TabsList>

        {/* Swagger Tab */}
        <TabsContent value="swagger" className="space-y-4">
          <Button asChild variant="outline">
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />Import Swagger/OpenAPI
              <input type="file" accept=".json,.yaml,.yml" multiple className="hidden" onChange={handleUploadSwagger} />
            </label>
          </Button>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Endpoints</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {swaggerFiles.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No Swagger files uploaded yet</TableCell></TableRow>
                ) : swaggerFiles.map((s) => {
                  const pathCount = Object.keys(s.swagger_data?.paths || {}).length;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="secondary">{pathCount} paths</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteSwagger(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Environments Tab */}
        <TabsContent value="environments" className="space-y-4">
          <Dialog open={envDialogOpen} onOpenChange={(v) => { setEnvDialogOpen(v); if (!v) { setEditingEnv(null); setEnvName(""); setEnvVars([{ key: "", value: "" }]); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Environment</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingEnv ? "Edit" : "New"} Environment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={envName} onChange={(e) => setEnvName(e.target.value)} placeholder="e.g. Staging" />
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
                  <Button variant="outline" size="sm" onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}><Plus className="mr-1 h-3 w-3" />Add Variable</Button>
                </div>
                <Button onClick={saveEnvironment} className="w-full">Save Environment</Button>
              </div>
            </DialogContent>
          </Dialog>
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
                        <Button variant="ghost" size="icon" onClick={() => { setEditingEnv(env); setEnvName(env.name); setEnvVars(env.values?.length ? env.values : [{ key: "", value: "" }]); setEnvDialogOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEnvironment(env.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Test Configs Tab */}
        <TabsContent value="configs" className="space-y-4">
          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Test Config</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Test Configuration</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Config Name</Label>
                    <Input value={configName} onChange={(e) => setConfigName(e.target.value)} placeholder="Load Test #1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Swagger Source</Label>
                    <Select value={configSwaggerId} onValueChange={setConfigSwaggerId}>
                      <SelectTrigger><SelectValue placeholder="Select swagger" /></SelectTrigger>
                      <SelectContent>
                        {swaggerFiles.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Virtual Users (VUs)</Label>
                    <Input type="number" value={configVus} onChange={(e) => setConfigVus(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input value={configDuration} onChange={(e) => setConfigDuration(e.target.value)} placeholder="30s" />
                  </div>
                </div>
                {/* Manual Endpoints */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Manual Endpoints</Label>
                    <Button variant="outline" size="sm" onClick={() => setManualEndpoints([...manualEndpoints, { method: "GET", url: "", body: "" }])}>
                      <Plus className="mr-1 h-3 w-3" />Add Endpoint
                    </Button>
                  </div>
                  {manualEndpoints.map((ep, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Select value={ep.method} onValueChange={(v) => { const n = [...manualEndpoints]; n[i].method = v; setManualEndpoints(n); }}>
                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="/api/endpoint or full URL" value={ep.url} onChange={(e) => { const n = [...manualEndpoints]; n[i].url = e.target.value; setManualEndpoints(n); }} className="flex-1" />
                      {["POST", "PUT", "PATCH"].includes(ep.method) && (
                        <Input placeholder='{"key":"val"}' value={ep.body} onChange={(e) => { const n = [...manualEndpoints]; n[i].body = e.target.value; setManualEndpoints(n); }} className="w-[160px] font-mono text-xs" />
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setManualEndpoints(manualEndpoints.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGenerateScript} disabled={!configSwaggerId}>
                    <Code className="mr-2 h-4 w-4" />Generate from Swagger
                  </Button>
                  <Button variant="outline" onClick={generateFromManualEndpoints} disabled={manualEndpoints.length === 0 || manualEndpoints.every(e => !e.url.trim())}>
                    <Code className="mr-2 h-4 w-4" />Generate from Endpoints
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>k6 Script</Label>
                  <Textarea value={configScript} onChange={(e) => setConfigScript(e.target.value)} className="font-mono text-xs min-h-[200px]" placeholder="k6 script will be generated here..." />
                </div>
                <Button onClick={saveConfig} className="w-full">Save Config</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>VUs</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testConfigs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No test configs yet</TableCell></TableRow>
                ) : testConfigs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.vus}</TableCell>
                    <TableCell>{c.duration}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteConfig(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Test Runs Tab */}
        <TabsContent value="runs" className="space-y-4">
          <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
            <DialogTrigger asChild>
              <Button><Play className="mr-2 h-4 w-4" />Run Test</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Run k6 Test</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Test Config</Label>
                  <Select value={runConfigId} onValueChange={setRunConfigId}>
                    <SelectTrigger><SelectValue placeholder="Select config" /></SelectTrigger>
                    <SelectContent>
                      {testConfigs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Environment (optional)</Label>
                  <Select value={runEnvId} onValueChange={setRunEnvId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {environments.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runTest} className="w-full" disabled={running || !runConfigId}>
                  {running ? "Starting..." : "Run k6 Test"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Config</TableHead>
                   <TableHead>Environment</TableHead>
                   <TableHead>Results</TableHead>
                   <TableHead className="w-[80px]">Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testRuns.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No test runs yet</TableCell></TableRow>
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
                      <TableCell className="text-sm text-muted-foreground">{testConfigs.find((c) => c.id === r.test_config_id)?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{environments.find((e) => e.id === r.environment_id)?.name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {results?.metrics ? (
                          <span>
                            <span className="text-muted-foreground">{results.metrics.totalRequests} reqs</span>
                            {" • "}
                            <span className="text-destructive">{results.metrics.errorRate?.toFixed(1)}% err</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/k6/report/${r.id}`)} title="View Report">
                          <BarChart3 className="h-4 w-4" />
                        </Button>
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
