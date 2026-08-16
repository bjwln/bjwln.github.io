# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

desk = Path(r'C:\Users\lenovo\Desktop')
for d in desk.iterdir():
    if not d.is_dir() or d.name.startswith('Multi'):
        continue
    print('DIR', repr(d.name))
    for f in d.iterdir():
        if '全文翻译' in f.name:
            b = f.read_bytes()
            print(' ', repr(f.name), 'bytes', len(b))
            try:
                t = b.decode('utf-8')
                print('  UTF-8 ok, chars', len(t), 'lines', len(t.splitlines()))
            except Exception as e:
                print('  utf8 fail', str(e)[:60])
                for enc in ('gbk', 'gb18030', 'utf-16'):
                    try:
                        t = b.decode(enc)
                        print(' ', enc, 'ok chars', len(t))
                        break
                    except Exception as e2:
                        print(' ', enc, 'fail', str(e2)[:60])
