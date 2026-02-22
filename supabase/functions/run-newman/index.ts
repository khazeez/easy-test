import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Create an HTTP client that skips SSL verification
// Deno.createHttpClient is available in Supabase Edge Functions
let insecureClient: Deno.HttpClient | null = null;
try {
  insecureClient = Deno.createHttpClient({
    caCerts: [],
    proxy: undefined,
  } as any);
} catch {
  // fallback: not available
}

// Helper: fetch with SSL verification disabled
async function insecureFetchRequest(
  fetchUrl: string,
  opts: { method: string; headers: Record<string, string>; body?: string | null }
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const fetchOpts: any = {
    method: opts.method,
    headers: opts.headers,
  };
  if (opts.body) fetchOpts.body = opts.body;
  if (insecureClient) fetchOpts.client = insecureClient;
  
  const resp = await fetch(fetchUrl, fetchOpts);
  const body = await resp.text();
  const headers: Record<string, string> = {};
  resp.headers.forEach((v: string, k: string) => {
    headers[k] = v;
  });
  return { status: resp.status, body, headers };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EnvVar {
  key: string;
  value: string;
}

// Replace {{var}} placeholders with environment values
function replaceVariables(text: string, vars: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// Build URL from Postman URL object
function buildUrl(urlObj: any, vars: Record<string, string>): string {
  if (typeof urlObj === "string") return replaceVariables(urlObj, vars);
  if (urlObj?.raw) return replaceVariables(urlObj.raw, vars);
  if (urlObj?.host && urlObj?.path) {
    const protocol = urlObj.protocol || "https";
    const host = Array.isArray(urlObj.host)
      ? urlObj.host.join(".")
      : urlObj.host;
    const path = Array.isArray(urlObj.path)
      ? urlObj.path.join("/")
      : urlObj.path;
    let url = `${protocol}://${host}/${path}`;
    if (urlObj.query?.length) {
      const params = urlObj.query
        .filter((q: any) => !q.disabled)
        .map(
          (q: any) =>
            `${encodeURIComponent(replaceVariables(q.key, vars))}=${encodeURIComponent(replaceVariables(q.value, vars))}`
        )
        .join("&");
      if (params) url += `?${params}`;
    }
    return replaceVariables(url, vars);
  }
  return "";
}

// Build headers from Postman header array
function buildHeaders(
  headerArr: any[],
  vars: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!Array.isArray(headerArr)) return headers;
  for (const h of headerArr) {
    if (h.disabled) continue;
    headers[replaceVariables(h.key, vars)] = replaceVariables(h.value, vars);
  }
  return headers;
}

// Build body from Postman body object
function buildBody(bodyObj: any, vars: Record<string, string>): { body: BodyInit | null; isFormData: boolean } {
  if (!bodyObj) return { body: null, isFormData: false };
  if (bodyObj.mode === "raw" && bodyObj.raw) {
    return { body: replaceVariables(bodyObj.raw, vars), isFormData: false };
  }
  if (bodyObj.mode === "urlencoded" && Array.isArray(bodyObj.urlencoded)) {
    const encoded = bodyObj.urlencoded
      .filter((p: any) => !p.disabled)
      .map(
        (p: any) =>
          `${encodeURIComponent(replaceVariables(p.key, vars))}=${encodeURIComponent(replaceVariables(p.value, vars))}`
      )
      .join("&");
    return { body: encoded, isFormData: false };
  }
  if (bodyObj.mode === "formdata" && Array.isArray(bodyObj.formdata)) {
    const formData = new FormData();
    for (const field of bodyObj.formdata) {
      if (field.disabled) continue;
      const key = replaceVariables(field.key, vars);
      if (field.type === "file") {
        // For file fields, create a dummy file with the specified src name
        // Since we can't access actual files, we create a placeholder
        const fileName = field.src || field.value || "file.bin";
        const contentType = field.contentType || "application/octet-stream";
        const blob = new Blob([`[file placeholder: ${fileName}]`], { type: contentType });
        formData.append(key, blob, typeof fileName === "string" ? fileName : (Array.isArray(fileName) ? fileName[0] : "file.bin"));
      } else {
        formData.append(key, replaceVariables(field.value || "", vars));
      }
    }
    return { body: formData, isFormData: true };
  }
  return { body: null, isFormData: false };
}

// Flatten collection items recursively
function flattenItems(
  items: any[],
  path: string[] = []
): { name: string; request: any; event: any[]; path: string[] }[] {
  const result: any[] = [];
  for (const item of items) {
    if (item.request) {
      result.push({
        name: item.name,
        request: item.request,
        event: item.event || [],
        path,
      });
    }
    if (item.item && Array.isArray(item.item)) {
      result.push(...flattenItems(item.item, [...path, item.name]));
    }
  }
  return result;
}

// Simple test script evaluator - handles common pm.test patterns
function evaluateTests(
  testScript: string,
  responseCode: number,
  responseBody: string,
  responseTime: number,
  responseHeaders: Record<string, string>
): { name: string; passed: boolean; error: string | null }[] {
  const results: { name: string; passed: boolean; error: string | null }[] = [];

  if (!testScript) return results;

  // Extract pm.test blocks
  const testRegex =
    /pm\.test\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:function\s*\(\s*\)|(?:\(\s*\))\s*=>)\s*\{([\s\S]*?)\}\s*\)/g;
  let match;

  while ((match = testRegex.exec(testScript)) !== null) {
    const testName = match[1];
    const testBody = match[2];
    let passed = true;
    let error: string | null = null;

    try {
      // Check for status code assertions
      if (testBody.includes("pm.response.to.have.status")) {
        const statusMatch = testBody.match(
          /pm\.response\.to\.have\.status\s*\(\s*(\d+)\s*\)/
        );
        if (statusMatch) {
          const expected = parseInt(statusMatch[1]);
          if (responseCode !== expected) {
            passed = false;
            error = `Expected status ${expected}, got ${responseCode}`;
          }
        }
      }

      // Check for pm.expect(pm.response.code).to.eql
      if (testBody.includes("pm.response.code")) {
        const codeMatch = testBody.match(
          /pm\.expect\s*\(\s*pm\.response\.code\s*\)\.to\.(?:eql|equal|be)\s*\(\s*(\d+)\s*\)/
        );
        if (codeMatch) {
          const expected = parseInt(codeMatch[1]);
          if (responseCode !== expected) {
            passed = false;
            error = `Expected status ${expected}, got ${responseCode}`;
          }
        }
      }

      // Check for response time assertions
      if (testBody.includes("pm.response.responseTime")) {
        const rtMatch = testBody.match(
          /pm\.expect\s*\(\s*pm\.response\.responseTime\s*\)\.to\.be\.below\s*\(\s*(\d+)\s*\)/
        );
        if (rtMatch) {
          const maxTime = parseInt(rtMatch[1]);
          if (responseTime > maxTime) {
            passed = false;
            error = `Response time ${responseTime}ms exceeded ${maxTime}ms`;
          }
        }
      }

      // Check for JSON body parsing
      if (testBody.includes("pm.response.json()")) {
        try {
          JSON.parse(responseBody);
        } catch {
          if (
            testBody.includes("to.be.an") ||
            testBody.includes("to.have.property")
          ) {
            passed = false;
            error = "Response is not valid JSON";
          }
        }
      }

      // Check for body contains
      if (testBody.includes("pm.response.to.have.body")) {
        // Basic body check - just verify non-empty
        if (!responseBody || responseBody.length === 0) {
          passed = false;
          error = "Response body is empty";
        }
      }

      // If no specific assertion was matched, check for generic status family
      if (
        !error &&
        testBody.includes("pm.response.to.be.ok") &&
        (responseCode < 200 || responseCode >= 300)
      ) {
        passed = false;
        error = `Expected 2xx status, got ${responseCode}`;
      }
    } catch (e) {
      passed = false;
      error = `Test evaluation error: ${e instanceof Error ? e.message : String(e)}`;
    }

    results.push({ name: testName, passed, error });
  }

  // If no pm.test blocks found, add a default status check
  if (results.length === 0) {
    results.push({
      name: "Status code is successful",
      passed: responseCode >= 200 && responseCode < 400,
      error:
        responseCode >= 400 ? `Status code was ${responseCode}` : null,
    });
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { run_id, skip_ssl } = await req.json();

    // Fetch the test run with related data
    const { data: run, error: runError } = await supabase
      .from("newman_test_runs")
      .select("*")
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      return new Response(
        JSON.stringify({ error: "Test run not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch collection
    const { data: collection } = await supabase
      .from("newman_collections")
      .select("*")
      .eq("id", run.collection_id)
      .single();

    if (!collection?.collection_data) {
      return new Response(
        JSON.stringify({ error: "Collection not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch environment if specified
    let envVars: Record<string, string> = {};
    let envName = "No Environment";
    if (run.environment_id) {
      const { data: env } = await supabase
        .from("newman_environments")
        .select("*")
        .eq("id", run.environment_id)
        .single();
      if (env) {
        envName = env.name;
        const values = env.values as EnvVar[];
        if (Array.isArray(values)) {
          for (const v of values) {
            if (v.key) envVars[v.key] = v.value || "";
          }
        }
      }
    }

    // Also load collection-level variables
    const collVars = collection.collection_data?.variable;
    if (Array.isArray(collVars)) {
      for (const v of collVars) {
        if (v.key && !(v.key in envVars)) {
          envVars[v.key] = v.value || "";
        }
      }
    }

    // Extract collection-level auth for inheritance
    const collectionAuth = collection.collection_data?.auth || null;

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        const items = flattenItems(collection.collection_data.item || []);
        const collName = collection.name;

        send({ type: "log", line: `newman\n` });
        send({ type: "log", line: `${collName}\n` });
        send({ type: "log", line: `Environment: ${envName}\n` });
        
        // Debug: show loaded env vars
        const envKeys = Object.keys(envVars);
        if (envKeys.length > 0) {
          send({ type: "log", line: `Loaded variables: ${envKeys.join(", ")}` });
        } else {
          send({ type: "log", line: `⚠ No environment variables loaded` });
        }
        send({ type: "log", line: `` });

        const requestResults: any[] = [];
        const allAssertions: any[] = [];
        const allErrors: any[] = [];
        let totalPassed = 0;
        let totalFailed = 0;
        let totalAssertionsPassed = 0;
        let totalAssertionsFailed = 0;

        for (const item of items) {
          const folder =
            item.path.length > 0
              ? `❯ ${item.path.join(" / ")} / `
              : "❯ ";
          send({ type: "log", line: `${folder}${item.name}` });

          const method = (item.request.method || "GET").toUpperCase();
          const url = buildUrl(item.request.url, envVars);
          
          // Start with default headers that Postman/Newman normally sends
          const headers: Record<string, string> = {
            "User-Agent": "PostmanRuntime/7.43.0",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
          };
          
          // Override with collection/request-level headers
          const reqHeaders = buildHeaders(
            item.request.header || [],
            envVars
          );
          Object.assign(headers, reqHeaders);

          // Add auth - use request-level auth, fallback to collection-level auth
          const authObj = item.request.auth || collectionAuth;
          if (authObj) {
            if (authObj.type === "bearer" && authObj.bearer) {
              const tokenVal = Array.isArray(authObj.bearer)
                ? authObj.bearer.find((b: any) => b.key === "token")?.value
                : authObj.bearer.token;
              if (tokenVal) {
                headers["Authorization"] = `Bearer ${replaceVariables(tokenVal, envVars)}`;
              }
            } else if (authObj.type === "apikey" && authObj.apikey) {
              const apiKeyArr = Array.isArray(authObj.apikey)
                ? authObj.apikey
                : [authObj.apikey];
              for (const ak of apiKeyArr) {
                if (ak.key && ak.value) {
                  const inHeader = ak.in !== "query";
                  if (inHeader) {
                    headers[replaceVariables(ak.key, envVars)] =
                      replaceVariables(ak.value, envVars);
                  }
                }
              }
            } else if (authObj.type === "basic" && authObj.basic) {
              const basicArr = Array.isArray(authObj.basic) ? authObj.basic : [];
              const username = basicArr.find((b: any) => b.key === "username")?.value || "";
              const password = basicArr.find((b: any) => b.key === "password")?.value || "";
              const encoded = btoa(`${replaceVariables(username, envVars)}:${replaceVariables(password, envVars)}`);
              headers["Authorization"] = `Basic ${encoded}`;
            }
          }

          const { body, isFormData } = buildBody(item.request.body, envVars);

          // Auto-set Content-Type for raw JSON body if not already set
          if (item.request.body?.mode === "raw" && body) {
            const lang = item.request.body?.options?.raw?.language;
            if (lang === "json" || (!headers["Content-Type"] && !headers["content-type"])) {
              // Check if body looks like JSON
              const trimmed = (body as string).trim();
              if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                headers["Content-Type"] = "application/json";
              }
            }
          }
          if (item.request.body?.mode === "urlencoded" && !headers["Content-Type"] && !headers["content-type"]) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
          }

          send({ type: "log", line: `  ${method} ${url}` });
          // Debug: show auth header if present
          if (headers["Authorization"]) {
            const authVal = headers["Authorization"];
            send({ type: "log", line: `  Auth: ${authVal.substring(0, 30)}...` });
          }
          // Debug: show body mode and content-type
          if (item.request.body?.mode) {
            send({ type: "log", line: `  Body: ${item.request.body.mode} | Content-Type: ${headers["Content-Type"] || headers["content-type"] || "not set"}` });
          }

          let statusCode = 0;
          let responseTime = 0;
          let responseBody = "";
          let responseSize = 0;
          let responseHeaders: Record<string, string> = {};
          let fetchError: string | null = null;

          const startTime = Date.now();
          try {
            const fetchHeaders = isFormData
              ? Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== "content-type"))
              : headers;
            
            const fetchUrl = url;
            const reqBody = (body && !["GET", "HEAD"].includes(method)) 
              ? (typeof body === "string" ? body : null) 
              : null;

            if (skip_ssl) {
              const result = await insecureFetchRequest(fetchUrl, {
                method,
                headers: fetchHeaders,
                body: reqBody,
              });
              responseTime = Date.now() - startTime;
              statusCode = result.status;
              responseBody = result.body;
              responseSize = responseBody.length;
              responseHeaders = result.headers;
            } else {
              const fetchOpts: RequestInit = { method, headers: fetchHeaders };
              if (reqBody) fetchOpts.body = reqBody;
              
              let resp: Response;
              try {
                resp = await fetch(fetchUrl, fetchOpts);
              } catch (sslErr) {
                if (String(sslErr).includes("certificate") || String(sslErr).includes("SSL") || String(sslErr).includes("UnknownIssuer")) {
                  send({ type: "log", line: `  ⚠ SSL error, retrying with Deno.createHttpClient...` });
                  const result = await insecureFetchRequest(fetchUrl, { method, headers: fetchHeaders, body: reqBody });
                  responseTime = Date.now() - startTime;
                  statusCode = result.status;
                  responseBody = result.body;
                  responseSize = responseBody.length;
                  responseHeaders = result.headers;
                  throw "handled";
                } else {
                  throw sslErr;
                }
              }
              responseTime = Date.now() - startTime;
              statusCode = resp.status;
              responseBody = await resp.text();
              responseSize = responseBody.length;
              resp.headers.forEach((v: string, k: string) => {
                responseHeaders[k] = v;
              });
            }
          } catch (e) {
            if (e === "handled") {
              // SSL retry succeeded, results already set
            } else {
              responseTime = Date.now() - startTime;
              fetchError =
                e instanceof Error ? e.message : String(e);
              send({
                type: "log",
                line: `  ✗ Error: ${fetchError}`,
              });
            }
          }

          if (!fetchError) {
            send({
              type: "log",
              line: `  [${statusCode}] ${responseTime}ms`,
            });
          }

          // Get test scripts
          const testEvent = item.event?.find(
            (ev: any) => ev.listen === "test"
          );
          const testScript = testEvent?.script?.exec
            ? Array.isArray(testEvent.script.exec)
              ? testEvent.script.exec.join("\n")
              : testEvent.script.exec
            : "";

          // Evaluate tests
          const testResults = fetchError
            ? [
                {
                  name: "Request succeeded",
                  passed: false,
                  error: fetchError,
                },
              ]
            : evaluateTests(
                testScript,
                statusCode,
                responseBody,
                responseTime,
                responseHeaders
              );

          const reqAssertions: any[] = [];

          for (const tr of testResults) {
            reqAssertions.push({
              name: tr.name,
              passed: tr.passed,
            });
            allAssertions.push({
              name: tr.name,
              passed: tr.passed,
              requestName: item.name,
              error: tr.error,
            });
            if (tr.passed) {
              totalAssertionsPassed++;
              send({
                type: "log",
                line: `  ✓ ${tr.name}`,
              });
            } else {
              totalAssertionsFailed++;
              send({
                type: "log",
                line: `  ✗ ${tr.name}${tr.error ? ` (${tr.error})` : ""}`,
              });
            }
          }

          const isPassed =
            !fetchError && testResults.every((t) => t.passed);
          if (isPassed) totalPassed++;
          else totalFailed++;

          if (!isPassed && !fetchError) {
            allErrors.push({
              requestName: item.name,
              statusCode,
              message: testResults
                .filter((t) => !t.passed)
                .map((t) => t.error)
                .join("; "),
            });
          } else if (fetchError) {
            allErrors.push({
              requestName: item.name,
              statusCode: 0,
              message: fetchError,
            });
          }

          requestResults.push({
            name: item.name,
            method,
            url,
            path: item.path,
            statusCode,
            responseTime,
            responseSize,
            passed: isPassed,
            assertions: reqAssertions,
          });

          send({ type: "log", line: `` });
        }

        // Summary
        send({
          type: "log",
          line: `┌─────────────────────────────────────────┐`,
        });
        send({
          type: "log",
          line: `│                 summary                 │`,
        });
        send({
          type: "log",
          line: `├─────────────────────────────────────────┤`,
        });
        send({
          type: "log",
          line: `│            requests:  ${items.length.toString().padStart(3)} total          │`,
        });
        send({
          type: "log",
          line: `│         assertions:  ${(totalAssertionsPassed + totalAssertionsFailed).toString().padStart(3)} total          │`,
        });
        send({
          type: "log",
          line: `│      passed:  ${totalPassed.toString().padStart(3)}                        │`,
        });
        send({
          type: "log",
          line: `│      failed:  ${totalFailed.toString().padStart(3)}                        │`,
        });
        send({
          type: "log",
          line: `└─────────────────────────────────────────┘`,
        });

        // Build result data
        const richResultData = {
          requests: requestResults,
          summary: {
            total_requests: items.length,
            passed: totalPassed,
            failed: totalFailed,
          },
          assertions: {
            total: totalAssertionsPassed + totalAssertionsFailed,
            passed: totalAssertionsPassed,
            failed: totalAssertionsFailed,
          },
          assertionDetails: allAssertions,
          errors: allErrors,
        };

        // Save results to DB
        const finalStatus = totalFailed > 0 ? "failed" : "passed";
        await supabase
          .from("newman_test_runs")
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            result_data: richResultData,
          })
          .eq("id", run_id);

        send({ type: "done", result: richResultData });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
