## 图片处理
### 中间件安装配置
之前处理post请求，使用的是koa-bodyparser,如果需要处理图片上传的功能，则需要结合
koa-multer。<br>本项目直接安装了koa-body,这个插件结合了上述2个的功能, 方便快捷。
<br>另外我使用的是七牛云存储，本地存储也可以。


**1. 安装依赖**
```js
npm i -D koa-body qiniu
```

**2. app.js入口文件中配置koa-body**

```js
/* app.js 入口文件 */
...
const koaBody = require('koa-body');
...
app.use(koaBody({
  multipart: true,
  formidable:{
    maxFileSize: 200*1024*1024 , // 设置上传文件大小最大限制，默认2M
    // uploadDir:path.join(__dirname,'public/uploads'), // 设置文件上传目录
    // keepExtensions: true,    // 保持文件的后缀
    // onFileBegin:(name,file) => { // 文件上传前的设置
      // console.log(`name: ${name}`);
      // console.log(file);
    }
}));
```

### 七牛云配置
前提条件：
在七牛云上申请账号，在`对象存储`目录下新建空间

**1. 从七牛云的`个人中心->密钥管理`中复制出AK、SK**

```js
/* config/qiniu.js */
const qiniuConfig = {
    accessKey: "七牛云上的AK",
    secretKey: "七牛云上的SK",
    bucket: "七牛的空间域",
    origin: "http://qb154ktno.bkt.clouddn.com/", //七牛云上的cdn域名
  };
module.exports = qiniuConfig

```
**2. 选择上传方式**

七牛云有多种[上传策略](https://developer.qiniu.com/kodo/sdk/1289/nodejs#server-upload "七牛云上传策略")，我选择的是`流上传`


```js
/*utils/upload.js*/

const qiniu = require('qiniu');

const qiniuConfig = require('../config/qiniu');

const upToQiniu = (filePath, key) => {
    const accessKey = qiniuConfig.accessKey;
    const secretKey = qiniuConfig.secretKey;
    const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
   
    // 简单上传的凭证
    const options  = {
        scope:qiniuConfig.bucket,
        returnBody: '{"key":"$(key)","name":"$(fname)"}'
    };
    
    var putPolicy = new qiniu.rs.PutPolicy(options);

    /**生成token作为个人七牛云账号的标识 */
    var uploadToken = putPolicy.uploadToken(mac);

    const config = new qiniu.conf.Config();

    /**空间对应的机房，按照自己的属区zone配置
     * z0 -> 华东;  z1 -> 华北; z2 -> 华南; na0-> 北美
     */
    config.zone = qiniu.zone.Zone_z2;

    const localFile = filePath;
    var formUploader = new qiniu.form_up.FormUploader(config);
    var putExtra = new qiniu.form_up.PutExtra();

    /**文件上传 */
    return new Promise((resolve, reject) => {
        /**
         * 以文件流的形式上传，uploadToken->token, key->上传七牛后的文件名 
         * localfile-> 流文件
         */
        formUploader.putStream(uploadToken, key, localFile, putExtra,
             function(respErr, respBody, respInfo) {
                if(respErr) {
                    reject(respErr)
                } else {
                    resolve(respBody)
                }
        })
    })
}

module.exports = {
    upToQiniu
}
```

**3. 控制模块编写上传逻辑**


```js
/* controller/qiniu.js*/

const { v1: uuidv1 } = require('uuid');
const fs = require('fs')

const uploadFunc = require('../utils/upload')

class GetAlbumController {
    /**上传图片到七牛云 */
    async uploadFile (ctx) {
        try {
            //前端必须以formData格式进行文件的传递
            const file = ctx.request.files.file
            if(file) {
                //文件命名
                const fileName = uuidv1();
                //读取文件流
                const reader = fs.createReadStream(file.path)
                // 获取文件扩展名
                const ext = file.name.split(".").pop()
                const fileUrl = `${fileName}.${ext}`
                //上传开始
                const result = await uploadFunc.upToQiniu(reader, fileUrl)
                if(result) {
                    ctx.body = result
                } else {
                    ctx.throw('405','文件上传失败')
                }

            } else {
                ctx.throw(604, '没有文件')
            }
        } catch(err) {
            ctx.throw(500, err)
        }
    }
}


module.exports = new GetAlbumController();
```
**4. 配置路由**
```js
/**router/qiniu.js**/

const Router = require('koa-router');

const router = new Router({
    prefix:'/qiniu'
});

const {
	uploadFile
} = require("../controllers/qiniu");

router.post("/upload",uploadFile);

module.exports = router;
```


