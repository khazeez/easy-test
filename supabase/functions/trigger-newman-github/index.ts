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

    const { run_id, skip_ssl, folder_name } = await req.json();

    if (!run_id) {
      return new Response(JSON.stringify({ error: "run_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify run exists
    const { data: run, error: runError } = await supabase
      .from("newman_test_runs")
      .select("*")
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger GitHub Actions workflow - only send minimal data
    // The workflow will fetch collection/environment from Supabase directly
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

    const workflowUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/newman-runner.yml/dispatches`;
    console.log("GitHub repo:", githubRepo);
    console.log("Workflow URL:", workflowUrl);

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
          skip_ssl: skip_ssl ? "true" : "false",
          folder_name: folder_name || "",
        },
      }),
    });

    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      console.log("GitHub API error:", ghResponse.status, errText);
      const adminClient = createClient(supabaseUrl, serviceKey);
      await adminClient.from("newman_test_runs").update({
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
      JSON.stringify({ success: true, message: "Workflow triggered" }),
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
