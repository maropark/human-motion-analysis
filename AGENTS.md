# Agents Instructions

Start every work session by reading:
- `.noggin/PROJECT.md`
- `.noggin/TODOS.md`
- `.noggin/design.md`

Rules:
- Treat `.noggin/TODOS.md` as the source of truth for scoped work.
- Update task state in `.noggin/TODOS.md`; edits write through to noggin.
- Keep implementation code in this repo.
- Keep planning and product direction in the linked noggin idea.
- If `.noggin/` is missing or broken, run `/home/maro/Documents/maro-og/Skills/promote-to-project/scripts/project-bridge.sh doctor /home/maro/Projects/human-motion-analysis`.

Current stack:
- Expo SDK 54
- React Native / TypeScript
- `expo-image-picker` for iPhone-style clip import
- `expo-video` for replay
- `react-native-svg` for trace overlays
