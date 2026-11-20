<template>
    <view class="page">
        <!-- 统计概览 -->
        <view class="hero">
            <view class="hero-title">学习档案</view>
            <view class="hero-sub">已学 {{ stats.total }} 词 · 按记忆程度分类查看</view>
            <view class="hero-bars">
                <view class="hbar-item">
                    <text class="hbar-num">{{ stats.newCount }}</text>
                    <text class="hbar-label">新学</text>
                </view>
                <view class="hbar-item">
                    <text class="hbar-num">{{ stats.consolidating }}</text>
                    <text class="hbar-label">巩固中</text>
                </view>
                <view class="hbar-item">
                    <text class="hbar-num">{{ stats.familiar }}</text>
                    <text class="hbar-label">熟悉</text>
                </view>
                <view class="hbar-item">
                    <text class="hbar-num">{{ stats.mastered }}</text>
                    <text class="hbar-label">已掌握</text>
                </view>
            </view>
        </view>

        <!-- 搜索框 -->
        <view class="search-bar">
            <text class="search-icon">🔍</text>
            <input class="search-input" v-model="keyword" placeholder="搜索已学单词" confirm-type="search" />
            <text class="clear" v-if="keyword" @click="keyword = ''">✕</text>
        </view>

        <!-- 程度筛选 -->
        <view class="filter-wrap">
            <view
                class="filter-chip"
                v-for="f in filters"
                :key="f.key"
                :class="{ active: activeFilter === f.key }"
                @click="activeFilter = f.key"
            >{{ f.label }}</view>
        </view>

        <!-- 词列表 -->
        <view class="word-list" v-if="shown.length">
            <view class="word-item" v-for="(w, i) in shown" :key="w.w">
                <view class="wi-head">
                    <view class="wi-left">
                        <text class="wi-word">{{ w.w }}</text>
                        <text class="wi-phonetic" v-if="w.p">{{ w.p }}</text>
                    </view>
                    <text class="degree-tag" :class="'deg-' + w.degree">{{ w.degreeLabel }}</text>
                </view>
                <text class="wi-meaning">{{ w.m || '（暂无释义）' }}</text>
                <view class="wi-meta">
                    <text class="meta-item">记忆阶段 {{ w.level }}</text>
                    <text class="meta-sep">·</text>
                    <text class="meta-item">复习 {{ w.reviewCount }} 次</text>
                    <text class="meta-sep" v-if="w.reviewCount">·</text>
                    <text class="meta-item" v-if="w.reviewCount">正确率 {{ w.accuracy }}%</text>
                </view>
                <view class="wi-foot">
                    <text class="next-review">{{ w.isNewToday ? '今日新学' : (w.lastReview ? '最近复习 ' + w.lastReview : '') }}</text>
                    <view class="wi-actions">
                        <text class="mini-btn" @click="speak(w.w)">🔊</text>
                        <text class="mini-btn detail" @click="goDetail(w.w)">查看 ›</text>
                    </view>
                </view>
            </view>
        </view>

        <view class="empty" v-else>
            <text>{{ keyword || activeFilter !== 'all' ? '没有符合条件的单词' : '还没有学过单词，去背诵页开始吧' }}</text>
        </view>
    </view>
</template>

<script>
import store from '@/common/store.js'
import speech from '@/common/speech.js'

export default {
    data() {
        return {
            all: [],
            stats: {},
            keyword: '',
            activeFilter: 'all',
            filters: [
                { key: 'all', label: '全部' },
                { key: '0', label: '新学' },
                { key: '1', label: '巩固中' },
                { key: '2', label: '熟悉' },
                { key: '3', label: '已掌握' }
            ]
        }
    },
    computed: {
        shown() {
            let list = this.all
            const k = this.keyword.trim().toLowerCase()
            if (k) list = list.filter(x => x.w.toLowerCase().indexOf(k) > -1 || x.m.toLowerCase().indexOf(k) > -1)
            if (this.activeFilter !== 'all') {
                const d = Number(this.activeFilter)
                list = list.filter(x => x.degree === d)
            }
            return list
        }
    },
    onShow() { this.refresh() },
    methods: {
        refresh() {
            store.init()
            this.all = store.getLearnedWords()
            this.stats = store.getProgressStats()
        },
        speak(word) { if (word) speech.speak(word) },
        /** 跳转查词页查看该词详情（tabBar 页不能带参，用本地存储传递） */
        goDetail(word) {
            try { uni.setStorageSync('pendingSearchWord', word) } catch (e) {}
            uni.switchTab({ url: '/pages/search/search' })
        }
    }
}
</script>

<style scoped>
.page { padding: 24rpx; padding-bottom: 60rpx; }
.hero {
    background: linear-gradient(135deg, #8B5CF6, #A78BFA);
    border-radius: 24rpx; padding: 40rpx 36rpx 32rpx; color: #fff; margin-bottom: 24rpx;
}
.hero-title { font-size: 40rpx; font-weight: 700; }
.hero-sub { font-size: 24rpx; opacity: .9; margin-top: 10rpx; }
.hero-bars { display: flex; justify-content: space-around; margin-top: 32rpx; }
.hbar-item { display: flex; flex-direction: column; align-items: center; }
.hbar-num { font-size: 38rpx; font-weight: 700; }
.hbar-label { font-size: 22rpx; opacity: .85; margin-top: 6rpx; }
.search-bar {
    display: flex; align-items: center; background: #fff; border-radius: 16rpx;
    padding: 18rpx 24rpx; margin-bottom: 20rpx; border: 2rpx solid #E8ECF3;
}
.search-icon { font-size: 30rpx; margin-right: 14rpx; }
.search-input { flex: 1; font-size: 28rpx; height: 44rpx; }
.clear { color: #B0B5BE; font-size: 28rpx; padding: 0 10rpx; }
.filter-wrap { display: flex; gap: 12rpx; flex-wrap: wrap; margin-bottom: 24rpx; }
.filter-chip {
    font-size: 24rpx; padding: 12rpx 24rpx; border-radius: 30rpx;
    background: #fff; color: #6B7280; border: 2rpx solid #E8ECF3;
}
.filter-chip.active { background: #8B5CF6; color: #fff; border-color: #8B5CF6; }
.word-list { background: #fff; border-radius: 20rpx; padding: 8rpx 28rpx; }
.word-item { padding: 28rpx 0; border-bottom: 1rpx solid #F2F3F6; }
.word-item:last-child { border-bottom: none; }
.wi-head { display: flex; justify-content: space-between; align-items: center; }
.wi-left { display: flex; align-items: baseline; gap: 14rpx; flex-wrap: wrap; }
.wi-word { font-size: 34rpx; font-weight: 700; color: #1A1D24; }
.wi-phonetic { font-size: 24rpx; color: #9AA0AA; }
.degree-tag { font-size: 20rpx; padding: 8rpx 18rpx; border-radius: 20rpx; white-space: nowrap; }
.deg-0 { background: #EEF4FF; color: #3A7AFE; }
.deg-1 { background: #FEF3E2; color: #F59E0B; }
.deg-2 { background: #E7F8EE; color: #22C55E; }
.deg-3 { background: #F3EEFF; color: #8B5CF6; }
.wi-meaning { display: block; font-size: 26rpx; color: #4B5563; line-height: 1.6; margin-top: 12rpx; }
.wi-meta { display: flex; align-items: center; gap: 8rpx; margin-top: 12rpx; }
.meta-item { font-size: 22rpx; color: #8A8F99; }
.meta-sep { font-size: 22rpx; color: #D0D4DB; }
.wi-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 16rpx; }
.next-review { font-size: 22rpx; color: #9AA0AA; }
.wi-actions { display: flex; align-items: center; gap: 14rpx; }
.mini-btn {
    font-size: 24rpx; padding: 8rpx 18rpx; border-radius: 16rpx;
    background: #F0F5FF; color: #3A7AFE; border: 2rpx solid #DCE8FF;
}
.mini-btn.detail { background: #F8F9FC; color: #6B7280; border-color: #E8ECF3; }
.empty { display: flex; align-items: center; justify-content: center; padding: 140rpx 40rpx; color: #A0A5AE; font-size: 28rpx; text-align: center; }
</style>
