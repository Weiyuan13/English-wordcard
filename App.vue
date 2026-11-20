<script>
export default {
    onLaunch() {
        // App 启动时初始化本地数据库
        const store = require('./common/store.js').default
        store.init()
    }
}
</script>

<style>
/* 全局样式 */
page {
    background-color: #F5F6F8;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #1A1D24;
}
</style>
