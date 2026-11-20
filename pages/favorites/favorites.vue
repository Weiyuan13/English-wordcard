<template>
    <view class="page">
        <view class="header">
            <view>
                <text class="h-title">我的收藏</text>
                <text class="h-sub">{{ currentBook.name }} · 共 {{ favorites.length }} 词</text>
            </view>
            <view class="clear-all" v-if="favorites.length" @click="confirmClear">清空</view>
        </view>

        <!-- 收藏列表 -->
        <view class="fav-list" v-if="favorites.length">
            <view class="fav-card" v-for="(f, i) in favorites" :key="f.w + '_' + f.ts">
                <view class="fav-main" @click="toggleExpand(f.w)">
                    <view class="fav-row">
                        <text class="fav-word">{{ f.w }}</text>
                        <text class="fav-star">★</text>
                    </view>
                    <text class="fav-phonetic" v-if="f.p">{{ f.p }}</text>
                    <text class="fav-meaning">{{ f.m || '暂无释义' }}</text>
                    <view class="fav-tags">
                        <text class="src-tag" :class="srcClass(f.source)">{{ srcText(f.source) }}</text>
                        <text class="fav-time">{{ fmtShort(f.ts) }} 收藏</text>
                    </view>
                </view>
                <view class="fav-expand" v-if="expanded === f.w">
                    <text class="fav-example" v-if="f.e">{{ f.e }}</text>
                    <view class="fav-actions">
                        <view class="mini-btn" @click="speak(f.w)">🔊 朗读</view>
                        <view class="mini-btn danger" @click="removeFav(f.w)">取消收藏</view>
                    </view>
                </view>
                <view class="expand-hint" @click="toggleExpand(f.w)">
                    {{ expanded === f.w ? '收起 ▲' : '展开详情 ▼' }}
                </view>
            </view>
        </view>

        <view class="empty" v-else>
            <text class="empty-icon">☆</text>
            <text class="empty-title">还没有收藏的单词</text>
            <text class="empty-sub">在背诵卡片或查词结果中点星标即可收藏</text>
        </view>
    </view>
</template>

<script>
import store from '@/common/store.js'
import speech from '@/common/speech.js'

export default {
    data() {
        return {
            favorites: [],
            expanded: '',
            currentBook: {}
        }
    },
    onShow() {
        this.refresh()
    },
    methods: {
        refresh() {
            this.favorites = store.getFavorites()
            this.currentBook = store.getCurrentBook()
        },
        toggleExpand(word) {
            this.expanded = this.expanded === word ? '' : word
        },
        srcText(source) {
            if (source === 'cet6' || source === 'local') return '六级'
            if (source === 'kaoyan') return '考研'
            if (source === 'both') return '六级+考研'
            if (source === 'web' || source === 'online') return '网页搜索'
            return source || '收藏'
        },
        srcClass(source) {
            if (source === 'cet6' || source === 'local') return 'cet6'
            if (source === 'kaoyan') return 'kaoyan'
            if (source === 'both') return 'both'
            if (source === 'web' || source === 'online') return 'web'
            return ''
        },
        fmtShort(ts) {
            const d = new Date(ts)
            const p = n => String(n).padStart(2, '0')
            return (d.getMonth() + 1) + '月' + d.getDate() + '日'
        },
        removeFav(word) {
            store.removeFavorite(word)
            if (this.expanded === word) this.expanded = ''
            this.refresh()
            uni.showToast({ title: '已取消收藏', icon: 'success' })
        },
        speak(word) {
            if (word) speech.speak(word)
        },
        confirmClear() {
            uni.showModal({
                title: '清空收藏',
                content: '确定清空当前词本的全部收藏吗？此操作不可恢复。',
                success: (res) => {
                    if (res.confirm) {
                        store.clearFavorites()
                        this.expanded = ''
                        this.refresh()
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
.header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8rpx 8rpx 28rpx;
}
.h-title { font-size: 38rpx; font-weight: 700; display: block; }
.h-sub { font-size: 24rpx; color: #8A8F99; margin-top: 8rpx; display: block; }
.clear-all { font-size: 26rpx; color: #EF4444; padding: 12rpx 20rpx; }
.fav-list { display: flex; flex-direction: column; gap: 20rpx; }
.fav-card {
    background: #fff; border-radius: 20rpx; padding: 28rpx 30rpx;
    box-shadow: 0 4rpx 20rpx rgba(0,0,0,.03);
}
.fav-main { width: 100%; }
.fav-row { display: flex; justify-content: space-between; align-items: center; }
.fav-word { font-size: 40rpx; font-weight: 700; word-break: break-all; }
.fav-star { font-size: 36rpx; color: #F59E0B; }
.fav-phonetic { font-size: 26rpx; color: #8A8F99; display: block; margin-top: 6rpx; }
.fav-meaning { font-size: 28rpx; line-height: 1.7; color: #1A1D24; display: block; margin-top: 14rpx; }
.fav-tags { display: flex; align-items: center; gap: 16rpx; margin-top: 18rpx; }
.src-tag { font-size: 20rpx; padding: 6rpx 16rpx; border-radius: 20rpx; background: #F0F2F5; color: #8A8F99; }
.src-tag.cet6 { background: #EEF4FF; color: #3A7AFE; }
.src-tag.kaoyan { background: #F3EEFF; color: #8B5CF6; }
.src-tag.both { background: #FEF3E2; color: #F59E0B; }
.src-tag.web { background: #E7F8EE; color: #22C55E; }
.fav-time { font-size: 20rpx; color: #B0B5BE; }
.fav-expand { margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid #F0F2F5; }
.fav-example { font-size: 25rpx; color: #6B7280; line-height: 1.7; display: block; white-space: pre-line; }
.fav-actions { display: flex; gap: 20rpx; margin-top: 22rpx; }
.mini-btn {
    background: #EEF4FF; color: #3A7AFE; padding: 14rpx 28rpx;
    border-radius: 30rpx; font-size: 24rpx;
}
.mini-btn.danger { background: #FEECEC; color: #EF4444; }
.expand-hint { text-align: center; font-size: 22rpx; color: #B0B5BE; margin-top: 18rpx; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 160rpx 0; }
.empty-icon { font-size: 100rpx; color: #E0E3E9; }
.empty-title { font-size: 30rpx; color: #6B7280; margin-top: 24rpx; }
.empty-sub { font-size: 24rpx; color: #A0A5AE; margin-top: 14rpx; text-align: center; }
</style>
