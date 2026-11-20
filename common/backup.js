/**
 * 数据备份与恢复（本地全量快照）
 *
 * 设计原则：
 * 1. 全量导出：通过 getStorageInfoSync 抓取所有本地键，不遗漏任何词本/任何模块数据。
 * 2. 安全导入：默认"合并覆盖"（只覆盖备份里出现的键），不清空现有技术数据；
 *    format 严格校验，格式不对绝不写入。
 * 3. 导入后自动触发 store 的数据版本迁移，旧版本备份也能平滑升级。
 * 4. 不依赖第三方库；App 端可选文件系统，H5/小程序端用剪贴板同样可用。
 */
import store from './store.js'

const TAG = 'cet6-word-backup'
const FORMAT_VERSION = 1          // 备份文件格式版本
const BACKUP_PREFIX = 'cet6words_backup_'  // 本地备份文件名前缀

/** 读取全部本地存储键值 */
function readAllStorage() {
    const data = {}
    let keys = []
    try {
        keys = (uni.getStorageInfoSync() || {}).keys || []
    } catch (e) {
        console.error('读取存储键列表失败', e)
        return data
    }
    for (const k of keys) {
        try {
            const v = uni.getStorageSync(k)
            if (v !== '' && v !== null && v !== undefined) data[k] = v
        } catch (e) { /* 单个键读取失败则跳过 */ }
    }
    return data
}

/** 生成备份快照对象（未序列化） */
export function buildSnapshot() {
    return {
        tag: TAG,
        formatVersion: FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        appid: '__UNI__D4B2027',
        data: readAllStorage()
    }
}

/** 生成备份 JSON 字符串 */
export function toJSON() {
    return JSON.stringify(buildSnapshot())
}

/** 校验备份对象格式，返回 {ok, msg, info} */
export function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return { ok: false, msg: '备份内容不是有效的对象' }
    }
    if (obj.tag !== TAG) {
        return { ok: false, msg: '这不是本 App 的备份文件' }
    }
    if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) {
        return { ok: false, msg: '备份数据体损坏' }
    }
    const keys = Object.keys(obj.data)
    if (!keys.length) {
        return { ok: false, msg: '备份文件中没有任何数据' }
    }
    return {
        ok: true,
        msg: '',
        info: {
            exportedAt: obj.exportedAt || '',
            formatVersion: obj.formatVersion || 0,
            keyCount: keys.length
        }
    }
}

/**
 * 从 JSON 字符串恢复数据
 * @param {string} jsonStr 备份 JSON 文本
 * @param {object} options { mode: 'merge' | 'replace' }
 *        merge（默认）：覆盖备份里出现的键，保留其余现有数据，最安全
 *        replace：先清空全部现有键再写入，用于完整还原到备份时间点
 * @returns {object} { ok, msg, importedKeys }
 */
export function importFromJSON(jsonStr, options) {
    const opt = options || {}
    const mode = opt.mode === 'replace' ? 'replace' : 'merge'
    let obj
    try {
        obj = JSON.parse(jsonStr)
    } catch (e) {
        return { ok: false, msg: 'JSON 解析失败，文件可能不完整或被改写', importedKeys: 0 }
    }
    const v = validate(obj)
    if (!v.ok) return { ok: false, msg: v.msg, importedKeys: 0 }

    const keys = Object.keys(obj.data)
    try {
        if (mode === 'replace') {
            // 清空现有全部键（校验已通过，此处才允许清空）
            const cur = (uni.getStorageInfoSync() || {}).keys || []
            for (const k of cur) {
                try { uni.removeStorageSync(k) } catch (e) { /* 忽略 */ }
            }
        }
        for (const k of keys) {
            try { uni.setStorageSync(k, obj.data[k]) } catch (e) { /* 忽略 */ }
        }
        // 补齐缺失的默认键并执行数据结构版本迁移
        store.init()
        return { ok: true, msg: '恢复成功，共导入 ' + keys.length + ' 项数据', importedKeys: keys.length }
    } catch (e) {
        return { ok: false, msg: '写入数据失败：' + (e && e.message || e), importedKeys: 0 }
    }
}

/** 复制备份文本到剪贴板（跨端通用） */
export function copyToClipboard(text) {
    return new Promise((resolve) => {
        uni.setClipboardData({
            data: text,
            success: () => resolve({ ok: true, msg: '已复制，可粘贴到微信/备忘录保存' }),
            fail: () => resolve({ ok: false, msg: '复制失败，请改用保存到文件' })
        })
    })
}

/** 从剪贴板读取文本（跨端通用） */
export function readFromClipboard() {
    return new Promise((resolve) => {
        uni.getClipboardData({
            success: (res) => resolve({ ok: true, text: res.data || '' }),
            fail: () => resolve({ ok: false, text: '', msg: '读取剪贴板失败' })
        })
    })
}

/** 运行环境是否支持本地文件系统（App 端 plus 可用） */
function hasFileSystem() {
    return typeof plus !== 'undefined' && plus.io && typeof plus.io.resolveLocalFileSystemURL === 'function'
}

/** 获取本地备份目录 URL：优先公共下载目录（用户可在文件管理器找到） */
function getBackupDirUrl() {
    if (typeof plus.io.PUBLIC_DOWNLOADS === 'string') return plus.io.PUBLIC_DOWNLOADS
    if (typeof plus.io.PRIVATE_DOC === 'string') return plus.io.PRIVATE_DOC
    return ''
}

/** 把备份文本保存到本地文件（仅 App 端） */
export function saveToFile(text) {
    return new Promise((resolve) => {
        if (!hasFileSystem()) {
            resolve({ ok: false, msg: '当前环境不支持保存到文件，请用复制文本方式' })
            return
        }
        const dirUrl = getBackupDirUrl()
        if (!dirUrl) {
            resolve({ ok: false, msg: '未找到可用的备份目录' })
            return
        }
        const d = new Date()
        const p = n => String(n).padStart(2, '0')
        const name = BACKUP_PREFIX + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
            '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.json'
        plus.io.resolveLocalFileSystemURL(dirUrl, (dirEntry) => {
            dirEntry.getFile(name, { create: true, exclusive: false }, (fileEntry) => {
                fileEntry.createWriter((writer) => {
                    writer.onwriteend = () => resolve({ ok: true, msg: '已保存到下载目录：' + name, path: fileEntry.fullPath, name })
                    writer.onerror = () => resolve({ ok: false, msg: '写入文件失败' })
                    writer.write(text)
                }, () => resolve({ ok: false, msg: '创建文件写入器失败' }))
            }, () => resolve({ ok: false, msg: '创建备份文件失败' }))
        }, () => resolve({ ok: false, msg: '打开备份目录失败，请检查存储权限' }))
    })
}

/** 列出本地已有备份文件（仅 App 端），按时间倒序 */
export function listLocalFiles() {
    return new Promise((resolve) => {
        if (!hasFileSystem()) {
            resolve({ ok: true, files: [] })
            return
        }
        const dirUrl = getBackupDirUrl()
        if (!dirUrl) { resolve({ ok: true, files: [] }); return }
        plus.io.resolveLocalFileSystemURL(dirUrl, (dirEntry) => {
            const reader = dirEntry.createReader()
            reader.readEntries((entries) => {
                const files = []
                for (const e of entries) {
                    if (e.isFile && e.name.indexOf(BACKUP_PREFIX) === 0 && e.name.slice(-5) === '.json') {
                        files.push({ name: e.name, path: e.fullPath })
                    }
                }
                files.sort((a, b) => b.name.localeCompare(a.name))
                resolve({ ok: true, files })
            }, () => resolve({ ok: true, files: [] }))
        }, () => resolve({ ok: true, files: [] }))
    })
}

/** 读取指定本地备份文件内容（仅 App 端） */
export function readLocalFile(path) {
    return new Promise((resolve) => {
        if (!hasFileSystem() || !path) {
            resolve({ ok: false, text: '', msg: '当前环境不支持读取文件' })
            return
        }
        plus.io.resolveLocalFileSystemURL(path, (fileEntry) => {
            fileEntry.file((file) => {
                const reader = new plus.io.FileReader()
                reader.onloadend = () => resolve({ ok: true, text: String(reader.result || '') })
                reader.onerror = () => resolve({ ok: false, text: '', msg: '读取文件内容失败' })
                reader.readAsText(file, 'utf-8')
            }, () => resolve({ ok: false, text: '', msg: '打开文件失败' }))
        }, () => resolve({ ok: false, text: '', msg: '找不到该备份文件' }))
    })
}

/** 数据量摘要（供设置页展示） */
export function getDataSummary() {
    const data = readAllStorage()
    let learned = 0, lookups = 0, favorites = 0
    for (const k of Object.keys(data)) {
        if (k.endsWith('_srs')) {
            const m = data[k]
            if (m && typeof m === 'object') learned += Object.keys(m).filter(w => m[w] && m[w].learned).length
        } else if (k.endsWith('_lookup_log')) {
            if (Array.isArray(data[k])) lookups += data[k].length
        } else if (k.endsWith('_favorites')) {
            if (Array.isArray(data[k])) favorites += data[k].length
        }
    }
    return {
        keyCount: Object.keys(data).length,
        learned,
        lookups,
        favorites,
        approxKB: Math.round(JSON.stringify(data).length / 1024)
    }
}

export default {
    buildSnapshot, toJSON, validate, importFromJSON,
    copyToClipboard, readFromClipboard,
    saveToFile, listLocalFiles, readLocalFile,
    getDataSummary,
    FORMAT_VERSION, TAG
}
