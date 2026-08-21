# -*- coding: utf-8 -*-
import json
from pypdf import PdfReader

src = r"C:\Users\lenovo\Zotero\storage\7QSK4PVE\Yao和Yu - 2026 - LLM-based multi-agent systems for clinical workflows a survey of AI hospitals.pdf"
out_txt = r"G:\hexo\my-blog\source\_posts\.tmp_fulltext\ai_hospitals.txt"
out_json = r"G:\hexo\my-blog\source\_posts\.tmp_fulltext\ai_hospitals_pages.json"

reader = PdfReader(src)
pages = []
with open(out_txt, "w", encoding="utf-8") as f:
    for i, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        text = "\n".join(line.rstrip() for line in text.splitlines())
        pages.append(text)
        f.write(f"\n===== PAGE {i} =====\n")
        f.write(text)
        f.write("\n")

with open(out_json, "w", encoding="utf-8") as f:
    json.dump({"n_pages": len(pages), "pages": pages}, f, ensure_ascii=False, indent=1)

print("pages:", len(pages), "chars:", sum(len(p) for p in pages))
