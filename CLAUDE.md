# claude-lab：给 AI 的工作约定

这个仓库是许多独立项目的合集，每个项目一个目录，命令在项目目录里运行（见 README.md）。

## Windows 软件的修改与发布

声准 Phonica（`phonica/`）、律影 Motif（`motif/`）、音乐粒子宇宙（`particle-universe/`）、墨誊 Moteng（`moteng/`）、鸿雁邮箱（`hongyan-mail/`）由 `.github/workflows/ship.yml` 自动合并、测试、签名和发布，说明见 `scripts/windows-release/README.md`。修改这些软件时：

- 改完、在本地跑过该项目的测试后，提交并推送到当前的 `claude/**` 分支就够了。流水线会在 Windows 上构建测试，通过后自动合并进 `main`，并只发布改动到的软件。不需要开 PR、不需要手动打标签或创建 Release，也不要让用户去 GitHub 上操作。
- 版本号不用改：已发布过的版本会被自动改成下一个补丁号。只有要发 minor / major 版本（如 1.3.0、2.0.0）时，才在 `package.json` 里改，并用 `npm version <x.y.z> --no-git-tag-version` 同步 `package-lock.json`。
- 推送后用 GitHub 工具查看「Ship · 自动合并与发布」这次运行的结果。失败（测试没过、与 main 冲突）时修好再推送；合并冲突就在分支上合并 `origin/main` 并解决冲突。
- `scripts/windows-release/update-signer.cjs` 在每个软件里有一份相同的副本，修改后运行 `node scripts/windows-release/check-copies.mjs --write`。
- 修改 `.github/workflows/` 的分支不能被内置令牌自动合并（没有 `SHIP_TOKEN` 时），推送后要告诉用户。
- 不要生成新的签名证书，不要把证书、密码或安装包提交到仓库。
