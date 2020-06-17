# 用户配置与鉴权

## cookie

大家都知道http请求是无状态的，但是web应用中又需要记住登录信息，方便后续的操作。
于是，程序员们想到了一个方法：请求的时候拿着一个令牌，服务器认证这个令牌，如果通过校验才会响应数据。
<div  align="center">    
<img src="/assets/img/cookie.webp"  />
</div>
具体的流程如下：
1. 客户端带着用户名和密码访问`login`接口
2. 服务器收到请求后校验用户名和密码，校验正确后，服务器发送一个`HttpResponse`响应到客户端，其中包含`Set-Cookie`的头部
3. 客户端发起非登录请求时，假如服务器给了 set-cookie，浏览器会自动在请求头中添加 `cookie`
4. 服务器接收请求，分解 `cookie`，验证信息，核对成功后返回 response 给客户端

```js
const Koa  = require('koa')
const app = new Koa()

app.use(async(ctx)=>{
    if(ctx.url=== '/login'){//①①①①①①①①①
        ...
        const { username, password } = ctx.body;
        /** 数据库查询用户，校验成功后设置cookie
         * ...其他操作
         */
        ctx.cookies.set( //②②②②②②②②②
            'username',username,{
                domain:'localhost', // 写cookie所在的域名
                path:'/index',       // 写cookie所在的路径
                maxAge:1000*60*60*24,   // cookie有效时长
                expires:new Date('2019-2-12'), // cookie失效时间
                httpOnly:false,  // 是否只用于http请求中获取
                overwrite:false  // 是否允许重写
            }
        )
        ctx.body = {code:0,msg:'cookie is set'}
    }else{ 
        //③③③③③③③③③③③③
        let hasCookies = ctx.cookies.get('username');

        //④④④④④④④④④④④④
         if( hasCookies ){
           /** 处理请求返回结果
            *  let data = await database.table.find({})
             * ctx.body = {
             *  code:0,
             *  data:data,
             *   msg:'success'
             * }
            */
         } else {
             /** 
              * 找不到cookies逻辑处理
              * ctx.body = {
              *     code:-1,
              *     msg:'failed,has no cookies'
              * }
             */
        }
    }
})

app.listen(3000,()=>{
    console.log('server is starting at port 3000')
})
```
## session
上述cookie的方式可以满足业务需求，但是存在明显的缺点：
   - 不安全，cookie存放在客户端，容易发生CSRF攻击
   - 每次都需要传输
   - 容量受限制，所存的字符有限
   - 虽然设置`httpOnly`，但是使用`document.cookie`还是可以读取到的，容易篡改泄露

基于以上原因，程序员们又想到了另一种解决方案：session

具体流程和cookie一样。不同的是，服务器校验登录信息正确后，一是将session存入数据库（或者内存中），另一个是将session对应的key即（externalKey）写入到cookie。
```js
const Koa = require('koa');                        
const Koa_Session = require('koa-session');  

const session_signed_key = ["some secret hurr"];  // 这个是配合signed属性的签名key
const session_config = {
    key: 'koa:sess', /**  cookie的key。 (默认是 koa:sess) */
    maxAge: 4000,   /**  session 过期时间，以毫秒ms为单位计算 。*/
    autoCommit: true, /** 自动提交到响应头。(默认是 true) */
    overwrite: true, /** 是否允许重写 。(默认是 true) */
    httpOnly: true, /** 是否设置HttpOnly，如果在Cookie中设置了"HttpOnly"属性，那么通过程序(JS脚本、Applet等)将无法读取到Cookie信息，这样能有效的防止XSS攻击。  (默认 true) */
    signed: true, /** 是否签名。(默认是 true) */
    rolling: true, /** 是否每次响应时刷新Session的有效期。(默认是 false) */
    renew: false, /** 是否在Session快过期时刷新Session的有效期。(默认是 false) */
};

// 实例化
const app = new Koa();
const session = Koa_Session(session_config, app)
app.keys = session_signed_key;

// 使用中间件，注意有先后顺序
app.use(session);

app.use(ctx => {
    const databaseUserName = "testSession";
    const databaseUserPasswd = "noDatabaseTest";
    // 对/favicon.ico网站图标请求忽略
    if (ctx.path === '/favicon.ico') return;

    if (!ctx.session.logged) {  // 如果登录属性为undefined或者false，对应未登录和登录失败
        // 设置登录属性为false
        ctx.session.logged = false;
        // 取请求url解析后的参数对象，方便比对
        // 如?nickname=post修改&passwd=123解析为{nickname:"post修改",passwd:"123"}
        let query = ctx.request.query;

        // 判断用户名密码是否为空
        if (query.nickname && query.passwd) {
            // 比对并分情况返回结果  
            if (databaseUserName == query.nickname) {  // 如果存在该用户名

                // 进行密码比对并返回结果 
                ctx.body = (databaseUserPasswd == query.passwd) ? "登录成功" : "用户名或密码错误";
                ctx.session.logged = true;
            } else { // 如果不存在该用户名                                     
                ctx.body = "用户名不存在";
            }
        } else {
            ctx.body = "用户名密码不能为空";
        }
    } else {

        /**ctx.body = "已登录" */
        
    }
}
);

app.listen(3000);
```


## Token
用session方式鉴权，解决了部分问题，但是仍存在不少缺点：
  - cookie+session 在跨域场景表现并不好（不可跨域，domain 变量，需要复杂处理跨域）
  - 如果是分布式部署，需要做多机共享 Session 机制（成本增加）
  - 查询 Session 信息可能会有数据库查询操作

于是程序员们又想到了一个解决办法：[JWT(JSON Web Token)](https://www.ruanyifeng.com/blog/2018/07/json_web_token-tutorial.html)<br>
JWT的原理是，服务器认证以后，生成一个 JSON 对象，发回给用户，就像下面这样:
```js
{
    "姓名": "森林",
    "角色": "搬砖工",
    "到期时间": "2020年1月198日16点32分"
}
```
用户与服务端通信的时候，都要发回这个 JSON 对象。服务器完全只靠这个对象认证用户身份。为了防止用户篡改数据，服务器在生成这个对象的时候，会加上签名。

服务器就不保存任何 session 数据了，也就是说，服务器变成无状态了，从而比较容易实现扩展。
```js
const Koa = require('koa')
const router = require('koa-router')

const jwt = require('jsonwebtoken')
const jwtAuth = require('koa-jwt')
const secret = 'itisvalue'
const bodyParser = require('koa-bodyparser')
const static = require('koa-static')


const app = new Koa()

app.use(static(__dirname +'/'))
app.use(bodyParser())

//配置session
router.post('/users/login-token', async ctx => {
    const {body} = ctx.request
    const userinfo = body.username
    /** 登录逻辑处理...*/
    ctx.body = {
        message:'login success',
        user:userinfo,
        token:jwt.sign({
            data:userinfo,
            exp:Math.floor(Date.now() / 1000) +60*60 //token过期时间，秒为单位
        },
        secret)
    }
})

//检查token是否合法
router.get('/users/getUser-token',
    jwtAuth({secret}), async ctx => {
        //验证通过
        ctx.body = {
            message:'get user datainfo success',
            userinfo:ctx.state.user.data
        }
})
```

## OAuth(第三方登录)


## SSO(单点登录)