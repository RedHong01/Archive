# ARCHIVE

个人物品索引静态站 —— **An index of things I've owned.**  
不是商店，只是把曾经选择过的东西安静地放在一页里。

## 预览

本地直接打开：

```bash
# 任意静态服务器均可，例如：
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

或双击打开 `index.html`（图片依赖 Unsplash CDN，需联网）。

## GitHub Pages

1. 把本仓库推到 GitHub
2. **Settings → Pages → Source** 选 `Deploy from a branch`
3. Branch 选 `main`，文件夹选 `/ (root)`
4. 保存后访问：`https://<user>.github.io/<repo>/`

也可使用 Actions 的静态部署；本项目无构建步骤，根目录 `index.html` 即可。

## 功能

| 功能 | 说明 |
| --- | --- |
| Example Index | 16 件示例藏品，仅供版式演示 |
| Your Archive | 本机 `localStorage`，可增删 |
| 筛选 / 搜索 | 分类、关键词、网格/列表视图 |
| Specimen 弹层 | 详情、← → 切换、Esc 关闭 |
| Export / Import | JSON 备份与恢复 |

## 结构

```
.
├── index.html      # 入口
├── css/styles.css
├── js/data.js      # 示例数据
├── js/app.js       # 交互
├── assets/         # 设计参考稿
└── README.md
```

## 隐私

个人档案只存在当前浏览器。清理站点数据会丢失；换机前请先 **Export**。

## License

演示用途。示例图片来自 [Unsplash](https://unsplash.com)，版权归原作者。
