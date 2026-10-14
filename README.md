# Ajou Menu · 亚洲大学食堂菜单

**[打开网站，直接查看菜单 →](https://zhupoxixixi.github.io/ajou-menu/)**

已部署到 GitHub Pages，电脑和手机浏览器都可以直接使用。**无需下载源码、安装程序或填写 API 密钥。**

## 如何使用

1. 点击右上角的 **中文 / 한국어** 切换语言。中文菜名下保留韩文原名，方便现场对照。
2. 选择 **宿舍食堂 / 教职工食堂**，再选择餐次和窗口。
3. 用底部左右按钮切换日期，或点击 **选择日期** 打开日历。手机上显示底部日历面板，电脑上显示弹窗。
4. 点击右上角搜索按钮，输入中文或韩文菜名；选择结果后会跳到对应日期、食堂和窗口。电脑也支持 `Ctrl + K` / `⌘ + K`。
5. 点击 **复制菜单**，可以复制当前窗口的菜单和分享链接。右上角还可以切换深浅主题。

## 菜单来源与更新

- 原始来源：[亚洲大学官方食堂公告](https://www.ajou.ac.kr/kr/life/food.do)。
- 仓库配置了每日韩国时间 **00:00（KST）** 的自动更新任务，实际执行时间可能延迟。
- 周末如已获取下周菜单，可以查看 **下周预告**。
- 菜单获取失败、译文暂缺或显示旧数据时，页面会提供提示。

这是非官方菜单助手，实际供餐和临时调整以学校公告为准。`≈ kcal` 是根据菜名粗略估算的热量，并非官方营养数据；各窗口菜单供分别选择。

## API 与隐私

网页只读取已生成的菜单数据，**不会直接请求翻译 API，也不会向访问者提供 API 密钥**。中文翻译在菜单生成流程中完成。

翻译密钥应保存在本地被 Git 忽略的 `.env` 或 GitHub Actions Secrets 中，不应写入网页、README 或公开代码。

<details>
<summary>网站维护说明（仅仓库管理员）</summary>

日常使用网站不需要以下配置。

- 自动翻译所需密钥：在仓库 **Settings → Secrets and variables → Actions** 中配置 Secret `TRANSLATE_API_KEY`。
- 当前默认翻译模型为 `deepseek-v4.1-flash`。如需调整，可配置 Variable `TRANSLATE_MODEL`；网关地址可通过 Variable `TRANSLATE_API_ENDPOINT` 调整。
- 手动更新菜单：进入 **Actions → Daily Menu Scrape → Run workflow**。
- 自动更新失败时，查看对应工作流日志。整批翻译失败会阻止发布新数据，保留此前的菜单。

</details>

## 界面来源

界面参考 [Çukurova 大学食堂](https://www.cukurova.app/) 的紧凑菜单风格，引用部分保留原项目的 MIT 许可与版权说明，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
