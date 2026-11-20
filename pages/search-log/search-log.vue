<template>
    <view class="page">
        <view class="header">
            <text class="h-title">查词记录</text>
            <text class="h-count" v-if="logs.length">{{ mergedLogs.length }} 个词 · {{ logs.length }} 次查询</text>
        </view>

        <!-- 搜索框 -->
        <view class="search-bar">
            <text class="search-icon">🔍</text>
            <input
                class="search-input"
                v-model="keyword"
                placeholder="搜索查过的单词"
                confirm-type="search"
            />
            <text class="clear" v-if="keyword" @click="keyword = ''">✕</text>
        </view>

        <!-- 按单词汇总 -->
        <view class="card" v-if="summary.length && !keyword">
            <view class="card-title">高频查询词</view>
            <view class="chip-wrap">
                <view class="chip" v-for="(s, i) in summary" :key="i" @click="keyword = s.word">
                    {{ s.word }} <text class="chip-num">×{{ s.count }}</text>
                </view>
            </view>
        </view>

        <!-- 合并后的词条列表（同一词只显示一条） -->
        <view class="log-list" v-if="filteredLogs.length">
            <view class="log-group" v-for="(g, i) in filteredLogs" :key="g.key">
                <view class="log-item" @click="goSearch(g.word)">
                    <view class="log-dot"></view>
                    <view class="log-body">
                        <view class="log-row">
                            <text class="log-word">{{ g.word }}</text>
                            <view class="log-meta">
                                <text class="log-count" v-if="g.count > 1">×{{ g.count }}</text>
                                <text class="log-source" :class="srcClass(g.source)">{{ srcText(g.source) }}</text>
                            </view>
                        </view>
                        <view class="log-time-row" @click.stop="toggleTimes(g.key)">
                            <text class="log-time">{{ g.count > 1 ? '最近 ' : '' }}{{ formatFull(g.ts) }}</text>
                            <text class="times-toggle" v-if="g.count > 1">{{ expanded === g.key ? '收起' : '全部 ' + g.count + ' 次' }}</text>
                        </view>
                    </view>
                    <text class="go-arrow">查看 ›</text>
                </view>
                <!-- 展开：该词的所有查询时间 -->
                <view class="times-detail" v-if="expanded === g.key && g.count > 1">
                    <view class="time-line" v-for="(t, ti) in g.times" :key="ti">
                        <text class="time-idx">{{ ti + 1 }}.</text>
                        <text class="time-val">{{ formatFull(t) }}</text>
                    </view>
                </view>
            </view>
        </view>

        <view class="empty" v-else>
            <text>{{ keyword ? '没有匹配的查词记录' : '暂无查词记录' }}</text>
        </view>

        <view class="clear-btn" v-if="logs.length" @click="confirmClear">清空全部记录</view>
    </view>
</template>

<script>
import store from '@/common/store.js'

export default {
    data() {
        return {
            logs: [],
            keyword: '',
            expanded: ''
        }
    },
    computed: {
        /** 按词合并（大小写不敏感）：同一词一条，保留查询次数与全部时间 */
        mergedLogs() {
            const map = {}
            this.logs.forEach(l => {
                const w = (l.word || '').trim()
                const key = w.toLowerCase()
                if (!key) return
                if (!map[key]) {
                    map[key] = { key, word: w, source: l.source, ts: l.ts, count: 0, times: [] }
                }
                const g = map[key]
                g.count++
                g.times.push(l.ts)
                // 用最新一条代表的词形与来源
                if (l.ts >= g.ts) {
                    g.ts = l.ts
                    g.word = w
                    g.source = l.source
                }
            })
            // 时间明细倒序（最近的在前）
            Object.keys(map).forEach(k => { map[k].times.sort((a, b) => b - a) })
            // 词条按最近查询时间倒序
            return Object.keys(map).map(k => map[k]).sort((a, b) => b.ts - a.ts)
        },
        /** 高频查询词（基于合并结果按次数排序） */
        summary() {
            return this.mergedLogs.slice()
                .sort((a, b) => b.count - a.count)
                .slice(0, 20)
                .map(g => ({ word: g.word, count: g.count }))
        },
        /** 搜索筛选（对合并后的词条按单词名模糊匹配） */
        filteredLogs() {
            const k = this.keyword.trim().toLowerCase()
            if (!k) return this.mergedLogs
            return this.mergedLogs.filter(g => g.word.toLowerCase().indexOf(k) > -1)
        }
    },
    onShow() {
        this.logs = store.getLookupLog()
        this.expanded = ''
    },
    methods: {
        srcText(source) {
            if (source === 'cet6') return '六级'
            if (source === 'kaoyan') return '考研'
            if (source === 'both') return '六级+考研'
            if (source === 'web') return '网页'
            if (source === 'local') return '内置'
            if (source === 'online') return '联网'
            return source || ''
        },
        srcClass(source) {
            if (source === 'cet6' || source === 'local') return 'cet6'
            if (source === 'kaoyan') return 'kaoyan'
            if (source === 'both') return 'both'
            if (source === 'web' || source === 'online') return 'web'
            return ''
        },
        /** 展开/收起该词的全部查询时间 */
        toggleTimes(key) {
            this.expanded = this.expanded === key ? '' : key
        },
        /** 跳转到查词页查看该词解释（tabBar 页不能带参，用本地存储传递） */
        goSearch(word) {
            try { uni.setStorageSync('pendingSearchWord', word) } catch (e) {}
            uni.switchTab({ url: '/pages/search/search' })
        },
        formatFull(ts) {
            const d = new Date(ts)
            const p = n => String(n).padStart(2, '0')
            return d.getFullYear() + '年' + p(d.getMonth() + 1) + '月' + p(d.getDate()) + '日 ' +
                p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
        },
        confirmClear() {
            uni.showModal({
                title: '清空记录',
                content: '确定清空全部查词记录吗？此操作不可恢复。',
                success: (res) => {
                    if (res.confirm) {
                        store.clearLookupLog()
                        this.logs = []
                        this.keyword = ''
                        this.expanded = ''
                        uni.showToast({ title: '已清空', icon: 'success' })
                    }
                }
            })
        }
    }
}
</script>

<style scoped>
.page { padding: 24rpx; }
.header { display: flex; justify-content: space-between; align-items: baseline; padding: 8rpx 8rpx 24rpx; }
.h-title { font-size: 36rpx; font-weight: 700; }
.h-count { font-size: 24rpx; color: #8A8F99; }
.search-bar {
    display: flex; align-items: center; background: #fff; border-radius: 16rpx;
    padding: 18rpx 24rpx; margin-bottom: 24rpx;
    border: 2rpx solid #E8ECF3;
}
.search-icon { font-size: 30rpx; margin-right: 14rpx; }
.search-input { flex: 1; font-size: 28rpx; height: 44rpx; }
.clear { color: #B0B5BE; font-size: 28rpx; padding: 0 10rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 28rpx; margin-bottom: 24rpx; }
.card-title { font-size: 28rpx; font-weight: 600; margin-bottom: 20rpx; }
.chip-wrap { display: flex; flex-wrap: wrap; gap: 14rpx; }
.chip { background: #EEF4FF; color: #3A7AFE; padding: 12rpx 24rpx; border-radius: 30rpx; font-size: 26rpx; }
.chip-num { font-size: 22rpx; opacity: .7; }
.log-list { background: #fff; border-radius: 20rpx; padding: 0 28rpx; }
.log-group { border-bottom: 1rpx solid #F2F3F6; }
.log-group:last-child { border-bottom: none; }
.log-item { display: flex; align-items: center; padding: 24rpx 0; }
.log-dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: #3A7AFE; margin-right: 20rpx; flex-shrink: 0; }
.log-body { flex: 1; min-width: 0; }
.log-row { display: flex; justify-content: space-between; align-items: center; }
.log-word { font-size: 30rpx; font-weight: 600; }
.log-meta { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.log-count { font-size: 22rpx; color: #F59E0B; background: #FFF6E5; padding: 6rpx 14rpx; border-radius: 20rpx; }
.log-source { font-size: 20rpx; padding: 6rpx 14rpx; border-radius: 20rpx; background: #F0F2F5; color: #8A8F99; white-space: nowrap; }
.log-source.cet6 { background: #EEF4FF; color: #3A7AFE; }
.log-source.kaoyan { background: #F3EEFF; color: #8B5CF6; }
.log-source.both { background: #FEF3E2; color: #F59E0B; }
.log-source.web { background: #E7F8EE; color: #22C55E; }
.log-time-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10rpx; }
.log-time { font-size: 24rpx; color: #8A8F99; }
.times-toggle { font-size: 22rpx; color: #3A7AFE; margin-left: 16rpx; flex-shrink: 0; }
.times-detail { background: #F8FAFD; border-radius: 12rpx; padding: 16rpx 20rpx; margin: 0 0 20rpx 36rpx; }
.time-line { display: flex; align-items: center; padding: 6rpx 0; }
.time-idx { font-size: 22rpx; color: #B0B5BE; width: 40rpx; flex-shrink: 0; }
.time-val { font-size: 22rpx; color: #6B7280; }
.go-arrow { font-size: 24rpx; color: #3A7AFE; margin-left: 16rpx; flex-shrink: 0; }
.empty { display: flex; align-items: center; justify-content: center; padding: 120rpx 0; color: #A0A5AE; font-size: 28rpx; }
.clear-btn { text-align: center; color: #EF4444; font-size: 26rpx; padding: 40rpx; }
</style>
