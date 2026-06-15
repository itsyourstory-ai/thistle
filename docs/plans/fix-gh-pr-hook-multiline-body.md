# Plan: Fix gh pr create Hook Rejecting Multi-line PR Bodies

## Problem

Running `gh pr create` with a multi-line `--body` or `--body-file` fails with:

```
Hook error: Bad control character in string literal in JSON at position N
```

Single-line bodies work fine. The error points to a hook (likely in `.claude/settings.json` or a global Claude Code hooks config) that parses the `gh pr create` command as JSON and chokes on newline characters (`\n`) embedded in the body string.

## Where to look

- `.claude/settings.json` — project-level hooks
- `~/.claude/settings.json` — global hooks
- Look for a hook on the `PostToolUse` or `PreToolUse` event that intercepts Bash tool calls and tries to JSON-parse the command string.

## Fix

The hook needs to either:
1. Skip JSON-parsing commands that contain `gh pr create`, or
2. Handle control characters (newlines, tabs) in string values before parsing — e.g. strip them or use a more permissive parser.

A quick workaround in the meantime: write the PR body to a temp file and pass `--body-file`, but this also fails if the hook intercepts the file read. The only working workaround currently is a single-line body.
