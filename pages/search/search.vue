<template>
    <view class="page">
        <!-- 搜索框 -->
        <view class="search-bar">
            <text class="search-icon">🔍</text>
            <input
                class="search-input"
                v-model="keyword"
                placeholder="输入单词查询"
                confirm-type="search"
                @confirm="doSearch"
                @input="onInput"
            />
            <text class="clear" v-if="keyword" @click="clear">✕</text>
        </view>

        <!-- 查词记录入口 -->
        <view class="log-entry" @click="goLog">
            <text>查词记录</text>
            <text class="log-count">{{ logCount }} 条 ›</text>
        </view>

        <!-- 搜索建议 -->
        <view class="suggest" v-if="!searched && suggestions.length">
            <view class="suggest-item" v-for="(s, i) in suggestions" :key="i" @click="selectWord(s.w)">
                <view class="s-line">
                    <text class="s-word">{{ s.w }}</text>
                    <text class="s-src" :class="s.source">{{ srcShort(s.source) }}</text>
                </view>
                <text class="s-mean">{{ s.m }}</text>
            </view>
        </view>

        <!-- 查询结果 -->
        <view class="result" v-if="searched">
            <view class="result-card" v-if="result">
                <view class="result-head">
                    <text class="r-word">{{ result.w }}</text>
                    <view class="speak" @click="speak"><text>🔊</text></view>
                </view>
                <text class="r-phonetic" v-if="result.p">{{ result.p }}</text>

                <!-- 词汇来源标签 -->
                <view class="r-tags">
                    <text class="source-tag" :class="result.source">{{ result.sourceLabel }}</text>
                </view>

                <view class="r-section">
                    <text class="r-section-title">释义</text>
                    <text class="r-meaning">{{ result.m || '暂无释义' }}</text>
                    <text class="r-meaning-en" v-if="result.mEn && result.mEn !== result.m">{{ result.mEn }}</text>
                    <text class="r-example" v-if="result.e">{{ result.e }}</text>
                </view>

                <view class="r-meta">
                    <text class="r-hint">{{ result.tip }}</text>
                    <text class="r-time">{{ result.timeText }}</text>
                </view>

                <!-- 手动收藏（联网词也能收藏） -->
                <view class="fav-action" :class="{ active: isFav }" @click="toggleFav">
                    <text class="fav-star">{{ isFav ? '★' : '☆' }}</text>
                    <text class="fav-label">{{ isFav ? '已收藏，点击取消' : '加入收藏' }}</text>
                </view>

                <view class="priority-box" v-if="result.addedPriority">
                    <text>✓ 已加入当前词本优先背诵队列</text>
                </view>
                <view class="cross-box" v-if="result.crossBookTip">
                    <text>{{ result.crossBookTip }}</text>
                </view>
            </view>

            <view class="empty" v-else>
                <text class="empty-icon">?</text>
                <text class="empty-text">未收录该词，且联网查询未成功</text>
                <text class="empty-sub">请检查网络后重试</text>
            </view>
        </view>

        <!-- 使用说明 -->
        <view class="tip" v-if="!searched && !suggestions.length">
            同时检索六级与考研词库，每条结果标注词汇来源，联网兜底可查任意单词。每次查询精确记录时间；属于当前词本的词会自动优先安排背诵。
        </view>
    </view>
</template>

<script>
import store from '@/common/store.js'
import api from '@/common/api.js'
import speech from '@/common/speech.js'

export default {
    data() {
        return {
            keyword: '',
            searched: false,
            suggestions: [],
            result: null,
            logCount: 0,
            loading: false,
            favTick: 0
        }
    },
    computed: {
        isFav() {
            if (!this.result) return false
            return this.favTick >= 0 && store.isFavorite(this.result.w)
        }
    },
    onShow() {
        this.logCount = store.getLookupLog().length
        // 从查词记录页跳转过来时，自动填入并查询该词
        let pending = ''
        try { pending = uni.getStorageSync('pendingSearchWord') || '' } catch (e) {}
        if (pending) {
            try { uni.removeStorageSync('pendingSearchWord') } catch (e) {}
            this.keyword = pending
            this.doSearch()
        }
    },
    methods: {
        srcShort(source) {
            if (source === 'cet6') return '六级'
            if (source === 'kaoyan') return '考研'
            if (source === 'both') return '六级+考研'
            return ''
        },
        sourceLabel(source) {
            if (source === 'cet6') return '六级词汇'
            if (source === 'kaoyan') return '考研词汇'
            if (source === 'both') return '六级 · 考研词汇'
            if (source === 'web') return '网页搜索词汇'
            if (source === 'local') return '内置词库'
            if (source === 'online') return '联网查询'
            return source || ''
        },
        toggleFav() {
            if (!this.result) return
            const r = this.result
            const added = store.toggleFavorite({
                w: r.w, m: r.m, p: r.p, e: r.e,
                source: r.source || 'web'
            })
            this.favTick++
            uni.showToast({ title: added ? '已加入收藏' : '已取消收藏', icon: 'success' })
        },
        onInput() {
            const k = this.keyword.trim()
            if (!k) { this.suggestions = []; this.searched = false; return }
            this.suggestions = store.searchWordsAll(k, 8)
            this.searched = false
        },
        clear() {
            this.keyword = ''
            this.suggestions = []
            this.searched = false
            this.result = null
        },
        selectWord(w) {
            this.keyword = w
            this.suggestions = []
            this.doSearch()
        },
        async doSearch() {
            const k = this.keyword.trim()
            if (!k) return
            if (this.loading) return
            this.loading = true
            this.suggestions = []
            this.searched = true
            this.result = null
            uni.showLoading({ title: '查询中...' })

            // ① 跨全部词本检索（离线，含六级 + 考研）
            const local = store.lookupAllBooks(k)
            if (local.found) {
                const addPri = !!local.inCurrentBook
                const entry = store.recordLookup(local.w, local.source, { addPriority: addPri })
                let crossBookTip = ''
                if (!local.inCurrentBook) {
                    const otherNames = local.bookNames.filter((n, i) => local.bookIds[i] !== store.currentBookId)
                    crossBookTip = '该词属于「' + otherNames.join('、') + '」，切换到对应词本后可加入优先背诵'
                }
                this.result = {
                    w: local.w,
                    m: local.m,
                    p: local.p,
                    e: local.e,
                    source: local.source,
                    sourceLabel: this.sourceLabel(local.source),
                    addedPriority: addPri && store.getSettings().autoPriority,
                    crossBookTip: crossBookTip,
                    tip: addPri ? '本地词库命中' : '跨词本命中',
                    timeText: this.fmtTime(entry.ts)
                }
                this.logCount = store.getLookupLog().length
                uni.hideLoading()
                this.loading = false
                return
            }

            // ② 联网兜底（网页搜索词汇，不进入本地背诵队列）
            const online = await api.lookup(k)
            if (online) {
                const word = online.word || k.toLowerCase()
                const entry = store.recordLookup(word, 'web', { addPriority: false })
                this.result = {
                    w: word,
                    m: online.meaning,
                    mEn: online.meaningEn || '',
                    p: online.phonetic || '',
                    e: online.example || '',
                    source: 'web',
                    sourceLabel: this.sourceLabel('web'),
                    addedPriority: false,
                    crossBookTip: '',
                    tip: '网页搜索 · 不进入本地背诵队列',
                    timeText: this.fmtTime(entry.ts)
                }
            }
            this.logCount = store.getLookupLog().length
            uni.hideLoading()
            this.loading = false
        },
        fmtTime(ts) {
            const d = new Date(ts)
            const p = n => String(n).padStart(2, '0')
            return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
                ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
        },
        speak() {
            if (this.result) speech.speak(this.result.w)
        },
        goLog() {
            uni.navigateTo({ url: '/pages/search-log/search-log' })
        }
    }
}
</script>

<style scoped>
.page { padding: 24rpx; }
.search-bar {
    display: flex; align-items: center; background: #fff; border-radius: 20rpx;
    padding: 20rpx 28rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,.03);
}
.search-icon { font-size: 32rpx; margin-right: 16rpx; }
.search-input { flex: 1; font-size: 30rpx; height: 48rpx; }
.clear { color: #B0B5BE; font-size: 30rpx; padding: 0 10rpx; }
.log-entry {
    display: flex; justify-content: space-between; align-items: center;
    background: #fff; border-radius: 16rpx; padding: 24rpx 28rpx;
    margin-top: 20rpx; font-size: 28rpx;
}
.log-count { font-size: 24rpx; color: #3A7AFE; }
.suggest { background: #fff; border-radius: 16rpx; margin-top: 16rpx; overflow: hidden; }
.suggest-item { padding: 22rpx 28rpx; border-bottom: 1rpx solid #F0F2F5; display: flex; flex-direction: column; }
.s-line { display: flex; align-items: center; gap: 16rpx; }
.s-word { font-size: 30rpx; font-weight: 600; }
.s-mean { font-size: 24rpx; color: #8A8F99; margin-top: 6rpx; }
.s-src { font-size: 18rpx; padding: 4rpx 12rpx; border-radius: 16rpx; background: #F0F2F5; color: #8A8F99; }
.result { margin-top: 24rpx; }
.result-card { background: #fff; border-radius: 20rpx; padding: 36rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,.03); }
.result-head { display: flex; align-items: center; justify-content: space-between; }
.r-word { font-size: 56rpx; font-weight: 700; word-break: break-all; }
.speak { background: #EEF4FF; color: #3A7AFE; padding: 14rpx 28rpx; border-radius: 40rpx; font-size: 28rpx; }
.r-phonetic { font-size: 28rpx; color: #8A8F99; display: block; margin-top: 10rpx; }
.r-tags { margin-top: 22rpx; }
.source-tag { font-size: 24rpx; font-weight: 600; padding: 10rpx 24rpx; border-radius: 30rpx; }
.r-section { margin-top: 24rpx; }
.r-section-title { font-size: 24rpx; color: #3A7AFE; font-weight: 600; }
.r-meaning { font-size: 32rpx; line-height: 1.7; display: block; margin-top: 12rpx; }
.r-meaning-en { font-size: 26rpx; color: #8A8F99; line-height: 1.6; display: block; margin-top: 10rpx; font-style: italic; }
.r-example { font-size: 26rpx; color: #6B7280; line-height: 1.75; display: block; margin-top: 16rpx; white-space: pre-line; }
.r-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 32rpx; }
.r-hint { font-size: 22rpx; color: #A0A5AE; }
.r-time { font-size: 22rpx; color: #A0A5AE; }
.priority-box { margin-top: 24rpx; background: #FEF3E2; color: #B45309; border-radius: 12rpx; padding: 20rpx; font-size: 24rpx; }
.cross-box { margin-top: 20rpx; background: #F3EEFF; color: #7C3AED; border-radius: 12rpx; padding: 20rpx; font-size: 24rpx; line-height: 1.6; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 100rpx 0; }
.empty-icon { width: 100rpx; height: 100rpx; border-radius: 50%; background: #F0F2F5; color: #B0B5BE; font-size: 60rpx; display: flex; align-items: center; justify-content: center; }
.empty-text { font-size: 28rpx; margin-top: 30rpx; color: #6B7280; }
.empty-sub { font-size: 24rpx; color: #A0A5AE; margin-top: 12rpx; }
.tip { font-size: 24rpx; color: #A0A5AE; line-height: 1.8; margin-top: 40rpx; padding: 0 12rpx; }

/* 来源标签配色 */
.source-tag.cet6, .s-src.cet6 { background: #EEF4FF; color: #3A7AFE; }
.source-tag.kaoyan, .s-src.kaoyan { background: #F3EEFF; color: #8B5CF6; }
.source-tag.both, .s-src.both { background: #FEF3E2; color: #F59E0B; }
.source-tag.web, .s-src.web { background: #E7F8EE; color: #22C55E; }
.source-tag.local, .s-src.local { background: #EEF4FF; color: #3A7AFE; }
.source-tag.online, .s-src.online { background: #E7F8EE; color: #22C55E; }
.fav-action {
    display: flex; align-items: center; justify-content: center; gap: 12rpx;
    margin-top: 28rpx; padding: 24rpx; border-radius: 16rpx;
    background: #FFF8E6; border: 2rpx solid #FDE9C8;
}
.fav-action.active { background: #FEF3E2; border-color: #F59E0B; }
.fav-star { font-size: 40rpx; color: #D6B36B; line-height: 1; }
.fav-action.active .fav-star { color: #F59E0B; }
.fav-label { font-size: 28rpx; font-weight: 600; color: #B45309; }
</style>
