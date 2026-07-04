---
layout: codeforces
title: Codeforces Round 1103 (Div. 3)
date: 2026-06-20 11:25:17
tags:
categories: 算法题
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBkG1qO7dKG3J9zwMmUJ3_VRqSjDXGPwAC9AtrG5DK4EX9JjuwHnIWOQEAAwIAA3kAAzwE.png
---

[题目地址](https://codeforces.com/contest/2236)

# A- Games on the Train



因为最后要到达同样的高度，并且每个塔都必须要添加高度。其实就是最矮的塔添加到【最高塔+1】的高度，记为ans。其余中间高度的塔要添加多少高度不用管，因为这个高度肯定包含在ans里面

```c++
void solve() {
	int t, k;
	cin>>t;
	while (t--) {
		int maxx=0,minn=1e9+10;
		int n,tem;
		cin>>n;
		for(int i=0;i<n;i++){
			cin>>tem;
			maxx=max(maxx,tem);
			minn=min(minn,tem);
		}
		cout<<(maxx+1)-minn<<'\n';
	}
	
}
```

# B. Tatar TV Show



一次操作会同时翻转两个相距 `k` 的位置：`i` 和 `i+k`。这意味着位置之间按“相差 `k`”形成若干条链：

- `1, 1+k, 1+2k, ...`
- `2, 2+k, 2+2k, ...`
- ...
- `k, 2k, 3k, ...`

每次操作只会在同一条链里翻转相邻两个点。在同一条链里，`1` 的个数奇偶性不变。

- 如果两个都是 `0`，`1` 的数量 `+2`
- 如果两个都是 `1`，`1` 的数量 `-2`
- 如果一 `0` 一 `1`，`1` 的数量不变

无论哪种情况，`1` 的数量奇偶性都不变。

最终目标是全 `0`，每条链里的 `1` 数量都是 `0`，也就是偶数。

所以答案条件是：

> 对每个余数类，也就是所有位置 `i, i+k, i+2k...`，其中 `1` 的个数必须是偶数。

```c++
void solve() {
	int t;
	cin >> t;
	while (t--) {
		int n, k;
		cin >> n >> k;
		string s;
		cin >> s;
		int num[k]={0};
		for (int i = 0; i < s.size(); i++)
			if (s[i] == '1')
				num[(i + 1) % k] += 1;
		int flag = 0;
		for (int i = 0; i < k; i++) {
			if (num[i] % 2 != 0) {
				cout << "NO" << '\n';
				flag = 1;
				break;
			}
		}
		if (!flag) {
			cout << "YES" << '\n';
		}
	}
}
```

# C. Omsk Programmers

对于一个数 `v`，如果你决定对它做若干次除法，那么就是
`floor(v / x)`
`floor(v / x^2)`
`floor(v / x^3)`
`...`
`0`

因为 `v ≤ 1e9`，`x ≥ 2`，所以这个链长度最多三十多。`pow(2,30)`=1073741824，1e9=1000000000.所以链长不会超过三十一

所以进行while循环暴力进行每次次数的记录的O(n)是完全ok的

时间复杂度：

- 构造 `mpa`：`O(La * log La)`，因为 `map` 插入是 `log`
- 构造 `mpb`：`O(Lb * log Lb)`
- 双重枚举：`O(La * Lb)`
- 单组为：`O(La * log La + Lb * log Lb + La * Lb)`由于 `La,Lb ≤ 31`，可以近似看成常数。`t ≤ 1e4`，所以总复杂度：`O(t * 31 * 31)`≈`O(t)`

```c++
void solve() {
	int t;
	cin >> t;
	while (t--) {
		int a, b, x;
		cin >> a >> b >> x;
		map<int, int> mpa, mpb;
		int aans = 0, bans = 0;
		while (a != 0) {
			mpa[a] = aans;
			aans++;
			a /= x;
		}
		mpa[0] = aans;
		while (b != 0) {
			mpb[b] = bans;
			bans++;
			b /= x;
		}
		mpb[0] = bans;
		int ans = 1e9;
		for (auto v : mpa)
			for (auto v1 : mpb)
				ans = min(abs(v.first - v1.first) + v.second + v1.second, ans);
		cout << ans;
		cout << '\n';
	}
}
```

# D. Brand New Tatar TV Show[DP]

## 定义dp

在 Arseniy 第一步选择某个数 `x` 后，游戏状态为：上一次选择的是 x，x还剩下了y个，轮到 Egor选数，我们让：

`dp[i] = 当前上一次被选择的数是 x，现在轮到当前玩家行动时，当前玩家是否必胜`。

那么现在只需要找到一个`dp[i]=1`就可以了，我们就可以在第一步的时候就让Arseniy选择这个`x`。那么在第`i`轮中轮到 Egor选择的时候就会必赢。

## 分析选数流程

我们定义：

- 上一次选择的是`val[i]`，并按照选择的数的大小排序
- `val[i]`还剩下`cnt[val[i]]`个

则如果上一次选择了`val[i]`，那么这一次只能：

1. 选择一个更大的数`val[j]`，进入下一个状态的博弈（因为一旦有人选择了跳跃下一个阶段，那么是不可以跳回来的。），并且满足：`val[i] < val[j] <= val[i] + k`。并且如果存在这样一个`j`使得`dp[j]`在计算过后为`dp[j]==0`，那么`dp[i]=1`，当前玩家获胜。如若不然，当前玩家就不能通过跳跃获胜，只能看同一个数 `val[i]` 剩下多少个。

2. 继续选择`val[i]`。Arseniy 或上一手已经拿走了一个 `val[i]`，所以还剩：`cnt[val[i]] - 1`个。那么`cnt[val[i]] - 1`：

   - 如果是奇数，当前玩家可以拿到最后一个，获胜。
   - 如果是偶数，当前玩家拿不到最后一个，失败。

   所以：如果玩家不能通过方式1来跳跃取胜，那么转移方程为：`dp[i] = ((cnt[val[i]] - 1) % 2 == 1)`

故转移公式为：是否存在 `j > i`，满足 `val[j] <= val[i] + k` 且 `dp[j] == false`。如果存在：`dp[i]=1`，如果不存在，`dp[i] = ((cnt[val[i]] - 1) % 2 == 1)`

## dp初始状态

因为通过跳跃的方式来取胜的过程，是要有跳跃之后`dp[j]`的获胜状态的。所以我们只能先更新`dp[j]`的获胜状态，然后有`dp[j]`的状态之后再去更新`dp[i]`的状态。那么`dp[j]`的状态是根据`dp[l]`来更新的，其中：`j < l`且`val[j] < val[l] <= val[j] + k`………… 如果一直往后迭代就能找到初始状态：

- `dp[u]`:`u`为`val[n]`的最后一个数，不会再去找一个比它大的数来更新它的状态
- `dp[u]`的能否获胜只能取决于方式2

## 复杂度优化

```c++
void solve() {
	int t;
	cin >> t;
	while (t--) {
		int n, k;
		cin >> n >> k;
		int  cnt[n + 1] = {0}, dp[n + 1] = {0};
		int tem = 0;
		vector<int> val;
		for (int i = 0; i < n; i++) {
			int x;
			cin >> x;
			cnt[x]++;
		}
		for (int i = 0; i <= n; i++)
			if (cnt[i] != 0)
				val.push_back(i);
		sort(val.begin(), val.end());
		int s = val.size();
		//如果上一轮拿走一个是奇数，必赢
		if (cnt[val[s - 1]] % 2 == 0) dp[s - 1] = 1;
		for (int i = s - 2; i >= 0; i--) {
			//当前剩余：cnt[val[i]]-1个数
			if (cnt[val[i]] % 2 != 0) { //如果当前按方式2继续拿下去的话，当前阶段是必输的。所以只能进行跳跃
				
				for (int j = i + 1; j < s; j++) {
					//去寻找存不存在一个j使得dp[j]=0,代表当前玩家在这一轮只要取val[j]就能必赢
					if (val[j] - val[i] <= k) {
						if (dp[j] == 0) { //如果存在，当前玩家就跳到这个必赢的那个阶段
							dp[i] = 1;
							break;
						}
					}
				}
				
			} else
				dp[i] = 1;
		}
		int flag = 0;
		//		cout<<dp[1]<<endl;
		for (int i = 0; i < s; i++)
			if (dp[i])
				flag = 1;
		if (flag) cout << "YES";
		else cout << "NO";
		cout << '\n';
	}
}
```

![image-20260624174329502](image-20260624174329502.png)

TLE的原因是因为第二层循环的暴力枚举：

```c++
for (int j = i + 1; j < s; j++) {
    if (val[j] - val[i] <= k) {
        if (dp[j] == 0) {
            dp[i] = 1;
            break;
        }
    }
}
```

我们可以用vector和set的STL库快速定位和查找。其中定位和查找的复杂度都为O(logn)

```c++
void solve() {
	int t;
	cin >> t;
	while (t--) {
		int n, k;
		cin >> n >> k;
		int  cnt[n + 1] = {0}, dp[n + 1] = {0};
		int tem = 0;
		vector<int> val;
		set<int> lose;
		for (int i = 0; i < n; i++) {
			int x;
			cin >> x;
			cnt[x]++;
		}

		for (int i = 0; i <= n; i++)
			if (cnt[i] != 0)
				val.push_back(i);


		sort(val.begin(), val.end());

		int s = val.size();
		//如果上一轮拿走一个是奇数，必赢

		if (cnt[val[s - 1]] % 2 == 0) dp[s - 1] = 1;
		if (!dp[s - 1]) lose.insert(s - 1);
		for (int i = s - 2; i >= 0; i--) {
			int flag=1;
			//当前剩余：cnt[val[i]]-1个数
			if (cnt[val[i]] % 2 != 0) { 

				//合法的跳跃约区间 O(log(n))
				int pos = upper_bound(val.begin(), val.end(), val[i] + k) - val.begin()-1 ;
				//在lose里面找有没有大于i下标(大于i下标就代表是之前记录好的状态)的失败状态
				//lose.upper_bound(i)没找到返回lose.end()
				auto it = lose.upper_bound(i);
				if(it!=lose.end()&&(*it)<=pos){
					dp[i]=1;
					flag=0;
				}

			} else
				dp[i] = 1;
			if(flag) lose.insert(i);
		}
		int flag = 0;
		//		cout<<dp[1]<<endl;
		for (int i = 0; i < s; i++)
			if (dp[i])
				flag = 1;
		if (flag) cout << "YES";
		else cout << "NO";
		cout << '\n';
	}
}
```

# E. Friendly Gifts

## 题目分析

如果一个数组是good数组，那么数组要满足

1. 没有重复，2. 最大值 - 最小值 + 1 = 长度

题目要找两个长度一样的 good 子段，而且它们合起来也要 good。比如长度是 `4`。第一段如果是：`[1,2,3,4]`。第二段就必须刚好接上：`[5,6,7,8]`.这样合起来才是：`[1,2,3,4,5,6,7,8]`。所以核心为找一段数值范围是 `[x, x+len-1]`，再找一段数值范围是` [x+len, x+2len-1]`

## 定义转移数组

同一种子段可能出现很多次，我们只记录它们所有起点里最靠左的那个、最靠右的那个，定义：

> mnPos[len]\[x]：长度为 len、最小值为 x 的 good 子段中，最靠左的起点
>
> mxPos[len]\[x]：长度为 len、最小值为 x 的 good 子段中，最靠右的起点

比如数组里有很多个长度为 `3`、最小值为 `1` 的 good 子段。

```
位置 2 开始：[1,2,3]
位置 5 开始：[3,1,2]
位置 8 开始：[2,3,1]
```

它们属于同一类：len = 3, x = 1。这些子段的起点分别是 2, 5, 8。则最小起点 = 2
最大起点 = 8。

### 我们为什么要记录最大起点？

比如另一类子段是：len = 3, x = 4。假设它只出现在位置 1 开始：[4,5,6]。如果我们只知道第一类的最小起点 `2`，那它和起点 `1` 太近就感觉起来会重叠。但其实第一类还有一个起点 `8`，尽量拉远，就会不重叠。

### 那凭什么认为记录最小和最大就是正确答案？万一在中间呢？

因为我们只需要判断“有没有两个不重叠”，而不是要找某个特殊的中间位置。如果中间某两个能不重叠，那么最左和最右一定也能不重叠。所以，对于同一种 good 子段类型，<span style="color:#FF00FF">我们只需要知道它**最左能从哪里开始**，以及**最右能从哪里开始就可以了**。</span>

## AC代码

```c++
void solve() {
	int t;
	cin >> t;
	while (t--) {
		int n;
		cin >> n;
		vector<int> a(n + 1);
		for (int i = 1; i <= n; i++) {
			cin >> a[i];
		}
		// lPos[len][x]：长度为 len、最小值为 x 的 good 子段中，最靠左的起点
		// rPos[len][x]：长度为 len、最小值为 x 的 good 子段中，最靠右的起点
		vector<vector<int>> lpos(n + 1, vector<int>(n + 2, INF));
		vector<vector<int>> rpos(n + 1, vector<int>(n + 2, -INF));

		for (int l = 1; l <= n; l++) {
			vector<int> cnt(n + 1, 0);
			int mn = INF;
			int mx = -INF;
			for (int r = l; r <= n; r++) {
				int tem = a[r];
				cnt[tem]++;
				if (cnt[tem] > 1) { //如果出现相同的数了，那一定不是good序列
					break;
				}
				mn = min(mn, tem);
				mx = max(mx, tem);
				if (mx - mn + 1 == r - l + 1) { //说明此序列是一个good序列
					lpos[mx - mn + 1][mn] = min(l, lpos[mx - mn + 1][mn]);
					rpos[mx - mn + 1][mn] = max(l, rpos[mx - mn + 1][mn]);
				}
			}
		}
		int ans = 0;
		for (int len = 0; len <= n / 2; len++) {
			for (int x = 1; x <= n; x++) {
				int flag = (lpos[len][x] != INF);
				if (!flag) {
					continue;
				}
				// 判断是否能选到两个不重叠的子段
				// 一边取最靠左，另一边取最靠右。
				// 如果起点差 >= len，则两个长度为 len 的子段不重叠。
				int flag3 = 0;
				if (abs(lpos[len][x] - rpos[len][x + len]) >= len && rpos[len][x + len] != -INF)
					flag3 = 1;

				if (flag3) ans = max(ans, len);
			}
		}
		cout << ans;
		cout << '\n';
	}

}
```

