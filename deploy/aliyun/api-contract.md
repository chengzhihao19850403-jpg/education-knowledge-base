# 匠人程云端 API 第一阶段接口

## 认证说明

第一阶段接口只服务统一工作台，不直接开放数据库给浏览器。

前端调用：

- `GET /health`
- `GET /employees`
- `GET /permissions`
- `POST /audit-logs`
- `POST /backup-exports`

后端使用数据库账号连接 RDS，浏览器不保存数据库密码。

## GET /health

返回：

```json
{
  "ok": true,
  "siteId": "jrcedu-main",
  "db": "connected"
}
```

## GET /employees

返回员工账号基础信息，不返回明文密码。

```json
{
  "employees": [
    {
      "name": "程志豪",
      "username": "chengzhihao",
      "role": "管理员",
      "phone": "15888003051",
      "wechat": "jrc-math",
      "subject": "数学",
      "scope": "1-9年级",
      "hireDate": "2016-06-20",
      "regularDate": "2016-07-20",
      "commissionRate": "100%",
      "permissions": ["admin.access"]
    }
  ]
}
```

## GET /permissions

返回权限目录和默认岗位权限。

```json
{
  "permissions": [],
  "roleDefaults": []
}
```

## POST /audit-logs

请求：

```json
{
  "siteId": "jrcedu-main",
  "moduleKey": "finance",
  "actionKey": "新增支出",
  "targetType": "expense",
  "targetId": "EXP-001",
  "summary": "新增 6 月房租",
  "operatorName": "陈雨晴",
  "operatorUsername": "chenyuqing",
  "operatorRole": "财务",
  "clientCreatedAt": "2026-06-21T10:00:00.000Z",
  "userAgent": "..."
}
```

返回：

```json
{ "ok": true, "id": "uuid" }
```

## POST /backup-exports

请求：

```json
{
  "siteId": "jrcedu-main",
  "backupVersion": "2026-06-21-local-backup-v2",
  "sourceUrl": "https://jrc-edu.github.io/jrcedu/portal/index.html",
  "exportedAt": "2026-06-21T10:00:00.000Z",
  "exportedByName": "程志豪",
  "exportedByUsername": "chengzhihao",
  "entryCount": 12,
  "storeKeys": ["paike-june-system-v1"]
}
```

返回：

```json
{ "ok": true, "id": "uuid" }
```
