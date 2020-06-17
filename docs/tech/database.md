
## 数据库
###  数据库简介
#### 文档(document)、集合(collection)、数据库(database)
#### 和sql型数据库对比
sql术语 | mongodb术语 | 解释 
:-: | :-: | :-: 
database | database | 数据库 
table | collection | 表/集合
row | document | 记录/文档
column | field | 字段/域
index | index | 索引
table joins | / | 连接，mongoDB不支持
primary key | primary key | 主键，mongoDB中`_id`即为主键

###  常规CURD操作
 具体api请参考[官方文档](https://mongoosejs.com/docs/api/model.html)

**- 新增**

常用方法有：
1. Model.create()
2.  _instance.save()

**- 查找**

如果不提供回调函数，所有这些方法都返回 Query 对象，它们都可以被再次修改（比如增加选项、键等），直到调用 exec 方法

常用的有：
 1. Model.find(query, fields, options, function(err, docs){}):返回文档数组
 2. Model.findById(obj._id,function(err, doc){})：返回单个文档
 3. Model.findOne({ _id:'id'},function(err, doc){})： 返回单个文档
 
 另外还有：`findByIdAndDelete`、 `findByIdAndRemove`、 `findByIdAndUpdate`、 `findOneAndDelete`、 `findOneAndRemove`、 `findOneAndReplace`、 `findOneAndUpdate`

**- 修改**
1. Model.update()
2. Model.updateOne()
3. Model.updateMany()

**- 删除**
1. Model.deleteMany()
2. Model.deleteOne()
3. Model.remove()

### 高级用法
1. Model.populate()：数据关联 参考：[Mongoose 之 Population 使用](https://segmentfault.com/a/1190000002727265)
2. Model.aggregte()：聚合
   通过管道操作实现聚合。常用的管道有：
   - $project:修改输入文档结构，用来重命名、显示部分字段、创建计算结果、嵌套文档
   - $match:过滤数据，输出符合条件的文档,相当于find()、findOne()、$where
   - $limit 限制文档数
   - $skip 跳过指定文档,配合`$limit`一起用于分页
   - $sort 排序
   - group 文档分组，可以使用的[逻辑字段：](https://docs.mongodb.com/manual/reference/operator/aggregation/)
       - $sum:计算总和
       - $avg:计算平均值
       - $min:获取对应值的最小值
       - $max:获取对应值的最大值
       - $push:在结果文档中插入值到一个数组中
       - $addToSet：在结果文档中插入值到一个数组中，但不创建副本 
       - $first  根据资源文档的排序获取第一个文档数据
       - $last  根据资源文档的排序获取最后一个文档数据 
   - $lookup 关联查询,相当于关系数据库中的left outer join
    基本格式为：
      ```js
      {
       from: 'book', //关联的集合
       localField:'cate_id', //本地id
       foreignField:'_id', //被关联的集合字段，一般为_id,数据类型必须和localField一致
       as: 'newName' //新的数组名
     }
     ```
     
 举例：<br>
 商品属性：_id,  createTime,  nowPriceL,  nowPriceH,  number<br>
     目标：统计每一天内店铺商品的最低价和最高价，平均最低价
 ```js
  Goods.aggregate([
      {
        $match: {
          number: {$gte:100} //匹配number>=100的记录
       }
      },
      {
         $project : {
             day : {$substr: [{"$add":["$createTime", 28800000]}, 0, 10] },//时区数据校正，8小时换算成毫秒数为8*60*60*1000=288000后分割成YYYY-MM-DD日期格式便于分组
             "nowPriceL": 1, //设置原有nowPriceL为1，表示结果显示原有字段nowPriceL
             "nowPriceH":1, //设置原有nowPriceH为1，表示结果显示原有字段nowPriceH
             avgNowPriceL:{$toDouble:"$nowPriceL"},//把最低价转换为小数
             avgNowPriceH:{$toDouble:"$nowPriceH"},//把最高价转换为小数
             "dayNumber":1 //每组内有多少个成员
         },
      },
    
    { 
      $group: { 
        _id:"$day", //按照$day进行分组（一组为1天） 
        nowPriceL:{$min: "$nowPriceL"}, //查找组内最小的nowPriceL 
        nowPriceH:{$max: "$nowPriceH"}, //查找组内最大的nowPriceH  
        avgNowPriceL:{$avg:"$avgNowPriceL"},//统计每一天内店铺商品的平均最低价
        avgNowPriceH:{$avg:"$avgNowPriceH"},//统计每一天内店铺商品的平均最高价
        dayNumber:{$sum:1}   
      } 
    }, 
    { 
      $sort: {
        nowPriceL: 1//执行完 $group，得到的结果集按照nowPriceL升序排列
      }
    }]).exec(function (err, goods){
    //返回结果  
    console.log(goods);
    });
 ```

 执行完$match管道后，得到的查询结果会输入到$project管道，执行完$project管道，得到的结果格式为{day,nowPriceL,nowPriceH},把这个结果输入$group管道，$group管道执行完毕，输出的结果输入到$sort管道，$sort执行完毕，输出最终结果集
