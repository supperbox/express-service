import mongoose from "./db.js";

//  有关登录相关的数据库管理
// 在代码层面对于应的 Schema 进行定义，确保字段与 MongoDB 中的集合结构一致
const loginSchema = new mongoose.Schema(
  {
    account: String,
    password: String,
  },
  {
    strict: false, // 允许文档中有模式未定义的字段
    versionKey: false,
    collection: "login", // 指定集合名称
  }
);

// 由于自动转换为小写复数形式而去找寻 userinfos 集合，因此需要手动指定集合名称 userInfo
const loginModel = mongoose.model("login", loginSchema);

// loginModel.find().then((res) => console.log('初始数据集合login:', res))

export default loginModel;
