/**
 * 全局常量与配置定义
 * 目的：将所有硬编码的变量集中管理，方便后续修改
 */

// 1. 网络消息协议类型 (Protocol Types)
export const MSG_TYPE = {
  PING: 'PING',         // 心跳检测
  PONG: 'PONG',         // 心跳响应
  HELLO: 'HELLO',       // 握手（建立连接后的第一条消息）
  PEER_EX: 'PEER_EX',   // 节点交换（Gossip 协议，互换邻居列表）
  ASK_PUB: 'ASK_PUB',   // 请求公共历史消息
  REP_PUB: 'REP_PUB',   // 响应公共历史消息
  MSG: 'MSG',           // 普通聊天消息（文本、图片、文件）
  HUB_PULSE: 'HUB_PULSE' // 房主心跳（MQTT专用）
};

// 2. 网络参数配置 (Network Parameters)
export const NET_PARAMS = {
  GOSSIP_SIZE: 20,          // 每次交换节点时最多推荐多少个
  MAX_PEERS_NORMAL: 30,     // 普通节点最大连接数
  MAX_PEERS_HUB: 80,        // 房主节点最大连接数
  CONN_TIMEOUT: 5000,       // 连接建立超时 (ms)
  PING_TIMEOUT: 6000,       // 判定掉线超时 (ms)
  LOOP_INTERVAL: 1000,      // 主循环间隔 (ms)
  RETRY_DELAY: 3000,        // 重试等待 (ms)
  HUB_PREFIX: 'p1-hub-v3-', // 房主ID前缀
  HUB_COUNT: 5              // 房主槽位数量
};

// 3. 聊天相关 (Chat)
export const CHAT = {
  PUBLIC_ID: 'all',         // 公共频道ID
  PUBLIC_NAME: '公共频道',   // 公共频道显示名称
  KIND_TEXT: 'text',        // 消息类型：文本
  KIND_IMAGE: 'image',      // 消息类型：图片
  KIND_FILE: 'file',        // 消息类型：文件（新增）
  TTL_DEFAULT: 16           // 消息最大跳数（TTL）
};

// 4. UI 配置 (UI Configuration)
export const UI_CONFIG = {
  COLOR_ONLINE: '#22c55e',     // 在线状态颜色 (绿色)
  COLOR_OFFLINE: '#666666',    // 离线状态颜色 (灰色)
  COLOR_GROUP: '#2a7cff',      // 群组头像背景色
  MSG_LOAD_BATCH: 20,          // 历史消息每次加载数量
  LONG_PRESS_DURATION: 500,    // 长按触发时间 (ms) - 用于全选功能
  MAX_IMG_WIDTH: 800,          // 图片压缩最大宽度 (px)
  IMG_QUALITY: 0.7             // 图片压缩质量 (0-1)
};

// 5. 本地存储键名 (LocalStorage Keys)
export const STORAGE_KEYS = {
  MY_ID: 'p1_my_id',
  NICKNAME: 'nickname',
  CONTACTS: 'p1_contacts',
  UNREAD: 'p1_unread'
};