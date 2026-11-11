// THI-61: checks for the edge-function deploy workflow and its migration guard.
// The real deploy can only be seen on a merge to main; these cover what can be
// checked offline.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const guardScript = path.join(repoRoot, "scripts/check-no-new-migrations.sh");
const workflowPath = path.join(repoRoot, ".github/workflows/deploy-functions.yml");
const THISTLE_REF = "uglsyitjasajubfvbiry";

describe("check-no-new-migrations.sh", () => {
  let dir: string;
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const commitFile = (file: string, body = "x") => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), body);
    git("add", "-A");
    git("commit", "-q", "-m", `add ${file}`);
    return git("rev-parse", "HEAD");
  };
  const runGuard = (before: string, after: string) =>
    spawnSync("bash", [guardScript, before, after], { cwd: dir, encoding: "utf8" });

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "thi61-"));
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    git("config", "commit.gpgsign", "false");
    commitFile("supabase/migrations/20260101_old.sql", "select 1;");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("passes when the push only changes functions", () => {
    const before = git("rev-parse", "HEAD");
    const after = commitFile("supabase/functions/generate-book/index.ts");
    const res = runGuard(before, after);
    expect(res.status).toBe(0);
  });

  it("passes when an existing migration is only edited", () => {
    const before = git("rev-parse", "HEAD");
    const after = commitFile("supabase/migrations/20260101_old.sql", "select 2;");
    expect(runGuard(before, after).status).toBe(0);
  });

  it("fails and names the file when the push adds a migration", () => {
    const before = git("rev-parse", "HEAD");
    commitFile("supabase/functions/generate-book/index.ts");
    const after = commitFile("supabase/migrations/20261112_add_x.sql");
    const res = runGuard(before, after);
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toContain("20261112_add_x.sql");
    expect(res.stdout + res.stderr).toMatch(/migration/i);
  });

  it("treats a file moved into supabase/migrations/ as added", () => {
    commitFile("supabase/drafts/20261113_moved.sql");
    const before = git("rev-parse", "HEAD");
    mkdirSync(path.join(dir, "supabase/migrations"), { recursive: true });
    git("mv", "supabase/drafts/20261113_moved.sql", "supabase/migrations/20261113_moved.sql");
    git("commit", "-q", "-m", "move");
    const res = runGuard(before, git("rev-parse", "HEAD"));
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toContain("20261113_moved.sql");
  });

  it("fails when the push range can't be checked", () => {
    const after = git("rev-parse", "HEAD");
    const res = runGuard("0000000000000000000000000000000000000000", after);
    expect(res.status).not.toBe(0);
  });
});

describe("deploy-functions workflow", () => {
  // Comment lines stripped so the checks look at what the workflow does.
  const workflow = readFileSync(workflowPath, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

  it("only runs on pushes to main that touch functions, or by hand", () => {
    expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\[main\]\s*\n\s*paths:\s*\n\s*-\s*["']?supabase\/functions\/\*\*/);
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/pull_request/);
  });

  it("is hard-wired to the Thistle project", () => {
    expect(workflow).toContain(`--project-ref ${THISTLE_REF}`);
    // No other project ref anywhere, and no way to pass one in.
    const refs = workflow.match(/\b[a-z]{20}\b/g) ?? [];
    expect(new Set(refs)).toEqual(new Set([THISTLE_REF]));
    expect(workflow).not.toMatch(/inputs\./);
    expect(workflow).not.toMatch(/supabase link/);
  });

  it("matches project_id in supabase/config.toml", () => {
    const config = readFileSync(path.join(repoRoot, "supabase/config.toml"), "utf8");
    expect(config).toMatch(new RegExp(`^project_id = "${THISTLE_REF}"`, "m"));
  });

  it("runs the migration guard on pushes only, before deploying", () => {
    const guard = workflow.indexOf("check-no-new-migrations.sh");
    const deploy = workflow.indexOf("supabase functions deploy");
    expect(guard).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(guard);
    expect(workflow).toMatch(
      /- name: Stop if a migration is waiting to be applied\s*\n\s*if: github\.event_name == 'push'/,
    );
    // Diffs from the last successful deploy, not just this push.
    expect(workflow).toContain("status=success");
  });

  it("deploys non-interactively with the token from secrets", () => {
    expect(workflow).toMatch(/supabase functions deploy --project-ref uglsyitjasajubfvbiry --use-api --yes/);
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("environment: production");
  });

  it("also runs when config.toml or a migration changes", () => {
    expect(workflow).toContain('- "supabase/config.toml"');
    expect(workflow).toContain('- "supabase/migrations/**"');
  });
});
