-- 匠人程综合管理系统云数据库第一阶段表结构
-- 目标：先落账号、权限、操作日志、备份记录、系统配置。
-- 说明：按 PostgreSQL / Supabase 兼容语法编写，正式接入前可按实际云厂商微调。

create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  password_hash text,
  role text not null,
  phone text,
  wechat text,
  subject text,
  scope text,
  hire_date date,
  regular_date date,
  commission_rate numeric(6, 2),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists permission_catalog (
  permission_key text primary key,
  module_key text not null,
  action_key text not null,
  display_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists employee_permissions (
  employee_id uuid not null references employees(id) on delete cascade,
  permission_key text not null references permission_catalog(permission_key) on delete cascade,
  granted_by uuid references employees(id),
  granted_at timestamptz not null default now(),
  note text,
  primary key (employee_id, permission_key)
);

create table if not exists role_permission_defaults (
  role text not null,
  permission_key text not null references permission_catalog(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  action_key text not null,
  target_type text,
  target_id text,
  summary text,
  before_data jsonb,
  after_data jsonb,
  operator_id uuid references employees(id),
  operator_name text,
  operator_username text,
  operator_role text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_module_created_idx
  on audit_logs(module_key, created_at desc);

create index if not exists audit_logs_operator_created_idx
  on audit_logs(operator_id, created_at desc);

create table if not exists backup_exports (
  id uuid primary key default gen_random_uuid(),
  backup_version text not null,
  source_url text,
  storage_kind text not null default 'localStorage',
  entry_count integer not null default 0,
  checksum text,
  exported_by uuid references employees(id),
  exported_by_name text,
  exported_at timestamptz not null default now(),
  note text
);

create table if not exists backup_payloads (
  id uuid primary key default gen_random_uuid(),
  backup_export_id uuid not null references backup_exports(id) on delete cascade,
  store_key text not null,
  store_label text,
  raw_payload jsonb not null,
  row_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (backup_export_id, store_key)
);

create table if not exists system_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  module_key text not null default 'portal',
  description text,
  updated_by uuid references employees(id),
  updated_at timestamptz not null default now()
);

create table if not exists cloud_migration_runs (
  id uuid primary key default gen_random_uuid(),
  migration_key text not null unique,
  phase text not null,
  status text not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  summary text,
  created_at timestamptz not null default now()
);

