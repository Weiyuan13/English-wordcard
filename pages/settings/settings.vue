<template>
    <view class="page">
        <!-- 词本选择 -->
        <view class="card">
            <view class="card-title">选择词本</view>
            <view class="book-list">
                <view
                    class="book-item"
                    :class="{ active: currentBookId === b.id }"
                    v-for="b in bookList"
                    :key="b.id"
                    @click="selectBook(b)"
                >
                    <view class="book-radio">
                        <view class="book-radio-inner" v-if="currentBookId === b.id"></view>
                    </view>
                    <view class="book-info">
                        <text class="book-name">{{ b.name }}</text>
                        <text class="book-desc">{{ b.desc }} · {{ b.count }} 词</text>
                    </view>
                    <text class="book-check" v-if="currentBookId === b.id">✓</text>
                </view>
            </view>
            <view class="book-tip">两个词本的学习进度、查词记录、优先词互相独立，切换不丢失。</view>
        </view>

        <view class="card">
            <view class="card-title">每日学习计划</view>

            <!-- 每日新词 -->
            <view class="setting-row">
                <view class="setting-info">
                    <text class="s-name">每日背诵量</text>
                    <text class="s-desc">每天学习的新词数量</text>
                </view>
                <view class="stepper">
                    <view class="step-btn" @click="change('dailyNew', -5)">−</view>
                    <text class="step-value">{{ draft.dailyNew }}</text>
                    <view class="step-btn" @click="change('dailyNew', 5)">+</view>
                </view>
            </view>

            <!-- 每日复习 -->
            <view class="setting-row">
                <view class="setting-info">
                    <text class="s-name">每日复习量</text>
                    <text class="s-desc">每天最多复习的词数</text>
                </view>
                <view class="stepper">
                    <view class="step-btn" @click="change('dailyReview', -10)">−</view>
                    <text class="step-value">{{ draft.dailyReview }}</text>
                    <view class="step-btn" @click="change('dailyReview', 10)">+</view>
                </view>
            </view>
        </view>

        <view class="card">
            <view class="card-title">学习偏好</view>
            <view class="setting-row">
                <view class="setting-info">
                    <text class="s-name">查词自动优先</text>
                    <text class="s-desc">查过的词自动加入优先背诵队列</text>
                </view>
                <switch :checked="draft.autoPriority" @change="draft.autoPriority = $event.detail.value" color="#3A7AFE" />
            </view>
        </view>

        <!-- 数据备份与恢复 -->
        <view class="card">
            <view class="card-title">数据备份与恢复</view>
            <view class="data-stat">
                <text class="ds-item">已学 {{ summary.learned }} 词</text>
                <text class="ds-dot">·</text>
                <text class="ds-item">查词 {{ summary.lookups }} 条</text>
                <text class="ds-dot">·</text>
                <text class="ds-item">收藏 {{ summary.favorites }} 个</text>
                <text class="ds-dot">·</text>
                <text class="ds-item">约 {{ summary.approxKB }} KB</text>
            </view>
            <view class="backup-tip">覆盖安装新版本不会丢失数据。备份用于防止卸载、换机或清除数据导致的数据丢失；建议定期导出保存。</view>
            <view class="backup-actions">
                <view class="bk-btn export" @click="exportBackup">导出备份</view>
                <view class="bk-btn import" @click="importBackup">导入恢复</view>
            </view>
        </view>

        <!-- 关于与更新 -->
        <view class="card">
            <view class="card-title">关于与更新</view>
            <view class="about-info">
                <view class="about-row"><text class="about-k">应用名称</text><text class="about-v">六级词卡</text></view>
                <view class="about-row"><text class="about-k">当前版本</text><text class="about-v">{{ appVersion }}</text></view>
                <view class="about-row"><text class="about-k">词库</text><text class="about-v">六级 {{ cet6Count }} 词 · 考研 {{ kaoyanCount }} 词</text></view>
            </view>
            <view class="update-warn">
                <text class="uw-title">更新时如何保留学习进度？</text>
                <text class="uw-line">1. 点下方按钮在浏览器下载最新版安装包；</text>
                <text class="uw-line">2. 下载后直接点击安装「覆盖」旧版，切勿先卸载！</text>
                <text class="uw-line">3. 只要包名和签名不变，覆盖安装后学习进度原样保留。</text>
                <text class="uw-line">4. 下载无需 GitHub 账户或登录，点一下就会开始下载。</text>
                <text class="uw-line uw-danger">⚠ 一旦先卸载再安装，本地进度会被清空；更新前建议先「导出备份」。</text>
            </view>
            <view class="about-actions">
                <view class="bk-btn export" @click="openDownload">下载最新版</view>
                <view class="bk-btn import" @click="exportBackup">更新前先备份</view>
            </view>
        </view>

        <view class="tip">调整后点击保存，今日计划会按新数量重新生成。已完成的记录不会丢失。</view>

        <view class="save-btn" @click="save">保存设置</view>
    </view>
</template>

<script>
import store from '@/common/store.js'
import backup from '@/common/backup.js'

// ============================================================
// 【需要你配置】最新版安装包的下载地址
// 打包前把下面改成你的真实地址（必须以 http:// 或 https:// 开头），例如：
//   - 网盘直链：https://www.lanzous.com/xxxxx
//   - GitHub Releases 直链（推荐，无需账户）：https://github.com/你的账号/仓库/releases/latest/download/cet6-word-app.apk
//   - DCloud 云打包完成后控制台给出的 APK 下载链接
// 留空字符串 '' 时，App 内按钮会提示"未配置"，不会打开假链接。
// ============================================================
const DOWNLOAD_URL = ''

const APP_VERSION = '1.0.0'

export default {
    data() {
        return {
            draft: {},
            bookList: [],
            currentBookId: '',
            summary: { learned: 0, lookups: 0, favorites: 0, approxKB: 0 },
            appVersion: APP_VERSION,
            cet6Count: 0,
            kaoyanCount: 0
        }
    },
    onShow() {
        this.draft = Object.assign({}, store.getSettings())
        this.bookList = store.getBookList()
        this.currentBookId = store.getCurrentBook().id
        this.summary = backup.getDataSummary()
        const bs = this.bookList || []
        this.cet6Count = (bs.find(b => b.id === 'cet6') || {}).count || 0
        this.kaoyanCount = (bs.find(b => b.id === 'kaoyan') || {}).count || 0
    },
    methods: {
        selectBook(b) {
            if (this.currentBookId === b.id) return
            store.switchBook(b.id)
            this.currentBookId = b.id
            // 词本切换后，设置草稿也要换成新词本的
            this.draft = Object.assign({}, store.getSettings())
            uni.showToast({ title: '已切换到' + b.name, icon: 'success' })
        },
        change(key, step) {
            const limits = {
                dailyNew: { min: 5, max: 200 },
                dailyReview: { min: 10, max: 300 }
            }
            const l = limits[key]
            let v = this.draft[key] + step
            v = Math.max(l.min, Math.min(l.max, v))
            this.draft[key] = v
        },
        save() {
            store.saveSettings(this.draft)
            store.rebuildDailyPlan()
            uni.showToast({ title: '设置已保存', icon: 'success' })
            setTimeout(() => {
                uni.navigateBack()
            }, 800)
        },

        // ---------- 关于与更新 ----------
        /** 在浏览器打开最新版下载地址；地址未配置时不打开假链接 */
        openDownload() {
            if (!DOWNLOAD_URL || DOWNLOAD_URL.indexOf('http://') !== 0 && DOWNLOAD_URL.indexOf('https://') !== 0) {
                uni.showModal({
                    title: '下载地址未配置',
                    content: '开发者尚未填写最新版下载地址。请在 pages/settings/settings.vue 顶部的 DOWNLOAD_URL 常量中填入真实地址后重新打包。\n\n更新提示：下载后请直接覆盖安装，不要先卸载，否则学习进度会丢失。',
                    showCancel: false
                })
                return
            }
            // App 端用系统浏览器打开，便于下载 APK 并覆盖安装
            // #ifdef APP-PLUS
            plus.runtime.openURL(DOWNLOAD_URL)
            // #endif
            // #ifndef APP-PLUS
            uni.setClipboardData({
                data: DOWNLOAD_URL,
                success: () => uni.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' })
            })
            // #endif
        },

        // ---------- 数据备份与恢复 ----------
        /** 导出备份：让用户选 保存到文件 / 复制文本 */
        exportBackup() {
            const json = backup.toJSON()
            uni.showActionSheet({
                itemList: ['保存到文件', '复制到剪贴板'],
                success: (res) => {
                    if (res.tapIndex === 0) {
                        uni.showLoading({ title: '正在保存' })
                        backup.saveToFile(json).then(r => {
                            uni.hideLoading()
                            uni.showModal({ title: r.ok ? '保存成功' : '保存失败', content: r.msg, showCancel: false })
                        })
                    } else if (res.tapIndex === 1) {
                        backup.copyToClipboard(json).then(r => {
                            uni.showToast({ title: r.ok ? '已复制请妥善保存' : '复制失败', icon: r.ok ? 'success' : 'none' })
                        })
                    }
                }
            })
        },

        /** 导入恢复：让用户选 剪贴板 / 本地文件 */
        importBackup() {
            uni.showActionSheet({
                itemList: ['从剪贴板导入', '从本地备份文件导入'],
                success: (res) => {
                    if (res.tapIndex === 0) {
                        backup.readFromClipboard().then(r => {
                            if (!r.ok || !r.text) {
                                uni.showToast({ title: '剪贴板为空或读取失败', icon: 'none' })
                                return
                            }
                            this.checkAndConfirmImport(r.text)
                        })
                    } else if (res.tapIndex === 1) {
                        this.pickLocalBackup()
                    }
                }
            })
        },

        /** 列出本地备份文件并让用户选择 */
        pickLocalBackup() {
            uni.showLoading({ title: '查找备份' })
            backup.listLocalFiles().then(r => {
                uni.hideLoading()
                const files = r.files || []
                if (!files.length) {
                    uni.showModal({
                        title: '没有找到备份文件',
                        content: '下载目录中没有备份文件。请先用「导出备份 → 保存到文件」，或改用剪贴板导入。',
                        showCancel: false
                    })
                    return
                }
                const names = files.slice(0, 6).map(f => f.name)
                uni.showActionSheet({
                    itemList: names,
                    success: (res) => {
                        const picked = files[res.tapIndex]
                        uni.showLoading({ title: '读取备份' })
                        backup.readLocalFile(picked.path).then(fr => {
                            uni.hideLoading()
                            if (!fr.ok) {
                                uni.showToast({ title: fr.msg || '读取失败', icon: 'none' })
                                return
                            }
                            this.checkAndConfirmImport(fr.text)
                        })
                    }
                })
            })
        },

        /** 校验备份内容，弹窗确认恢复模式后执行导入 */
        checkAndConfirmImport(text) {
            let obj
            try { obj = JSON.parse(text) } catch (e) {
                uni.showModal({ title: '导入失败', content: '备份内容不是有效的 JSON', showCancel: false })
                return
            }
            const v = backup.validate(obj)
            if (!v.ok) {
                uni.showModal({ title: '导入失败', content: v.msg, showCancel: false })
                return
            }
            const when = v.info.exportedAt ? v.info.exportedAt.replace('T', ' ').slice(0, 19) : '未知时间'
            uni.showActionSheet({
                itemList: ['合并覆盖（推荐，保留其它数据）', '完整还原（清空当前数据后写入）'],
                success: (res) => {
                    const mode = res.tapIndex === 1 ? 'replace' : 'merge'
                    const warn = mode === 'replace'
                        ? '完整还原会清空当前所有数据，再用备份覆盖。此操作不可撤销，确定继续吗？\n\n备份时间：' + when
                        : '将用备份中的数据覆盖同名项，其余数据保留。\n\n备份时间：' + when
                    uni.showModal({
                        title: mode === 'replace' ? '⚠ 完整还原确认' : '确认导入',
                        content: warn,
                        confirmText: '确认恢复',
                        confirmColor: mode === 'replace' ? '#EF4444' : '#3A7AFE',
                        success: (m) => {
                            if (!m.confirm) return
                            const result = backup.importFromJSON(text, { mode })
                            uni.showModal({
                                title: result.ok ? '恢复成功' : '恢复失败',
                                content: result.msg,
                                showCancel: false,
                                success: () => {
                                    if (result.ok) {
                                        // 刷新页面数据
                                        this.draft = Object.assign({}, store.getSettings())
                                        this.currentBookId = store.getCurrentBook().id
                                        this.summary = backup.getDataSummary()
                                    }
                                }
                            })
                        }
                    })
                }
            })
        }
    }
}
</script>

<style scoped>
.page { padding: 24rpx; }
.card {
    background: #fff; border-radius: 20rpx; padding: 30rpx;
    margin-bottom: 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,.03);
}
.card-title { font-size: 30rpx; font-weight: 600; margin-bottom: 12rpx; color: #1A1D24; }
.book-list { margin-top: 8rpx; }
.book-item {
    display: flex; align-items: center; padding: 24rpx 20rpx;
    border: 2rpx solid #EEF0F4; border-radius: 16rpx; margin-bottom: 16rpx;
}
.book-item.active { border-color: #3A7AFE; background: #F5F9FF; }
.book-radio {
    width: 40rpx; height: 40rpx; border-radius: 50%;
    border: 3rpx solid #C8CDD6; display: flex; align-items: center;
    justify-content: center; margin-right: 20rpx; flex-shrink: 0;
}
.book-item.active .book-radio { border-color: #3A7AFE; }
.book-radio-inner { width: 20rpx; height: 20rpx; border-radius: 50%; background: #3A7AFE; }
.book-info { display: flex; flex-direction: column; flex: 1; }
.book-name { font-size: 30rpx; font-weight: 600; }
.book-desc { font-size: 22rpx; color: #8A8F99; margin-top: 6rpx; }
.book-check { color: #3A7AFE; font-size: 32rpx; font-weight: 600; }
.book-tip { font-size: 22rpx; color: #A0A5AE; line-height: 1.6; margin-top: 8rpx; }
.setting-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 28rpx 0; border-bottom: 1rpx solid #F2F3F6;
}
.setting-row:last-child { border-bottom: none; }
.setting-info { display: flex; flex-direction: column; flex: 1; }
.s-name { font-size: 30rpx; color: #1A1D24; }
.s-desc { font-size: 22rpx; color: #8A8F99; margin-top: 8rpx; }
.stepper { display: flex; align-items: center; gap: 20rpx; }
.step-btn {
    width: 56rpx; height: 56rpx; border-radius: 50%;
    background: #EEF4FF; color: #3A7AFE; font-size: 36rpx;
    display: flex; align-items: center; justify-content: center;
}
.step-value { font-size: 34rpx; font-weight: 600; width: 70rpx; text-align: center; }
.tip { font-size: 24rpx; color: #A0A5AE; line-height: 1.7; padding: 8rpx 12rpx 32rpx; }
.data-stat {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx;
    background: #F8F9FC; border: 2rpx solid #ECEFF4; border-radius: 14rpx;
    padding: 20rpx 22rpx; margin: 8rpx 0 16rpx;
}
.ds-item { font-size: 24rpx; color: #4B5563; font-weight: 600; }
.ds-dot { font-size: 22rpx; color: #D0D4DB; }
.backup-tip { font-size: 22rpx; color: #8A8F99; line-height: 1.7; margin: 4rpx 0 20rpx; }
.backup-actions { display: flex; gap: 16rpx; }
.bk-btn {
    flex: 1; text-align: center; padding: 24rpx 0; border-radius: 16rpx;
    font-size: 28rpx; font-weight: 600;
}
.bk-btn.export { background: #EEF4FF; color: #3A7AFE; border: 2rpx solid #CFE0FF; }
.bk-btn.import { background: #F3FBF6; color: #16A34A; border: 2rpx solid #C6EBD3; }
.about-info { background: #F8F9FC; border: 2rpx solid #ECEFF4; border-radius: 14rpx; padding: 8rpx 22rpx; margin-bottom: 20rpx; }
.about-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #EDEFF3; }
.about-row:last-child { border-bottom: none; }
.about-k { font-size: 26rpx; color: #8A8F99; }
.about-v { font-size: 26rpx; color: #1A1D24; font-weight: 600; }
.update-warn { background: #FFF9EC; border: 2rpx solid #F5DFB8; border-radius: 14rpx; padding: 22rpx 24rpx; margin-bottom: 20rpx; display: flex; flex-direction: column; gap: 8rpx; }
.uw-title { font-size: 26rpx; font-weight: 700; color: #B45309; margin-bottom: 4rpx; }
.uw-line { font-size: 23rpx; color: #7C5A1E; line-height: 1.6; }
.uw-danger { color: #DC2626; font-weight: 600; margin-top: 6rpx; }
.save-btn {
    background: #3A7AFE; color: #fff; text-align: center;
    padding: 30rpx; border-radius: 20rpx; font-size: 30rpx; font-weight: 600;
    margin-bottom: 40rpx;
}
</style>
