## 2025-05-23 - [Lockfile Churn & Sparse Maps]
**Learning:** Installing dependencies with `npm install` in a monorepo can cause massive lockfile churn if not careful, especially if `package-lock.json` is not in sync or if environment differs. Always revert lockfiles if not intending to update dependencies.
**Action:** Always check `git status` or diffs for lockfiles before submitting. Use `npm ci` if possible or revert changes.

**Learning:** Replacing "dense" loop logic (iterating all slots) with "sparse" logic (iterating all items) is a great optimization, but ensures consumers handle missing keys (sparse map). In this case, `map.get(key) || []` was already used, making it safe.
**Action:** When optimizing data structures from dense to sparse, verify how consumers handle missing data.
