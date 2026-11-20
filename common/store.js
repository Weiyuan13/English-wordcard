/**
 * 本地数据存储与核心业务逻辑（支持多词本，数据按词本隔离）
 * 全部数据保存在手机本地（uni.setStorageSync），无需服务器
 * 含：SM-2 简化版间隔重复算法、每日计划、查词记录、优先级队列
 */
import books from './books.js'

// 全局键（不按词本隔离）
const GLOBAL = {
    CURRENT_BOOK: 'cet6_current_book',  // 当前选中的词本 id
    DATA_VERSION: 'cet6_data_version'   // 数据结构版本号（用于升级迁移）
}

// 当前数据结构版本。每次改动存储结构/语义时 +1，并在 MIGRATIONS 里加一条规则。
const DATA_VERSION = 1

// 按词本隔离的数据键（实际存储时会加 {bookId}_ 前缀）
const K = {
    SRS: 'srs',            // 记忆状态表 { word: srsRecord }
    LOOKUP: 'lookup_log',  // 查词记录 [{word, ts, source}]
    PRIORITY: 'priority',  // 优先背诵词 [word]
    DAILY: 'daily_plan',   // 每日计划
    SETTINGS: 'settings',  // 设置
    STATS: 'stats',        // 累计统计
    FAVORITES: 'favorites' // 收藏词 [{w, m, p, e, source, ts}]
}

const DEFAULT_SETTINGS = {
    dailyNew: 20,
    dailyReview: 50,
    autoPriority: true
}

const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60, 120]

function today() {
    const d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function dayDiff(a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number)
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000)
}

function addDays(dateStr, n) {
    const p = dateStr.split('-').map(Number)
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]))
    d.setUTCDate(d.getUTCDate() + n)
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function shuffle(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
}

function read(key, def) {
    try {
        const v = uni.getStorageSync(key)
        return (v === '' || v === null || v === undefined) ? def : v
    } catch (e) { return def }
}

function write(key, val) {
    try { uni.setStorageSync(key, val) } catch (e) { console.error('存储失败', key, e) }
}

/**
 * 数据迁移规则表：把数据从 v(n-1) 升级到 v(n)。
 * 新增结构变更时：DATA_VERSION +1，并在此加一条 MIGRATIONS[新版本] 函数。
 * 每条规则必须幂等（重复执行不产生副作用）。
 */
const MIGRATIONS = {
    // v1：补齐历史 SRS 记录缺失字段（firstLearn/reviewCount/correctCount），
    // 并修正"今天新学但 nextReview=今天"的误判，统一改为次日复习。
    1: function () {
        const t = today()
        for (const b of books.list) {
            const srsKey = b.id + '_' + K.SRS
            const srs = read(srsKey, null)
            if (!srs || typeof srs !== 'object') continue
            let changed = false
            for (const w of Object.keys(srs)) {
                const r = srs[w]
                if (!r || typeof r !== 'object') continue
                if (r.firstLearn === undefined) { r.firstLearn = r.lastReview || '1970-01-01'; changed = true }
                if (r.reviewCount === undefined) { r.reviewCount = 0; changed = true }
                if (r.correctCount === undefined) { r.correctCount = r.reviewCount && r.level > 0 ? r.reviewCount : 0; changed = true }
                // 新学当天被误判为今天待复习的，改为次日
                if (r.firstLearn === t && r.nextReview && r.nextReview <= t) {
                    r.nextReview = addDays(t, 1)
                    changed = true
                }
            }
            if (changed) write(srsKey, srs)
        }
    }
}

export default {
    /** 当前词本 id（读时兜底为第一个词本） */
    get currentBookId() {
        const id = read(GLOBAL.CURRENT_BOOK, '')
        return books.get(id).id
    },
    /** 当前词本词库（动态） */
    get wordList() {
        return books.getWords(this.currentBookId)
    },
    /** 按当前词本拼出实际存储键 */
    _key(base) {
        return this.currentBookId + '_' + base
    },

    // ---------- 词本管理 ----------
    getBookList() {
        return books.list.map(b => ({ id: b.id, name: b.name, desc: b.desc, count: b.words.length }))
    },
    getCurrentBook() {
        const id = this.currentBookId
        const b = books.get(id)
        return { id: b.id, name: b.name, desc: b.desc, count: b.words.length }
    },
    /** 切换词本：目标词本首次进入时初始化其数据 */
    switchBook(id) {
        if (!books.get(id) || books.get(id).id !== id) return false
        write(GLOBAL.CURRENT_BOOK, id)
        this.init()
        return true
    },

    init() {
        if (!read(this._key(K.SETTINGS), null)) write(this._key(K.SETTINGS), Object.assign({}, DEFAULT_SETTINGS))
        if (!read(this._key(K.SRS), null)) write(this._key(K.SRS), {})
        if (!read(this._key(K.LOOKUP), null)) write(this._key(K.LOOKUP), [])
        if (!read(this._key(K.PRIORITY), null)) write(this._key(K.PRIORITY), [])
        if (!read(this._key(K.FAVORITES), null)) write(this._key(K.FAVORITES), [])
        if (!read(this._key(K.STATS), null)) write(this._key(K.STATS), {
            totalLearned: 0, totalReviews: 0, streak: 0, lastActive: ''
        })
        this.migrateIfNeeded()
    },

    /**
     * 数据结构版本迁移：启动时自动执行。
     * 从当前版本逐级升级到 DATA_VERSION，每级只跑一次，全程不删除任何原始数据。
     */
    migrateIfNeeded() {
        let cur = Number(read(GLOBAL.DATA_VERSION, 0))
        if (!Number.isFinite(cur)) cur = 0
        if (cur >= DATA_VERSION) return
        for (let v = cur + 1; v <= DATA_VERSION; v++) {
            const fn = MIGRATIONS[v]
            if (typeof fn === 'function') {
                try { fn.call(this) } catch (e) { console.error('数据迁移 v' + v + ' 失败', e) }
            }
        }
        write(GLOBAL.DATA_VERSION, DATA_VERSION)
    },

    // ---------- 设置 ----------
    getSettings() {
        return Object.assign({}, DEFAULT_SETTINGS, read(this._key(K.SETTINGS), {}))
    },
    saveSettings(s) {
        write(this._key(K.SETTINGS), Object.assign(this.getSettings(), s))
    },

    // ---------- 记忆状态 ----------
    getSrsMap() {
        return read(this._key(K.SRS), {})
    },
    saveSrsMap(m) {
        write(this._key(K.SRS), m)
    },
    getWordState(word) {
        return this.getSrsMap()[word] || null
    },

    /**
     * 是否今天需要复习：已学过、已到期，且不是"今天首次学习"的新词。
     * 今天刚背的新词一律次日再复习（墨墨规则），不当天进入复习队列。
     */
    isDue(word) {
        const st = this.getWordState(word)
        if (!st || !st.learned) return false
        const t = today()
        if ((st.firstLearn || st.lastReview) === t) return false
        return !!st.nextReview && st.nextReview <= t
    },

    /** 评分：0=忘记 1=模糊 2=认识 */
    rateWord(word, rating) {
        const map = this.getSrsMap()
        const now = today()
        let r = map[word] || {
            level: 0, interval: 0, nextReview: now, ease: 2.5,
            lastReview: '', firstLearn: now, reviewCount: 0, correctCount: 0, learned: false
        }
        // 是否首次学习（新词当天第一次评分）
        const isFirstLearn = !r.learned
        // 兼容旧数据：无首次学习日期的按很早处理，避免误标为"今日新学"
        if (!r.firstLearn) r.firstLearn = '1970-01-01'
        r.lastReview = now
        r.reviewCount += 1
        if (rating === 0) {
            r.level = 0
            r.interval = 0
            r.nextReview = now
            r.ease = Math.max(1.3, r.ease - 0.2)
        } else if (rating === 1) {
            r.interval = Math.max(1, Math.floor(r.interval / 2) || 1)
            if (r.level === 0) r.level = 1
            r.nextReview = addDays(now, r.interval)
            r.ease = Math.max(1.3, r.ease - 0.05)
        } else {
            r.level = Math.min(INTERVALS.length - 1, r.level + 1)
            r.interval = INTERVALS[r.level]
            r.ease = Math.min(3.0, r.ease + 0.05)
            r.nextReview = addDays(now, r.interval)
            r.correctCount += 1
        }
        // 新词无论评什么分，都次日再复习，不在当天进入待复习
        if (isFirstLearn && r.nextReview <= now) {
            r.nextReview = addDays(now, 1)
        }
        r.learned = true
        map[word] = r
        this.saveSrsMap(map)

        const st = this.getStats()
        st.totalReviews += 1
        st.totalLearned = Object.values(map).filter(x => x.learned).length
        if (st.lastActive !== now) {
            const diff = st.lastActive ? dayDiff(st.lastActive, now) : 999
            st.streak = (diff === 1) ? st.streak + 1 : 1
            st.lastActive = now
        }
        write(this._key(K.STATS), st)
        return r
    },

    getStats() {
        return read(this._key(K.STATS), { totalLearned: 0, totalReviews: 0, streak: 0, lastActive: '' })
    },

    /**
     * 学习程度分级（依据记忆阶段 level 0~8）
     * 0 新学 / 1 巩固中 / 2 熟悉 / 3 已掌握
     */
    getDegree(level) {
        const lv = Number(level) || 0
        if (lv <= 0) return 0
        if (lv <= 2) return 1
        if (lv <= 4) return 2
        return 3
    },
    getDegreeLabel(level) {
        return ['新学', '巩固中', '熟悉', '已掌握'][this.getDegree(level)]
    },

    /**
     * 取所有已学过的词（含学习程度），供「学习档案」页使用
     * @returns {Array} [{ w, m, p, e, level, degree, degreeLabel, reviewCount,
     *                    correctCount, accuracy, nextReview, lastReview, dueToday, isNewToday }]
     */
    getLearnedWords() {
        const srs = this.getSrsMap()
        const t = today()
        const list = []
        for (const w of Object.keys(srs)) {
            const st = srs[w]
            if (!st || !st.learned) continue
            const info = this.findWord(w) || { w, m: '', p: '', e: '' }
            const degree = this.getDegree(st.level)
            const isNewToday = (st.firstLearn || st.lastReview) === t
            list.push({
                w: info.w || w,
                m: info.m || '', p: info.p || '', e: info.e || '',
                level: st.level || 0,
                degree,
                degreeLabel: ['新学', '巩固中', '熟悉', '已掌握'][degree],
                reviewCount: st.reviewCount || 0,
                correctCount: st.correctCount || 0,
                accuracy: st.reviewCount ? Math.round((st.correctCount || 0) / st.reviewCount * 100) : 0,
                nextReview: st.nextReview || '',
                lastReview: st.lastReview || '',
                // 今天新学的词次日再复习，不算今天待复习
                dueToday: !!st.nextReview && st.nextReview <= t && !isNewToday,
                isNewToday
            })
        }
        // 新学/C程度低在前，其次按复习日期倒序
        list.sort((a, b) => a.degree - b.degree || (b.lastReview || '').localeCompare(a.lastReview || ''))
        return list
    },

    /** 今日新学的词（当天首次学习，level 低且最近复习是今天） */
    getTodayNewWords() {
        return this.getLearnedWords().filter(x => x.isNewToday)
    },

    /** 学习档案统计概览 */
    getProgressStats() {
        const list = this.getLearnedWords()
        const byDegree = [0, 0, 0, 0]
        list.forEach(x => { byDegree[x.degree]++ })
        return {
            total: list.length,
            newCount: byDegree[0],
            consolidating: byDegree[1],
            familiar: byDegree[2],
            mastered: byDegree[3],
            dueCount: list.filter(x => x.dueToday).length
        }
    },

    // ---------- 查词记录与优先级 ----------
    getLookupLog() {
        return read(this._key(K.LOOKUP), [])
    },
    /**
     * 记录一次查词
     * @param {string} word 单词
     * @param {string} source 来源标签：'cet6'|'kaoyan'|'both'|'web'（兼容旧的 'local'|'online'）
     * @param {object} options { addPriority:boolean } 是否加入当前词本优先队列
     */
    recordLookup(word, source, options) {
        const log = this.getLookupLog()
        log.unshift({ word, ts: Date.now(), date: today(), source: source || 'local' })
        write(this._key(K.LOOKUP), log.slice(0, 500))
        const opt = options || {}
        const shouldAdd = (opt.addPriority === undefined) ? true : opt.addPriority
        if (shouldAdd && this.getSettings().autoPriority) this.addPriority(word)
        return log[0]
    },
    /** 清空当前词本的查词记录 */
    clearLookupLog() {
        write(this._key(K.LOOKUP), [])
    },

    // ---------- 收藏 ----------
    /** 取当前词本收藏列表（最新在前） */
    getFavorites() {
        return read(this._key(K.FAVORITES), [])
    },
    /** 判断某词是否已收藏（大小写不敏感） */
    isFavorite(word) {
        const w = String(word || '').trim().toLowerCase()
        if (!w) return false
        return this.getFavorites().some(f => f.w.toLowerCase() === w)
    },
    /**
     * 收藏单词（已存在则不重复添加）
     * @param {object} item { w, m, p, e, source }
     * @returns {boolean} 是否新增
     */
    addFavorite(item) {
        const w = String((item && item.w) || '').trim()
        if (!w) return false
        if (this.isFavorite(w)) return false
        const favs = this.getFavorites()
        favs.unshift({
            w: w,
            m: item.m || '',
            p: item.p || '',
            e: item.e || '',
            source: item.source || '',
            ts: Date.now()
        })
        write(this._key(K.FAVORITES), favs.slice(0, 1000))
        return true
    },
    /** 取消收藏 */
    removeFavorite(word) {
        const w = String(word || '').trim().toLowerCase()
        write(this._key(K.FAVORITES), this.getFavorites().filter(f => f.w.toLowerCase() !== w))
    },
    /** 切换收藏状态，返回当前是否已收藏 */
    toggleFavorite(item) {
        if (this.isFavorite(item.w)) {
            this.removeFavorite(item.w)
            return false
        }
        this.addFavorite(item)
        return true
    },
    /** 清空当前词本收藏 */
    clearFavorites() {
        write(this._key(K.FAVORITES), [])
    },
    getLookupCount(word) {
        return this.getLookupLog().filter(x => x.word === word).length
    },
    getPriorityWords() {
        return read(this._key(K.PRIORITY), [])
    },
    addPriority(word) {
        const p = this.getPriorityWords()
        if (p.indexOf(word) === -1) {
            p.unshift(word)
            write(this._key(K.PRIORITY), p)
        }
    },
    removePriority(word) {
        write(this._key(K.PRIORITY), this.getPriorityWords().filter(w => w !== word))
    },

    // ---------- 每日计划 ----------
    getDailyPlan() {
        const plan = read(this._key(K.DAILY), null)
        if (plan && plan.date === today()) return plan
        return null
    },
    ensureDailyPlan() {
        const existing = this.getDailyPlan()
        if (existing) return existing

        const settings = this.getSettings()
        const srs = this.getSrsMap()
        const priority = this.getPriorityWords()

        const newSet = []
        for (const w of priority) {
            const st = srs[w]
            if ((!st || !st.learned) && newSet.indexOf(w) === -1) newSet.push(w)
            if (newSet.length >= settings.dailyNew) break
        }
        if (newSet.length < settings.dailyNew) {
            // 其余词按考频（词频）从高到低排列：f 越小越常用越先背
            const candidates = this.wordList
                .filter(x => !srs[x.w] || !srs[x.w].learned)
                .filter(x => newSet.indexOf(x.w) === -1)
                .sort((a, b) => (a.f || 99999) - (b.f || 99999))
                .map(x => x.w)
            const picked = candidates.slice(0, settings.dailyNew - newSet.length)
            picked.forEach(w => { if (newSet.indexOf(w) === -1) newSet.push(w) })
        }

        const reviewSet = Object.keys(srs)
            .filter(w => this.isDue(w))
            .sort((a, b) => srs[a].nextReview.localeCompare(srs[b].nextReview))
            .slice(0, settings.dailyReview)

        const plan = {
            date: today(), book: this.currentBookId,
            newWords: newSet, reviewWords: reviewSet,
            doneNew: [], doneReview: []
        }
        write(this._key(K.DAILY), plan)
        return plan
    },
    markDone(type, word) {
        const plan = this.getDailyPlan() || this.ensureDailyPlan()
        const key = type === 'new' ? 'doneNew' : 'doneReview'
        if (plan[key].indexOf(word) === -1) plan[key].push(word)
        write(this._key(K.DAILY), plan)
    },
    rebuildDailyPlan() {
        write(this._key(K.DAILY), null)
        return this.ensureDailyPlan()
    },

    // ---------- 词库查询 ----------
    findWord(word) {
        const w = word.trim().toLowerCase()
        return this.wordList.find(x => x.w.toLowerCase() === w) || null
    },
    searchWords(keyword, limit) {
        const k = keyword.trim().toLowerCase()
        if (!k) return []
        const exact = this.wordList.filter(x => x.w.toLowerCase().indexOf(k) === 0)
        const contains = this.wordList.filter(x => x.w.toLowerCase().indexOf(k) > 0)
        return exact.concat(contains).slice(0, limit || 30)
    },

    /**
     * 跨全部词本查询（查词页用）：标注该词属于哪些词本
     * @returns { found, w, m, p, e, bookIds:[], source, inCurrentBook }
     *   source: 'cet6' | 'kaoyan' | 'both'
     *   信息取所属词本中最完整的一条（优先有例句/音标的）
     */
    lookupAllBooks(word) {
        const w = String(word || '').trim().toLowerCase()
        if (!w) return { found: false }
        const hits = []
        for (const b of books.list) {
            const hit = (b.words || []).find(x => x.w.toLowerCase() === w)
            if (hit) hits.push({ id: b.id, name: b.name, entry: hit })
        }
        if (!hits.length) return { found: false, w: w }

        // 取信息最完整的词条：例句 > 音标 > 释义长度
        const score = e => (e.e ? 4 : 0) + (e.p ? 2 : 0) + Math.min((e.m || '').length / 50, 1)
        let best = hits[0].entry
        for (const h of hits) if (score(h.entry) > score(best)) best = h.entry

        const bookIds = hits.map(h => h.id)
        return {
            found: true,
            w: best.w,
            m: best.m || '',
            p: hits.map(h => h.entry.p).find(Boolean) || best.p || '',
            e: hits.map(h => h.entry.e).find(Boolean) || best.e || '',
            bookIds,
            bookNames: hits.map(h => h.name),
            source: bookIds.length > 1 ? 'both' : bookIds[0],
            inCurrentBook: bookIds.indexOf(this.currentBookId) > -1
        }
    },

    /** 跨词本联想建议（同一单词合并来源标注） */
    searchWordsAll(keyword, limit) {
        const k = String(keyword || '').trim().toLowerCase()
        if (!k) return []
        const map = {}
        for (const b of books.list) {
            for (const x of (b.words || [])) {
                const lw = x.w.toLowerCase()
                const idx = lw.indexOf(k)
                if (idx === -1) continue
                if (!map[lw]) map[lw] = { w: x.w, m: x.m, idx, bookIds: [] }
                if (map[lw].bookIds.indexOf(b.id) === -1) map[lw].bookIds.push(b.id)
            }
        }
        return Object.keys(map)
            .map(lw => map[lw])
            .sort((a, b) => a.idx - b.idx || a.w.length - b.w.length)
            .slice(0, limit || 30)
            .map(x => ({
                w: x.w,
                m: x.m,
                source: x.bookIds.length > 1 ? 'both' : x.bookIds[0]
            }))
    }
}
