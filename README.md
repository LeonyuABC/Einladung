# Couple Space

Couple Space 是一个固定供 Yaoyu 和 Daria 使用的纯静态情侣工具网站。项目只使用 HTML、CSS、原生 JavaScript、浏览器 `localStorage` 和可选的 FormSubmit 邮件通知；没有数据库、后端、构建步骤或第三方前端库。

## 已实现功能

- 本地身份选择与无损切换；
- 开放选择邀约和具体想法邀约；
- 邀约回应链接及可选 FormSubmit 邮件通知；
- 原生 JavaScript 月历、计划创建和双方反应；
- 活动日记、双方评价和文字感想；
- 愿望清单、Perfect Match、转计划和转邀约；
- 计划、日记、愿望的分享、回应和按 ID 合并；
- 分享冲突时选择保留本地版本或采用分享版本；
- JSON 数据导出、导入和本地数据二次确认删除；
- 手机与电脑响应式界面、键盘焦点样式和页面内提示。

## 文件结构

```text
couple-space/
├── index.html
├── style.css
├── config.js
├── js/
│   ├── app.js
│   ├── storage.js
│   ├── share.js
│   ├── identity.js
│   ├── invitation.js
│   ├── calendar.js
│   ├── diary.js
│   ├── wishlist.js
│   └── backup.js
└── README.md
```

## 在 IntelliJ IDEA 中运行

1. 解压 ZIP。
2. 在 IntelliJ IDEA 中选择 `File` → `Open`，打开整个 `couple-space` 文件夹。
3. 在项目栏中右键 `index.html`。
4. 选择 `Open In` → `Browser`，或点击编辑器右上角的浏览器图标。
5. 正常地址类似 `http://localhost:63342/couple-space/index.html`。

不要双击 `index.html` 直接用 `file://` 打开。项目使用 ES Modules，浏览器通常会限制 `file://` 页面之间的模块加载；邮件接口也可能因本地文件来源和跨域规则而失败。IntelliJ IDEA 自带的本地网页服务器即可运行，无需安装其他软件。

## 配置 FormSubmit 邮件

唯一需要手动修改的配置位于 `config.js`：

```js
export const CONFIG = {
    formSubmitEndpoint: "FORM_SUBMIT_ENDPOINT_HERE"
};
```

把占位文字替换成已经激活、可以使用 AJAX 的 FormSubmit endpoint，例如隐藏标识形式的地址。不要把地址重复写入其他 JavaScript 文件。

未配置时，回应页面会自动隐藏邮件按钮，并提示使用回应链接。邮件只发送当前邀约回应的必要字段，不会发送完整 `localStorage`。发送有 15 秒超时和失败恢复，不能替代数据保存或同步。

如果使用公开邮箱形式的 endpoint，邮箱会出现在网站源代码中。更推荐 FormSubmit 提供的隐藏标识。

## 上传到 GitHub Pages

1. 新建 GitHub 仓库，把 `couple-space` 内的全部文件上传到仓库根目录；不要只上传 `index.html`。
2. 在仓库中打开 `Settings` → `Pages`。
3. 在 `Build and deployment` 下选择 `Deploy from a branch`。
4. 选择包含代码的分支，例如 `main`，目录选择 `/ (root)` 并保存。
5. 等待 GitHub 给出 Pages 地址后打开网站。

项目所有文件路径都是相对路径，分享链接基于当前网页地址生成，因此可以部署在 `https://用户名.github.io/仓库名/` 这样的子目录中。

## 数据和同步限制

所有本地数据统一保存在当前浏览器的 `coupleSpaceDataV1` 中：

- Yaoyu 在自己的浏览器创建的数据不会自动出现在 Daria 的设备；
- 切换身份只是在同一浏览器内模拟两个人，不是真正账号登录；
- 两台设备之间需要发送“分享链接”或“回应链接”；
- 对方打开链接后，必须确认才会保存到对方自己的浏览器；
- 同一条记录通过 ID 合并，不会直接清空或覆盖其他数据；
- 浏览器数据被清除后，本地记录也会消失，所以应定期导出备份；
- 网站没有实时同步、数据库、照片上传、云端图片、密码或真实账号。

照片没有被编码进分享链接：图片体积很容易让 URL 超长，也不适合保存到 `localStorage`。日记使用 Emoji、标题、简短描述、心情和文字感想代替照片。

## 用分享链接交换数据

1. 在任一模块创建内容。
2. 点击分享按钮。
3. 手机支持系统分享菜单时会直接打开；其他情况下会尝试复制链接。
4. 如果剪贴板权限被拒绝，页面会显示只读文本框供手动复制。
5. 对方打开链接后先选择自己的本地身份。
6. 页面会显示来源、类型和内容摘要；确认后才保存。
7. 对方填写反应或评价，再生成回应链接发回。
8. 创建者打开回应链接，按 ID 合并反应或评价。

分享数据会经过类型、日期、身份和文字长度检查。用户输入只通过 `textContent` 或表单值显示，不作为 HTML 执行。

## 导出和导入备份

在首页底部进入 `Einstellungen & Backup`：

- `Daten exportieren` 下载类似 `couple-space-backup-2026-07-20.json` 的文件；
- `Daten importieren` 选择之前导出的 JSON，并确认替换当前浏览器中的全部本地数据；
- 无效文件不会破坏已有数据；
- `Alle lokalen Daten löschen` 需要连续两次确认，并且只删除当前浏览器的数据。

FormSubmit 配置不会包含在备份中。

## 手动测试清单

### 身份

1. 第一次打开选择 Yaoyu。
2. 刷新，确认身份仍然是 Yaoyu。
3. 切换到 Daria，确认已有数据没有消失。

### 邀约

1. Yaoyu 创建 `Gemeinsam auswählen` 邀约并复制链接。
2. 在无痕窗口打开链接，选择 Daria。
3. 完成日期、时间、活动和其他活动文字。
4. 生成回应链接并发回普通窗口。
5. Yaoyu 打开回应链接，保存到本地邀请列表。
6. 点击 `Als Plan speichern`，确认计划表单被预填。
7. 再测试 `Konkrete Idee` 的三种回应。
8. 配置 FormSubmit 后测试邮件成功；临时填错 endpoint，确认失败后按钮恢复。

### 计划

1. 新建计划，确认日期上出现 Emoji 和数量。
2. 点击上月和下月，检查跨年和闰年月份。
3. Yaoyu 选择爱心，切换 Daria 再选择爱心。
4. 确认出现 `Von euch beiden bestätigt`。
5. 分享计划，在另一个浏览器保存、反应并生成回应链接。
6. 在原浏览器打开回应链接，确认按同一个 `plan.id` 合并且不重复创建。

### 日记

1. 创建多个不同月份的日记，确认时间线从新到旧并按月分组。
2. 两个身份分别添加和修改评价。
3. 分享日记，在另一个浏览器添加评价并生成回应链接。
4. 合并回应，确认双方评价都显示。
5. 确认界面没有照片上传功能。

### 愿望

1. 创建愿望，两个身份分别选择爱心。
2. 确认显示 `Perfect Match`。
3. 点击转成计划，检查预填内容。
4. 点击创建邀请，检查具体邀约表单预填。
5. 分享愿望，在另一浏览器反应并合并回应。

### 备份与安全

1. 创建一些数据并导出 JSON。
2. 二次确认删除全部本地数据。
3. 导入刚才的 JSON，检查所有模块恢复。
4. 尝试导入普通文本、错误版本 JSON 和缺字段 JSON，确认原数据不变。
5. 修改分享链接中的 `data` 参数，确认页面显示友好错误而不是崩溃。

## 说明

这是无需编译和构建的静态项目。项目运行本身不需要 Java、Maven、Node.js、npm、数据库或额外开发工具。
