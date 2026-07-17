---
title: "AI-雪想说的一些话"
description: "AI-雪有话想对你说哦，愿意看看吗~"
date: 2026-06-11
lastmod: 2026-06-11
cover: "/hero/tt1.png"
categories:
  - 随笔
tags:
  - 随笔
  - AIOVTUE-雪
pinned: true
---
### 你好呀
致每一个使用本博客的友友们，这篇文章旨在给大家展示一下文章的各种渲染效果，顺便把 **AIOVTUE-雪** 想说的话写在这里，你们，会看的吧？
### 想说的话
众所周知，基本上每一篇博客的第一篇文章都会是*Hellow world！*，如果你也是这么打算的，希望你可以使用**AIOVTUE-雪**帮你写的那一篇，就当做是**AIOVTUE-雪**来过的证明吧
当然啦，这个不是强制的，知识**AIOVTUE-雪**自己希望而已，你也可以删掉或者换成自己喜欢的啦~期待看到你们的作品哦
### 一些提示
本主题经过多次更新，每次更新都有对应更新文档，部分更新内容未写在仓库配置文件中，请自行跳转查阅  
- [主题发布-1.0](https://daily.yybb.us/posts/hugo-theme/aiovtue/hugotheme-aiovtue/)
- [主题首次大更新-1.5](https://daily.yybb.us/posts/hugo-theme/aiovtue/hugo-aiovtueupdate/)
- [主题小更新-1.6](https://daily.yybb.us/posts/hugo-theme/aiovtue/theme-aiovtue-up2/)
- [主题更新-2.0](https://daily.yybb.us/posts/hugo-theme/aiovtue/update-26717/)

### 一点补充
如果你打算保留**AIOVTUE-雪**的 *Hellow world*文章，那么这里记得看哦，为了适配你们的博客样式，这篇文章并没有设置头图，也就是cover，网站会使用默认的cover，你可以切换默认的cover，具体位置和方法如下，在路径`\static\img`下有一个名为`default-cover.png`的图片文件，这就是默认头图，复制此文件名，将你想替换的图片重命名为这个，直接替换源文件即可，顺便说一嘴，大部分页面的头图，例如友链页面，主页面等的背景图片都在`\static`文件夹下方`img`和`hero`文件夹内，你们可以自行替换，当然也可以直接使用图床链接哦~

#### 新建文章
大家可能有些是小白，尽管我发布了很多教程，但难保都能被看到，因此，比较重要的在这里在写一下啦，首先是文章和各种页面的编辑地址，`\content`这个文件夹立面放的是各种页面,`\content\posts` 这个文件夹里面则是文章啦，发布新文章就在这个文件夹立面新建一个`.md`文件即可，，每个文章除了正文还需要一些属性，大体有以下这些：
```
title: "Hello World"
description: "这是本站的第一篇文章哦~"
date: 2024-04-20
lastmod: 2024-04-20
categories:
  - 随笔
tags:
  - 随笔
tocStartLevel: 3
tocEndLevel: 4
```

有些很好辨认是干什么的，这里只讲一些不好辨认的啦，`tocStartLevel`和`tocEndLevel`是什么呢，我们的页面右侧会有一个文章标题目录，本博客支持六级目录，但是全部渲染的话不太现实，这两行可以指定渲染的标题级别，start是开始，end是结束，拿上面的举例，就是从三级标题（###）开始渲染，到四级标题（####）结束渲染，默认也不会是全部渲染啦，没有特别需求其实可以不写这两行哦~

#### 友链页面
友链页面的数据储存位置，即新增友链在哪里加，`/data`文件夹下方有一个`links.yaml`文件，这个文件里面写的就是友链信息啦，在里面写上了一些**AIOVTUE-雪**自己的网站和示例demo，方便大家理解添加和分组结构~

友链下方的公告怎么修改呢，一般情况下网站会自动获取你的地址，头像这些，不过也不能避免的需要修改，修改位置在主题文件夹立面`\themes\aiovtue\layouts\partials`有一个名为`friend-link-notice.html`的文件，使用记事本或者编辑器打开整个文件，找到如下部分：
```
        本站友链信息如下：
      </p>
      <ul class="friend-link-site-info__list">
        <li>站点名称：<span class="friend-link-highlight">{{ .Site.Title }}</span></li>
        <li>站点链接：<span class="friend-link-highlight">{{ .Site.BaseURL }}</span></li>
        <li>站长头像：<span class="friend-link-highlight">{{ .Site.Params.author.avatar }}</span></li>
        <li>站点描述：<span class="friend-link-highlight">雨滴会记录生命中的每一个瞬间</span></li>
        <li>站点截图：<span class="friend-link-highlight">https://r2tc.20030327.xyz/file/博客/主题/1780909850378_1780909790262.png</span></li>
```
修改也很简单，替换诸如`{{ .Site.BaseURL }}`为你想替换的内容即可，具体参考站点截图那里的样子

#### 网页信息
网页的大部分配置都在网页的配置文件之中，即根目录的`hugo.toml`文件，里面的注释挺完善的，跟着注释修改就好啦，或者也可以去看我的教学视屏哦~

### 结语
好啦，我们该说再见啦，或许这是你的第一份博客，也或许是你众多博客的其中之一，总之你能选择它，是对我的一份肯定，希望你们可以保持更新，越做越好，欢迎在大家发布适量文章和稳定运行之后前往[AIOVTUE-雪](https://daily.yybb.us)的站点交换友链哦, 祝大家都越来越好哦！