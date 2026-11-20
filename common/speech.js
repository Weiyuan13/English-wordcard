/**
 * 在线朗读工具：使用有道发音接口播放真人音频
 * 系统 TTS（plus.speech）在多数国产安卓机不可用，故改用在线音频
 * 有道 dictvoice 实测稳定（audio/mpeg），type=2 为英音
 */
let audioCtx = null

function getAudio() {
    // #ifdef APP-PLUS || H5
    if (!audioCtx && typeof uni.createInnerAudioContext === 'function') {
        audioCtx = uni.createInnerAudioContext()
        audioCtx.onError((e) => {
            console.warn('音频播放失败', e)
            // #ifdef APP-PLUS
            uni.showToast({ title: '朗读失败，请检查网络', icon: 'none' })
            // #endif
        })
    }
    // #endif
    return audioCtx
}

export default {
    /**
     * 朗读单词
     * @param {string} word 单词
     * @param {number} type 0=美音 1=英音 2=英音(慢) 3=美音(慢)，默认 2
     */
    speak(word, type) {
        const w = String(word || '').trim()
        if (!w) return
        // #ifdef APP-PLUS || H5
        const ctx = getAudio()
        if (!ctx) return
        ctx.stop()
        ctx.src = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(w) + '&type=' + (type || 2)
        ctx.play()
        // #endif
        // #ifdef MP-WEIXIN
        uni.showToast({ title: '小程序端暂不支持朗读', icon: 'none' })
        // #endif
    },
    /** 释放音频资源（页面卸载时可选调用） */
    destroy() {
        if (audioCtx) {
            audioCtx.destroy()
            audioCtx = null
        }
    }
}
