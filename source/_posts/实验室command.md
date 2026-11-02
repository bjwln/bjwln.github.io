---
title: 实验室command
date: 2026-11-02 20:19:25
cover: cover.jpg
sticky: 1
---

```bash
# 1. 激活环境
conda activate climode

# 2. 确认 GPU 可用
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
# 必须输出 True，如果 False 告诉我

# 3. 确认项目文件在服务器上
ls ~/ClimODE_repro/
# 应该能看到 climode/ scripts/ tests/ era5_data/ artifacts/ 这些目录
```

# 创建文件夹

```bash
mkdir ~/<name>
```

