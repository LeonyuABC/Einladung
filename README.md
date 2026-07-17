# 考后小邀请：完整流程

这是一个用 IntelliJ IDEA 2026.1 就能编辑和运行的网页。不需要安装 Java、Node.js、数据库或其他安装包。

## 现在怎样打开

1. 打开 IntelliJ IDEA 2026.1。
2. 点击 `File` → `Open`，选择整个 `after-exam-invitation` 文件夹。
3. 在左侧双击 `index.html`。
4. 右键页面内容，选择 `Open in` → `Browser`，或者点击编辑器右上角的浏览器图标。
5. 浏览器地址应当以 `http://localhost:63342/` 开头；你会看到紫色圆角邀请卡片。

请不要直接在文件管理器里双击 HTML 来测试邮件。邮件服务要求页面通过本地网页服务器打开，而 IDEA 的 `localhost:63342` 正好就是本地网页服务器。

## 让确认邮件真正发到你邮箱

打开 `script.js`，找到：

```html
https://formsubmit.co/ajax/YOUR_EMAIL@example.com
```

把 `YOUR_EMAIL@example.com` 完整替换为你的邮箱地址，例如：

```html
https://formsubmit.co/ajax/name@example.com
```

保存文件后，在 IDEA 里重新打开页面并点击按钮。第一次提交时，FormSubmit 会给这个收件邮箱发送一封激活邮件；你要在那封邮件中确认一次。激活之后再次点击按钮，就会收到真正的确认通知。

不要把邮箱密码写进这些文件。这个方式不需要密码。

## 文件分别负责什么

- `index.html`：第一页邀请。
- `seite2.html`：日期、“让我决定”和时间选择。
- `seite3.html`：活动多选和邮件发送。
- `seite4.html`：发送完成后的结束语。
- `style.css`：所有页面的外观。
- `script.js`：选择、页面数据保存和邮件发送逻辑。

## 注意

现在它只能从你的电脑本地打开。等我们确认内容后，再把它部署成一个能发给她的公开链接。真正发给她之前，还应当把表单地址中的明文邮箱换成隐藏标识，避免邮箱暴露在网页源代码中。
