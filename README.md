# Couple Space：匿名联网 + PIN 版

这是 Yaoyu 和 Daria 共用的实时同步情侣空间。网页仍然是普通 HTML、CSS 和原生 JavaScript，不需要新的编译器、Node.js、Java 后端或自己租服务器。

## 最重要的变化

- 不需要 Yaoyu 的邮箱；
- 不需要 Daria 的邮箱；
- 不发送登录邮件；
- 打开网站后直接选择 `Yaoyu` 或 `Daria`；
- Yaoyu 的 PIN：`029`；
- Daria 的 PIN：`1016`；
- Firebase 在后台自动建立匿名会话；
- Firestore 保存共同数据，并把修改实时同步到另一台设备；
- 网站里的邀请直接同步，不再要求发送邀请链接或邮件；
- 暂时不上传照片。

第一次运行前，请严格按照 [FIREBASE-SETUP.md](FIREBASE-SETUP.md) 完成 Firebase 后台的三个设置。

## 使用流程

```text
打开同一个公开网站
        ↓
后台自动连接 Firebase（无需操作）
        ↓
选择 Yaoyu / Daria
        ↓
输入对应 PIN
        ↓
计划、邀请、日记和愿望自动保存到 Firestore
        ↓
另一台设备实时收到修改
```

Daria 不需要 Firebase 账号，也不需要创建 Firebase 项目。只有你作为项目管理者需要设置一次 Firebase。

## 已实现功能

- Yaoyu / Daria 选择界面和各自 PIN；
- Firebase 匿名身份验证；
- 跨手机、电脑和浏览器的 Firestore 实时同步；
- 共同邀请，以及对邀请的站内回复；
- 月历、计划和双方反应；
- 活动日记、双方评价与文字感想；
- 愿望清单、Perfect Match、转计划与转邀请；
- JSON 数据导出、导入与清空；
- 本地界面缓存；
- 手机和电脑响应式布局。

## 项目文件

```text
couple-space-anonymous-pin/
├── index.html
├── style.css
├── config.js
├── firestore.rules
├── FIREBASE-SETUP.md
├── README.md
└── js/
    ├── app.js
    ├── cloud.js
    ├── storage.js
    ├── share.js
    ├── identity.js
    ├── invitation.js
    ├── calendar.js
    ├── diary.js
    ├── wishlist.js
    └── backup.js
```

## 数据保存位置

共同数据保存在你的 Firebase 项目 `couple-space-e92ac` 中：

```text
couples/yaoyu-daria/invitations/{id}
couples/yaoyu-daria/plans/{id}
couples/yaoyu-daria/diaryEntries/{id}
couples/yaoyu-daria/wishlistItems/{id}
```

浏览器中的 `coupleSpaceCloudCacheV1` 只是缓存。网页顶部显示 `Synchronisiert`，才表示已经成功连接 Firestore。

## 本地测试与真正的双设备使用

在 IntelliJ IDEA 中右键 `index.html`，通过浏览器打开，可以在 `localhost` 测试。但 `localhost` 只能你自己的电脑访问。

要让 Daria 在她的设备上使用，必须把文件发布到 GitHub Pages 或 Firebase Hosting。最简单的是继续使用 GitHub Pages：

1. 把本文件夹里的内容上传到 GitHub 仓库根目录；
2. GitHub 仓库进入 `Settings → Pages`；
3. 选择 `Deploy from a branch`；
4. 选择 `main` 和 `/ (root)`；
5. 等待生成公开的 HTTPS 网址；
6. 你和 Daria 打开完全相同的网址；
7. 你选择 Yaoyu，她选择 Daria。

不需要构建或编译。

## PIN 的安全边界

这个版本的 PIN 是你要求的“稍微有意思、简单挡一下”的入口。因为网站是静态前端，熟悉网页代码的人仍然能查看或绕过 PIN。Firestore 规则要求访问者先获得 Firebase 匿名会话，但它不能证明匿名访问者到底是 Yaoyu 还是 Daria。

因此：

- 只把网站网址发给 Daria；
- 不要把 GitHub 仓库或网址公开宣传；
- 不要在里面保存银行卡、证件、密码等敏感信息；
- 如果未来需要真正严格的身份权限，再增加正式账号登录或服务器端 PIN 验证。

## 修改 PIN

打开 `config.js`，修改：

```js
users: {
    Yaoyu: { pin: "029", avatar: "Y" },
    Daria: { pin: "1016", avatar: "D" }
}
```

保存并重新上传网站文件即可。

## 旧数据迁移

如果旧版已经有计划或日记：

1. 在旧版的设置页面导出 JSON；
2. 打开新版，选择身份并输入 PIN；
3. 进入 `Einstellungen & Backup`；
4. 导入旧 JSON；
5. 等待顶部显示 `Synchronisiert`；
6. 在另一台设备刷新并检查数据。

## 已知边界

- 必须联网才能确认双方已经同步；
- 同一个字段被两个人几乎同时修改时，最后成功写入的值可能成为最终值；
- 删除共同记录会同步到两台设备；
- 暂不支持照片上传；
- 不再包含邮件发送功能。
