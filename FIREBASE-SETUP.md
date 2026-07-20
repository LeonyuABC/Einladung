# Firebase 设置：只做一次

Firebase 网页配置已经写入 `config.js`，项目是 `couple-space-e92ac`。你不需要 Daria 的邮箱，也不需要再设置邮件登录。

现在只需要完成下面三项：

1. 开启“匿名”登录；
2. 确认 Firestore 数据库已经创建；
3. 发布本项目附带的 Firestore Rules。

## 第一步：开启匿名登录

1. 打开 <https://console.firebase.google.com/>；
2. 进入项目 `Couple Space`；
3. 左侧点击 `Authentication`；
4. 打开顶部的“登录方法”（Sign-in method）；
5. 在登录服务商列表中找到“匿名”（Anonymous）；
6. 点击“匿名”；
7. 打开“启用”开关；
8. 点击“保存”。

以前开启的“电子邮件/密码”可以保留，也可以关闭。新版代码完全不会使用邮件登录。

## 第二步：确认 Firestore 已创建

1. Firebase 左侧进入 `Firestore Database`；
2. 如果已经能看到“数据 / 规则 / 索引”等页面，说明数据库已经创建，直接进入第三步；
3. 如果出现“创建数据库”，点击它；
4. 选择生产模式（Production mode）；
5. 选择离你们较近的区域；
6. 完成创建。

不需要手动建立 `plans`、`invitations` 等集合。第一次保存数据时，网站会自动创建。

## 第三步：发布安全规则

1. 用 IntelliJ IDEA 打开本项目的 `firestore.rules`；
2. 全选并复制文件里的全部内容；
3. Firebase Console 进入 `Firestore Database → 规则`；
4. 删除规则编辑器里现有的全部内容；
5. 粘贴 `firestore.rules` 的完整内容；
6. 点击“发布”。

新版规则允许已经由 Firebase 建立匿名会话的浏览器访问 `yaoyu-daria` 这个共同空间，并拒绝其他 Firestore 路径。

## 第四步：先在本机测试

不要直接双击 `index.html` 使用 `file://` 打开。

1. 在 IntelliJ IDEA 打开整个 `couple-space-anonymous-pin` 文件夹；
2. 右键 `index.html`；
3. 选择 `Open In → Browser`；
4. 等页面显示 `Bereit – wähle deine Person.`；
5. 选择 Yaoyu；
6. 输入 PIN `029`；
7. 新建一个测试计划；
8. 确认顶部显示 `Synchronisiert`。

可以再用同一台电脑的无痕窗口测试 Daria：

1. 打开同一个 localhost 地址；
2. 选择 Daria；
3. 输入 PIN `1016`；
4. 检查刚才的测试计划是否自动出现；
5. 添加一个反应，检查第一个窗口是否实时更新。

## 第五步：发布给 Daria 使用

`localhost` 只能在你的电脑上打开。真正跨设备同步需要你们访问同一个公开网站地址。

最简单的是 GitHub Pages：

1. 把本文件夹中的所有文件上传到 GitHub 仓库根目录；
2. 仓库进入 `Settings → Pages`；
3. Source 选择 `Deploy from a branch`；
4. Branch 选择 `main`，文件夹选择 `/ (root)`；
5. 保存并等待 GitHub 显示公开网址；
6. 你和 Daria 打开同一个网址；
7. 你选择 Yaoyu + `029`；
8. Daria 选择 Daria + `1016`。

如果 Firebase 报告当前域名未授权：

1. Firebase 进入 `Authentication → 设置 → 已获授权的网域`；
2. 添加 `你的GitHub用户名.github.io`；
3. 不要填写 `https://`，也不要填写仓库路径。

## 最终检查

分别在两个窗口或两台设备完成：

- Yaoyu 新建计划，Daria 自动看到；
- Daria 添加反应，Yaoyu 自动看到；
- Yaoyu 创建邀请，Daria 在邀请页面点击“Antworten”；
- Daria 保存回答，Yaoyu 自动看到；
- 双方分别写日记评价；
- 双方分别对愿望作出反应；
- 刷新页面后数据仍然存在。

## 常见问题

### 显示“Anonyme Anmeldung ist ... noch nicht aktiviert”

说明第一步没有保存成功。回到 `Authentication → 登录方法 → 匿名`，启用并保存。

### 能进入网站，但顶部显示同步失败

最常见原因是第三步的 `firestore.rules` 没有发布，或 Firestore Database 还没有创建。

### Daria 打不开 localhost

这是正常的。localhost 不是公开网站。先完成 GitHub Pages 发布，然后把 GitHub Pages 网址发给她。

### Daria 是否需要邮箱或 Firebase 项目？

不需要。她只需要打开你发布的网址，选择 Daria，输入 `1016`。

### 为什么还叫“匿名登录”？

这是 Firebase 在后台给每个浏览器创建一个临时身份，用来允许 Firestore 联网读写。网页不会显示注册页面，也不会发送邮件。对你们来说，看到的仍然只是“选择人 + PIN”。
