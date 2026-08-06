# Couple Space – Start, Kalender, Tagebuch und Unsere Ideen

这是 Yaoyu 与 Daria 共用的 Firebase 实时同步情侣空间。项目继续使用原生 HTML、CSS、JavaScript、Firebase Anonymous Auth、Firestore、GitHub Pages 和 PWA，不需要 React、Java 后端、Node.js 构建或其他平台。

## 三个主页面

1. `Start & Kalender`
   - 60 条中文/乌克兰语双语情话，每 5 秒自动切换，也可用上下三角手动翻页；
   - 从 2026 年 7 月 19 日开始计算在一起的天数；
   - Yaoyu 与 Daria 的每日心情、扩展 Emoji 和文字状态；
   - 心情只能填写今天或过去，计划可以填写过去、今天和未来；
   - 共同大日历每个日期显示 Yaoyu、Daria 和当天安排；
   - 普通计划使用薄荷绿色，从 `Unsere Ideen` 同步的项目使用暖黄色；
   - 同一天多个项目显示 `+1`、`+2` 等数量。

2. `Tagebuch`
   - 保留原来的日记、活动回忆、双方评价和感想；
   - 原有 `diaryEntries` 数据结构不变。

3. `Unsere Ideen`
   - 合并原来的 Einladung 和 Wunschliste；
   - 支持想法、愿望、邀请、旅行、活动、惊喜、吃饭和居家安排；
   - 支持 Emoji、标题、说明、自由预算、未定日期或确定日期；
   - 确定日期后自动显示在首页大日历；
   - 双方可选择接受、待定、拒绝或建议其他时间；
   - 支持评论和评论 Emoji；
   - 双方都可以编辑、取消日期或删除。

## 通知规则

- 每个人最多保留最近 20 条；
- 超过 7 天自动清理；
- 清理会同步到 Firestore，不只是界面隐藏。

## 旧数据兼容

新版继续使用原来的 Firebase 集合：

```text
couples/yaoyu-daria/invitations/{id}
couples/yaoyu-daria/plans/{id}
couples/yaoyu-daria/diaryEntries/{id}
couples/yaoyu-daria/wishlistItems/{id}
couples/yaoyu-daria/moods/{date-person}
couples/yaoyu-daria/notifications/{id}
```

因此覆盖网站代码不会清空 Firestore：

- 原来的 `plans` 会继续显示，旧的 `activity`、`note`、`time` 和 `reactions` 字段都兼容；
- 原来的心情 Emoji、文字状态和备注继续显示，包括新版列表中没有的旧选项；
- 原来的日记保持不变；
- 原来的 `wishlistItems` 会自动作为 `Unsere Ideen` 读取；
- 原来的 `invitations` 集合不会被删除，只是不再作为单独页面显示。

部署前仍建议先在旧版 `Einstellungen & Backup` 中导出一次 JSON 备份。

## Firebase 是否需要重新配置

不需要新建 Firebase 项目，也不需要清空数据库或更换 `coupleId`。

压缩包中的 `config.js` 已保留原 Firebase Web 配置和 PIN。只要你继续部署到原 GitHub Pages 仓库，直接覆盖代码即可。

`firestore.rules` 仍然使用原来的六个集合，没有新增集合。如果你当前 Firebase 已经发布过原规则，不必重新配置；不确定时，可以把压缩包内 `firestore.rules` 的内容重新发布一次。

详细升级步骤见 [UPGRADE.md](UPGRADE.md)。Firebase 初次配置说明见 [FIREBASE-SETUP.md](FIREBASE-SETUP.md)。

## 项目结构

```text
Einladung/
├── index.html
├── style.css
├── config.js
├── firestore.rules
├── manifest.webmanifest
├── service-worker.js
├── README.md
├── UPGRADE.md
├── FIREBASE-SETUP.md
├── icons/
└── js/
    ├── app.js
    ├── backup.js
    ├── calendar.js
    ├── cloud.js
    ├── diary.js
    ├── ideas.js
    ├── identity.js
    ├── invitation.js
    ├── mood.js
    ├── quotes.js
    ├── share.js
    ├── storage.js
    └── wishlist.js
```

`invitation.js` 与 `wishlist.js` 仅保留用于兼容旧分享链接和旧项目，不再出现在主导航中。
