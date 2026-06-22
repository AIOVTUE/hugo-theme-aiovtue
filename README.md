# AIOVTUE Hugo 博客

参考valaxy、butterfly、sakura等，基于Hugo 的静态博客。

## 博客预览
![](https://pic1.imgdb.cn/item/6a3938ff4a893629d992bb61.png)
---

![](https://pic1.imgdb.cn/item/6a3938fe4a893629d992bb5f.png)
---

![](https://pic1.imgdb.cn/item/6a3938ff4a893629d992bb60.png)
---

![](https://pic1.imgdb.cn/item/6a3938fe4a893629d992bb5d.png)
---

![](https://pic1.imgdb.cn/item/6a3938fe4a893629d992bb5e.png)
---


## 环境要求

- [Hugo Extended](https://gohugo.io/installation/)（推荐 0.120+，当前使用 0.163）

验证安装：

```bash
hugo version
# 输出中应包含 extended
```

---

## 目录结构

```
hugo-blog/
├── hugo.toml              # ★ 主配置（站点信息、导航、Hero、评论、赞助等）
├── data/
│   └── links.yaml         # ★ 友链卡片数据
├── content/               # ★ 所有文章与页面（Markdown）
│   ├── posts/             #   博客文章
│   ├── gallery/           #   相册
│   ├── about.md           #   关于页
│   ├── links.md           #   友链页（壳子，数据在 data/links.yaml）
│   ├── comment.md         #   留言页
│   ├── search.md          #   搜索页
│   ├── archives/          #   归档页
│   ├── categories/        #   分类列表页
│   └── tags/              #   标签列表页
├── static/                # ★ 原样复制的静态文件（favicon、hero、envelope）
├── themes/aiovtue/         #   主题（一般不改，除非调样式/布局）
├── scripts/
│   └── migrate-content.mjs  # 从上级 Valaxy 项目批量同步内容
├── package.json           # npm 脚本
└── public/                # 构建输出（自动生成，勿手改，已 gitignore）
```

标 ★ 的是日常最常改动的位置。`hugo.toml` 和 `data/links.yaml` 内已写中文注释，可直接打开查看说明。

---

## 文章在哪里？

**路径：** `content/posts/`

每篇文章一个 `.md` 文件，文件名即 URL 别名（slug）。例如 `content/posts/memos-web.md` 对应 `/posts/memos-web/`。

### 新建文章

在 `content/posts/` 下新建 `my-new-post.md`：

```markdown
---
title: "文章标题"
description: "摘要，用于 SEO 和分享卡片"
date: 2026-06-20
lastmod: 2026-06-20          # 可选，最后修改时间
cover: "https://example.com/cover.jpg"   # 封面图 URL
categories:
  - 分类名
tags:
  - 标签一
  - 标签二
weight: 1                     # 可选，越小越靠前（置顶用）
---

正文使用 **Markdown** 书写。

支持代码块、图片、表格等。图片可写：

![说明](https://example.com/image.jpg)
```

保存后，本地 `npm run dev` 即可在浏览器预览。

### 编辑 / 删除文章

- **编辑：** 直接改对应的 `content/posts/*.md`
- **删除：** 删除该 `.md` 文件，然后执行 `npm run build`（会清理 `public/` 中的旧页面）

### 文章 Front Matter 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 标题 |
| `date` | 是 | 发布日期 |
| `description` | 建议 | 摘要（搜索、OG 分享） |
| `cover` | 建议 | 封面图 |
| `categories` | 建议 | 分类（自动生成分类页） |
| `tags` | 建议 | 标签 |
| `lastmod` | 否 | 最后修改时间 |
| `weight` | 否 | 排序权重，数字越小越靠前 |

---

## 页面在哪里？

Hugo 中「页面」分两类：

### 1. 独立页面（单文件）

位于 `content/` 根目录，通过 front matter 的 `layout` 指定模板：

| 文件 | 访问路径 | layout | 说明 |
|------|----------|--------|------|
| `about.md` | `/about/` | `about` | 关于页，正文写在文件里 |
| `links.md` | `/links/` | `links` | 友链页壳子，卡片在 `data/links.yaml` |
| `comment.md` | `/comment/` | `comment` | 留言页（Waline + 信封动画） |
| `search.md` | `/search/` | `search` | 全文搜索页 |

**编辑关于页：** 改 `content/about.md` 的 Markdown 正文即可。

**编辑友链：** 改 `data/links.yaml`（不是 `links.md`）。

### 2. 栏目 / 列表页（目录 + `_index.md`）

| 目录 | 访问路径 | 说明 |
|------|----------|------|
| `content/archives/_index.md` | `/archives/` | 归档（含统计图） |
| `content/categories/_index.md` | `/categories/` | 全部分类 |
| `content/tags/_index.md` | `/tags/` | 全部标签 |
| `content/gallery/_index.md` | `/gallery/` | 相册列表 |

分类页、标签详情页由 Hugo 根据文章 front matter **自动生成**，无需手动创建。

### 3. 相册（特殊页面）

```
content/gallery/
├── _index.md          # 相册列表（albums 字段控制显示哪些相册）
├── bizhi/index.md     # 相册「一些壁纸」→ /gallery/bizhi/
└── jiamio/index.md    # 相册「秘密哦」→ /gallery/jiamio/
```

**新建相册：**

1. 创建 `content/gallery/新相册名/index.md`
2. 在 `content/gallery/_index.md` 的 `albums` 列表中加入 `新相册名`

相册 front matter 示例：

```markdown
---
title: "相册标题"
date: 2025-08-18
cover: "https://example.com/cover.jpg"
desc: "相册描述"
location: "重庆"
encrypted: false          # true 时启用密码门
password: "your-password" # encrypted 为 true 时填写
source: local
tags:
  - 壁纸
photos:
  - url: "https://example.com/photo1.jpg"
    date: 2026-6-1
  - url: "https://example.com/photo2.jpg"
    date: 2026-5-20
---
```

### 3. 友链（特殊页面）
友链公告文件位置：`themes/aiovtue/layouts/partials/friend-link-notice.html`

### 4. 评论系统

评论出现在**文章详情页**、**友链页**、**留言页**底部，在 `hugo.toml` 中配置。

#### 选择评论服务

```toml
[params.comment]
  provider = 'waline'   # waline | twikoo
```

#### Waline

1. 在 [Waline](https://waline.js.org/) 或托管平台（如 [HouLang 评论服务](https://waline.js.org/) 文档所列）创建站点，获得 **serverURL**。
2. 填入 `hugo.toml`：

```toml
[params.waline]
  # Waline 服务端地址（创建应用后获得，末尾不要加 /）
  serverURL = 'https://你的地址'
  placeholder = '分享你的想法...'   # 评论框占位文字（可选）
```

3. 保存后重新构建部署。评论区会随站点 `html.dark` 类自动切换深浅色。

#### Twikoo

若改 Twikoo，将 `provider` 设为 `twikoo` 并配置：

```toml
[params.twikoo]
  envId = 'https://你的-twikoo-地址/'
```

#### 关闭单篇文章评论

在文章 front matter 中加：

```yaml
comment: false
```

---

## 站点配置在哪里改？

| 想改什么 | 改哪个文件 |
|----------|------------|
| 站点名、域名、导航、Hero、社交、赞助、评论、页脚 | `hugo.toml` |
| 友链卡片 | `data/links.yaml` |
| 首页轮播图 / 留言信封图 | `static/hero/`、`static/envelope/` |
| 网站图标 | `static/favicon.png` |
| 主题样式、布局 | `themes/aiovtue/`（进阶） |

修改 `hugo.toml` 后，开发服务器会自动热重载；改 `static/` 文件后刷新浏览器即可。

**重要：** 部署前确认 `hugo.toml` 顶部 `baseURL` 与线上域名一致（当前为 `https://da.yybb.us/`）。

---

## 本地开发与测试

```bash
cd hugo-blog

# 启动开发服务器（内容改动自动刷新）
npm run dev
# 等价于：hugo server -D

# 浏览器打开
# http://localhost:1313
```

常用操作：

- 改文章 / 页面 → 保存后浏览器刷新
- 改 `hugo.toml` / `data/links.yaml` → 自动生效
- 按 `Ctrl+C` 停止服务器

### 本地构建（模拟上线产物）

```bash
npm run build
# 等价于：hugo build --cleanDestinationDir
```

构建结果在 `public/` 目录。`--cleanDestinationDir` 会先清空旧文件，避免已删文章残留。

本地预览构建结果（可选）：

```bash
npx --yes serve public
# 或任意静态文件服务器指向 public/
```

---

## 云端部署（Cloudflare Pages）

本站为纯静态站点，构建产物为 `public/` 目录，适合 [Cloudflare Pages](https://pages.cloudflare.com/)。

1. 将 `hugo-blog/` 推送到 GitHub / GitLab 等
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择仓库，配置构建设置：

| 设置项 | 值 |
|--------|-----|
| Framework preset | None（不要直接选hugo，cloudflare的hugo版本太低） |
| Build command | `npm run build` |
| Build output directory | `public` |
| Root directory | `hugo-blog`（若仓库根目录不是 hugo-blog 本身则填写） |


4. 保存并部署。首次成功后获得 `*.pages.dev` 预览地址。

5. **绑定自定义域名：** Pages 项目 → **Custom domains** → 添加你的域名，按提示在 Cloudflare DNS 添加 CNAME。

6. 确认 `hugo.toml` 中 `baseURL` 与最终访问域名一致，改完后重新部署。

## 云端部署（vercel）
vercel新建项目，选择连接github，选择本项目，配置界面直接选hugo即可，如果失败的话，可以手动选择构建命令为`npm run build`, 输出目录`public`, 如何直接部署即可

## 云端部署（netlify）
netlify新建项目，选择连接github，选择本项目，配置界面直接选hugo即可，如果失败的话，可以手动选择构建命令为`npm run build`, 输出目录`public`, 如何直接部署即可

其实都是一样的啦，要么直接选hugo预设，要么手动输入构建命令和输出目录，一通百通~

## 常用命令速查

```bash
npm run dev      # 本地开发预览
npm run build    # 构建到 public/（部署用）
npm run migrate  # 从 Valaxy 同步内容（慎用，会覆盖）
```
