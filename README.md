# Ajou Menu · 亚洲大学食堂菜单

轻量的中韩双语菜单站。界面参考 [Çukurova 大学食堂](https://www.cukurova.app/)：黑色顶栏、紧凑菜单卡、底部日期导航，电脑使用日历弹窗、手机使用底部日历面板。

支持食堂、餐次和窗口切换，中韩菜名搜索、深浅主题切换及菜单复制。复制的链接可以直接打开对应日期、食堂、餐次和窗口。中文模式保留韩文菜名，便于现场对照。引用的设计与配色遵循 MIT 许可，详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 本地预览

根目录是前端源文件；`site/` 是自动同步的发布副本。无需 npm 安装或前端构建。

```powershell
python -m http.server 8766 --bind 127.0.0.1 --directory site
```

访问 `http://127.0.0.1:8766/`。仅供本地预览，不是生产服务器。

## 获取菜单与翻译

使用 Python 3.12 或更新版本：

```powershell
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# 编辑 .env，填写自己的密钥。
python -m scraper.main
```

`.env` 和翻译缓存不进入 Git。翻译使用 FactChat 的 OpenAI 兼容接口：

| 配置 | 默认值 / 用途 |
| --- | --- |
| `TRANSLATE_API_KEY` | 必填的本地密钥；网页不调用翻译 API |
| `TRANSLATE_API_ENDPOINT` | `https://factchat-cloud.mindlogic.ai/v1/gateway` |
| `TRANSLATE_MODEL` | `deepseek-v4.1-flash` |
| `TRANSLATE_MAX_WORKERS` | 4，允许 1–8 |
| `TRANSLATE_BATCH_SIZE` | 20，允许 1–40 |
| `REQUIRE_TRANSLATION` | 设置为 `1` 时，缺少密钥或整批中文失败会阻止数据发布 |

程序对整周文本去重、分批翻译，对临时网络问题和限流有限重试。仅缓存经过长度、格式和语言校验的成功结果。缓存按版本、模型和端点区分。旧版本缓存自动失效。

某间食堂获取失败时保留其 ID；如有同一天的旧数据，明确标记为旧数据。不会使用其他日期的菜单冒充当天菜单。未知菜品与通知不填默认热量，所有显示的热量都是粗略估算，不能作为官方营养信息。不同窗口的热量不相加。

## GitHub Actions 配置

在仓库 **Settings → Secrets and variables → Actions** 中设置：

- **Secret `TRANSLATE_API_KEY`**：使用当前 FactChat 密钥。迁移网关时需要更新原来的密钥；本地 `.env` 不会自动同步到 GitHub。
- 可选 **Variable `TRANSLATE_API_ENDPOINT`** 和 **Variable `TRANSLATE_MODEL`**：未设置时使用表中的默认值。端点现在读取 Variable，而非旧的同名 Secret。

定时任务计划在韩国时间每天 00:00 执行，GitHub 实际调度可能延迟。工作流会检查回归用例、恢复翻译缓存、获取全周菜单、同步 `site/`、提交变更。整批翻译失败会让工作流失败并保留此前发布数据。

GitHub Pages 可保持现有根目录发布设置。手动修改根目录前端文件后，运行以下命令更新兼容副本：

```powershell
python -m scraper.sync_site
```

## 验证

```powershell
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/menu.test.cjs
```

Python 测试使用模拟接口，不花费翻译额度。浏览器还应检查手机/桌面视口、语言切换、食堂切换、周末预告、缺失数据和键盘操作。

菜单原始来源：[亚洲大学官网](https://www.ajou.ac.kr/kr/life/food.do)。本项目为非官方菜单助手，实际供应以学校公告为准。
