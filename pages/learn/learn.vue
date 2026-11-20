<template>
    <view class="page">
        <!-- 学习进行中 -->
        <block v-if="current">
            <view class="topbar">
                <text class="counter">{{ index + 1 }} / {{ queue.length }}</text>
                <text class="tag" v-if="isPriority">优先词</text>
            </view>
            <view class="progress-line">
                <view class="progress-line-fill" :style="{ width: progressPercent + '%' }"></view>
            </view>

            <!-- 单词卡片 -->
            <view class="flashcard" @click="flip">
                <view class="fav-btn" :class="{ active: isFav }" @click.stop="toggleFav">
                    <text>{{ isFav ? '★' : '☆' }}</text>
                </view>
                <view class="card-face card-front" v-if="!revealed">
                    <text class="word">{{ current.w }}</text>
                    <text class="phonetic" v-if="current.p">{{ current.p }}</text>
                    <view class="speak" @click.stop="speak">
                        <text>🔊 朗读</text>
                    </view>
                    <text class="tap-hint">点击卡片查看释义</text>
                </view>
                <view class="card-face card-back" v-else>
                    <text class="word small">{{ current.w }}</text>
                    <scroll-view scroll-y class="meaning-box">
                        <text class="meaning">{{ current.m || '（本地词库暂无释义）' }}</text>
                        <text class="example" v-if="current.e">{{ current.e }}</text>
                    </scroll-view>
                    <text class="tap-hint">点击卡片返回</text>
                </view>
            </view>

            <!-- 评分按钮 -->
            <view class="rating" v-if="revealed">
                <view class="rate-btn forget" @click="rate(0)">
                    <text class="r-label">忘记</text>
                    <text class="r-desc">明天再练</text>
                </view>
                <view class="rate-btn fuzzy" @click="rate(1)">
                    <text class="r-label">模糊</text>
                    <text class="r-desc">短期巩固</text>
                </view>
                <view class="rate-btn know" @click="rate(2)">
                    <text class="r-label">认识</text>
                    <text class="r-desc">拉长间隔</text>
                </view>
            </view>
            <view class="reveal-btn-wrap" v-else>
                <view class="reveal-btn" @click="flip">显示释义</view>
            </view>

            <!-- 查过的词提示 -->
            <view class="lookup-tip" v-if="lookupTimes > 0">
                这个词你查过 {{ lookupTimes }} 次，已优先安排
            </view>
        </block>

        <!-- 完成状态 -->
        <block v-else>
            <view class="done-view">
                <view class="done-icon">✓</view>
                <text class="done-title">今日背诵完成！</text>
                <text class="done-desc">共学习 {{ doneCount }} 个新词</text>
                <view class="done-btn" @click="goReview">去复习</view>
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
            favTick: 0
        }
    },
    computed: {
        current() {
            return this.queue[this.index] || null
        },
        isFav() {
            if (!this.current) return false
            return this.favTick >= 0 && store.isFavorite(this.current.w)
        },
        progressPercent() {
            if (!this.queue.length) return 100
            return Math.round(this.index / this.queue.length * 100)
        },
        isPriority() {
            if (!this.current) return false
            return store.getPriorityWords().indexOf(this.current.w) > -1
        },
        lookupTimes() {
            if (!this.current) return 0
            return store.getLookupCount(this.current.w)
        }
    },
    onShow() {
        this.loadQueue()
    },
    methods: {
        loadQueue() {
            const plan = store.ensureDailyPlan()
            // 今日新词中未完成的
            const pending = plan.newWords.filter(w => plan.doneNew.indexOf(w) === -1)
            this.queue = pending.map(w => {
                const info = store.findWord(w) || { w, m: '', p: '', e: '' }
                const st = store.getWordState(w)
                return {
                    w: info.w,
                    m: info.m,
                    p: info.p || (st && st.phonetic) || '',
                    e: info.e || ''
                }
            })
            this.index = 0
            this.revealed = false
            this.doneCount = plan.doneNew.length
        },
        flip() {
            this.revealed = !this.revealed
        },
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
            store.markDone('new', word)
            this.doneCount++
            this.index++
            this.revealed = false
            if (this.index >= this.queue.length) {
                uni.showToast({ title: '背诵完成', icon: 'success' })
            }
        },
        goReview() {
            uni.switchTab({ url: '/pages/review/review' })
        },
        goHome() {
            uni.switchTab({ url: '/pages/index/index' })
        }
    }
}
</script>

<style scoped>
.page { padding: 24rpx; min-height: 100vh; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 8rpx 8rpx 20rpx; }
.counter { font-size: 28rpx; color: #8A8F99; font-weight: 600; }
.tag { font-size: 22rpx; color: #F59E0B; background: #FEF3E2; padding: 8rpx 20rpx; border-radius: 30rpx; }
.progress-line { height: 8rpx; background: #E8ECF3; border-radius: 8rpx; margin-bottom: 40rpx; overflow: hidden; }
.progress-line-fill { height: 100%; background: #3A7AFE; transition: width .3s; }
.flashcard {
    background: #fff; border-radius: 28rpx; min-height: 600rpx;
    box-shadow: 0 8rpx 40rpx rgba(0,0,0,.06);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40rpx; position: relative;
}
.card-face { display: flex; flex-direction: column; align-items: center; width: 100%; }
.word { font-size: 76rpx; font-weight: 700; color: #1A1D24; text-align: center; word-break: break-all; }
.word.small { font-size: 44rpx; margin-bottom: 30rpx; }
.phonetic { font-size: 32rpx; color: #8A8F99; margin-top: 16rpx; }
.speak {
    margin-top: 36rpx; background: #EEF4FF; color: #3A7AFE;
    padding: 16rpx 40rpx; border-radius: 40rpx; font-size: 28rpx;
    border: 2rpx solid #CFE0FF;
}
.tap-hint { position: absolute; bottom: 40rpx; font-size: 24rpx; color: #B0B5BE; }
.fav-btn {
    position: absolute; top: 24rpx; right: 24rpx; z-index: 2;
    width: 64rpx; height: 64rpx; border-radius: 50%;
    background: #FFF8E6; display: flex; align-items: center; justify-content: center;
    font-size: 40rpx; color: #D6B36B; line-height: 1;
}
.fav-btn.active { background: #F59E0B; color: #fff; }
.meaning-box { max-height: 400rpx; width: 100%; }
.meaning { font-size: 34rpx; line-height: 1.8; color: #1A1D24; text-align: center; display: block; }
.example { font-size: 26rpx; color: #8A8F99; margin-top: 24rpx; display: block; text-align: center; line-height: 1.7; white-space: pre-line; }
.rating { display: flex; gap: 16rpx; margin-top: 40rpx; }
.rate-btn {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    padding: 28rpx 0; border-radius: 20rpx;
    border: 2rpx solid rgba(0,0,0,.04);
}
.rate-btn.forget { background: #FEECEC; border-color: #F8D0D0; }
.rate-btn.fuzzy { background: #FEF3E2; border-color: #F5DFB8; }
.rate-btn.know { background: #E7F8EE; border-color: #C6EBD3; }
.r-label { font-size: 30rpx; font-weight: 600; }
.r-desc { font-size: 22rpx; color: #8A8F99; margin-top: 8rpx; }
.forget .r-label { color: #EF4444; }
.fuzzy .r-label { color: #F59E0B; }
.know .r-label { color: #22C55E; }
.reveal-btn-wrap { margin-top: 40rpx; }
.reveal-btn {
    background: #3A7AFE; color: #fff; text-align: center;
    padding: 30rpx; border-radius: 20rpx; font-size: 30rpx; font-weight: 600;
}
.lookup-tip { text-align: center; font-size: 24rpx; color: #F59E0B; margin-top: 28rpx; }
.done-view { display: flex; flex-direction: column; align-items: center; padding-top: 180rpx; }
.done-icon {
    width: 140rpx; height: 140rpx; border-radius: 50%; background: #22C55E;
    color: #fff; font-size: 80rpx; display: flex; align-items: center; justify-content: center;
}
.done-title { font-size: 40rpx; font-weight: 700; margin-top: 40rpx; }
.done-desc { font-size: 26rpx; color: #8A8F99; margin-top: 16rpx; }
.done-btn {
    background: #3A7AFE; color: #fff; padding: 26rpx 80rpx;
    border-radius: 40rpx; font-size: 30rpx; margin-top: 60rpx;
}
.done-link { color: #8A8F99; font-size: 26rpx; margin-top: 32rpx; }
</style>
