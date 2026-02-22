import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, Users, Zap, Timer, Share2, Check, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

export default function K6Report() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [run, setRun] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [environment, setEnvironment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const handleShare = async () => {
    if (!runId) return;
    setSharing(true);
    try {
      const { data: existing } = await supabase
        .from("k6_shared_reports" as any)
        .select("share_token")
        .eq("run_id", runId)
        .limit(1);

      let token: string;
      if (existing && existing.length > 0) {
        token = (existing[0] as any).share_token;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { data: inserted, error } = await supabase
          .from("k6_shared_reports" as any)
          .insert({ run_id: runId, created_by: user.user?.id } as any)
          .select("share_token")
          .single();
        if (error) throw error;
        token = (inserted as any).share_token;
      }

      const link = `${window.location.origin}/shared/report?token=${token}&type=k6`;
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      toast({ title: "Share link copied!", description: "Link has been copied to clipboard." });
    } catch (e: any) {
      toast({ title: "Failed to share", description: e.message, variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    if (!runId) return;
    supabase.from("k6_test_runs").select("*").eq("id", runId).single().then(async ({ data }) => {
      if (!data) { setLoading(false); return; }
      setRun(data);
      if ((data as any).test_config_id) {
        const { data: cfg } = await supabase.from("k6_test_configs").select("name, vus, duration").eq("id", (data as any).test_config_id).single();
        setConfig(cfg);
      }
      if ((data as any).environment_id) {
        const { data: env } = await supabase.from("k6_environments").select("name").eq("id", (data as any).environment_id).single();
        setEnvironment(env);
      }
      setLoading(false);
    });
  }, [runId]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  if (!run) return <div className="flex items-center justify-center py-20 text-muted-foreground">Run not found</div>;

  const results = run.result_data as any;
  if (!results) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
      <p className="text-muted-foreground">No result data available for this run.</p>
    </div>
  );

  const metrics = results.metrics || {};
  const timeline: any[] = results.timeline || [];
  const checks: any[] = results.checks || [];
  const thresholds: any[] = results.thresholds || [];
  const endpoints: any[] = results.endpoints || [];
  const errorList: any[] = results.errors || [];
  const cliOutput: string = results.cli_output || "";

  const passFailChecks = [
    { name: "Passed", value: checks.filter((c) => c.passed).length, fill: "hsl(var(--primary))" },
    { name: "Failed", value: checks.filter((c) => !c.passed).length, fill: "hsl(var(--destructive))" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">k6 Load Test Report</h1>
          <p className="text-muted-foreground text-sm">
            {(config as any)?.name || "Unknown Config"} • {(environment as any)?.name || "No Environment"} • {new Date(run.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
            {shareLink ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
            {sharing ? "Sharing..." : shareLink ? "Copied!" : "Share"}
          </Button>
          <Badge variant={run.status === "passed" ? "secondary" : run.status === "failed" ? "destructive" : "outline"} className="text-sm">
            {run.status}
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />VUs</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.vus || (config as any)?.vus || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" />Duration</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.duration || (config as any)?.duration || "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" />RPS</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.rps?.toFixed(1) || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.totalRequests || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Error Rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{metrics.errorRate?.toFixed(1) || 0}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Response</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgResponseTime?.toFixed(0) || 0}ms</div>
            <p className="text-xs text-muted-foreground mt-1">p95: {metrics.p95?.toFixed(0) || 0}ms</p>
          </CardContent>
        </Card>
      </div>

      {/* Percentile Card */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 py-3">
          <div className="text-sm"><span className="text-muted-foreground">p50:</span> <strong>{metrics.p50?.toFixed(0) || 0}ms</strong></div>
          <div className="text-sm"><span className="text-muted-foreground">p90:</span> <strong>{metrics.p90?.toFixed(0) || 0}ms</strong></div>
          <div className="text-sm"><span className="text-muted-foreground">p95:</span> <strong>{metrics.p95?.toFixed(0) || 0}ms</strong></div>
          <div className="text-sm"><span className="text-muted-foreground">p99:</span> <strong>{metrics.p99?.toFixed(0) || 0}ms</strong></div>
          <div className="text-sm"><span className="text-muted-foreground">min:</span> <strong>{metrics.minResponseTime?.toFixed(0) || 0}ms</strong></div>
          <div className="text-sm"><span className="text-muted-foreground">max:</span> <strong>{metrics.maxResponseTime?.toFixed(0) || 0}ms</strong></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints ({endpoints.length})</TabsTrigger>
          <TabsTrigger value="checks">Checks ({checks.length})</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds ({thresholds.length})</TabsTrigger>
          <TabsTrigger value="errors">Errors ({errorList.length})</TabsTrigger>
          {cliOutput && <TabsTrigger value="cli"><Terminal className="h-3.5 w-3.5 mr-1" />CLI Output</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Response Time Over Time (ms)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="p50" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="p50" />
                    <Line type="monotone" dataKey="p95" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="p95" />
                    <Line type="monotone" dataKey="p99" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} name="p99" />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Virtual Users & RPS</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Area type="monotone" dataKey="vus" stroke="hsl(var(--info))" fill="hsl(var(--info) / 0.2)" strokeWidth={2} name="VUs" />
                    <Area type="monotone" dataKey="rps" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} name="RPS" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Error Rate Over Time (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="errorRate" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" strokeWidth={2} name="Error %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Checks Pass/Fail</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={passFailChecks} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name}: ${e.value}`}>
                      {passFailChecks.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Response Time by Endpoint</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={endpoints.map((e) => ({ name: e.name?.length > 18 ? e.name.slice(0, 18) + "…" : e.name, avg: e.avg, p95: e.p95 }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Avg" />
                    <Bar dataKey="p95" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="p95" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints">
          <Card>
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Avg (ms)</TableHead>
                    <TableHead>p95 (ms)</TableHead>
                    <TableHead>p99 (ms)</TableHead>
                    <TableHead>Error %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No endpoint data</TableCell></TableRow>
                  ) : endpoints.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="secondary" className="text-xs font-mono">{e.method}</Badge></TableCell>
                      <TableCell className="text-sm font-mono">{e.url}</TableCell>
                      <TableCell>{e.count}</TableCell>
                      <TableCell>{e.avg?.toFixed(0)}</TableCell>
                      <TableCell>{e.p95?.toFixed(0)}</TableCell>
                      <TableCell>{e.p99?.toFixed(0)}</TableCell>
                      <TableCell>
                        <Badge variant={e.errorRate > 0 ? "destructive" : "secondary"} className="text-xs">
                          {e.errorRate?.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Checks Tab */}
        <TabsContent value="checks">
          <Card>
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Check Name</TableHead>
                    <TableHead>Passes</TableHead>
                    <TableHead>Fails</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No checks</TableCell></TableRow>
                  ) : checks.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{c.passed ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}</TableCell>
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-primary">{c.passes}</TableCell>
                      <TableCell className="text-destructive">{c.fails}</TableCell>
                      <TableCell>{c.passes + c.fails > 0 ? ((c.passes / (c.passes + c.fails)) * 100).toFixed(1) : 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholds.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No thresholds configured</TableCell></TableRow>
                ) : thresholds.map((t: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{t.passed ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}</TableCell>
                    <TableCell className="text-sm font-medium font-mono">{t.metric}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.threshold}</TableCell>
                    <TableCell className="text-sm">{t.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors">
          <Card>
            {errorList.length === 0 ? (
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="mx-auto h-8 w-8 mb-2 text-primary" />
                No errors in this run
              </CardContent>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="divide-y">
                  {errorList.map((err: any, i: number) => (
                    <div key={i} className="p-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium">{err.name}</span>
                        <Badge variant="destructive" className="text-xs">{err.count} occurrences</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">{err.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        </TabsContent>

        {/* CLI Output Tab */}
        {cliOutput && (
          <TabsContent value="cli">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  k6 CLI Output
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[600px]">
                  <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/50 rounded-md p-4 text-foreground leading-relaxed">
                    {cliOutput}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
