# Token Economy Tips for Agents

- Favor **front-matter** over long prose; encode policy once.
- Emit **artifacts only** (markdown/JSON) asked in `requires.artifacts`.
- Use compact YAML/JSON. Avoid explanations unless requested.
- Reuse short **templates** (milestones.yaml, lane_proposal) across tasks.
- Keep **few-shot examples** tiny (1 short example).
- Store context in `memory/` and reference by filename instead of repeating text.
- For diffs/plans: include **paths and counts**, skip unchanged hunks.
- Prefer **links** to large logs/artifacts instead of inline blobs.
