import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { run_id } = await req.json();

    if (!run_id) {
      return new Response(JSON.stringify({ error: "run_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify run exists
    const { data: run, error: runError } = await supabase
      .from("k6_test_runs")
      .select("*")
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const githubPat = Deno.env.get("GITHUB_PAT");
    const githubRepo = Deno.env.get("GITHUB_REPO");

    if (!githubPat || !githubRepo) {
      return new Response(
        JSON.stringify({ error: "GitHub PAT or repo not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // First, list workflows to find the correct workflow ID
    const listUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows`;
    console.log("Listing workflows from:", listUrl);

    const listResponse = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!listResponse.ok) {
      const errText = await listResponse.text();
      console.error("Failed to list workflows:", listResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Failed to list workflows: ${listResponse.status}`, details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workflowsData = await listResponse.json();
    const workflows = workflowsData.workflows || [];
    console.log("Found workflows:", workflows.map((w: any) => `${w.name} (${w.path}, id: ${w.id})`).join(", "));

    // Find k6 workflow by name or path
    const k6Workflow = workflows.find((w: any) =>
      w.path === ".github/workflows/k6-runner.yml" ||
      w.name === "k6 Load Test Runner"
    );

    if (!k6Workflow) {
      const available = workflows.map((w: any) => `${w.name} (${w.path})`).join(", ");
      console.error("k6 workflow not found. Available:", available);
      return new Response(
        JSON.stringify({ error: "k6 workflow not found in repository", available_workflows: available }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use workflow ID instead of filename for dispatch
    const workflowUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${k6Workflow.id}/dispatches`;
    console.log("Triggering k6 workflow:", workflowUrl, "id:", k6Workflow.id);

    const ghResponse = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          run_id: run_id,
          supabase_url: supabaseUrl,
          supabase_service_key: serviceKey,
        },
      }),
    });

    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      console.error("GitHub API error:", ghResponse.status, errText);
      const adminClient = createClient(supabaseUrl, serviceKey);
      await adminClient.from("k6_test_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        result_data: { error: `GitHub API error: ${ghResponse.status} - ${errText}` } as any,
      }).eq("id", run_id);

      return new Response(
        JSON.stringify({ error: `GitHub API error: ${ghResponse.status}`, details: errText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "k6 workflow triggered" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
