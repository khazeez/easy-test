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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type") || "newman"; // newman, k6, bundle

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── Bundle share ───
    if (type === "bundle") {
      const { data: bundle, error: bundleErr } = await supabase
        .from("shared_report_bundles")
        .select("*")
        .eq("share_token", token)
        .single();

      if (bundleErr || !bundle) {
        return new Response(JSON.stringify({ error: "Invalid or expired bundle link" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: items } = await supabase
        .from("shared_report_bundle_items")
        .select("*")
        .eq("bundle_id", bundle.id)
        .order("created_at");

      const runs: any[] = [];
      for (const item of (items || [])) {
        if (item.runner_type === "newman") {
          const { data: run } = await supabase.from("newman_test_runs").select("*").eq("id", item.run_id).single();
          if (run) {
            let collectionName = null;
            let environmentName = null;
            if (run.collection_id) {
              const { data: col } = await supabase.from("newman_collections").select("name").eq("id", run.collection_id).single();
              collectionName = col?.name;
            }
            if (run.environment_id) {
              const { data: env } = await supabase.from("newman_environments").select("name").eq("id", run.environment_id).single();
              environmentName = env?.name;
            }
            runs.push({ runner_type: "newman", run, collectionName, environmentName });
          }
        } else if (item.runner_type === "k6") {
          const { data: run } = await supabase.from("k6_test_runs").select("*").eq("id", item.run_id).single();
          if (run) {
            let configName = null;
            let environmentName = null;
            if (run.test_config_id) {
              const { data: cfg } = await supabase.from("k6_test_configs").select("name").eq("id", run.test_config_id).single();
              configName = cfg?.name;
            }
            if (run.environment_id) {
              const { data: env } = await supabase.from("k6_environments").select("name").eq("id", run.environment_id).single();
              environmentName = env?.name;
            }
            runs.push({ runner_type: "k6", run, configName, environmentName });
          }
        }
      }

      return new Response(
        JSON.stringify({ type: "bundle", bundle, runs }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── K6 single share ───
    if (type === "k6") {
      const { data: shared, error: sharedErr } = await supabase
        .from("k6_shared_reports")
        .select("*")
        .eq("share_token", token)
        .single();

      if (sharedErr || !shared) {
        return new Response(JSON.stringify({ error: "Invalid or expired share link" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: run, error: runErr } = await supabase
        .from("k6_test_runs")
        .select("*")
        .eq("id", shared.run_id)
        .single();

      if (runErr || !run) {
        return new Response(JSON.stringify({ error: "Test run not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let configName = null;
      let environmentName = null;
      if (run.test_config_id) {
        const { data: cfg } = await supabase.from("k6_test_configs").select("name, vus, duration").eq("id", run.test_config_id).single();
        configName = cfg?.name;
      }
      if (run.environment_id) {
        const { data: env } = await supabase.from("k6_environments").select("name").eq("id", run.environment_id).single();
        environmentName = env?.name;
      }

      return new Response(
        JSON.stringify({ type: "k6", run, configName, environmentName, shared_at: shared.created_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Newman single share (default) ───
    const { data: shared, error: sharedErr } = await supabase
      .from("newman_shared_reports")
      .select("*")
      .eq("share_token", token)
      .single();

    if (sharedErr || !shared) {
      return new Response(JSON.stringify({ error: "Invalid or expired share link" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run, error: runErr } = await supabase
      .from("newman_test_runs")
      .select("*")
      .eq("id", shared.run_id)
      .single();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Test run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let collectionName = null;
    let environmentName = null;

    if (run.collection_id) {
      const { data: col } = await supabase.from("newman_collections").select("name").eq("id", run.collection_id).single();
      collectionName = col?.name;
    }

    if (run.environment_id) {
      const { data: env } = await supabase.from("newman_environments").select("name").eq("id", run.environment_id).single();
      environmentName = env?.name;
    }

    return new Response(
      JSON.stringify({
        type: "newman",
        run,
        collectionName,
        environmentName,
        shared_at: shared.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
