# Stage 1: Build static assets
FROM node:20 AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
# npm ci 在当前 npm 版本 + lockfile 组合下会触发 rollup 可选依赖 (@rollup/rollup-linux-x64-*) 的已知 bug
# 这里改为 npm install，在容器环境中重新解析依赖，保证 rollup 原生二进制正确安装
RUN rm -f package-lock.json && npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
