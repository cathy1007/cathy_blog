# 后台服务器
## 介绍
项目主要是信息展示，所以仅做了登录、产品管理，用到的模块和插件很少<br>
技术栈  `Koa` + `mongoDB` + `Qiniu`<br>

##目录结构
```
.<br>
├── app.js *(入口文件)*<br>
├── bin<br>
│   └── www<br>
├── config *(全局配置文件)*<br>
├── controllers *(解析用户的输入，处理后返回相应的结果)*<br>
├── dbs *(数据库配置和模型)*<br>
│   ├── config.js<br>
│   └── models<br>
├── middleware *(中间件)*<br>
│   ├── auth.js<br>
│   ├── http-error.js<br>
│   └── index.js<br>
├── package-lock.json<br>
├── package.json<br>
├── README.md<br>
├── routers *(URL路由规则)*<br>
└── utils *(公共插件)*<br>
```
## 数据库配置
数据库我们采用的是`mongodb`，插件模块选用的`Mongoose`。

`mongoose`是`nodeJS`提供连接 `mongodb`的一个库，类似于`jquery`和`js`的关系，对`mongodb`一些原生方法进行了封装以及优化。简单的说，`Mongoose`就是对`node`环境中`MongoDB`数据库操作的封装，一个对象模型(`ODM`)工具，将数据库中的数据转换为`JavaScript`对象以供我们在应用中使用。
```js 
  /* dbs/config.js */
  ...
  const dburl = 'mongodb://127.0.0.1:27017/mall';
  const db = mongoose.connect(dburl,{ useUnifiedTopology: true, useNewUrlParser: true })
  ...
  module.exports = db;

  /*------end-----*/ 

  /* app.js中引入 */ 
  require('./dbs/config')
```

models模块中定义相应数据结构，例如在`goods.js`中定义Schema:

```js
 /* models/goods.js*/
const GoodsSchema = mongoose.Schema({
	types   : { //分类,关联classify模型
		type: Schema.Types.ObjectId, 
		ref : 'Classify',
		required: true
	},
	name     : { type: String, required: true }, //标题
	price    : { type: Number, required: true }, //价格
	remark   : { type: String, required: true }, //备注
	images   : { type: Array, required: true }, //图片
	cover_url  : { type: String, required: true }, //封面
	author: { type: String, required: true }, //作者
	publisher: { type: String, required: true }, //出版社
	binding: { type: String, required: true}, //纸张类型
	size:  { type: String, required: true}, //尺寸
	hot: { //是否是热门推荐
		type:Boolean,
		default: false
	},
	ad:{ //是否是广告轮播
		type:Boolean,
		default:false
	}
},{ timestamps: true })

```
注：Goods的模型中types(一对一关系)关联书籍类型，广告轮播本来打算作为一个新的模型创建的，因为应用场景单一，所以都集中在gooods中了。后续看情形再做拆分。 


## 路由 RESTful API 配置
### 何为RESTful？
  REST的全称是Representational state transfer:
  - Representational: 数据的表现形式(JSON、XML...)
  - state: 当前状态或者数据
  - transfer: 数据传输
  
### 有何特点？
  - 关注点分离<br>
    服务端专注数据存储，提升了简单性，前端专注用户界面，提升了可移植性。
  - 无状态<br>
    所有用户会话信息都保存在客户端。每次请求必须包括所有信息，不能依赖上下文信息。服务端不用保存会话信息，提升了简单性、可靠性、可见性。
  - 缓存可设计<br>
    所有服务端响应都要被标为可缓存或不可缓存，减少前后端交互，提升了性能。
  - 接口统一<br>
    接口设计尽可能统一通用，提升了简单性、可见性。接口与实现解耦，使前后端可以独立开发迭代。
  - 分层系统
  - 按需代码
### 如何设计？
  - URI 使用名词，尽量使用复数，如/goods
  - URI 使用嵌套表示关联关系，如/users/123/repos/234
  - 使用正确的 HTTP 方法，如 GET/POST/PUT/DELETE

由于项目模块较多，对应的路由也很多。项目里用 node 的 fs 模块去遍历读取 routes 下的所有路由文件，统一注册。
```js
/* routers/index.js */

const fs = require("fs");
const path = require('path')
const router = require('koa-router')();

module.exports = app => {
  fs.readdirSync(__dirname).forEach(file => {
    if (file === "index.js") {
      return;
    }
    const route = require(`./${file}`);
    //设置统一api前缀
    router.use('/api', route.routes(), route.allowedMethods())
    app.use(router.routes()).use(router.allowedMethods());
  });
};

```

书籍模块控制器，处理业务逻辑
```js
/* controllers/goods.js */

const Goods = require('../dbs/models/goods');

class Ctrl {
    async findIndex(ctx) {
      let banner = await Goods.find({ad:true})
      .limit(3)
      .select({ cover_url:1, name:1 });
    
      let hotGoods  = await Goods.find({hot:true})
      .limit(10);
        ctx.body = {banner, hotGoods};
    }
    
    ...
}
  
  module.exports = new Ctrl();
```

书籍模块路由,restful设计
```js
/* routers/goods */
const jwt = require("koa-jwt");
const { secret } = require("../config");

const Router = require('koa-router');
const router = new Router({
    prefix:'/goods'
});

const {
	find,
	findIndex,
	findById,
	create,
	update,
	del,
	checkExist,
	changeStatus
} = require("../controllers/goods");

const auth = jwt({ secret });

router.get("/", find);
router.post("/",auth,create);
router.get("/all", findIndex);
router.get("/:id", findById);


router.put("/:id",auth, checkExist, update);
router.patch("/:id/change",auth, checkExist, changeStatus);
router.delete('/:id',auth, del);
module.exports = router;
```

## 用户认证与鉴权
