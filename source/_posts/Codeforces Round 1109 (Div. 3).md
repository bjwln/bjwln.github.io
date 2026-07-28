---
layout: codeforces
title: Codeforces Round 1109 (Div. 3)
date: 2026-07-22 18:43:22
tags:
categories: 算法题
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBkG1qO7dKG3J9zwMmUJ3_VRqSjDXGPwAC9AtrG5DK4EX9JjuwHnIWOQEAAwIAA3kAAzwE.png
---

# A. Iskander and Drawings

贪心，找最长连续子序列

```c++
#include <bits/stdc++.h>
using namespace std;
void solve() {
	int t;
	cin >> t;
	while (t--) {
		int n;
		string s;
		cin >> n;
		cin >> s;
		int xian = 0;
		int maxx = 0;
		for (int i = 0; i < n; i++) {
			if (s[i] == '*') {
				maxx = max(maxx, (xian + 1) / 2);
				xian = 0;
			} else
				xian++;
		}
		maxx = max(maxx, (xian + 1) / 2);
		cout << maxx;
		cout << "\n";
	}
}
signed main() {
	ios::sync_with_stdio(false);
	cin.tie(nullptr);

	solve();
}
```



# B. Nikita and Books

贪心

因为最终只要求是连续递增的，所以我们让序列：`1,2,3,4,5……`这样递增就好了。存一个storage代表总容量，然后一点一点往外拿。

```c++
#include <bits/stdc++.h>
using namespace std;
#define int long long
void solve() {
	int t;
	cin >> t;
	while (t--) {
		int n;
		cin >> n;
		int shu[n];
		for (int i = 0; i < n; i++) {
			cin >> shu[i];
		}
		int ku = 0;
		int flag = 0;
		ku += (shu[0] - 1);
		for (int i = 1; i < n; i++) {
			if(shu[i]>=i+1){
				ku+=(shu[i]-(i+1));
			}else{
				int take=((i+1)-shu[i]);
				ku-=take;
				if(ku<0){
					flag=1;
					break;
				}
			}
		}
		cout<<(flag==1?"NO":"YES");
		cout << "\n";
	}
}
signed main() {
	ios::sync_with_stdio(false);
	cin.tie(nullptr);

	solve();
}
```



# C. Stepan and Permutation

并查集

题目给了一个`a`和一个`b`，这两个字母代表每个数字可以移动的步长step，我们由测试样例1可以看出来，当`ab`为23的时候，他们步长是相差1的，也就是可以通过`ab`互相配合来达到遍历所有区间的目的。

然后可以感觉出来其实这个区间被分成了关于a的一个集合和关于b的一个集合。如果数组本身是乱序的，那么我们可以通过这两个集合的相互配合来修改顺序吗？

那么当遍历到某个下标`i`的时候，如果这个下标`i`表示的数和这个排序后这个下标`i`应该表示的数如果在一个集合内，我们就可以通过`ab`互相配合来修改顺序。

这些**集合**我们用并查集来维护。

```c++
#include <bits/stdc++.h>
using namespace std;
#define int long long
#define N 200005
int p[N];//p[x]为x的父节点
int find(int x) { //查找结点x的祖宗结点
	if (p[x] != x) p[x] = find(p[x]);
	return p[x];
}

void solve() {
	int t;
	cin >> t;
	while (t--) {

		int n, a, b;
		cin >> n >> a >> b;
		for (int i = 1; i <= n; i ++ ) { //并查集的初始化
			p[i] = i;
		}
		int shu[n], shuc[n];
		for (int i = 0; i < n; i++) {
			cin >> shu[i];
			shuc[i] = shu[i];
		}
		for (int i = 0; i < n; i++) {
			if (i + a < n) 	p[find(shu[i])] = find(shu[i + a]);
			if (i + b < n)  p[find(shu[i])] = find(shu[i + b]);
		}
		sort(shuc, shuc + n);
		int ok = 1;
		for (int i = 0; i < n; i++) {
			if (shu[i] != shuc[i]) {
				if (find(shu[i]) != find(shuc[i])) {
					ok = 0;
					cout << "NO";
					break;
				}
			}
		}
		if (ok) cout << "YES";
		cout << "\n";
	}
}
signed main() {
	ios::sync_with_stdio(false);
	cin.tie(nullptr);

	solve();
}
```

# D. Yaroslav and Productivity

 **第一步：从最简单的情况开始想 **

 先不考虑帖子，总生产力就是 sum(a)。

 **第二步：加一个帖子，看看发生了什么**

 有一个帖子 `b_1` = 3。它翻转 `[1, 3]`，那总生产力变成：
 ` (-a1 - a2 - a3) + a4 + a5 + ... + an = (-sum[1,3]) + sum[4,n]`

**第三步：加第二个帖子，观察变化**

再加 b~2~ = 5。现在两个帖子，选或不选，有 4 种组合。这时候开始注意到：

选帖子3: 位置1~3翻。选帖子5: 位置1~5翻

位置1~3的翻转次数 = x~3~ + x~5~，位置4~5的翻转次数 = x~5~，位置6~n的翻转次数 = 0。

决定翻转次数的是"有多少帖子覆盖了这个位置"，而覆盖规则是：帖子 b~j~ 覆盖所有 ≤ b~j~ 的位置。

**第四步：画一根数轴，标出所有 b~j~**

位置:      1   2   3         4   5          6   7   8            9

帖子:        b~1~=3            b~2~=5            b~3~=8

这时你自然会发现：

  - 位置 1~3：被帖子 1,2,3 覆盖
  - 位置 4~5：被帖子 2,3 覆盖
  - 位置 6~8：被帖子 3 覆盖
  - 位置 9~n：不被任何帖子覆盖

"覆盖集合"只在 b~j~ 位置发生变化。在 [1,3] 内部，每个位置被覆盖的帖子集合一样。

**第五步：压缩，分段**

既然在一个区间内所有位置改变相同，我们把它打包。

将帖子排序为 b~1~ < b~2~ < ... <b~3~，数组被分成 m+1 段：

段1: [1, b~1~]

段2: (p~1~, b~2~]

段m: (b~m-1~, b~m~]

段m+1: (b~m~, n]

记 `seg[i] `为第 i 段的和，接下来只需要操作这些段就可以了。（原数组值转变为这些段就是因为激励帖子本身就把问题转换成了对段的求解）

**第六步：设状态方程**

`dp[i][0]`= 从段 i 到末尾的最大贡献

`dp[i][1]` = 从段 i 到末尾的最大贡献

**第七步：初始状态及遍历方向**

遍历方向从后往前遍历，因为我们的初始状态是`dp[0][0]=seg.back();`（因为最后一段的翻转状态只取决于b~m~，比较好判断）

```c++
#include <bits/stdc++.h>
using namespace std;
#define int long long
#define N 200005

void solve() {
	int t;
	cin >> t;
	while (t--) {
		int n, m;
		cin >> n >> m;

		vector<int> a(n);
		for (int i = 0; i < n; i++) cin >> a[i];

		vector<int> b(m);
		for (int i = 0; i < m; i++) cin >> b[i];
		sort(b.begin(), b.end());

		vector<long long> pref(n + 1, 0);
		for (int i = 0; i < n; i++) pref[i + 1] = pref[i] + a[i];

		// 计算每个段的和，共 m+1 段
		vector<int> seg;
		int prev = 0;
		for (int i = 0; i < m; i++) {
			seg.push_back(pref[b[i]] - pref[prev]);  
			prev = b[i];
		}
		seg.push_back(pref[n] - pref[prev]);  

		// 从右向左 DP
		int dp[1][2];
		dp[0][0]=seg.back(); //不翻转的话就是最后一段的长度
		dp[0][1]=LLONG_MIN / 2;        
		for (int i = (int)seg.size() - 2; i >= 0; i--) {
			int ndp0 =  seg[i] + max(dp[0][0], dp[0][1]);
			int ndp1 = -seg[i] + max(dp[0][0], dp[0][1]);
			dp[0][0] = ndp0;
			dp[0][1] = ndp1;
		}

		cout << max(dp[0][0], dp[0][1]) << '\n';
	}
}
signed main() {
	ios::sync_with_stdio(false);
	cin.tie(nullptr);

	solve();
}
```



# E. Masha and the Garland

假设我们翻转子段 [a, b]（把里面的 0 变 1，1 变 0）：

     位置:  ...  a-1  [a  a+1  ...  b-1  b]  b+1  ...
     原值:  ...   x    y   y'   ...  z'   z    w    ...
     翻转后: ...   x   !y  !y'   ... !z'  !z   w    ...
                    ↑                            ↑
                边界对(a-1,a)翻转了          边界对(b,b+1)翻转了

  - 内部对 (a,a+1)...(b-1,b)：两个都翻转，相等关系不变
  - 边界对 (a-1,a) 和 (b,b+1)：一个翻转一个不翻转，相等关系翻转
    - 原来相等 → 变不相等（修复了问题）
    - 原来不相等 → 变相等（产生了新问题，但我们可以选择不这么干）

  即：**一次操作至多修复 2 个相邻相同对。**

设区间内有 bad 个相邻相同对。

  - 每次操作修 0 个、1 个或 2 个
  - 最优策略：每次选两个相邻相同对，翻转它们之间的子段，一次修两个
  - 最少操作次数 = `ceil(bad / 2)`

用前缀和数组 `P[i]` 统计从开头到位置 i 有多少个相邻相同对：  `P[i] = s[0..i] `中相邻相同对的数量

**对于区间` [l, r]`：**

  区间内 bad 数 =`P[r-1] - P[l-1]`= (前r个字符的bad数) - (前l-1个字符的bad数)。  然后判断 `bad ≤ 2k。`

例1: s = "0011", 查询 [1, 4] 即整个串 0011
  - 相邻相同对：(0,0) 相等，(0,1) 不等，(1,1) 相等 → bad = 2
  - 最少操作：`ceil(2/2)` = 1 次
  - 实际：翻转 [2,3] 即 01 → 0011 变成 0101，美丽了
  - 判定：2 ≤ 2k，k ≥ 1 即可

  例2: s = "0000", 查询 [1, 4]

  - 翻转位置 2（即 [1,1]）：0000 → 0100
  - 翻转位置 4（即 [3,3]）：0100 → 0101

```c++
#include <bits/stdc++.h>
using namespace std;
#define int long long
#define N 200005

void solve() {
	int t;
	cin >> t;
	while (t--) {
		int m, n;
		cin >> m >> n;
		string s;
		cin >> s;
		vector<int>P(m,0);
		for (int i = 1; i < m; ++i)
			P[i] = P[i - 1] + (s[i] == s[i - 1]);
		while (n--) {
			int l, r, k;
			cin >> l >> r >> k;
			cout << (P[r - 1] - P[l - 1] <= (k *2 ) ? "YES\n" : "NO\n");
		}
	}
}
signed main() {
	ios::sync_with_stdio(false);
	cin.tie(nullptr);
	
	solve();
}
```

