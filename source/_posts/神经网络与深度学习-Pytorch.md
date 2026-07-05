---
title: 神经网络与深度学习-Pytorch
date: 2026-06-04 10:04:06
categories: 大模型
tag:
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

整体流程：准备数据 → 构建模型 → 定义损失与优化器 → 循环训练（前向、算损失、反向、更新参数）。

## ⭐⭐⭐用到的函数和知识点

###  PyTorch 里处理数据的标准三步流程

> tensor → Dataset → DataLoader

1. Tensor：原始数据

   ```python
   X = torch.tensor([[1.0, 2.0], [3.0, 4.0], ...])
   y = torch.tensor([0.0, 1.0, ...])
   ```

   Tensor 只是装着数字的多维数组本身，它不知道怎么**批量取数据、怎么打乱、怎么并行加载**。

2. Dataset：把数据包装成"可索引"的对象

   ```python
   from torch.utils.data import TensorDataset
   
   dataset = TensorDataset(X, y)
   ```

   `Dataset` 的作用是：

   - 把 `X` 和 `y` 配对绑定
   - 让你可以通过索引拿到一个 `(features, label)` 样本：

   > `x_i, y_i = dataset[0]`

   它回答的是"第 i 个样本是什么"。

3. DataLoader：数据加载器

   ```python
   from torch.utils.data import DataLoader
   
   loader = DataLoader(dataset, batch_size=32, shuffle=True)
   ```

   **数据加载器**就是帮你自动把数据集切分成小批量（batch），然后按批次喂给模型的工具。

   它主要做这几件事：

   | 功能         | 作用                                         |
   | ------------ | -------------------------------------------- |
   | `batch_size` | 每次取多少条样本                             |
   | `shuffle`    | 每个 epoch 是否打乱数据顺序                  |
   | 自动迭代     | 用 `for batch in loader` 就能逐个 batch 遍历 |
   | 多进程加载   | `num_workers` 可以并行读取数据               |

   例如：

   ```python
   for X_batch, y_batch in loader:
       # X_batch 形状: (32, n_features)
       # y_batch 形状: (32,)
       pred = model(X_batch)
       loss = criterion(pred, y_batch)
   ```


### 创造数据`make_regression`

`make_regression` 是 scikit-learn 中一个用来**生成模拟回归数据**的函数，常用于测试线性回归模型。返回的是 **NumPy 数组（`ndarray`）**

它的基本作用：根据你指定的参数，自动构造一个带有已知真实系数的人造数据集，这样你可以验证模型能不能学得够准。

```python
make_regression：我故意设了真实系数，再生成带噪声的数据点
模型训练：不知道真实系数，只看数据，自己学
训练完：对比学出来的 weight/bias 和真实系数

如果学出来的值接近真实系数，就验证了两件事：
模型没问题：线性回归模型确实能从数据中学到正确的规律
训练流程没问题：损失函数、反向传播、优化器这套流程是能跑通的
```

常用参数大概长这样：

```python
from sklearn.datasets import make_regression

X, y, coef = make_regression(
    n_samples=100,    # 样本数
    n_features=5,     # 特征数
    n_informative=3,  # 真正对 y 有影响的特征数
    noise=10,         # 噪声强度
    coef=True,        # 是否返回真实系数
    random_state=42
)
```

它会返回：

- `X`：形状为 `(n_samples, n_features)` 的特征矩阵
- `y`：形状为 `(n_samples,)` 的目标值
- `coef`：真实特征的权重系数（如果 `coef=True`）

`make_regression` 的约定：

  - `x`（特征）：永远是 2维 `(100, 1)`  —  因为特征可以有多个维度
  - `y`（目标值）：永远是 1维 `(100,)`  — `sklearn` 的习惯，因为目标值就是一个标量

生成数据的大致公式是：

```python
y = X @ coef + bias + noise # 假设 X 是 (100, 3)，coef 是 (3,)，结果 y 是形状 (100,)
```

其中 `noise` 是服从正态分布的随机扰动。

在模拟线性回归时，它的好处是你知道“正确答案”——可以把模型学出来的系数和 `make_regression` 返回的真实 `coef` 对比，看偏差有多大，用来评估模型效果或者做教学演示。

### 线性回归函数

#### 理解线性回归函数`Linear()`的定义

1. 代码`nn.Linear(1, 1)` 中的 "1" 指的是什么？

     - 第一个 1：每个样本的特征数`（in_features）`

     - 第二个 1：每个样本的输出出数`（out_features）`


2. 线性回归公式为`output = input × W^T + b`

     - `W` 的形状：`(1, 1)` — 因为输入1维、输出1维

     - `b` 的形状：`(1,)`

   根据上述公式，如果我们传入 `(100, 1) `并且代入公式中： ` input (100, 1)  ×  W^T (1, 1)  →  (100, 1)  +  b`。

   实际意义是 "对 batch 里的每个样本，分别做一次 `y = x * w + b"`。无论传 (1, 1)、(16, 1) 还是 (100, 1)，PyTorch 自动把 batch 维（第一维）当作"批次"，对每个样本独立做线性变换。

<span style="color:red">线性回归运算的本质是只（100,1）的第二维做计算，第一维是做计算的次数。如果传入(100,2)的话，那么线性回归就要为 `nn.Linear(2, 1)`，表示我的线性回归要对两个特征做一百次计算，计算出100个1个特征的样本</span>

![image-20260703120004061](image-20260703120004061.png)

#### 另外：⭐<span style="color:#FF00FF">`nn.Linear()`的两个维度通常是不相等的</span>

```python
相等的情况反而少见。nn.Linear 的作用就是在不同维度之间做映射（投影）：

  nn.Linear(2, 1)    # 2维 → 1维：降维（回归输出、二分类...）
  nn.Linear(64, 10)  # 64维 → 10维：降维（10分类任务）
  nn.Linear(16, 32)  # 16维 → 32维：升维
  nn.Linear(128, 128) # 128维 → 128维：保持维度不变（Transformer里常见）

  # 代码里的 nn.Linear(1, 1) 是因为 x 和 y 都是 1 维，所以输入输出都是 1——这只是一个特例，不是规则。

  当做多特征回归时就看出来了：

  # 假如有2个特征（如面积、房龄）预测房价
  x.shape        # (100, 2)   ← 2个特征
  model = nn.Linear(2, 1)  # 输入2维，输出1维

  这里 2 ≠ 1，但完全没问题。
```



### 损失函数

#### 回归问题的损失函数

`nn.MSELoss()`以均方误差为指导思想来不断逼近真实值

`loss = criterion(y_pred,train_y.reshape(-1,1))`计算预测值和真实值之间的损失，分两部分解释：

  1. `criterion(y_pred, ...)   # train_x shape: (16, 1)`

      ` criterion` 是一个损失函数（比如` nn.MSELoss()` 或 `nn.BCELoss()`），计算预测值 `y_pred`
       和真实值之间的差异。返回一个标量（张量），数值越小说明预测越准。

  2. `train_y.reshape(-1, 1)` `# train_y` 从 DataLoader 来，原始 `shape: (16,)`

     一维：只有一个轴

     ```python
       train_y = torch.tensor([1, 2, 3, 4, 5])
       train_y.shape      # torch.Size([5])    ← 这是1维，不是1行5列, 形状(5,)
       train_y.ndim       # 1
     ```

     二维：两个轴

     ```python
     y_pred = torch.tensor([[1], [2], [3], [4], [5]])
       y_pred.shape       # torch.Size([5, 1]) ← 这是2维
       y_pred.ndim        # 2
       y_pred = torch.tensor( [[1, 2, 3, 4, 5]] ) # 也是二维，形状(1,5)
     ```

     ⭐⭐<span style="color:#FF00FF">`[[1],[2],[3],[4],[5]]`和 `[[1, 2, 3, 4, 5]]`都是二维，他们的区别在哪里呢?</span>

     ![image-20260703113328639](image-20260703113328639.png)

     ![image-20260703113349286](image-20260703113349286.png)

     ⭐⭐<span style="color:#FF00FF">`[1, 2, 3, 4, 5]`就是5个样本，零个特征吗？</span>

     不是的。`[1, 2, 3, 4, 5] `形状 (5,) 是 1维张量，它根本没有"样本"和"特征"的概念——就是一排数字（五个数排成一排）。

     由此可得 `reshape(-1, 1)` 的作用：
     把 `(16,) → (16, 1)`，变成16行1列的列向量。

       ` reshape`前: `[ 0.5,  1.2,  3.4, ... ]`        `shape: (16,)`
       `reshape`后: `[[ 0.5],`
                          `[ 1.2],`
                          `[ 3.4],`
                            `...] `                                        `shape: (16, 1)`

     即：<span style="color:#FF9966">因为`train_x`是16个数据，每个数据有一个特征，所以也要把一开始仅仅是一行数据的`train_y`改成16个样本，每个样本有一个特征的形式</span>

### 反向传播和优化器

`optimizer.zero_grad()`：梯度清零

`loss.backward()`：反向传播

`optimizer.step()`：梯度更新

#### optimizer.zero_grad() 梯度清零函数

给出梯度的概念：梯度就是损失函数对每个参数的导数（偏导数）其实际意义为

> "这个参数往哪个方向调一点点，loss 能下降得最快"

比如线性回归 `y = wx + b`，梯度就是 `∂loss/∂w` 和 `∂loss/∂b`，分别告诉你 w 和 b 该怎么调。

PyTorch 的设计哲学是：梯度累加给用户更多灵活性。比如你想手动模拟一个大 batch（显存不够时），就可以多次 `backward()` 让梯度自动累加，最后只 `step()` 一次，效果等价于用大 batch 训练。但代价是：如果你不做累加，就必须手动清零。下面演示累加是什么意思：

假设某个参数的梯度，第一个 batch 算出来是 `0.3`：

```python
loss.backward()
# param.grad = 0.3
```

第二个 batch 如果不清零，直接再 backward：

```py
loss.backward()
# param.grad = 0.3 + 0.5 = 0.8   ← 累加了
```

然后 `optimizer.step()` 会用 `0.8` 去更新参数，而不是这个 batch 真正的梯度 `0.5`。

当显存不够、想用大 batch 但放不下时：

```python
optimizer.zero_grad()
for i, (X_batch, y_batch) in enumerate(loader):
    loss = criterion(model(X_batch), y_batch) / accumulation_steps
    loss.backward()         # 梯度累加
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()    # 累加几次后才更新
        optimizer.zero_grad()
```

此为梯度累加技巧，用小显存模拟大 batch。所以累加这个特性不是 bug，是 feature，只是默认场景下需要手动清零而已。

#### loss.backward() 反向传播函数

反向传播是计算梯度的高效算法。

关键在于：神经网络是一个多层的复合函数，从输入到输出要经过很多步计算。要算 loss 对最前面参数的梯度，需要用链式法则一层层往回推。比如：

```python
输入 x
  → z1 = w1 * x          #（前向计算第一步） w1为权重
  → z2 = w2 * z1         #（前向计算第二步） w2为权重
  → loss = (z2 - y)²     #（算损失）    拿结果 z2 和真实值 y 比，算误差（即均方误差）
    
```

现在想求 `∂loss/∂w1`，也就是 w1 对 loss 的影响有多大。

直接看不容易，但用链式法则从后往前拆：`∂loss/∂w1 = ∂loss/∂z2  ×  ∂z2/∂z1  ×  ∂z1/∂w1`,从 loss 出发，反向一层一层乘回去，就能算出最前面 w1 的梯度。这就是"反向传播"名字的由来——和前向计算方向相反。<span style="color:#FF9966">(复合函数求偏导)</span>。PyTorch 在你做前向计算时，会偷偷记录一张**计算图**（记录每一步用了什么运算、依赖关系）。当你调用 `loss.backward()` 时，它就沿着这张图从后往前，用链式法则一次性算出所有参数的梯度，存到每个参数的 `.grad` 属性里。所以 `loss.backward()` 这一行代码，干的事情就是：**从 loss 开始反向走 → 链式法则逐层求导 → 把结果存进每个参数的 .grad**

#### Why在正向传播的时候把梯度算出来，非要加一个反向传播？

因为不知道目标是什么。前向传播时还没算出 loss，不知道最终误差是多少，自然没法算"误差对参数的梯度"。必须先走到终点拿到 loss，才能往回推。

想象开车从 A 到 B，路上经过很多路口：A → 路口1 → 路口2 → 路口3 → B。

- 前向传播：从 A 出发，一个路口一个路口往前开，最终到达 B，发现走偏了 10 公里

- 反向传播：从 B 往回看，"在路口3 我应该左转一点，在路口2 应该右转一点……"

前向的时候还不知道最终偏了多少，所以我们不知道每个路口该怎么修正。只有到了终点发现误差，才能往回推算每一步该负多少责任。

从公式上看：`∂loss/∂w1 = ∂loss/∂z2 × ∂z2/∂z1 × ∂z1/∂w1`,  `∂z1/∂w1` 前向时确实能算，但其中`∂loss/∂z2` 要等 loss 算出来才知道。中间的 `∂z2/∂z1` 也要等 z2 算出来才知道。链条最后一环永远要等前向走完才能确定，所以没法真正"边走边算"，只能"走完再回头"。

#### `optim.SGD()` 优化器

`optimizer = optim.SGD(model.parameters(), lr=0.01)`

`optim.SGD`：选择 SGD 这个优化算法。SGD 全称是 Stochastic Gradient Descent（随机梯度下降），就是最基础的梯度下降法，每次用一个 batch 的数据算梯度然后更新参数。

`model.parameters()`：告诉优化器"你要负责更新哪些参数"。这里把模型里所有的 weight 和 bias 都交给它管，之后 `optimizer.step()` 就会更新这些参数。

`lr=0.01`：学习率设为 0.01，控制每次参数更新的步子大小。0.01 意味着每次只走梯度值的 1%，步子比较小，更新比较稳。

#### `optimizer.step()`梯度更新函数

拿着反向传播算出来的梯度，按公式修改参数值，让 loss 变小。对于每个参数：新参数 = 旧参数 - 学习率 × 梯度（梯度指向的是 loss 增大的方向，而我们要让 loss 减小，所以要反着走（减去梯度）。这叫梯度下降。）即`optimizer.step()` 这一行代码，帮你对所有参数执行了下面的操作。

```python
model.weight = model.weight - lr * model.weight.grad
model.bias   = model.bias   - lr * model.bias.grad
# 假设当前 weight = 2.0，反向传播算出梯度 grad = 0.5，学习率 lr = 0.1
# 新 weight = 2.0 - 0.1 × 0.5 = 2.0 - 0.05 = 1.95
# 参数从 2.0 变成了 1.95，往梯度指的方向走了一小步。
# 下一个 batch 再算、再走一步，反复很多轮，参数就慢慢逼近最优值。
```

#### 损失函数、反向传播和优化器的关系

1. 不同的损失函数会形成不同的 loss 曲面（可以想象成一个地形）。有的地形像一个光滑的碗，梯度下降能很快滑到最低点；有的地形坑坑洼洼，梯度下降容易卡在小坑里出不来。

   - 好的损失函数：曲面光滑、碗状，梯度明确指向最低点

   - 差的损失函数：曲面崎岖、有多个局部最小值，容易卡住

   比如均方误差（MSE）对回归问题来说就是一个很好的光滑碗，所以回归任务默认用它。

2. 反向传播给出下一步前进方向：比如站在曲面上的某个位置，反向传播看了一下周围，说"往这边走是下坡"。但不知道最低点在哪、离多远。你迈了一步，到了新位置，它再看一次，说"现在往那边走"，就这样一步一步挪。

3. 优化器决定如何到达反向传播给出的下一步的方向，优化器选得好能少走弯路、少震荡、更快收敛。比如我们这基础 SGD 就是老老实实按`新参数 = 旧参数 - lr × 梯度`，但它有几个问题：

- 遇到平坦区域，梯度很小，走得极慢
- 遇到陡峭区域，梯度很大，容易震荡甚至发散
- 遇到狭长的山谷地形，会在两侧来回弹，迟迟到不了最低点

所以还会有其他的优化器，比如Momentum（带惯性）和 Adam（最常用）



## 代码

### 创建数据集

```python
def create_dataset():
    # 1. 创建数据集对象.
    x, y, coef = make_regression(
        n_samples=100,  # 100个样本
        n_features=1,  # 1个特征（特征点）
        noise=10,  # 噪声，噪声越大，样本点越散
        coef=True,  # 是否返回系数，默认为False，返回值为None
        bias=14.5,  # 偏置值
        random_state=3  # 随机种子，随机种子相同，输出数据相同
    )
    # 2. 把上述数据转换为张量
    x = torch.tensor(x, dtype=torch.float32)
    y = torch.tensor(y, dtype=torch.float32)
    return x, y, coef
```

**输出x,y,coef含义如下如所示**

![image-20260702161448070](image-20260702161448070.png)

### 模型训练

```python
def train(x, y, coef):
    # 1. 创建数据集对象. 把 tensor → 数据集对象 → 数据加载器.
    dataset = TensorDataset(x, y)

    # 2. 创建数据加载器对象.
    # 参1: 数据集对象, 参2: 批次大小, 参3: 是否打乱数据(训练集打乱, 测试集不打乱)
    dataloader = DataLoader(dataset, batch_size=16, shuffle=True)
    # 3.创建初始的线性回归模型
    # 参1：输入特征维度，参2：输出特征维度
    model = nn.Linear(1, 1)
    # 4. 创建损失函数对象
    criterion = nn.MSELoss()  # 平方损失
    # 5. 创建优化器对象
    optimizer = optim.SGD(model.parameters(), lr=0.01)
    # 6.具体的训练过程
    # 6.1 定义变量，分别表示：训练论述，每轮的（平均）损失值，训练总损失值，训练的样本数
    epochs, loss_list, total_loss, total_sample = 100, [], 0.0, 0
    # 6.2 开始训练
    for epoch in range(epochs):
        # 6.3 每轮分批次训练
        for train_x, train_y in dataloader:  # 7批（16，16，16，16，16，16，4）
            # 6.4 模型预测
            y_pred = model(train_x)  # 输出二维
            # 6.5 计算（每批的平均）损失
            loss = criterion(y_pred, train_y.reshape(-1, 1))
            # 6.6 计算总损失 和 样本（批次）数
            total_loss += loss.item()
            total_sample += 1
            # 6.7 梯度清零 + 反向传播 + 梯度更新
            optimizer.zero_grad()  # 梯度清零
            loss.backward()  # 反向传播。计算梯度
            optimizer.step()  # 梯度更新
            # 6.8 把本轮的（平均损失值），添加到列表中
            loss_list.append(total_loss/total_sample)
        print(f'轮数:{epoch+1}，平均损失值:{total_loss/total_sample}')
    # 7.打印最终的训练结果
    print(f'{epochs}轮的平均损失分别为：{loss_list}')
    print(f'模型参数，权重：{model.weight}, 偏置：{model.bias}')

```

训练结果：

![image-20260704164257692](image-20260704164257692.png)



### What  should we do?

我们在模型训练的过程中来调整`超参数`使这些数据拟合度更高。从而能对新的数据预测精准，我们在拿到一堆数据之后主要做：

1. 训练过程前选定超参数

   - 模型结构`（Linear / 多层网络）`

   - 损失函数`（MSE）`

   - 优化器和学习率`（Adam, lr=0.001）`
   - 训练轮数（`epochs）`
   - 批大小`（batch_size）`

2. 训练过程中程序自动执行，我们不介入

   - 优化器自动调 `weight` 和 `bias`

      - `loss` 随之变化

      - 跑完设定的轮数后结束

3. 训练后：看结果决定要不要调

   - 第一轮：用 `SGD，lr=0.01`，训练 100 轮 → `loss` 降不下来

   - 第二轮：换成 `Adam，lr=0.001`，训练 500 轮 →` loss` 降得很好 ✓

   - 第三轮：再加一层网络，`lr=0.001`，训练 500 轮 → 更好了 ✓



### 绘制曲线

```python
    # 8.绘制损失曲线
    #             100轮          每轮的平均损失值
    plt.plot(range(epochs),loss_list)
    plt.title('损失值曲线变化图')
    plt.grid()
    plt.show()

    # 9. 绘制预测值和真实值的关系.
    # 9.1 绘制样本点分布情况.
    plt.scatter(x, y)  # 画散点图。把 x 和 y 的每一对值作为一个点画在图上。
    # 9.2 绘制训练模型的预测值.
    # x: 100个样本点的特征.
    y_pred = torch.tensor(data = [v * model.weight + model.bias for v in x])
    # 9.3 计算真实值.
    y_true = torch.tensor(data =[v * coef + 14.5 for v in x])
    # 9.4 绘制预测值 和 真实值的 折线图.
    plt.plot( x, y_pred, color = 'red', label = '预测值')
    plt.plot(x, y_true, color = 'green', label = '真实值')
    # 9.5 图例, 网格.
    plt.legend()
    plt.grid()
    # 9.6 显示图像.
    plt.show()
```

![image-20260704183626622](image-20260704183626622.png)

![image-20260704190145254](image-20260704190145254.png)
