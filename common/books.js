/**
 * 词本注册中心
 * 每个词本：id / name / 词库数据 / 简介
 * 新增词本只需在此注册词库文件，并在 store.js 无额外改动（存储按 id 自动隔离）
 */
import cet6 from './words.js'
import kaoyan from './words-kaoyan.js'

export default {
    list: [
        {
            id: 'cet6',
            name: '六级词汇',
            desc: '大学英语六级核心词',
            words: cet6
        },
        {
            id: 'kaoyan',
            name: '考研词汇',
            desc: '全国硕士研究生入学考试词',
            words: kaoyan
        }
    ],

    get(id) {
        return this.list.find(b => b.id === id) || this.list[0]
    },

    getWords(id) {
        return this.get(id).words
    },

    getName(id) {
        return this.get(id).name
    }
}
