import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, BarChart3,
  ChevronDown, ChevronRight, Send, FileText, Code, ArrowRightLeft,
  Share2, Check, Zap, TrendingUp, Timer, Gauge, Activity,
  ArrowUpDown, Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, ScatterChart, Scatter, ZAxis,
  ReferenceLine, LineChart, Line,
} from "recharts";

// ─── Helper: compute percentile ───
function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ─── Helper: format ms with color class ───
function getSpeedClass(ms: number): string {
  if (ms <= 200) return "text-primary";
  if (ms <= 500) return "text-warning";
  if (ms <= 1000) return "text-[hsl(var(--warning))]";
  return "text-destructive";
}

function getSpeedLabel(ms: number): string {
  if (ms <= 200) return "Fast";
  if (ms <= 500) return "Normal";
  if (ms <= 1000) return "Slow";
  return "Very Slow";
}

// ─── RequestDetail (Allure-style collapsible step) ───
function RequestDetail({ request }: { request: any }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const allPassed = request.assertions?.every((a: any) => a.passed) ?? true;
  const hasFailed = request.assertions?.some((a: any) => !a.passed) ?? false;
  const responseTime = request.responseTime || 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b ${hasFailed ? 'border-l-4 border-l-destructive' : 'border-l-4 border-l-primary'}`}>
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground w-6 font-mono">{(request.index ?? 0) + 1}</span>
          <Badge
            variant={request.method === "GET" ? "secondary" : request.method === "POST" ? "default" : request.method === "DELETE" ? "destructive" : "outline"}
            className="text-xs font-mono min-w-[55px] justify-center"
          >
            {request.method}
          </Badge>
          <span className="text-sm font-medium truncate text-left flex-1">{request.name}</span>
          <Badge variant={String(request.statusCode).startsWith("2") ? "secondary" : "destructive"} className="text-xs font-mono">
            {request.statusCode}
          </Badge>
          {/* Performance bar */}
          <div className="flex items-center gap-2 w-32">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${responseTime <= 200 ? 'bg-primary' : responseTime <= 500 ? 'bg-[hsl(var(--warning))]' : 'bg-destructive'}`}
                style={{ width: `${Math.min(100, (responseTime / 2000) * 100)}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-14 text-right font-semibold ${getSpeedClass(responseTime)}`}>{responseTime}ms</span>
          </div>
          {request.assertions?.length > 0 && (
            <div className="flex items-center gap-1">
              {allPassed ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <span className="text-xs text-muted-foreground">{request.assertions.filter((a: any) => a.passed).length}/{request.assertions.length}</span>
            </div>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/30 border-b px-4 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="overview" className="text-xs h-7"><ArrowRightLeft className="h-3 w-3 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="request" className="text-xs h-7"><Send className="h-3 w-3 mr-1" />Request</TabsTrigger>
              <TabsTrigger value="response" className="text-xs h-7"><FileText className="h-3 w-3 mr-1" />Response</TabsTrigger>
              {(request.preRequestScripts?.length > 0 || request.testScripts?.length > 0) && (
                <TabsTrigger value="scripts" className="text-xs h-7"><Code className="h-3 w-3 mr-1" />Scripts</TabsTrigger>
              )}
              <TabsTrigger value="assertions" className="text-xs h-7"><CheckCircle className="h-3 w-3 mr-1" />Tests ({request.assertions?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="col-span-2 md:col-span-3 rounded-lg bg-card p-3 border">
                  <p className="text-xs text-muted-foreground">URL</p>
                  <p className="text-xs font-mono break-all mt-1">{request.url}</p>
                </div>
                <div className="rounded-lg bg-card p-3 border">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-lg font-bold mt-1">{request.statusCode}</p>
                </div>
                <div className="rounded-lg bg-card p-3 border">
                  <p className="text-xs text-muted-foreground">Response Time</p>
                  <p className={`text-lg font-bold mt-1 ${getSpeedClass(responseTime)}`}>{responseTime}ms</p>
                  <Badge variant="outline" className="text-[10px] mt-1">{getSpeedLabel(responseTime)}</Badge>
                </div>
              </div>
              {/* Performance breakdown */}
              <div className="rounded-lg bg-card p-3 border">
                <p className="text-xs text-muted-foreground mb-2">Response Size</p>
                <p className="text-sm font-semibold">{request.responseSize ? `${(request.responseSize / 1024).toFixed(1)} KB` : "—"}</p>
              </div>
            </TabsContent>

            <TabsContent value="request" className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Request Headers</p>
                {request.requestHeaders && Object.keys(request.requestHeaders).length > 0 ? (
                  <div className="rounded-lg bg-card border overflow-hidden">
                    <Table>
                      <TableBody>
                        {Object.entries(request.requestHeaders).map(([k, v]: [string, any]) => (
                          <TableRow key={k}>
                            <TableCell className="font-mono text-xs font-medium w-[200px] py-1.5">{k}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground py-1.5 break-all">{v}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-xs text-muted-foreground">No headers captured</p>}
              </div>
              {request.requestBody && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Request Body</p>
                  <ScrollArea className="max-h-[300px]">
                    <pre className="text-xs font-mono bg-card border rounded-lg p-3 whitespace-pre-wrap break-all">
                      {typeof request.requestBody === "string" ? request.requestBody : JSON.stringify(request.requestBody, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            <TabsContent value="response" className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Response Headers</p>
                {request.responseHeaders && Object.keys(request.responseHeaders).length > 0 ? (
                  <div className="rounded-lg bg-card border overflow-hidden">
                    <Table>
                      <TableBody>
                        {Object.entries(request.responseHeaders).map(([k, v]: [string, any]) => (
                          <TableRow key={k}>
                            <TableCell className="font-mono text-xs font-medium w-[200px] py-1.5">{k}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground py-1.5 break-all">{v}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-xs text-muted-foreground">No headers captured</p>}
              </div>
              {request.responseBody && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Response Body</p>
                  <ScrollArea className="max-h-[400px]">
                    <pre className="text-xs font-mono bg-card border rounded-lg p-3 whitespace-pre-wrap break-all">
                      {(() => {
                        try { return JSON.stringify(JSON.parse(request.responseBody), null, 2); } catch { return request.responseBody; }
                      })()}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            {(request.preRequestScripts?.length > 0 || request.testScripts?.length > 0) && (
              <TabsContent value="scripts" className="mt-3 space-y-3">
                {request.preRequestScripts?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Pre-request Script</p>
                    <pre className="text-xs font-mono bg-card border rounded-lg p-3 whitespace-pre-wrap">{request.preRequestScripts.join("\n")}</pre>
                  </div>
                )}
                {request.testScripts?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Test Script</p>
                    <pre className="text-xs font-mono bg-card border rounded-lg p-3 whitespace-pre-wrap">{request.testScripts.join("\n")}</pre>
                  </div>
                )}
              </TabsContent>
            )}

            <TabsContent value="assertions" className="mt-3">
              {request.assertions?.length > 0 ? (
                <div className="space-y-1">
                  {request.assertions.map((a: any, j: number) => (
                    <div key={j} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${a.passed ? 'bg-primary/5' : 'bg-destructive/5'}`}>
                      {a.passed ? <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                      <div>
                        <span className={a.passed ? "text-primary" : "text-destructive"}>{a.name}</span>
                        {a.error && <p className="text-xs text-destructive mt-0.5">{a.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">No assertions for this request</p>}
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Performance Hero Metric Card ───
function MetricCard({ icon: Icon, label, value, subValue, className = "" }: {
  icon: any; label: string; value: string | number; subValue?: string; className?: string;
}) {
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Report ───
export default function NewmanReport() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [run, setRun] = useState<any>(null);
  const [collection, setCollection] = useState<any>(null);
  const [environment, setEnvironment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    supabase.from("newman_test_runs").select("*").eq("id", runId).single().then(async ({ data }) => {
      if (!data) { setLoading(false); return; }
      setRun(data);
      if ((data as any).collection_id) {
        const { data: col } = await supabase.from("newman_collections").select("name").eq("id", (data as any).collection_id).single();
        setCollection(col);
      }
      if ((data as any).environment_id) {
        const { data: env } = await supabase.from("newman_environments").select("name").eq("id", (data as any).environment_id).single();
        setEnvironment(env);
      }
      setLoading(false);
    });
  }, [runId]);

  const handleShare = async () => {
    if (!runId) return;
    setSharing(true);
    try {
      const { data: existing } = await supabase
        .from("newman_shared_reports")
        .select("share_token")
        .eq("run_id", runId)
        .limit(1);

      let token: string;
      if (existing && existing.length > 0) {
        token = (existing[0] as any).share_token;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { data: inserted, error } = await supabase
          .from("newman_shared_reports")
          .insert({ run_id: runId, created_by: user.user?.id } as any)
          .select("share_token")
          .single();
        if (error) throw error;
        token = (inserted as any).share_token;
      }

      const link = `${window.location.origin}/shared/report?token=${token}`;
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      toast({ title: "Share link copied!", description: "Link has been copied to clipboard." });
    } catch (e: any) {
      toast({ title: "Failed to share", description: e.message, variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  // ─── Computed performance metrics ───
  const perfData = useMemo(() => {
    if (!run?.result_data) return null;
    const results = run.result_data as any;
    const requests: any[] = results.requests || [];
    const times = requests.map((r: any) => r.responseTime || 0);
    const sizes = requests.map((r: any) => r.responseSize || 0);
    const totalTime = times.reduce((s: number, t: number) => s + t, 0);

    const avg = times.length > 0 ? Math.round(totalTime / times.length) : 0;
    const min = times.length > 0 ? Math.min(...times) : 0;
    const max = times.length > 0 ? Math.max(...times) : 0;
    const p50 = Math.round(percentile(times, 50));
    const p90 = Math.round(percentile(times, 90));
    const p95 = Math.round(percentile(times, 95));
    const p99 = Math.round(percentile(times, 99));
    const totalSize = sizes.reduce((s: number, v: number) => s + v, 0);

    // Histogram buckets
    const buckets = [
      { range: "0-100ms", min: 0, max: 100 },
      { range: "100-200ms", min: 100, max: 200 },
      { range: "200-500ms", min: 200, max: 500 },
      { range: "500ms-1s", min: 500, max: 1000 },
      { range: "1s-2s", min: 1000, max: 2000 },
      { range: "2s+", min: 2000, max: Infinity },
    ];
    const histogram = buckets.map(b => ({
      range: b.range,
      count: times.filter(t => t >= b.min && t < b.max).length,
      fill: b.max <= 200 ? "hsl(var(--primary))" : b.max <= 500 ? "hsl(var(--primary))" : b.max <= 1000 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
    }));

    // Waterfall data
    let cumulativeStart = 0;
    const waterfall = requests.map((r: any, i: number) => {
      const start = cumulativeStart;
      const duration = r.responseTime || 0;
      cumulativeStart += duration;
      return {
        name: r.name?.length > 25 ? r.name.slice(0, 25) + "…" : (r.name || `#${i + 1}`),
        start,
        duration,
        end: start + duration,
        statusCode: r.statusCode,
        method: r.method,
      };
    });

    // Slowest 5
    const slowest = [...requests]
      .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0))
      .slice(0, 5);

    // Speed distribution
    const fast = times.filter(t => t <= 200).length;
    const normal = times.filter(t => t > 200 && t <= 500).length;
    const slow = times.filter(t => t > 500 && t <= 1000).length;
    const verySlow = times.filter(t => t > 1000).length;

    // Status distribution
    const statusDist: Record<string, number> = {};
    requests.forEach((r: any) => {
      const s = String(r.statusCode || "unknown");
      statusDist[s] = (statusDist[s] || 0) + 1;
    });

    return {
      requests, times, avg, min, max, p50, p90, p95, p99,
      totalTime, totalSize, histogram, waterfall, slowest,
      fast, normal, slow, verySlow, statusDist,
      summary: results.summary || {},
      assertions: results.assertions || {},
      errors: results.errors || [],
      cliOutput: results.cli_output,
    };
  }, [run]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  if (!run) return <div className="flex items-center justify-center py-20 text-muted-foreground">Run not found</div>;
  if (!perfData) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
      <p className="text-muted-foreground">No result data available for this run.</p>
    </div>
  );

  const { requests, assertions, errors: errorList, slowest, histogram, waterfall, statusDist } = perfData;
  const folderName = (run as any).folder_name;
  const failedRequests = requests.filter(r => r.assertions?.some((a: any) => !a.passed));

  const passFailData = [
    { name: "Passed", value: assertions.passed || perfData.summary.passed || 0, fill: "hsl(var(--primary))" },
    { name: "Failed", value: assertions.failed || perfData.summary.failed || 0, fill: "hsl(var(--destructive))" },
  ];

  const statusChartData = Object.entries(statusDist).map(([code, count]) => ({
    name: code, value: count,
    fill: code.startsWith("2") ? "hsl(var(--primary))" : code.startsWith("4") ? "hsl(var(--warning))" : code.startsWith("5") ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
  }));

  const duration = run.started_at && run.completed_at
    ? ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)
    : null;

  const total = (assertions.passed || 0) + (assertions.failed || 0);
  const passRate = total > 0 ? ((assertions.passed || 0) / total * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">API Test Report</h1>
          <p className="text-muted-foreground text-sm truncate">
            {(collection as any)?.name || "Unknown Collection"}
            {folderName && <> / <Badge variant="outline" className="text-xs ml-1">{folderName}</Badge></>}
            {" • "}{(environment as any)?.name || "No Environment"} • {new Date(run.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
            {shareLink ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
            {sharing ? "Sharing..." : shareLink ? "Copied!" : "Share"}
          </Button>
          <Badge variant={run.status === "passed" ? "secondary" : run.status === "failed" ? "destructive" : "outline"} className="text-sm px-3 py-1">
            {run.status === "passed" ? <CheckCircle className="h-3.5 w-3.5 mr-1" /> : run.status === "failed" ? <XCircle className="h-3.5 w-3.5 mr-1" /> : null}
            {run.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* ─── Performance Hero Section ─── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Gauge} label="Avg Response Time" value={`${perfData.avg}ms`} subValue={`Min ${perfData.min}ms • Max ${perfData.max}ms`} />
        <MetricCard icon={Timer} label="P95 Response Time" value={`${perfData.p95}ms`} subValue={`P50 ${perfData.p50}ms • P99 ${perfData.p99}ms`} />
        <MetricCard icon={Activity} label="Total Requests" value={perfData.summary.total_requests || requests.length} subValue={duration ? `Duration: ${duration}s` : undefined} />
        <MetricCard icon={TrendingUp} label="Pass Rate" value={`${passRate}%`} subValue={`${assertions.passed || 0} passed • ${assertions.failed || 0} failed`} />
      </div>

      {/* ─── Speed Distribution Bar ─── */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Speed Distribution</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {requests.length > 0 && (
              <>
                {perfData.fast > 0 && <div className="bg-primary transition-all" style={{ width: `${(perfData.fast / requests.length) * 100}%` }} title={`Fast: ${perfData.fast}`} />}
                {perfData.normal > 0 && <div className="bg-[hsl(var(--info))]  transition-all" style={{ width: `${(perfData.normal / requests.length) * 100}%` }} title={`Normal: ${perfData.normal}`} />}
                {perfData.slow > 0 && <div className="bg-[hsl(var(--warning))] transition-all" style={{ width: `${(perfData.slow / requests.length) * 100}%` }} title={`Slow: ${perfData.slow}`} />}
                {perfData.verySlow > 0 && <div className="bg-destructive transition-all" style={{ width: `${(perfData.verySlow / requests.length) * 100}%` }} title={`Very Slow: ${perfData.verySlow}`} />}
              </>
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> ≤200ms ({perfData.fast})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--info))] inline-block" /> 200-500ms ({perfData.normal})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--warning))] inline-block" /> 500ms-1s ({perfData.slow})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> &gt;1s ({perfData.verySlow})</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Donut Charts ─── */}
       <div className="grid gap-4 lg:grid-cols-2">
         {(() => {
           const reqPassed = requests.filter((r: any) => !r.assertions?.some((a: any) => !a.passed)).length;
           const reqFailed = requests.length - reqPassed;
           const reqDonutData = [
             { name: "Passed", value: reqPassed, fill: "hsl(var(--primary))" },
             { name: "Failed", value: reqFailed, fill: "hsl(var(--destructive))" },
           ];
           const reqPassRate = requests.length > 0 ? ((reqPassed / requests.length) * 100).toFixed(1) : "0";
           return (
             <Card>
               <CardHeader className="pb-2"><CardTitle className="text-base">Request Pass Rate</CardTitle></CardHeader>
               <CardContent className="flex flex-col items-center">
                 <ResponsiveContainer width="100%" height={200}>
                   <PieChart>
                     <Pie data={reqDonutData.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} strokeWidth={2} stroke="hsl(var(--card))" label={(e) => { const pct = ((e.value / requests.length) * 100).toFixed(1); return `${e.name}: ${e.value} (${pct}%)`; }}>
                       {reqDonutData.filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.fill} />)}
                     </Pie>
                     <Legend />
                     <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
                 <p className="text-2xl font-bold mt-1">{reqPassRate}%</p>
                 <p className="text-xs text-muted-foreground">{reqPassed}/{requests.length} requests passed</p>
               </CardContent>
             </Card>
           );
         })()}
         <Card>
           <CardHeader className="pb-2"><CardTitle className="text-base">Assertion Pass / Fail</CardTitle></CardHeader>
           <CardContent className="flex flex-col items-center">
             <ResponsiveContainer width="100%" height={200}>
               <PieChart>
                 <Pie data={passFailData.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} strokeWidth={2} stroke="hsl(var(--card))" label={(e) => { const pct = (total > 0 ? (e.value / total) * 100 : 0).toFixed(1); return `${e.name}: ${e.value} (${pct}%)`; }}>
                   {passFailData.filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.fill} />)}
                 </Pie>
                 <Legend />
                 <Tooltip />
               </PieChart>
             </ResponsiveContainer>
             <p className="text-2xl font-bold mt-1">{passRate}%</p>
             <p className="text-xs text-muted-foreground">{assertions.passed || 0}/{total} assertions passed</p>
           </CardContent>
         </Card>
       </div>
      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance"><Activity className="h-3.5 w-3.5 mr-1" />Performance</TabsTrigger>
          <TabsTrigger value="steps">Steps ({requests.length})</TabsTrigger>
          {failedRequests.length > 0 && (
            <TabsTrigger value="failures">
              <XCircle className="h-3.5 w-3.5 mr-1" />Failures ({failedRequests.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="errors">Errors ({errorList.length})</TabsTrigger>
          {perfData.cliOutput && <TabsTrigger value="logs">CLI Logs</TabsTrigger>}
        </TabsList>

        {/* ─── Performance Tab ─── */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Response Time Histogram */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Response Time Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {histogram.map((h, i) => <Cell key={i} fill={h.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Percentile Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Response Time Percentiles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "P50 (Median)", value: perfData.p50, max: perfData.max },
                  { label: "P90", value: perfData.p90, max: perfData.max },
                  { label: "P95", value: perfData.p95, max: perfData.max },
                  { label: "P99", value: perfData.p99, max: perfData.max },
                ].map((p) => (
                  <div key={p.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{p.label}</span>
                      <span className={`font-mono font-semibold ${getSpeedClass(p.value)}`}>{p.value}ms</span>
                    </div>
                    <Progress value={p.max > 0 ? (p.value / p.max) * 100 : 0} className="h-2" />
                  </div>
                ))}
                <div className="pt-2 border-t grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Total Transfer</p>
                    <p className="font-semibold">{(perfData.totalSize / 1024).toFixed(1)} KB</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Time</p>
                    <p className="font-semibold">{(perfData.totalTime / 1000).toFixed(2)}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Waterfall Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ArrowUpDown className="h-4 w-4" />Request Waterfall</CardTitle>
              <CardDescription>Sequential execution timeline showing each request's duration</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, waterfall.length * 32)}>
                <BarChart data={waterfall} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}ms`} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                      if (name === "start") return [null, null];
                      return [`${value}ms`, "Duration"];
                    }}
                    labelFormatter={(label) => label}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="start" stackId="a" fill="transparent" />
                  <Bar dataKey="duration" stackId="a" radius={[0, 4, 4, 0]}>
                    {waterfall.map((w, i) => (
                      <Cell key={i} fill={w.duration <= 200 ? "hsl(var(--primary))" : w.duration <= 500 ? "hsl(var(--info))" : w.duration <= 1000 ? "hsl(var(--warning))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                  <ReferenceLine x={perfData.avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Avg: ${perfData.avg}ms`, position: "top", fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Slowest Endpoints */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Slowest Endpoints</CardTitle>
              <CardDescription>Top 5 slowest API calls that may need optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {slowest.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>
                    <Badge variant={r.method === "GET" ? "secondary" : r.method === "POST" ? "default" : "outline"} className="text-xs font-mono min-w-[50px] justify-center">
                      {r.method}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{r.url}</p>
                    </div>
                    <Badge variant={String(r.statusCode).startsWith("2") ? "secondary" : "destructive"} className="text-xs font-mono">{r.statusCode}</Badge>
                    <div className="text-right">
                      <p className={`text-lg font-bold font-mono ${getSpeedClass(r.responseTime)}`}>{r.responseTime}ms</p>
                      <p className="text-[10px] text-muted-foreground">{getSpeedLabel(r.responseTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Response Time per Request bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Response Time per Request</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={requests.map((r: any, i: number) => ({
                  name: r.name?.length > 20 ? r.name.slice(0, 20) + "…" : r.name,
                  time: r.responseTime || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={80} className="fill-muted-foreground" />
                  <YAxis className="fill-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}ms`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}ms`, "Response Time"]} />
                  <ReferenceLine y={perfData.avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Avg`, position: "right", fontSize: 10 }} />
                  <ReferenceLine y={perfData.p95} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `P95`, position: "right", fontSize: 10 }} />
                  <Bar dataKey="time" radius={[4, 4, 0, 0]}>
                    {requests.map((r: any, i: number) => (
                      <Cell key={i} fill={(r.responseTime || 0) <= 200 ? "hsl(var(--primary))" : (r.responseTime || 0) <= 500 ? "hsl(var(--info))" : (r.responseTime || 0) <= 1000 ? "hsl(var(--warning))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Steps Tab ─── */}
        <TabsContent value="steps">
          <Card className="overflow-hidden">
            {requests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No request data available</div>
            ) : (
              requests.map((r: any, i: number) => (
                <RequestDetail key={i} request={{ ...r, index: r.index ?? i }} />
              ))
            )}
          </Card>
        </TabsContent>

        {/* ─── Failures Tab ─── */}
        {failedRequests.length > 0 && (
          <TabsContent value="failures">
            <Card className="overflow-hidden">
              {failedRequests.map((r: any, i: number) => (
                <RequestDetail key={i} request={r} />
              ))}
            </Card>
          </TabsContent>
        )}

        {/* ─── Errors Tab ─── */}
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
                        <span className="text-sm font-medium">{err.requestName || `Request #${i + 1}`}</span>
                        <Badge variant="destructive" className="text-xs">{err.statusCode || "Error"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">{err.message}</p>
                      {err.stack && (
                        <pre className="text-xs bg-muted p-2 rounded ml-6 overflow-auto max-h-[100px] font-mono">{err.stack}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        </TabsContent>

        {/* ─── CLI Logs Tab ─── */}
        {perfData.cliOutput && (
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Newman CLI Output</CardTitle>
                <CardDescription>Raw output from the Newman CLI execution</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[600px]">
                  <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-4 rounded-lg overflow-auto">{perfData.cliOutput}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
