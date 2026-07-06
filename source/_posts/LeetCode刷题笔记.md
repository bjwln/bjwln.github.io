---
title: LeetCode刷题笔记
date: 2026-06-24 18:38:58
tags:
categories: 算法题
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBkGVqO7WC4DGzDgSFbhiu1wiq6DFouAAC7AtrG5DK4EW3dVRlz4SK8AEAAwIAA3kAAzwE.png
---

# DP

## 锯齿形状数组的总数Ⅱ

### 定义状态

整个数组的变化节奏只有两种。当前位置`i`的数为x时：

- 第`i-1`个位置是`< x`的，那么第`i+1`个位置就要`> x`的
- 第`i-1`个位置是`> x`的，那么第`i+1`个位置就要`< x`的

因为每个数都可能作为上升存在也可能作为下降存在，所以定义两个状态：

- `up[x]`：当前数组最后一个数是 `x`，并且最后一步是上升的方案数，即`z > y < x`
- `down[x]`：当前数组最后一个数是 `x`，并且最后一步是下降的方案数，即`z < y > x`

### 分析状态转移

若数列为`z y x`，对于x：

1. 最后一步是上升，即存在前一个数`y < x`，那么`up[x]`要加上`down[y]`(当前数组最后一个数是 `y`，并且最后一步是下降的方案数).即加上了`z > y`的情况
2. 最后一步是下降，即存在前一个数`y > x`，那么`down[x]`要加上`up[y]`(当前数组最后一个数是 `y`，并且最后一步是上升的方案数).即加上了`z < y`的情况

### 分析初始状态len=2

若长度为2，下标为`i`的最后一步为上升方案数`up[i]=i`，下标为`i`的最后一步为下降方案数`up[i]=r-l`

得到复杂度高的代码

```c++
	for (int len = 3; len <= n; len++) {
		//此时的up,down数组为第len-1层的数据
		//定义新newup,newdown来更新第len层的数据
		int newup[r - l + 1] = {0}, newdown[r - l + 1] = {0};
		for (int x = l; x <= r; x++) {
			//如果y->x为上升，那么就要加上所有z->y是下降的
			for (int y = 0; y < x; y++)
				newup[x] = (newup[x] + down[y]) % MOD;
			//如果y->x为下降，那么就要加上所有z->y是上升的
			for (int y = x + 1; y <= r; y++)
				newdown[x] = (newdown[x] + up[y]) % MOD;
		}
		for (int i = l; i <= r; i++) {
			up[i] = newup[i];
			down[i] = newdown[i];
		}
	}
```



### ⭐⭐⭐优化时间复杂度——矩阵快速幂

比如·`n=3,l=0,r=2`

当长度为2的时候

```c++
up   = [0, 1, 2]
down = [2, 1, 0]
state2 =
[
  0,
  1,
  2,
  2,
  1,
  0
]
```

当进行`len=3`的更新时

```c++
newUp[0] = 0
newUp[1] = down[0]
newUp[2] = down[0] + down[1]

newDown[0] = up[1] + up[2]
newDown[1] = up[2]
newDown[2] = 0
如果写的明确一点，所有的新值都是旧状态的加法组合。
newUp[0]   = 0
newUp[1]   = oldDown[0]
newUp[2]   = oldDown[0] + oldDown[1]
newDown[0] = oldUp[1] + oldUp[2]
newDown[1] = oldUp[2]
newDown[2] = 0
```

这就可以用一个 `0/1` 表来表示，这个表就是“转移矩阵”。含义为：这个新状态要由哪些旧状态加起来。`newUp2: 0 0 0 1 1 0`:`newUp[2] = oldDown[0] + oldDown[1]`

```c++
             oldUp0 oldUp1 oldUp2 oldDown0 oldDown1 oldDown2
newUp0          0      0      0       0        0        0
newUp1          0      0      0       1        0        0
newUp2          0      0      0       1        1        0
newDown0        0      1      1       0        0        0
newDown1        0      0      1       0        0        0
newDown2        0      0      0       0        0        0
```

则可以更新出`state3 = T * state2，state4 = T * (T * state2)= T^2 * state2…………`

我们要计算`staten=T^(n-2) * state2`

但由于计算`n-2`次矩阵相乘复杂度太高，那么我们可以用快速幂的方式

比如`n=10`，`state10 = T^8 * state2`，如果普通乘法则需要：`state2 -> state3 -> state4 -> state5 -> state6 -> state7 -> state8 -> state9 -> state10`。我们优化一下为：

```
T^1
T^2 = T^1 * T^1
T^4 = T^2 * T^2
T^8 = T^4 * T^4
```

这样只需要四次

再比如`n=15`，`T^(15 - 2) = T^13`，而`13 = 8 + 4 + 1`（拆解成二进制1101），所以`T^13 = T^8 * T^4 * T^1`。

```c++
Matrix mul(const Matrix& a, const Matrix& b) { //矩阵乘法
    int n = a.size();
    int mid = b.size();
    int m = b[0].size();

    Matrix c(n, vector<long long>(m, 0));

    for (int i = 0; i < n; i++) {
        for (int k = 0; k < mid; k++) {
            if (a[i][k] == 0) continue;

            for (int j = 0; j < m; j++) {
                if (b[k][j] == 0) continue;

                c[i][j] = (c[i][j] + a[i][k] * b[k][j]) % MOD;
            }
        }
    }
    return c;
}

Matrix qpow(Matrix base, long long exp) { //快速幂
    int n = base.size();

    Matrix res(n, vector<long long>(n, 0));
    for (int i = 0; i < n; i++) {
        res[i][i] = 1;
    }

    while (exp > 0) {
        //就是看当前二进制这一位是不是 1,如果是 1，就说明当前这个 base 要乘进答案里：
        if (exp & 1) {
            res = mul(base, res);
        }

        base = mul(base, base);
        exp >>= 1;
    }

    return res;
}
```

快速幂解释，例如n=13的情况

```c++
exp = 13，base = T^1
最低位是 1，所以 res *= T^1
base 平方 -> T^2
exp 右移 -> 6

exp = 6，base = T^2
最低位是 0，所以 res 不动
base 平方 -> T^4
exp 右移 -> 3

exp = 3，base = T^4
最低位是 1，所以 res *= T^4
base 平方 -> T^8
exp 右移 -> 1

exp = 1，base = T^8
最低位是 1，所以 res *= T^8
base 平方 -> T^16
exp 右移 -> 0
```

### AC代码

```c++
#include <bits/stdc++.h>
using namespace std;

#define int long long
const int MOD = 1e9+7;
using Matrix = vector<vector<int>>;

Matrix mul(const Matrix& a, const Matrix& b) {
	int n = a.size();
	int mid = b.size();
	int m = b[0].size();

	Matrix c(n, vector<int>(m, 0));

	for (int i = 0; i < n; i++) {
		for (int k = 0; k < mid; k++) {
			if (a[i][k] == 0) continue;

			for (int j = 0; j < m; j++) {
				if (b[k][j] == 0) continue;

				c[i][j] = (c[i][j] + a[i][k] * b[k][j]) % MOD;
			}
		}
	}

	return c;
}

Matrix qpow(Matrix base, int exp) {
	int n = base.size();

	Matrix res(n, vector<int>(n, 0));

	for (int i = 0; i < n; i++) {
		res[i][i] = 1;
	}

	while (exp > 0) {
		if (exp & 1) {
			res = mul(res, base);
		}

		base = mul(base, base);
		exp >>= 1;
	}

	return res;
}
void solve() {
	int n, l, r;
	cin >> n >> l >> r;
	int m = r - l + 1;
	Matrix state(2 * m, vector<int>(1, 0)); //int state[2*m][1]={0}
	Matrix trans(2 * m, vector<int>(2 * m, 0)); //int trans[2*m][2*m]={0}
	// 长度为 2 的初始状态
	// state[0 ... m - 1] 是 up[0 ... m - 1]
	// state[m ... 2m - 1] 是 down[0 ... m - 1]
	for (int i = 0; i < m; i++) {
		state[i][0] = i;
		state[m + i][0] = m - i - 1;
	}
	//求转移矩阵
	for (int x = 0; x < m; x++) {
		// newup[x] = sum(down[y]), y < x
		for (int y = 0; y < x; y++) {
			trans[x][ m + y] = 1;	//trans[newup][olddown]
		}

		// newdown[x] = sum(up[y]), y > x
		for (int y = x + 1; y < m; y++) {
			trans[m + x][y] = 1;	//trans[newdown][oldup]
		}
	}
	Matrix p = qpow(trans, n - 2);
	Matrix finalState = mul(p, state);

	int ans = 0;
	for (int i = 0; i < 2 * m; i++) {
		ans = (ans + finalState[i][0]) % MOD;
	}
	cout << ans << '\n';

}
signed main() {
	ios_base::sync_with_stdio(0);
	cin.tie(0) ;
	cout.tie(0);
	solve();
}
```

# 区间处理

## 删除被覆盖区间

我们只要确定了左端点从小到大排序，那么就确保了**接下来的区间的左端点一定位于前面已经遍历过区间左端点的后面**。那么只要本轮的右端点小于前面区间右端点的最大值，就可以把本轮区间消除掉。

如果左端点相等，我们尽量让右端点值大的排在前面。因为⬆的假设就是由大区间逐渐包裹小区间的算法过程。

```c++
int removeCoveredIntervals(vector<vector<int>>& intervals) {
	sort(intervals.begin(), intervals.end(), [](const vector<int>& a, const vector<int>& b) {
		if (a[0] != b[0])
			return a[0] < b[0];
		else return a[1] > b[1];
	});
	int maxx = 0;
	int ans = intervals.size();
	for (auto& v : intervals) {
		if (v[1] <= maxx) ans--;
		maxx = max(v[1], maxx);
	}
	return ans;
}
```

