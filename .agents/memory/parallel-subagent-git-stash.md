---
name: Parallel subagents vs uncommitted parent edits
description: Subagents may git-stash the working tree for baseline checks and clobber the parent agent's uncommitted edits.
---

Rule: when delegating write-work to parallel subagents, forbid `git stash` in the brief, and after joining them verify your own earlier uncommitted edits still exist (grep a marker) before continuing.

**Why:** A subagent's "clean baseline" stash + conflicted pop can leave the parent's uncommitted files reverted to HEAD.

**How to apply:** Add "do not use git stash" to every parallel write-subagent brief; re-grep your own key edits after all joins.
