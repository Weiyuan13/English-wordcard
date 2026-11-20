<template>
    <view class="page">
        <!-- 顶部欢迎区 -->
        <view class="hero">
            <view class="book-switch" @click="goSettings">
                <text>{{ currentBook.name }}</text>
                <text class="book-switch-arrow">▾</text>
            </view>
            <view class="hero-title">六级词卡</view>
            <view class="hero-sub">今日目标 · 坚持每一天</view>
            <view class="streak" v-if="stats.streak > 0">连续打卡 {{ stats.streak }} 天</view>
        </view>

        <!-- 今日进度卡片 -->
        <view class="card progress-card">
            <view class="card-title">今日进度</view>
            <view class="progress-row">
                <view class="progress-item">
                    <text class="p-num">{{ plan.newWords.length }}</text>
                    <text class="p-label">待背新词</text>
                </view>
                <view class="progress-item">
                    <text class="p-num done">{{ plan.doneNew.length }}</text>
                    <text class="p-label">已背</text>
                </view>
                <view class="progress-item">
                    <text class="p-num">{{ plan.reviewWords.length }}</text>
                    <text class="p-label">待复习</text>
                </view>
                <view class="progress-item">
                    <text class="p-num done">{{ plan.doneReview.length }}</text>
                    <text class="p-label">已复习</text>
                </view>
            </view>
            <view class="bar-wrap">
                <view class="bar">
                    <view class="bar-fill" :style="{ width: newPercent + '%' }"></view>
                </view>
                <text class="bar-text">新词 {{ newPercent }}%</text>
            </view>
            <view class="bar-wrap">
                <view class="bar">
                    <view class="bar-fill review" :style="{ width: reviewPercent + '%' }"></view>
                </view>
                <text class="bar-text">复习 {{ reviewPercent }}%</text>
            </view>
        </view>

        <!-- 快捷入口 -->
        <view class="card">
            <view class="card-title">开始学习</view>
            <view class="action-grid">
                <view class="action action-learn" @click="go('/pages/learn/learn')">
                    <view class="action-icon blue">背</view>
                    <text class="action-name">每日背诵</text>
                    <text class="action-desc">{{ remainingNew > 0 ? '还有 ' + remainingNew + ' 个新词' : '已完成' }}</text>
                </view>
                <view class="action action-review" @click="go('/pages/review/review')">
                    <view class="action-icon green">复</view>
                    <text class="action-name">每日复习</text>
                    <text class="action-desc">{{ remainingReview > 0 ? '还有 ' + remainingReview + ' 个待复习' : '已完成' }}</text>
                </view>
            </view>
        </view>

        <!-- 统计 -->
        <view class="card">
            <view class="card-title">学习统计</view>
            <view class="stat-grid">
                <view class="stat">
                    <text class="s-num">{{ stats.totalLearned }}</text>
                    <text class="s-label">已掌握</text>
                </view>
                <view class="stat">
                    <text class="s-num">{{ stats.totalReviews }}</text>
                    <text class="s-label">累计复习</text>
                </view>
                <view class="stat">
                    <text class="s-num">{{ priorityCount }}</text>
                    <text class="s-label">优先词</text>
                </view>
                <view class="stat">
                    <text class="s-num">{{ favoriteCount }}</text>
                    <text class="s-label">收藏</text>
                </view>
            </view>
        </view>

        <!-- 学习档案入口 -->
        <view class="card setting-entry" @click="goProgress">
            <view class="setting-left">
                <text class="setting-icon progress">📊</text>
                <view class="setting-text">
                    <text class="setting-name">学习档案</text>
                    <text class="setting-desc">已学 {{ learnedCount }} 词 · 查看学习程度</text>
                </view>
            </view>
            <text class="setting-arrow">›</text>
        </view>

        <!-- 收藏入口 -->
        <view class="card setting-entry" @click="goFavorites">
            <view class="setting-left">
                <text class="setting-icon fav">☆</text>
                <view class="setting-text">
                    <text class="setting-name">我的收藏</text>
                    <text class="setting-desc">已收藏 {{ favoriteCount }} 个单词</text>
                </view>
            </view>
            <text class="setting-arrow">›</text>
        </view>

        <!-- 设置入口 -->
        <view class="card setting-entry" @click="goSettings">
            <view class="setting-left">
                <text class="setting-icon">⚙</text>
                <view class="setting-text">
                    <text class="setting-name">学习设置</text>
                    <text class="setting-desc">每日背诵 {{ settings.dailyNew }} 词 · 复习 {{ settings.dailyReview }} 词</text>
                </view>
            </view>
            <text class="setting-arrow">›</text>
        </view>

        <!-- 词库信息 -->
        <view class="tip">当前词本：{{ currentBook.name }} {{ wordTotal }} 词 · 查过的词自动优先背诵</view>
    </view>
</template>

<script>
import store from '@/common/store.js'

export default {
    data() {
        return {
            plan: { newWords: [], reviewWords: [], doneNew: [], doneReview: [] },
            stats: {},
            settings: {},
            currentBook: {},
            priorityCount: 0,
            favoriteCount: 0,
            learnedCount: 0,
            wordTotal: 0
        }
    },
    computed: {
        remainingNew() { return Math.max(0, this.plan.newWords.length - this.plan.doneNew.length) },
        remainingReview() { return Math.max(0, this.plan.reviewWords.length - this.plan.doneReview.length) },
        newPercent() {
            if (!this.plan.newWords.length) return 100
            return Math.round(this.plan.doneNew.length / this.plan.newWords.length * 100)
        },
        reviewPercent() {
            if (!this.plan.reviewWords.length) return 100
            return Math.round(this.plan.doneReview.length / this.plan.reviewWords.length * 100)
        }
    },
    onShow() {
        this.refresh()
    },
    methods: {
        refresh() {
            store.init()
            this.plan = store.ensureDailyPlan()
            this.stats = store.getStats()
            this.settings = store.getSettings()
            this.currentBook = store.getCurrentBook()
            this.priorityCount = store.getPriorityWords().length
            this.favoriteCount = store.getFavorites().length
            this.learnedCount = store.getProgressStats().total
            this.wordTotal = store.wordList.length
        },
        go(url) {
            // tabBar 页面必须用 switchTab 跳转
            uni.switchTab({ url })
        },
        goSettings() {
            uni.navigateTo({ url: '/pages/settings/settings' })
        },
        goFavorites() {
            uni.navigateTo({ url: '/pages/favorites/favorites' })
        },
        goProgress() {
            uni.navigateTo({ url: '/pages/progress/progress' })
        }
    }
}
</script>

<style scoped>
.page { padding: 24rpx; }
.book-switch {
    position: absolute; top: 28rpx; right: 28rpx;
    display: flex; align-items: center; gap: 8rpx;
    background: rgba(255,255,255,.18); border: 2rpx solid rgba(255,255,255,.55); border-radius: 30rpx;
    padding: 9rpx 21rpx; font-size: 24rpx; color: #fff;
}
.book-switch-arrow { font-size: 20rpx; opacity: .9; }
.hero { position: relative;
    background: linear-gradient(135deg, #3A7AFE, #5B9BFF);
    border-radius: 24rpx;
    padding: 44rpx 36rpx;
    color: #fff;
    margin-bottom: 24rpx;
}
.hero-title { font-size: 44rpx; font-weight: 700; }
.hero-sub { font-size: 26rpx; opacity: .85; margin-top: 12rpx; }
.streak {
    display: inline-block; margin-top: 24rpx;
    background: rgba(255,255,255,.2); border-radius: 30rpx;
    padding: 10rpx 24rpx; font-size: 24rpx;
}
.card {
    background: #fff; border-radius: 20rpx; padding: 30rpx;
    margin-bottom: 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,.03);
}
.card-title { font-size: 30rpx; font-weight: 600; margin-bottom: 24rpx; color: #1A1D24; }
.progress-row { display: flex; justify-content: space-around; margin-bottom: 28rpx; }
.progress-item { display: flex; flex-direction: column; align-items: center; }
.p-num { font-size: 44rpx; font-weight: 700; color: #3A7AFE; }
.p-num.done { color: #22C55E; }
.p-label { font-size: 22rpx; color: #8A8F99; margin-top: 8rpx; }
.bar-wrap { display: flex; align-items: center; margin-top: 16rpx; }
.bar { flex: 1; height: 14rpx; background: #EEF1F6; border-radius: 10rpx; overflow: hidden; }
.bar-fill { height: 100%; background: #3A7AFE; border-radius: 10rpx; transition: width .3s; }
.bar-fill.review { background: #22C55E; }
.bar-text { font-size: 22rpx; color: #8A8F99; width: 130rpx; text-align: right; }
.action-grid { display: flex; gap: 20rpx; }
.action {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    background: #F8F9FC; border: 2rpx solid #E6EBF2; border-radius: 16rpx; padding: 26rpx 16rpx;
    transition: background .2s, border-color .2s;
}
.action-learn { background: #F5F8FF; border-color: #D9E5FF; }
.action-review { background: #F3FBF6; border-color: #D6F0E0; }
.action-icon {
    width: 80rpx; height: 80rpx; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 34rpx; font-weight: 600; margin-bottom: 16rpx;
}
.action-icon.blue { background: #3A7AFE; }
.action-icon.green { background: #22C55E; }
.action-name { font-size: 28rpx; font-weight: 600; }
.action-desc { font-size: 22rpx; color: #8A8F99; margin-top: 8rpx; }
.stat-grid { display: flex; justify-content: space-around; }
.stat { display: flex; flex-direction: column; align-items: center; }
.s-num { font-size: 36rpx; font-weight: 700; color: #1A1D24; }
.s-label { font-size: 22rpx; color: #8A8F99; margin-top: 6rpx; }
.tip { font-size: 22rpx; color: #A0A5AE; text-align: center; padding: 12rpx 0 40rpx; }
.setting-entry { display: flex; justify-content: space-between; align-items: center; border: 2rpx solid #ECEFF4; }
.setting-left { display: flex; align-items: center; }
.setting-icon {
    width: 72rpx; height: 72rpx; border-radius: 20rpx; background: #F0F2F5;
    display: flex; align-items: center; justify-content: center;
    font-size: 36rpx; color: #6B7280; margin-right: 20rpx;
}
.setting-icon.fav { background: #FFF8E6; color: #F59E0B; font-size: 44rpx; }
.setting-icon.progress { background: #F3EEFF; color: #8B5CF6; font-size: 38rpx; }
.setting-text { display: flex; flex-direction: column; }
.setting-name { font-size: 28rpx; font-weight: 600; }
.setting-desc { font-size: 22rpx; color: #8A8F99; margin-top: 8rpx; }
.setting-arrow { font-size: 40rpx; color: #C0C4CC; }
</style>
