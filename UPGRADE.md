# 从当前线上版本升级

## 1. 先备份

在当前线上网站中进入：

```text
Einstellungen & Backup → Daten exportieren
```

保存下载的 JSON。正常升级不会删除数据，但备份可以防止误操作。

## 2. 不要修改 Firebase 项目

继续使用现在的 Firebase 项目：

```text
projectId: couple-space-e92ac
coupleId: yaoyu-daria
```

不要新建数据库，不要点击网站中的“Alle gemeinsamen Daten löschen”，也不要导入空 JSON。

## 3. 覆盖 GitHub 仓库文件

把新版压缩包中 `Einladung` 文件夹里的内容上传到原 GitHub 仓库根目录，覆盖旧文件。

必须一起上传：

- `index.html`
- `style.css`
- `js/` 整个文件夹
- `service-worker.js`
- `manifest.webmanifest`
- `icons/`

`config.js` 已保留当前配置。上传前可以再次确认其中仍是你原来的 Firebase 参数和 PIN。

## 4. Firestore Rules

新版没有增加新的 Firestore 集合，仍然只使用：

- invitations
- plans
- diaryEntries
- wishlistItems
- moods
- notifications

因此已经发布过原规则时，不需要重新配置。若 Firebase Console 中的规则与压缩包不同，可把 `firestore.rules` 全部复制到：

```text
Firebase Console → Firestore Database → Rules → Publish
```

## 5. 等待 GitHub Pages 部署

GitHub Actions 或 Pages 显示部署成功后：

1. 电脑浏览器按 `Ctrl + F5`；
2. 手机上完全关闭旧 PWA 后重新打开；
3. 仍显示旧界面时，删除主屏幕上的旧 PWA，再从浏览器重新添加；
4. 等顶部显示 `Synchronisiert` 后检查数据。

## 6. 升级后检查

请依次确认：

- 原来的 3 条 Plan 仍出现在共同大日历；
- 原来的每日心情和星星/Emoji 记录仍显示；
- Tagebuch 原有内容仍在；
- `Unsere Ideen` 当前为空是正常的，因为你目前的 Wunsch 与 Einladung 已经清零；
- 新增一个测试计划后，另一台设备能够实时看到；
- 新增一条带日期的 Idee 后，它在日历中显示为黄色。

## 数据兼容说明

第一次编辑旧计划时，新版会在原记录上补充新版字段，但会保留旧反应字段。旧心情中的自定义 Emoji 和旧文字状态不会因为新版选项列表变化而消失。
