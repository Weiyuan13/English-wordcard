<template>
    <view class="page">
        <!-- 今日待复习统计（档案管理的学习程度不显示此项，统一归到复习栏目） -->
        <view class="due-summary">
            <view class="ds-main">
                <text class="ds-num">{{ dueTotal }}</text>
                <text class="ds-label">今日待复习</text>
            </view>
            <text class="ds-sub">已完成 {{ doneCount }} / {{ dueTotal }}</text>
        </view>

        <!-- 今日新学提示（来自学习栏，次日复习） -->
        <view class="new-today-bar" v-if="todayNewCount > 0" @click="goProgress">
            <view class="ntb-icon">📚</view>
            <view class="ntb-text">
                <text class="ntb-title">今日新学 {{ todayNewCount }} 词 · 次日复习</text>
                <text class="ntb-desc">来自每日背诵，点击查看学习程度</text>
            </view>
            <text class="ntb-arrow">›</text>
        </view>

        <block v-if="current">
            <view class="topbar">
                <text class="counter">{{ index + 1 }} / {{ queue.length }}</text>
                <text class="tag">复习</text>
            </view>
            <view class="progress-line">
                <view class="progress-line-fill" :style="{ width: progressPercent + '%' }"></view>
            </view>

            <view class="flashcard" @click="flip">
                <view class="fav-btn" :class="{ active: isFav }" @click.stop="toggleFav">
                    <text>{{ isFav ? '★' : '☆' }}</text>
                </view>
                <view class="card-front" v-if="!revealed">
                    <text class="word">{{ current.w }}</text>
                    <text class="phonetic" v-if="current.p">{{ current.p }}</text>
                    <view class="speak" @click.stop="speak"><text>🔊 朗读</text></view>
                    <text class="tap-hint">回想词义后点击查看</text>
                </view>
                <view class="card-back" v-else>
                    <text class="word small">{{ current.w }}</text>
                    <scroll-view scroll-y class="meaning-box">
                        <text class="meaning">{{ current.m || '（暂无释义）' }}</text>
                    </scroll-view>
                    <text class="state-line">记忆阶段 {{ current.level }} · 已复习 {{ current.reviewCount }} 次</text>
                    <text class="tap-hint">点击卡片返回</text>
                </view>
            </view>

            <view class="rating" v-if="revealed">
                <view class="rate-btn forget" @click="rate(0)">
                    <text class="r-label">忘记</text><text class="r-desc">重新学</text>
                </view>
                <view class="rate-btn fuzzy" @click="rate(1)">
                    <text class="r-label">模糊</text><text class="r-desc">巩固</text>
                </view>
                <view class="rate-btn know" @click="rate(2)">
                    <text class="r-label">认识</text><text class="r-desc">拉长间隔</text>
                </view>
            </view>
            <view class="reveal-btn-wrap" v-else>
                <view class="reveal-btn" @click="flip">显示释义</view>
            </view>
        </block>

        <block v-else>
            <view class="done-view">
                <view class="done-icon">✓</view>
                <text class="done-title">今日复习完成！</text>
                <text class="done-desc">共复习 {{ doneCount }} 个单词</text>
                <view class="done-btn" @click="goLearn">去背新词</view>
                <view class="done-link" @click="goProgress">查看学习档案</view>
                <view class="done-link" @click="goHome">返回首页</view>
            </view>
        </block>
    </view>
</template>

<script>
import store from '@/common/store.js'
import speech from '@/common/speech.js'

export default {
    data() {
        return {
            queue: [],
            index: 0,
            revealed: false,
            doneCount: 0,
            favTick: 0,
            todayNewCount: 0,
            dueTotal: 0
        }
    },
    computed: {
        current() { return this.queue[this.index] || null },
        isFav() {
            if (!this.current) return false
            return this.favTick >= 0 && store.isFavorite(this.current.w)
        },
        progressPercent() {
            if (!this.queue.length) return 100
            return Math.round(this.index / this.queue.length * 100)
        }
    },
    onShow() { this.loadQueue() },
    methods: {
        loadQueue() {
            const plan = store.ensureDailyPlan()
            // 兜底过滤：新学的词当天不进入复习（修复今天已固化的旧计划）
            const dueList = plan.reviewWords.filter(w => store.isDue(w))
            const pending = dueList.filter(w => plan.doneReview.indexOf(w) === -1)
            this.queue = pending.map(w => {
                const info = store.findWord(w) || { w, m: '', p: '', e: '' }
                const st = store.getWordState(w) || { level: 0, reviewCount: 0 }
                return {
                    w: info.w, m: info.m, p: info.p || '',
                    level: st.level, reviewCount: st.reviewCount
                }
            })
            this.index = 0
            this.revealed = false
            this.doneCount = dueList.filter(w => plan.doneReview.indexOf(w) > -1).length
            this.dueTotal = dueList.length
            this.todayNewCount = store.getTodayNewWords().length
        },
        flip() { this.revealed = !this.revealed },
        toggleFav() {
            if (!this.current) return
            const c = this.current
            const added = store.toggleFavorite({
                w: c.w, m: c.m, p: c.p, e: c.e,
                source: store.currentBookId
            })
            this.favTick++
            uni.showToast({ title: added ? '已加入收藏' : '已取消收藏', icon: 'success' })
        },
        speak() {
            if (this.current) speech.speak(this.current.w)
        },
        rate(rating) {
            if (!this.current) return
            const word = this.current.w
            store.rateWord(word, rating)
            store.markDone('review', word)
            this.doneCount++
            this.index++
            this.revealed = false
            if (this.index >= this.queue.length) {
                uni.showToast({ title: '复习完成', icon: 'success' })
            }
        },
        goLearn() { uni.switchTab({ url: '/pages/learn/learn' }) },
        goHome() { uni.switchTab({ url: '/pages/index/index' }) },
        goProgress() { uni.navigateTo({ url: '/pages/progress/progress' }) }
    }
}
</script>

<style scoped>
.page { padding: 24rpx; min-height: 100vh; }
.due-summary {
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(135deg, #22C55E, #4ADE80);
    border-radius: 20rpx; padding: 32rpx 36rpx; margin-bottom: 24rpx; color: #fff;
}
.ds-main { display: flex; align-items: baseline; gap: 14rpx; }
.ds-num { font-size: 60rpx; font-weight: 700; line-height: 1; }
.ds-label { font-size: 28rpx; font-weight: 600; opacity: .95; }
.ds-sub { font-size: 24rpx; background: rgba(255,255,255,.2); padding: 10rpx 22rpx; border-radius: 30rpx; }
.new-today-bar {
    display: flex; align-items: center; background: #F3EEFF; border: 2rpx solid #E4D9FF;
    border-radius: 16rpx; padding: 20rpx 24rpx; margin-bottom: 24rpx;
}
.ntb-icon { font-size: 40rpx; margin-right: 18rpx; }
.ntb-text { flex: 1; display: flex; flex-direction: column; }
.ntb-title { font-size: 26rpx; font-weight: 600; color: #7C3AED; }
.ntb-desc { font-size: 22rpx; color: #9B8ABF; margin-top: 6rpx; }
.ntb-arrow { font-size: 36rpx; color: #A78BFA; margin-left: 12rpx; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 8rpx 8rpx 20rpx; }
.counter { font-size: 28rpx; color: #8A8F99; font-weight: 600; }
.tag { font-size: 22rpx; color: #22C55E; background: #E7F8EE; padding: 8rpx 20rpx; border-radius: 30rpx; }
.progress-line { height: 8rpx; background: #E8ECF3; border-radius: 8rpx; margin-bottom: 40rpx; overflow: hidden; }
.progress-line-fill { height: 100%; background: #22C55E; transition: width .3s; }
.flashcard {
    background: #fff; border-radius: 28rpx; min-height: 600rpx;
    box-shadow: 0 8rpx 40rpx rgba(0,0,0,.06);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40rpx; position: relative;
}
.card-front, .card-back { display: flex; flex-direction: column; align-items: center; width: 100%; }
.word { font-size: 76rpx; font-weight: 700; color: #1A1D24; text-align: center; word-break: break-all; }
.word.small { font-size: 44rpx; margin-bottom: 30rpx; }
.phonetic { font-size: 32rpx; color: #8A8F99; margin-top: 16rpx; }
.speak { margin-top: 36rpx; background: #EEF4FF; color: #3A7AFE; padding: 16rpx 40rpx; border-radius: 40rpx; font-size: 28rpx; border: 2rpx solid #CFE0FF; }
.tap-hint { position: absolute; bottom: 40rpx; font-size: 24rpx; color: #B0B5BE; }
.fav-btn {
    position: absolute; top: 24rpx; right: 24rpx; z-index: 2;
    width: 64rpx; height: 64rpx; border-radius: 50%;
    background: #FFF8E6; display: flex; align-items: center; justify-content: center;
    font-size: 40rpx; color: #D6B36B; line-height: 1;
}
.fav-btn.active { background: #F59E0B; color: #fff; }
.meaning-box { max-height: 360rpx; width: 100%; }
.meaning { font-size: 34rpx; line-height: 1.8; color: #1A1D24; text-align: center; display: block; }
.state-line { font-size: 24rpx; color: #8A8F99; margin-top: 30rpx; }
.rating { display: flex; gap: 16rpx; margin-top: 40rpx; }
.rate-btn { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 28rpx 0; border-radius: 20rpx; border: 2rpx solid rgba(0,0,0,.04); }
.rate-btn.forget { background: #FEECEC; border-color: #F8D0D0; }
.rate-btn.fuzzy { background: #FEF3E2; border-color: #F5DFB8; }
.rate-btn.know { background: #E7F8EE; border-color: #C6EBD3; }
.r-label { font-size: 30rpx; font-weight: 600; }
.r-desc { font-size: 22rpx; color: #8A8F99; margin-top: 8rpx; }
.forget .r-label { color: #EF4444; }
.fuzzy .r-label { color: #F59E0B; }
.know .r-label { color: #22C55E; }
.reveal-btn-wrap { margin-top: 40rpx; }
.reveal-btn { background: #22C55E; color: #fff; text-align: center; padding: 30rpx; border-radius: 20rpx; font-size: 30rpx; font-weight: 600; }
.done-view { display: flex; flex-direction: column; align-items: center; padding-top: 180rpx; }
.done-icon { width: 140rpx; height: 140rpx; border-radius: 50%; background: #22C55E; color: #fff; font-size: 80rpx; display: flex; align-items: center; justify-content: center; }
.done-title { font-size: 40rpx; font-weight: 700; margin-top: 40rpx; }
.done-desc { font-size: 26rpx; color: #8A8F99; margin-top: 16rpx; }
.done-btn { background: #3A7AFE; color: #fff; padding: 26rpx 80rpx; border-radius: 40rpx; font-size: 30rpx; margin-top: 60rpx; }
.done-link { color: #8A8F99; font-size: 26rpx; margin-top: 32rpx; }
</style>
