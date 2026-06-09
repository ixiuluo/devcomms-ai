# DevComms AI

> 🚀 AI 驱动的开发者沟通平台 — 自动从 Git 历史生成 Changelog，一键发布到邮件和 Slack

[English](#english) | 中文

---

## 这是什么？

**DevComms AI** 自动将 Git 提交记录转化为结构化的 Changelog，并通过托管页面、邮件和 Slack 分发给用户。AI 负责编写和分类，人类只需一键审批。

### 核心功能

- 🔄 **自动生成 Changelog**：连接 GitHub，每次 Release 自动从 Commits 生成结构化的更新日志
- 📧 **多渠道分发**：托管页面 + 邮件推送 + Slack 通知，让你的用户不错过任何更新
- 🤖 **AI 辅助编写**：AI 自动分类（Feature / Bug / Improvement）并撰写用户友好的更新说明
- ✅ **人工审批**：生成后你可编辑和审批，确保内容质量

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务（PostgreSQL + Redis）
docker compose up -d

# 3. 构建共享包
npm run build -w packages/shared

# 4. 数据库迁移
npm run db:migrate -w apps/api

# 5. 启动 API（终端 1）
npm run dev -w apps/api

# 6. 启动前端（终端 2）
npm run dev -w apps/web
```

- **API**：`http://localhost:3000` — 健康检查 `/health`
- **Web**：`http://localhost:3001` — Landing Page & Dashboard

---

## 环境要求

- **Node.js** >= 20.0.0（推荐 LTS 22）
- **Docker**（用于本地 PostgreSQL 和 Redis）
- **npm** >= 10.0.0

---

## 项目结构

```
/
├── apps/
│   ├── api/              # Express API — Changelog 生成、GitHub Webhook、发布
│   └── web/              # Next.js — Landing Page、Dashboard、Changelog 展示页
├── packages/
│   └── shared/           # @dra/shared — 共享类型、常量、ApiResponse<T>
├── docs/                 # 文档
│   ├── development.md    # 开发指南
│   └── infrastructure.md # 基础设施与部署
├── scripts/              # 运维脚本
├── docker-compose.yml    # 本地开发服务（PostgreSQL 16 + Redis 7）
├── docker-compose.prod.yml  # 生产环境配置
├── fly.toml              # Fly.io 部署配置（生产）
├── fly.staging.toml      # Fly.io 部署配置（Staging）
├── .github/workflows/    # CI 流水线（lint → typecheck → test → build → deploy）
└── tsconfig.base.json    # 共享 TypeScript 配置
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动所有开发服务 |
| `npm run build` | 构建所有包和应用 |
| `npm test` | 运行所有测试 |
| `npm run lint` | 代码检查 |
| `npm run lint:fix` | 自动修复 Lint 问题 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | 检查格式 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run clean` | 清理构建产物 |

API 命令：

| 命令 | 说明 |
|------|------|
| `npm run dev -w apps/api` | 启动 API 开发服务器 |
| `npm run db:migrate -w apps/api` | 数据库迁移 |
| `npm run db:generate -w apps/api` | 生成 Prisma Client |
| `npm run db:studio -w apps/api` | 启动 Prisma Studio |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **运行时** | Node.js 22, TypeScript 5.7 |
| **API** | Express 4, Helmet, Morgan |
| **前端** | Next.js 15, React 19, Tailwind CSS 4 |
| **数据库** | SQLite (dev), libSQL / Turso (prod) |
| **缓存** | Redis 7（Docker 开发环境） |
| **AI** | Anthropic Claude API（可选，Changelog 生成） |
| **测试** | Vitest |
| **代码质量** | ESLint 9 (flat config) + Prettier |
| **CI/CD** | GitHub Actions → Fly.io (API) + Vercel (Web) |
| **监控** | Sentry（错误追踪）, `/health` 健康检查 |

---

## 配置

复制 `.env.example` 为 `.env` 并按需填写：

```bash
cp .env.example .env
```

### 必需的第三方服务

| 服务 | 用途 | 注册地址 |
|------|------|----------|
| GitHub App | OAuth 登录 + Webhook 接收 | https://github.com/settings/apps |
| Anthropic | AI 生成 Changelog（可选） | https://console.anthropic.com |
| Stripe | 付费订阅（可选） | https://dashboard.stripe.com |
| Slack App | Slack 通知分发（可选） | https://api.slack.com/apps |

---

## 部署

- **API**：`flyctl deploy --config fly.toml`（Fly.io）
- **Web**：Vercel（GitHub 自动部署）
- **CI 流水线**：Lint → TypeCheck → Test → Build → Deploy

详见 [docs/infrastructure.md](docs/infrastructure.md)

---

<h2 id="english">English</h2>

### What is DevComms AI?

AI-powered developer communication platform. Automatically generates structured changelogs from Git history and distributes them via hosted page, email, and Slack. AI writes and categorizes — humans approve with one click.

### Key Features

- 🔄 **Auto Changelog Generation** — Connect GitHub, generate structured release notes from commits
- 📧 **Multi-channel Distribution** — Hosted page + Email + Slack, keep users informed
- 🤖 **AI-assisted Writing** — AI categorizes (Feature/Bug/Improvement) and writes user-friendly summaries
- ✅ **Human Approval** — Edit and approve before publishing

### Quick Start

See the [快速开始](#快速开始) section above.

### Tech Stack

See the [技术栈](#技术栈) section above, or [docs/infrastructure.md](docs/infrastructure.md) for deployment details.
