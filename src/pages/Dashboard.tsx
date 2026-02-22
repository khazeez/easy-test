import { useProjects } from "@/hooks/useProjects";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Activity, FileJson, Gauge } from "lucide-react";

export default function Dashboard() {
  const { currentProject } = useProjects();
  const [stats, setStats] = useState({ newmanRuns: 0, k6Runs: 0, newmanPass: 0, newmanFail: 0, k6Pass: 0, k6Fail: 0 });
  const [recentNewman, setRecentNewman] = useState<any[]>([]);
  const [recentK6, setRecentK6] = useState<any[]>([]);

  useEffect(() => {
    if (!currentProject) return;
    const pid = currentProject.id;

    Promise.all([
      supabase.from("newman_test_runs").select("*").eq("project_id", pid).order("created_at", { ascending: false }).limit(5),
      supabase.from("k6_test_runs").select("*").eq("project_id", pid).order("created_at", { ascending: false }).limit(5),
    ]).then(([nr, kr]) => {
      const nrData = (nr.data || []) as any[];
      const krData = (kr.data || []) as any[];
      setRecentNewman(nrData);
      setRecentK6(krData);
      setStats({
        newmanRuns: nrData.length,
        k6Runs: krData.length,
        newmanPass: nrData.filter((r) => r.status === "passed").length,
        newmanFail: nrData.filter((r) => r.status === "failed").length,
        k6Pass: krData.filter((r) => r.status === "passed").length,
        k6Fail: krData.filter((r) => r.status === "failed").length,
      });
    });
  }, [currentProject]);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Activity className="h-12 w-12 mb-4" />
        <p className="text-lg">Create a project to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview for {currentProject.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Newman Runs</CardTitle>
            <FileJson className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newmanRuns}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-xs"><CheckCircle className="mr-1 h-3 w-3" />{stats.newmanPass}</Badge>
              <Badge variant="destructive" className="text-xs"><XCircle className="mr-1 h-3 w-3" />{stats.newmanFail}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">k6 Runs</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.k6Runs}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-xs"><CheckCircle className="mr-1 h-3 w-3" />{stats.k6Pass}</Badge>
              <Badge variant="destructive" className="text-xs"><XCircle className="mr-1 h-3 w-3" />{stats.k6Fail}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newmanRuns + stats.k6Runs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.newmanRuns + stats.k6Runs > 0
                ? Math.round(((stats.newmanPass + stats.k6Pass) / (stats.newmanRuns + stats.k6Runs)) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Newman Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {recentNewman.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test runs yet</p>
            ) : (
              <div className="space-y-2">
                {recentNewman.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      {r.status === "passed" ? <CheckCircle className="h-4 w-4 text-primary" /> : r.status === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <Badge variant={r.status === "passed" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent k6 Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {recentK6.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test runs yet</p>
            ) : (
              <div className="space-y-2">
                {recentK6.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      {r.status === "passed" ? <CheckCircle className="h-4 w-4 text-primary" /> : r.status === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <Badge variant={r.status === "passed" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
