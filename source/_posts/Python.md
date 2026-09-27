---
title: Python
date: 2026-09-20 20:16:38
tags:
categories: 大模型
---

# 命令

### pip show 依赖名称

显示某一个依赖安装的位置

### python -m 模块名

把一个 Python 模块（module）当成脚本来运行。

### dir

当前目录的所有文件展示



# 异常

## raise

```python
raise
raise 异常类
raise 异常类("错误信息")
raise 异常实例
raise 异常类("错误信息") from 原因
```



# 输出语句

## print

### f()函数

```python
print(f"SixSixAgents ready. Model: {agent.model}")
```



1. `f"`：f-string 的标记，**f / F** 写在引号前面，表示这个字符串支持嵌入变量 / 表达式。
2. `"SixSixAgents ready. Model: "`：普通文本，原样输出。
3. `{agent.model}`：花括号里面写 Python 表达式
   - 运行时会取出 agent.model 的值，转成字符串替换掉这整块 `{agent.model}`

## input

### strip()函数

作用：删除字符串开头和结尾的空白字符

```python
# 输入："   你好啊   "
s = "   你好啊   "
print(s.strip()) # "你好啊"，首尾空格删掉，中间不变
```

# argparse 模块

 argparse是一个Python模块：命令行选项、参数和子命令解析器。

[`argparse`](https://docs.python.org/zh-cn/3/library/argparse.html#module-argparse) 模块可以让人轻松编写用户友好的命令行接口。程序定义它需要的参数，然后 [`argparse`](https://docs.python.org/zh-cn/3/library/argparse.html#module-argparse) 将弄清如何从 [`sys.argv`](https://docs.python.org/zh-cn/3/library/sys.html#sys.argv) 解析出那些参数。 [`argparse`](https://docs.python.org/zh-cn/3/library/argparse.html#module-argparse) 模块还会自动生成帮助和使用手册，并在用户给程序传入无效参数时报出错误信息。

## 使用流程

1. **创建解释器`argument`对象**

   ```python
   class argparse.ArgumentParser(prog=None, usage=None, description=None, epilog=None, parents=[], formatter_class=argparse.HelpFormatter, prefix_chars='-', fromfile_prefix_chars=None, argument_default=None, conflict_handler='error', add_help=True, allow_abbrev=True)
   
   ```

   - prog - 程序的名称（默认：sys.argv[0]）
   - usage - 描述程序用途的字符串（默认值：从添加到解析器的参数生成）
   - description - 在参数帮助文档之前显示的文本（默认值：无）
   - epilog - 在参数帮助文档之后显示的文本（默认值：无）
   - parents - 一个 ArgumentParser 对象的列表，它们的参数也应包含在内
   - formatter_class - 用于自定义帮助文档输出格式的类
   - prefix_chars - 可选参数的前缀字符集合（默认值：’-’）
   - fromfile_prefix_chars - 当需要从文件中读取其他参数时，用于标识文件名的前缀字符集合（默认值：None）
   - argument_default - 参数的全局默认值（默认值： None）
   - conflict_handler - 解决冲突选项的策略（通常是不必要的）
   - add_help - 为解析器添加一个 -h/--help 选项（默认值： True）
   - allow_abbrev - 如果缩写是无歧义的，则允许缩写长选项 （默认值：True）

   

   ```python
   parser = argparse.ArgumentParser(description='Process some integers.')
   ```

   使用 [`argparse`](https://docs.python.org/zh-cn/3/library/argparse.html#module-argparse) 的第一步是创建一个 [`ArgumentParser`](https://docs.python.org/zh-cn/3/library/argparse.html#argparse.ArgumentParser) 对象。

   [`ArgumentParser`](https://docs.python.org/zh-cn/3/library/argparse.html#argparse.ArgumentParser) 对象包含将命令行解析成 Python 数据类型所需的全部信息。

2. **添加参数`add_argument() `方法**

   ```python
   ArgumentParser.add_argument(name or flags...[, action][, nargs][, const][, default][, type][, choices][, required][, help][, metavar][, dest])
   
   ```

   - name or flags - 一个命名或者一个选项字符串的列表，例如 foo 或 -f, --foo。
   - action - 当参数在命令行中出现时使用的动作基本类型。
   - nargs - 命令行参数应当消耗的数目。
   - const - 被一些 action 和 nargs 选择所需求的常数。
   - default - 当参数未在命令行中出现时使用的值。
   - type - 命令行参数应当被转换成的类型。
   - choices - 可用的参数的容器。
   - required - 此命令行选项是否可省略 （仅选项可用）。
   - help - 一个此选项作用的简单描述。
   - metavar - 在使用方法消息中使用的参数值示例。
   - dest - 被添加到 parse_args() 所返回对象上的属性名。

   

   给一个 [`ArgumentParser`](https://docs.python.org/zh-cn/3/library/argparse.html#argparse.ArgumentParser) 添加程序参数信息是通过调用 [`add_argument()`](https://docs.python.org/zh-cn/3/library/argparse.html#argparse.ArgumentParser.add_argument) 方法完成的。

   ```python
   parser.add_argument('integers', metavar='N', type=int, nargs='+', help='an integer for the accumulator')
   ```

   - `'integers'`参数名字。解析完成后，可以通过 `args.integers` 获取这个参数的值。

     > 这是位置参数（不带`--`），运行脚本时必须在命令行写上，不能省略。

   - `metavar='N'` 在帮助信息（`-h`）里显示的占位符名字，不影响变量名。 执行 `python script.py -h` 时会看到类似：

     ```
     positional arguments:
       N        an integer for the accumulator
     ```

     如果不写 metavar，这里默认会显示 `integers`。

   - `type=int` 把传入的命令行字符串，自动转换成 `int` 类型。 如果用户输入不是数字，程序直接报错。

   - `nargs='+'`

     - `nargs='+'`：接收 1 个或多个参数，打包成列表 list。
     - 必须至少给 1 个数字，不给会报错。
     - 示例输入：`python script.py 1 2 3` → `args.integers = [1, 2, 3]`

     补充 nargs 常用取值对比：

     - `nargs='?'`：0 个或 1 个
     - `nargs='*'`：0 个或多个（可以不传，得到空列表）
     - `nargs='+'`：1 个或多个，不能为空

   - `help='an integer for the accumulator'``-h` 帮助信息里的说明文字。

3. **解析参数**

   ```python
   >>> parser.parse_args(['--sum', '7', '-1', '42'])
   Namespace(accumulate=<built-in function sum>, integers=[7, -1, 42])
   ```

   

# JSON

JSON 文件/响应中的内容通常是 JSON 格式的文本（字符串），Python 需要用 `json` 模块把 JSON 文本解析成 Python 对象。转为字典或者列表格式

| 常量、类或者方法名 |                                                           |
| ------------------ | --------------------------------------------------------- |
| json.dump          | 方法，传入一个json对象，将其编码为json格式后储存到io流中  |
| json.dumps         | 方法，传入一个python对象，将其编码为json格式后储存到str中 |
| json.load          | 方法，传入一个json格式的str，将其解码为python对象         |
| json.loads         | 方法，传入一个json格式的str，将其解码为python对象         |

## loads用法

```python
import json

data = '''
[{
    "name": "小明",
    "height": "170",
    "age": "18"
}, {
     "name": "小红",
    "height": "165",
    "age": "20"
}]
'''

# 打印data类型
print(type(data))
# json类型的数据转化为python类型的数据
new_data = json.loads(data)
# 打印data类型
print(type(new_data))

```

![image-20260923190254247](Python/image-20260923190254247.png)



然后我们就可以获得其中的数据了

```python
name = new_data[0]['name']
new_name = new_data[0].get('name')
```

![image-20260923190445742](Python/image-20260923190445742.png)



## load用法

注意 ：load方法操作的是整个文件对象，这里是将整个整个文件对象里面的内容转化为json对象。（下图是文件操作对象）

![image-20260923190635362](Python/image-20260923190635362.png)

```python
import json
import json
# load的用法是把json格式文件，转换成python类型的数据。
# 构建该文件的文件对象
with open('test1.json',encoding='utf-8')as fp:
    # 加载垓文件对象，转换为python类型的数据
    pyth_list = json.load(fp)
    print(pyth_list)
    print(type(pyth_list))
    print(type(pyth_list[0]))
```

![image-20260923190731871](Python/image-20260923190731871.png)

## dumps函数

`json.dumps()`函数，把python类型的数据转换成json字符串

```python
import json

data = '''
[{
    "name": "小明",
    "height": "170",
    "age": "18"
}, {
     "name": "小红",
    "height": "165",
    "age": "20"
}]
'''
# 打印data类型
print(type(data))
# json类型的数据转化为python类型的数据
new_data = json.loads(data)
# 把python类型的数据转换成json字符串
lit = json.dumps(new_data)
# 打印转换后data类型
print(type(new_data))
print(type(lit))

```

![image-20260923191103776](Python/image-20260923191103776.png)

## dump函数

把python类型的数据以json格式储存到文件中

```python
import json
data = '''
[{
    "name": "小明",
    "height": "170",
    "age": "18"
}, {
     "name": "小红",
    "height": "165",
    "age": "20"
}]
'''

# json类型的数据转化为python类型的数据
new_data = json.loads(data)

# 把python类型的数据以json格式储存到文件中
# 构建要写入文件对象
with open('test1.json','w',encoding='utf-8')as fp:
    # 把python类型的数据以json格式储存到文件中，为了输出中文，还需要指定参数 ensure_ascii 为 False
    json.dump(new_data,fp,ensure_ascii=False)

```

![image-20260923191227658](Python/image-20260923191227658.png)

# 文件

## 打开文件的步骤

这里结合`json`中的语法来演示打开文件的步骤

**打开文件，然后把文件转成字符串的形式来操作**

```python
text = file.read_text(encoding="utf-8")  # 读取文件 → 字符串
config = json.loads(text)                      # 字符串 → Python对象
```

`config`是`list`类型

**直接读取这个文件，把文件转成列表来操作**

```python
with open('test1.json', encoding='utf-8') as fp:
    pyth_list = json.load(fp)
```

其中，`fp`是`file`类型，`pyth_list`是`list`类型

**两种方法可以这样写，完全等价**

```python
config = json.loads(LLM_CONFIG.read_text(encoding="utf-8"))
```

```python
with open(LLM_CONFIG) as fp:
    config = json.load(fp)
```



# HTTP库

## HTTPX

### `httpx.Client(...)`

创建一个可复用的 HTTP 客户端对象。即创建“请求工具”，此时没有访问网络

```python
httpx.Client(
    base_url="https://api.example.com/v1/",
    headers={"Authorization": "Bearer sk-xxx"},
    timeout=60.0,
    follow_redirects=True,
    verify=True,
    proxy=None,
)
```

- `base_url`：统一设置接口基础地址，后面请求相对路径。
- `headers`：放 `Authorization`、`Content-Type` 等请求头。
- `timeout`：设置网络请求超时时间。
- `follow_redirects`：是否自动跟随重定向，默认是 `False`。
- `verify`：HTTPS 证书验证，默认是 `True`，通常不用写。
- `proxy`：需要通过代理访问接口时使用。

#### `client.get()`

使用这个工具请求某个 URL

```python
response = client.get(
    "https://example.com/search",
    params={"q": "python", "page": 1},
    headers={"User-Agent": "MyApp/1.0"},
    timeout=10.0,
    follow_redirects=True,
)
```

- `params`：添加 URL 查询参数。

  ```python
  client.get(
      "https://example.com/search",
      params={"q": "python", "page": 1},
  )
  ```

  实际请求地址会变成：`https://example.com/search?q=python&page=1`

  重复参数可以使用列表：

  ```python
  client.get(
      "https://example.com/search",
      params=[("tag", "python"), ("tag", "http")],
  )
  ```

  结果为：`https://example.com/search?tag=python&tag=http`

- `headers`：为当前请求增加或覆盖请求头。

  ```python
  client.get(
      "https://example.com/data",
      headers={
          "Authorization": "Bearer sk-xxx",
          "X-Request-ID": "abc123",
      },
  )
  ```

- `timeout`：覆盖客户端设置的超时时间。

  ```python
  client.get("https://example.com", timeout=5.0)
  ```

  也可以使用详细超时：

  ```python
  client.get(
      "https://example.com",
      timeout=httpx.Timeout(
          connect=3.0,
          read=30.0,
          write=5.0,
          pool=5.0,
      ),
  )
  ```

- `follow_redirects`：指定当前请求是否跟随重定向。

  ```python
  client.get(
      "https://example.com/old",
      follow_redirects=True,
  )
  ```

  

#  虚拟环境 venv

## 问题

不同项目使用的环境不同，如果都放到本地去部署的话，不同项目之间的不同环境会相互覆盖

![image-20260920202235251](Python/image-20260920202235251.png)

## 解决方法

把各自需要的依赖都放到自己项目的目录中

![image-20260920202354171](Python/image-20260920202354171.png)

## 实现步骤

1. 项目终端运行`python -m venv .venv`。注意，第一个`venv`不可以改名称，后面的`.venv`是可以改的，默认是`.venv`

2. 项目终端运行`.venv\Scripts\activate`用于激活这个虚拟环境目录，使python在解释的时候用这个目录下的环境

   激活之后可以比较明显的看到这个终端带了一个(.venv)的前缀

   ![image-20260920203949944](Python/image-20260920203949944.png)

3. 接下来在虚拟环境激活的状态下去安装依赖也是安装到这个目录了

   ![image-20260920204831192](Python/image-20260920204831192.png)

4. 退出命令：`deactivate`。或者直接把cmd窗口guan'diao
