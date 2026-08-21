# _txt_archive 说明

本文件夹是 **Codex 处理博客文献笔记时产生的中间工作文件归档**，与博客运行无关，可安全保留或删除。

## 来源与用途

2026 年 8 月，Codex 在处理博客文章《文章骨架（12篇）.md》中"文献"部分的三篇全英文论文笔记时，从 PDF/Zotero 提取并校验了大量中间文本。这些文件是当时"改写必须有依据"的**证据存档**：如需再次改写或核对文献笔记，可直接从本文件夹取用，避免重新提取。

## 内容清单

### 三篇论文全文提取（核心存档）
| 文件 | 对应论文 |
| --- | --- |
| `.tmp_fulltext/li2024.txt` | Li et al. 2024 *A survey on LLM-based multi-agent systems: workflow, infrastructure, and challenges*（笔记 ①） |
| `.tmp_fulltext/ai_hospitals.txt` | *LLM-based multi-agent systems for clinical workflows: a survey of AI hospitals*（笔记 ②） |
| `.tmp_fulltext/xiong2026.txt` | Xiong et al. 2026 *Not just one agent: LLM-based multi-agent systems for medicine...*（笔记 ③） |
| `_xiong_paper.txt` | 上述 Xiong 2026 的另一份 36 页版全文提取 |

### 其他论文相关文件（`.tmp_fulltext/` 内）
- `guo2024.txt`：Guo et al. *Large Language Model based Multi-Agents: A Survey of Progress and Challenges* 全文
- `li_columns.txt` / `guo_columns.txt`：按 PDF 双栏拆分的文本
- `li_refs_raw.txt` / `guo_refs_raw.txt`：论文参考文献原始文本
- `li_skeleton_dump.txt` / `guo_skeleton_dump.txt`：按章节抽取的骨架（标题 + 首段）
- `tables_full.txt` / `tables_snapshot.txt`：表格提取调试输出
- 其余 `.py` 脚本、`.json`、`.png`：提取/校验用的临时脚本与中间结果

### 根目录其他文件
| 文件 | 说明 |
| --- | --- |
| `_review_en.txt` | 一篇英文 scoping review 草稿《LLM-Based Multi-Agent Systems for Oncology Multidisciplinary Tumor Boards》 |
| `apply_patch_test.txt` | 测试文件（内容为 "hello world"），无实际用途 |

## 为什么放在这里（不影响博客）

- 这些 txt 未被任何博客文章（`.md`）或 hexo 配置引用（已检索确认）；
- hexo 只把 `source/` 下的 `.md` 渲染为文章，txt 不会被发布，但可能被当作静态资源拷入 `public/`；
- 本文件夹位于 `G:\hexo\my-blog\`（`source` 之外），hexo 完全不会扫描处理，不影响博客生成。

## 恢复方式

如需放回原处：将 `.tmp_fulltext` 文件夹复制回 `G:\hexo\my-blog\source\_posts\`，根目录三个 txt 同样放回即可。

## 归档日期

2026-08-21