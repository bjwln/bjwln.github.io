---
title: PyTorch
date: 2026-06-04 10:04:06
tags:
categories: 深度学习
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBjxVqMAsk-_Twr0LCOsrln4gLg72rjAACLAxrG3UggUWroE8MiRIINAEAAwIAA3kAAzwE.png
---

PyTorch是一个用于机器学习和深度学习的开源深度学习框架，由Facebook于2016年发布，其主要实现了自动微分功能，并引入动态计算图使模型建立更加灵活。Pytorch可分为前后端两个部分，前端是与用户直接交互的python API，后端是框架内部实现的部分，包括Autograd，它是一个自动微分引擎。

Pytorch基于已有的张量库Torch开发，在PyTorch的早期版本中，使用的是Torch7，后来随着PyTorch的发展，逐渐演变成了PyTorch所使用的张量库。

现如今，Pytorch已经成为开源机器学习系统中，在科研领域市场占有率最高的框架，其在AI顶会上的占比在2022年已达80％ 。

# 张量的类型转换

## 张量转换NumPy数组

```python
def dem02():
    t1 = torch.tensor([1, 2, 3, 4, 5])
    print(f't1: {t1}, type: {type(t1)}')
    # 2.张量-> numpy.
    n1 = t1.numpy()
    print(f'n1: {n1}, type: {type(n1)}')
    # 3.演示上述方式 共享内存。
    n1[0] = 100
    print(f't1: {t1}') # [100, 2, 3, 4, 5]
    print(f'n1: {n1}') # [100, 2, 3, 4, 5]
```



## NumPy数组转换张量

- 使用from_ numpy 可以将ndarray数组转换为Tensor，默认共享内存，使用 copy 函数避免共享。
- 使用 torch.tensor 可以将 ndarray 数组转换为 Tensor，默认不共享内存。（用的多）

```python
def dem02():
    # 1.创建numpy数组
    n1 = np.array([11, 22, 33])
    print(f'n1:{n1},type:{type(n1)}')
    # 2.把上述的numpy数组，转换成张量.
    t1 = torch.from_numpy(n1).type(torch.float32)
    print(f't1: {t1}, type: {type(t1)}')
    t1 = t1.numpy()  # 把t1转换回numpy，然后演示tensor函数的效果
    print(f't1: {t1}, type: {type(t1)}')
    t1 = torch.tensor(n1, dtype=torch.float32)
    print(f't1: {t1}, type: {type(t1)}')
```

## 从张量中提取内容

只能从标量张量中提取内容。也就是这个张量中只能有一个值

```python
def dem02():
    t1=torch.tensor(100);
    print(f't1: {t1},type:{type(t1)}')
    value = t1.item()
    print(f'value: {value},type:{type(value)}')
```



# 张量的数值计算

## 基本运算

### 加减乘除

涉及到的API:

- add(), sub(), mul(), div(), neg()    加减乘除,取反substact，multiply，divide
- add\_(), sub\_(), mul\_() div\_(), neg\_(）功能同上，只不过可以修改源数据，类似于 Pandas部分的inplace=True

需要你记忆的: +，-，*，/

如果是张量和数值运算，则:该数值会和张量中的每个值依次进行 对应的运算. 

```py
def dem02():
    t1=torch.tensor([10,12,13]);
    t1+=10
    print(f't1: {t1}')
```

![](image-20260605101130635.png)

### 幂运算：pow()、pow_()

接口：`Tensor ** exponent` / `Tensor.pow(exponent)` / `Tensor.pow_(exponent)`

功能：逐元素求幂。`pow()` 返回新张量，`pow_()` 为 in-place。

参数：`exponent`：指数（标量或与张量可广播的张量）

```python
import torch
tensor1 = torch.tensor([1, 2, 3])
print(tensor1 ** 2)   # tensor([1, 4, 9])
print(tensor1.pow(2)) # 同上
tensor1.pow_(2)       # in-place
print(tensor1)        # tensor([1, 4, 9])
```

### 求平方根：sqrt()、sqrt_()

接口：`Tensor.sqrt()` / `Tensor.sqrt_()`

功能：逐元素平方根。`sqrt()` 返回新张量，`sqrt_()` 为 in-place。

参数：无

```python
import torch
tensor1 = torch.tensor([1.0, 2.0, 3.0])
print(tensor1.sqrt())  # tensor([1., 1.414..., 1.732...])
tensor1.sqrt_()
print(tensor1)
```

### 以 e 为底：exp()、log()

接口：`Tensor.exp()` / `Tensor.exp_()`、`Tensor.log()` / `Tensor.log_()`

功能：逐元素以 e 为底求幂（exp）或求自然对数（log）。带下划线版本为 in-place。

参数：无

```python
import torch
tensor1 = torch.tensor([1.0, 2.0, 3.0])
print(tensor1.exp())  # e^1, e^2, e^3
print(tensor1.log())  # ln(1), ln(2), ln(3)
```

### 哈达玛积（逐元素乘法）

接口：`*`、`Tensor.mul(other)`

功能：两张量形状相同或可广播时，对应位置相乘（Hadamard product），与矩阵乘法不同。

参数：`other`：张量或标量

```python
import torch
tensor1 = torch.tensor([[1, 2], [3, 4]])
tensor2 = torch.tensor([[1, 2], [3, 4]])
print(tensor1 * tensor2)   # [[1,4],[9,16]]
print(tensor1.mul(tensor2)) # 同上
```



## 矩阵乘法运算

1. 点乘：
   要求：两个张量的维度保持一致，对应元素直接做相应的操作.
   API:
   - `t1 * t2`
   - `t1.mul(t2)`  # multiply: 乘法

2. 矩阵乘法：
   要求：两个张量，第一个张量的列数，等于第二个张量 的行数(A列 = B行)
   结果：A行B列
   API:
   - `t1 @ t2`
   - `t1.matmul(t2)`
   - `t1.dot(t2)` 扩展：只针对于一维张量有效.

注意：

`X = X @ Y` 会先分配新张量再赋给 `X`；若之后不再使用原来的 `X`，可用 `X[:] = X @ Y` 在原有存储上写入，减少一次分配。确保右边的结果能够正确地广播到左边指定的形状。如果形状不匹配，则会导致错误。

```python
import torch
X = torch.randint(1, 9, (3, 2, 4))
Y = torch.randint(1, 9, (3, 4, 1))
print(id(X))
X = X @ Y      # X 指向新对象，原内存可被回收
print(id(X))   # 与上面不同

X = torch.randint(1, 9, (3, 2, 4))
print(id(X))
X[:] = X @ Y   # 结果写回 X 的存储，id(X) 不变
print(id(X))
```

# 张量的索引操作

## 简单索引与切片

接口：`tensor[i]`、`tensor[:, j]`、`tensor[i:j, k:l]` 等下标与切片语法

功能：单整数索引会使该维消失（降维）；切片保留该维；`:` 表示该维全选。

参数：`i`、`j` 等为整数或切片（start​\:end:step），支持负索引。

```py
tensor1 = torch.randint(1, 9, (3, 5, 4)) 
#这行代码的意思是：创建一个形状为 (3, 5, 4) 的三维张量（Tensor），其中的元素是从 1 到 8 之间的随机整数。
print(tensor1[0].shape)      # (5, 4)：取第 0 维为 0 的片
print(tensor1[:, 1].shape)   # (3, 4)：第 1 维取 1
print(tensor1[2, 1, 3])      # 标量
print(tensor1[1:, 1:4, 0:3].shape)  # (2, 3, 3)：切片
```

## ⭐列表索引

接口：`tensor[[i1,i2,...],[j1,j2,...],...]` 等，下标为整数张量或列表。

- ：表示选择当前所有行/列

- `tensor[[[1],[2]],[3,4]]`:代表把第2行的3，4两列和第3行的3，4两列读出来

- <span style="color:#FF00FF">`tensor[:, tensor[2]>5]`：</span>

  ```python
   # tensor[2] > 5 仅以第3个矩阵（索引2）为条件，生成布尔掩码。
   # 但 tensor[:, mask] 会在所有矩阵（第1、第2、第3个）的相同位置提取数据，而不管其他矩阵在这    些位置的值是否满足>5
   # 结果是所有矩阵在第3个矩阵满足条件的那些位置上的值（共7个位置）。
   # 只有第3个矩阵的对应值保证 >5，而第1、第2个矩阵的值只是巧合出现在这些位置，可能完全不符合      >5 的条件。
      tensor = torch.tensor([
          [[7, 1, 4, 4],
           [4, 8, 2, 8],
           [7, 8, 7, 2],
           [2, 2, 7, 8],
           [7, 2, 2, 2]],
  
          [[1, 2, 2, 3],
           [7, 5, 7, 3],
           [5, 8, 8, 2],
           [7, 4, 6, 7],
           [5, 5, 4, 1]],
           
          [[4, 2, 2, 7],
           [1, 6, 8, 7],
           [7, 1, 6, 2],
           [4, 4, 3, 1],
           [2, 8, 1, 5]]])
      print(tensor[:,tensor[2]>5])
      #	[4, 2, 2, 7],
      #   [1, 6, 8, 7],
      #   [7, 1, 6, 2],
      #   [4, 4, 3, 1],
      #   [2, 8, 1, 5]
      #   [[False, False, False,  True],
      # 	[False,  True,  True,  True],
      # 	[ True, False,  True, False],
      # 	[False, False, False, False],
      # 	[False,  True, False, False]]
      #	得到布尔掩码后返回所有为True的值
  ```

- `t1[:, t1[1, :] > 5]`（`t1[:, t1[1] > 5]`）：`t1[1, :] > 5`是一个定位，代表选择所有行的第【在矩阵中第二行列数据大于五的】列

  ```python
   t1 = torch.tensor([[6, 9, 9, 2, 8],
                         [7, 8, 5, 8, 4],
                         [7, 4, 3, 9, 3],
                         [6, 1, 4, 2, 8],
                         [1, 2, 5, 7, 4]])
      print(t1[:, t1[1, :] > 5])
      #输出所有行的第1，2，4列数据。共5行（所有行），3列
      # tensor([[6, 9, 2],
      #         [7, 8, 8],
      #         [7, 4, 9],
      #         [6, 1, 2],
      #         [1, 2, 7]])
  ```

  

功能：多下标按位置配对或广播，可取出不连续或重排后的元素。

参数：各维传入长度相同的整数序列或可广播的整数张量。

```python
	import torch
    tensor1 = torch.randint(1, 9, (3, 5, 4))
    # 取 (1,1)、(0,2) 两行
    print(tensor1)
    print(tensor1[[1, 0], [1, 2]])
    # [[0],[1]] 与 [1,2] 广播，取 4 个位置，结果形状 (2, 2, 4)
    print(tensor1[[[0], [1]], [1, 2]].shape)
```

<span style="color:#FF00FF">下面演示一下三维张量的列表索引计算方法</span>

```python
 tensor = torch.tensor([
        [[7, 1, 4, 4],
         [4, 8, 2, 8],
         [7, 8, 7, 2],
         [2, 2, 7, 8],
         [7, 2, 2, 2]],

        [[1, 2, 2, 3],
         [7, 5, 7, 3],
         [5, 8, 8, 2],
         [7, 4, 6, 7],
         [5, 5, 4, 1]],

        [[4, 2, 2, 7],
         [1, 6, 8, 7],
         [7, 1, 6, 2],
         [4, 4, 3, 1],
         [2, 8, 1, 5]]])
    print(tensor[[1, 0], [1, 2]])
     # 把 tensor 结构拆开：
     #  tensor[0] = [
     #      [7, 1, 4, 4],   # 第0行
     #      [4, 8, 2, 8],   # 第1行 ← tensor[0][1]
     #      [7, 8, 7, 2],   # 第2行
     #      [2, 2, 7, 8],
     #      [7, 2, 2, 2]
     #  ]
     #  tensor[1] = [
     #     [7, 5, 7, 3],   # 第1行 ← tensor[1][1]
     #      [5, 8, 8, 2],
     #      [7, 4, 6, 7],
     #      [5, 5, 4, 1]
     #  ]
     #  所以：
     #  - tensor[1, 1] → tensor[1][1] → [7, 5, 7, 3]
     #  - tensor[0, 2] → tensor[0][2] → [7, 8, 7, 2]
```

## ⭐范围索引（切片）

同上“简单索引”中的切片用法；`start:end:step`、负索引均支持。

```python
import torch
tensor1 = torch.randint(1, 9, (3, 5, 4))
print(tensor1[1:].shape)          
print(tensor1[-1:, 1:4, 0:3].shape) 
```

<span style="color:#FF00FF">下面演示一下三维张量的范围索引计算方法</span>

```python
    tensor = torch.tensor([
        [[7, 1, 4, 4],
         [4, 8, 2, 8],
         [7, 8, 7, 2],
         [2, 2, 7, 8],
         [7, 2, 2, 2]],

        [[1, 2, 2, 3],
         [7, 5, 7, 3],
         [5, 8, 8, 2],
         [7, 4, 6, 7],
         [5, 5, 4, 1]],

        [[4, 2, 2, 7],
         [1, 6, 8, 7],
         [7, 1, 6, 2],
         [4, 4, 3, 1],
         [2, 8, 1, 5]]])
    print(tensor[1:])
    # tensor([[[1, 2, 2, 3],
    #          [7, 5, 7, 3],
    #          [5, 8, 8, 2],
    #          [7, 4, 6, 7],
    #          [5, 5, 4, 1]],
    #
    #         [[4, 2, 2, 7],
    #          [1, 6, 8, 7],
    #          [7, 1, 6, 2],
    #          [4, 4, 3, 1],
    #          [2, 8, 1, 5]]])
    # 记录包含第二三维所有数的第一维的下标1之后的数
    print(tensor[-1:, 1:4, :3])
    # tensor([[[1, 6, 8],
    #          [7, 1, 6],
    #          [4, 4, 3]]])
    #   ┌───────┬──────┬────────────┬────────────────────────────────────────────┐
    #   │ 维度  │ 切片 │    含义    │                  选中内容                   │
    #   ├───────┼──────┼────────────┼────────────────────────────────────────────┤
    #   │ 维度0 │ -1:  │ 最后一个    │ layer 2 (整个 5×4)                         │
    #   ├───────┼──────┼────────────┼────────────────────────────────────────────┤
    #   │ 维度1  │ 1:4 │ 行 1, 2, 3 │ [[1, 6, 8, 7], [7, 1, 6, 2], [4, 4, 3, 1]] │
    #   ├───────┼──────┼────────────┼────────────────────────────────────────────┤
    #   │ 维度2 │  :3  │ 列 0, 1, 2 │ 每行取前3列                                 │
    #   └───────┴──────┴────────────┴────────────────────────────────────────────┘
    #   最终结果 — 从最后一层 (layer 2)，取行 1~3，列 0~2：
```

## 多维索引

```python
   t2 = torch.tensor([
            [
                [
                    3, 
                 	4, 
                 	6, 
                 	5
                ],
                
                [
                    8, 
                    8, 
                    8, 
                    3
                ],
                
                [4, 9, 6, 7]
            ],

            [
                [2, 8, 8, 5],
                [6, 4, 2, 2],
                [2, 7, 9, 4]
            ]
    ])
    # 需求1:获取0轴上的第1个数据.
    print(t2[0,:,:])
    # tensor([[3, 4, 6, 5],
    #         [8, 8, 8, 3],
    #         [4, 9, 6, 7]])
    # 需求2:获取1轴上的第1个数据.
    print(t2[:,0,:])
    # tensor([[3, 4, 6, 5],
    #         [2, 8, 8, 5]])
    # 需求3:获取2轴上的第1个数据.
    print(t2[:,:,0])
    # tensor([[3, 8, 4],
    #         [2, 6, 2]])
    
```

![image-20260614103710271](image-20260614103710271.png)

![](image-20260614103655112.png)

索引操作` t2[:,:,0]` 的工作原理

  当我们使用` t2[:,:,0]` 时：

  - 第一个 : 表示保留所有层（2个层）
  - 第二个 : 表示保留所有行（3行）
  - 0 表示只选择第0列

  所以这个操作实际上是：

  - 从第0层：取第0列 → [3, 8, 4]
  - 从第1层：取第0列 → [2, 6, 2]

# 张量的形状操作

## reshape 与 view(View不常用)

接口：

- `Tensor.reshape(*shape)`：在内存不连续时可返回副本
- `Tensor.view(*shape)`：要求张量在内存中连续，否则需先调用 `contiguous()`

功能：在元素总数不变的前提下调整形状。

```python
tensor1 = torch.randint(1, 9, (3, 5, 4))  # 共 60 个元素

print(tensor1.reshape(6, 10))   # 形状 (6, 10)
print(tensor1.reshape(3, -1))  # (3, 20)，-1 被推断为 20
```



## unsqueeze：增加大小为 1 的维

接口：

- `Tensor.unsqueeze(dim)`
- `Tensor.unsqueeze_(dim)`

功能：在指定位置插入一个大小为 1 的维度，常用于广播或与某些接口的维度要求对齐。一般在模型欠拟合的时候增加维度

参数：

- `dim`：插入的维度下标（支持负索引，-1 表示最后一维之后）。

```python
# 1. 定义2行3列的张量.
    t1 = torch.randint(1, 10, size=(2, 3))
    print(f't1: {t1}, shape: {t1.shape}')  # (2, 3)

    # 2. 在0维上, 添加一个维度.
    t2 = t1.unsqueeze(0)
    print(f't2: {t2}, shape: {t2.shape}')  # (1, 2, 3)

    # 3. 在1维上, 添加一个维度.
    t3 = t1.unsqueeze(1)
    print(f't3: {t3}, shape: {t3.shape}')  # (2, 1, 3) 由原来的两行三列矩阵变为两个一行三列的矩阵

    # 4. 在2维上, 添加一个维度.
    t4 = t1.unsqueeze(2)
    print(f't4: {t4}, shape: {t4.shape}')  # (2, 3, 1)

    # 5. 在3维上(不存在), 添加一个维度.
    t5 = t1.unsqueeze(3)
    print(f't5: {t5}, shape: {t5.shape}')  # (2, 3 , * , 1)  中间跳了一个*，报越界错误
```

## squeeze：删除大小为 1 的维

接口：

- `Tensor.squeeze(dim=None)`
- `Tensor.squeeze_(dim=None)`

功能：删除大小为 1 的维度。不传 `dim` 时删除所有大小为 1 的维；传 `dim` 时仅当该维为 1 才删除。

参数：

- `dim`：可选，指定要删除的维度下标。

```python
import torch
tensor1 = torch.tensor([1, 2, 3, 4, 5])
tensor1 = tensor1.unsqueeze_(dim=0)  # (1, 5)
tensor1 = tensor1.unsqueeze_(dim=0)  # (1, 1, 5)
print(tensor1.squeeze())  # (5,)，删除所有大小为 1 的维
```

## 交换维度

接口：

- `Tensor.transpose(dim0, dim1)`：交换两个指定维度
- <span style="color:#FF00FF">`Tensor.permute(*dims)`：按给定顺序重排所有维度，可一次实现多维交换</span>

参数：

- `transpose(dim0, dim1)`：`dim0`、`dim1` 为要交换的两个维度下标（从 0 起）。
- <span style="color:#FF00FF">`permute(*dims)`：`*dims` 为新的维度顺序，例如原形状 (2,3,6) 传入 (2,0,1) 得到 (6,2,3)。</span>

```python
 tensor1 = torch.randint(1, 9, (2, 3, 6))

    # transpose：只交换第 1 维与第 2 维，结果形状 (2, 6, 3)
    print(tensor1.transpose(1, 2))

    # permute：按 (dim2, dim0, dim1) 重排，结果形状 (6, 2, 3)
    print(tensor1.permute(2, 0, 1))       # 第0维的数据为dim2，第1维的数据为dim0，第2维的数据为dim1
```



# 张量的拼接操作

## torch.cat

接口：`torch.cat(tensors, dim=0, out=None)`

功能：在指定维度上拼接多个张量，除 `dim` 外其余维度须相同。

参数：

- `tensors`：张量序列（list 或 tuple）
- `dim`：沿该维拼接
- `out`：可选输出张量

```python
    # 1. 创建两个张量.
    t1 = torch.randint(1, 10, (2, 3))
    print(f't1: {t1}, shape: {t1.shape}')

    t2 = torch.randint(1, 10, (2, 3))
    print(f't2: {t2}, shape: {t2.shape}')

    # 2. 演示张量的拼接.
    t3 = torch.cat(tensors=[t1, t2], dim=0)  # (2, 3) + (2, 3) = (4, 3)
    print(f't3: {t3}, shape: {t3.shape}')
```

![image-20260614222751340](image-20260614222751340.png)

## torch.stack

接口：`torch.stack(tensors, dim=0, out=None)`

功能：在新维度上堆叠多个张量，所有输入形状必须一致，结果多出一维。

参数：

- `tensors`：形状相同的张量序列
- `dim`：插入的新维度位置
- `out`：可选输出张量

```python
    # 1. 创建两个张量.
    t1 = torch.tensor([[6,9,9],[2,8,7]])

    t2 = torch.tensor([[8,5,8],[4,7,4]])
    # 思路2: stack() 拼接张量, 可以是新维度, 但是无论新旧维度, 所有维度都必须保持一致.
    t7 = torch.stack([t1, t2], dim=0)    # (2, 3) + (2, 3) = (2, 2, 3)
    print(f't7: {t7}, shape: {t7.shape}')

    t8 = torch.stack(tensors=[t1, t2], dim=1)    # (2, 3) + (2, 3) = (2, 2, 3)
    print(f't8: {t8}, shape: {t8.shape}')
    
    t9 = torch.stack(tensors=[t1, t2], dim=2)  # (2, 3) + (2, 3) = (2, 3, 2)
    print(f't9: {t9}, shape: {t9.shape}')
```

关于`t8`：

![image-20260614223902264](image-20260614223902264.png)

![image-20260614223851271](image-20260614223851271.png)

关于`t9`：

![image-20260614224332820](image-20260614224332820.png)

<span style="color:#FF00FF">⭐这里的二维度相比于前面的维度，只是单个数字，故不用再加中括号</span>

![image-20260614230021539](image-20260614230021539.png)

![image-20260614230104952](image-20260614230104952.png)

# 自动微分模块

训练时 PyTorch 会构建**计算图（computational graph）**，记录数据与运算，并通过内置的微分引擎 `torch.autograd` 在根节点调用 `backward()` 自动计算梯度。PyTorch 的 `backward()` 就是在计算图上自动做链式法则，从根节点（通常是损失）一路把梯度传回叶子节点（如权重、偏置）。

![image-20260616222332398](image-20260616222332398.png)

![image-20260616223707063](image-20260616223707063.png)

```python
 	# 1. 定义变量，记录：初始的权重w(旧)
    # 参1：初始值，参2：是否自动微分(求导)，参3：数据类型
    w = torch.tensor(data=10, requires_grad=True, dtype=torch.float)

    # 2. 定义loss变量，表示损失函数。
    loss = 2 * w ** 2  # loss = 2w² → 求导：4w

    # 3. 打印梯度函数类型(了解)
    # print(f'梯度函数类型：{type(loss.grad_fn)}')    # <class 'MulBackward0'>
    # print(loss.sum())

    # 4. 计算梯度，梯度 = 损失函数的导数，计算完毕后，会记录到 w.grad属性中。
    # loss.sum().backward()      # 保证loss是1个标量。
    loss.backward()  # 这里因为y本身就是标量，可以不写sum()

    # 5. 代入 权重更新公式：W新 = W旧 - 学习率 * 梯度
    w.data = w.data - 0.01 * w.grad

    # 6. 打印最终结果。
    print(f'更新后的权重：{w}')  # 9.6
```

在真实的神经网络中，情况完全不同：

  1. 损失函数不是 2w²，而是 loss = f(w, x, y) —— 依赖输入数据 x 和真实标签 y。
  2. 梯度不会总是把 w 推向 0，因为 loss 的最低点不一定在 w=0 处。比如线性回归 loss = (wx - y)²，最优 w 是让 wx ≈ y

    的那个值，通常不是 0。
  3. 多个权重相互制衡，真实网络有成千上万的参数，一个权重的梯度受其他所有权重影响，不会简单归零。
  4. 当模型收敛时，梯度会趋近于 0，此时权重稳定在最优值附近，而不是单纯的 0。

  一句话总结：这个 demo 的 loss 函数恰好是 2w²（最小值在 w=0），所以你看到 w→0
  是对的。但在真实场景中，梯度下降会让权重停在让 loss 最小的那个值，那个值一般不是 0。

## 自动微分模块案例-循环更新参数

```python
    w = torch.tensor(data=10, requires_grad=True, dtype=torch.float32)
    loss = w ** 2 + 20
    # 利用梯度下降法，循环迭代100求最优解
    print(f'开始权重值:{w:.5f}, (0.01 * w.grad):无 , loss:{loss:.5f}')
    for i in range(1, 101):
        # 1.正向传播
        loss = w ** 2 + 20
        # 2.梯度清零，否则 backward() 会累加梯度
        if w.grad is not None:
            w.grad.zero_()
        # 3.反向传播
        # 这里的loss本身就是一个标量，所以可以不用写sum
        # PyTorch 的 backward() 会累加梯度，而不是覆盖梯度。这是因为一个参数可能被多个 loss 贡献梯度（比如 RNN中同一个权重在不同时间步被使用）。
        loss.backward()
        # print(f'梯度值为:{w.grad}')
        # 4.梯度更新
        w.data = w.data - 0.01 * w.grad
        # 5.打印本次梯度更新后的权重参数结果
        print(f'第{i}次，权重初始值：{w:.5f},(0.01 * w.grad):{0.01 * w.grad:.5f}, loss:{loss:.5f}')
    print(f'最终权重：{w},梯度:{w.grad},loss={loss}')
```



# 案例-线性回归案例
