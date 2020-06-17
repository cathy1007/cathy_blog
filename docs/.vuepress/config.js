module.exports = {
    title: 'cathyの博客',
    description: 'welcome to visit my blogs!',
    themeConfig: {
        logo: '/assets/img/logo.jpg',
        nav: [{
                text: '技术',
                link: '/tech/'
            },
            {
                text: '读书',
                link: '/book/'
            },
            {
                text: '生活',
                link: '/life/'
            },
            {
                text: 'Github',
                link: 'https://www.baidu.com'
            },
        ],
        sidebar: {
            '/book/': [
                '',     /* /foo/ */
                'server',  /* /foo/one.html */
                'database',
                'two'   /* /foo/two.html */
              ],
        },
        sidebarDepth: 2,
    },
    head: [
        ['link', {
            rel: 'icon',
            href: `/favicon.ico`
        }]
    ],
    dest: './docs/.vuepress/dist',
    ga: '',
    evergreen: true,
    base:'cathy_blog'
}