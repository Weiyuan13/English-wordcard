/**
 * 联网查词兜底：本地两个词库都查不到时调用
 * 主源：dictionaryapi.dev —— 免费无 key，提供英文释义/音标/例句
 * 中文：MyMemory 翻译接口 —— 免费无 key，将英文释义译成中文
 * 已移除失效的有道翻译老接口（返回 302，是联网失败的元凶）
 * 全部失败时返回 null，页面给出友好提示，不影响离线使用
 */

function fetchJson(url, timeout) {
    return new Promise((resolve, reject) => {
        uni.request({
            url: url,
            method: 'GET',
            timeout: timeout || 10000,
            header: { 'Accept': 'application/json' },
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data)
                else reject(new Error('HTTP ' + res.statusCode))
            },
            fail: (err) => reject(err)
        })
    })
}

/** 从 phonetics 中挑一个带 text 的音标 */
function extractPhonetic(entry) {
    if (entry.phonetic) return entry.phonetic
    const list = entry.phonetics || []
    for (const p of list) {
        if (p.text) return p.text
    }
    return ''
}

/** 取首个释义 + 例句（英文） */
function extractMeaning(entry) {
    const meanings = entry.meanings || []
    if (!meanings.length) return { def: '', example: '', pos: '' }
    const m = meanings[0]
    const def = (m.definitions && m.definitions[0]) || {}
    return {
        pos: m.partOfSpeech || '',
        def: def.definition || '',
        example: def.example || ''
    }
}

/** MyMemory 英译中（免费无 key），失败返回空串 */
async function translateToChinese(text) {
    if (!text) return ''
    try {
        const url = 'https://api.mymemory.translated.net/get?q=' +
            encodeURIComponent(text) + '&langpair=en%7Czh-CN'
        const data = await fetchJson(url, 10000)
        const t = data && data.responseData && data.responseData.translatedText
        if (!t) return ''
        // MyMemory 偶尔返回错误串，过滤掉
        if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) return ''
        return t
    } catch (e) {
        console.warn('中文翻译失败', e)
        return ''
    }
}

export default {
    /**
     * 在线查词
     * @param {string} word 单词（小写）
     * @returns {Promise<{word, phonetic, meaning, meaningEn, pos, example, source}|null>}
     *   meaning   = 中文释义（翻译失败时回退为英文）
     *   meaningEn = 英文释义原文（作为补充展示）
     */
    async lookup(word) {
        const w = word.trim().toLowerCase()
        if (!w) return null

        let entry = null
        // 主源：dictionaryapi.dev
        try {
            const data = await fetchJson(
                'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w), 10000)
            if (Array.isArray(data) && data.length) entry = data[0]
        } catch (e) {
            console.warn('dictionaryapi.dev 查询失败', e)
        }

        if (entry) {
            const mi = extractMeaning(entry)
            // 取中文翻译
            const cn = await translateToChinese(mi.def)
            return {
                word: entry.word || w,
                phonetic: extractPhonetic(entry),
                meaning: cn || mi.def,       // 中文优先，失败回退英文
                meaningEn: mi.def,
                pos: mi.pos,
                example: mi.example,
                source: 'dictionaryapi.dev'
            }
        }

        // 兜底：MyMemory 直接翻译单词（dictionaryapi.dev 查不到时，如缩写/人名）
        try {
            const url = 'https://api.mymemory.translated.net/get?q=' +
                encodeURIComponent(w) + '&langpair=en%7Czh-CN'
            const data = await fetchJson(url, 10000)
            const t = data && data.responseData && data.responseData.translatedText
            if (t && !/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) {
                return {
                    word: w,
                    phonetic: '',
                    meaning: t,
                    meaningEn: '',
                    pos: '',
                    example: '',
                    source: 'mymemory'
                }
            }
        } catch (e) {
            console.warn('MyMemory 兜底查询失败', e)
        }

        return null
    }
}
