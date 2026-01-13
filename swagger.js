import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Image Upload API",
      version: "1.0.0",
      description: "API 文档",
    },
    servers: [
      {
        url: "http://localhost:3008", // 请根据实际本地端口修改
        description: "本地开发服务器",
      },
      // {
      //   url: 'http://121.37.23.86:3000', // 请根据实际生产地址修改
      //   description: '生产服务器',
      // },
    ],
  },
  // 指定包含 Swagger 注释的文件路径
  apis: ["./expressRoutes/*.js"],
};

const specs = swaggerJsdoc(options);

export default (app) => {
  // 访问 /api-docs 查看文档
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
};
