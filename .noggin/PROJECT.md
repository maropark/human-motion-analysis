# Project Bridge

Repo-local entrypoint for the linked noggin idea.

- Idea folder: `/home/maro/Documents/maro-og/Development/Ideas/human-motion-analysis`
- Repo folder: `/home/maro/Projects/human-motion-analysis`
- Task source: `TODOS.md`
- Design source: `README.md`

Read in this order:
1. `.noggin/TODOS.md`
2. `.noggin/design.md`
3. Any additional files in `.noggin/idea/`

Rules:
- Treat `.noggin/TODOS.md` as the source of truth for scoped tasks.
- The canonical bridge names may point at legacy vault filenames such as `handoff-notes.md` or `design-doc.md`.
- Editing `.noggin/TODOS.md` or `.noggin/design.md` updates the vault through the symlink.
- If a link is broken, run `project-bridge.sh doctor "/home/maro/Projects/human-motion-analysis"`.
