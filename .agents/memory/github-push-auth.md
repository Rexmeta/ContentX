---
name: GitHub push authentication
description: How to distinguish Git transport authentication from connector API authorization in this Replit project.
---

Replit's GitHub connector authorization and Git CLI HTTPS authentication are separate. A healthy connector can read and write GitHub's REST Git database API while `git push` still uses an expired credential, and a fine-grained PAT can read repository metadata yet be denied Git-object writes.

**Why:** A resolved branch repeatedly appeared blocked because HTTPS Git authentication failed independently of the repository's conflict state. The connector's OAuth authorization ultimately had the required Git database API access.

**How to apply:** First verify the working tree, rebase metadata, and branch ancestry separately from authentication. Never force-push to work around a credential error. Prefer normal Git transport when valid credentials exist; if only connector API writes work, verify the final tree hash and remote ref before aligning the local branch.