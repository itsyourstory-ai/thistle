# Linear ticket template

Use this shape for every Thistle ticket in Linear (team THI), whether a person or an AI tool writes it. The same text is saved as the team's default issue template in Linear (Settings → Teams → Thistle → Templates).

**Writing rules**

- Write for a teammate first: short sentences, plain words, the same name for the same thing throughout.
- Say what's true today and what "done" looks like. Skip the history.
- Put file names, function names and implementation hints in **Agent notes**, not the main description.
- If someone has to do part of it in a dashboard or account, add the `Human` label and start the description with a **Human step:** line.
- Set the project (0–7), priority, and any "blocked by" / "blocks" links when creating the ticket.

---

## Template (copy from here)

```markdown
<!-- One or two sentences: what's wrong or missing today, and why it matters to customers or the business. -->

## What to do

<!-- The change, in plain words. Bullets are fine. For a decision ticket, list the options and a recommendation. -->

## Done when

<!-- How anyone can tell it's finished. Prefer things you can check: "a test purchase sends a receipt email". Include the tests that should exist. -->

## Out of scope

<!-- Optional. What this ticket deliberately doesn't cover, and where that lives instead. -->

+++ Agent notes

<!-- Optional. File paths, functions, gotchas, related code. Written for whoever (or whatever) implements it. -->

+++
```
