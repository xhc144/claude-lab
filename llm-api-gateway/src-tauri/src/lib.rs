use axum::{
    body::Body,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Local;
use futures_util::StreamExt;
use rand::{distributions::Alphanumeric, Rng};
use reqwest::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    net::SocketAddr,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tokio::sync::{mpsc, oneshot, Mutex};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

const SERVICE_NAME: &str = "LocalModelGateway";
const UNIFIED_MODEL_PREFIX: &str = "xhc-";
static QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);

fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = if let Some(window) = app.get_webview_window("main") {
        window
    } else {
        WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
            .title("大模型统一 API 网关")
            .inner_size(1240.0, 820.0)
            .min_inner_size(980.0, 680.0)
            .build()?
    };
    window.unminimize()?;
    window.show()?;
    window.set_focus()?;
    Ok(())
}

fn prefixed_unified_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed
        .to_ascii_lowercase()
        .starts_with(UNIFIED_MODEL_PREFIX)
    {
        format!(
            "{UNIFIED_MODEL_PREFIX}{}",
            &trimmed[UNIFIED_MODEL_PREFIX.len()..]
        )
    } else {
        format!("{UNIFIED_MODEL_PREFIX}{trimmed}")
    }
}

#[derive(Clone)]
struct AppState {
    db_path: PathBuf,
    client: Client,
    server: Arc<Mutex<Option<oneshot::Sender<()>>>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GatewaySettings {
    listen_host: String,
    port: u16,
    auto_start_gateway: bool,
    minimize_to_tray: bool,
    start_on_boot: bool,
    theme: String,
    log_level: String,
}

impl Default for GatewaySettings {
    fn default() -> Self {
        Self {
            listen_host: "127.0.0.1".into(),
            port: 8787,
            auto_start_gateway: true,
            minimize_to_tray: true,
            start_on_boot: false,
            theme: "system".into(),
            log_level: "info".into(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Channel {
    id: String,
    name: String,
    provider: String,
    base_url: String,
    models: String,
    model_mapping: String,
    priority: i64,
    weight: i64,
    enabled: bool,
    timeout_seconds: i64,
    max_retries: i64,
    status: String,
    has_api_key: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelMapping {
    id: String,
    unified_name: String,
    channel_id: String,
    upstream_model: String,
    fallback_channel_id: Option<String>,
    #[serde(default)]
    channel_ids: Vec<String>,
    context_length: i64,
    cached_input_price: Option<f64>,
    input_price: f64,
    output_price: f64,
    currency: String,
    price_source: String,
    price_updated_at: Option<String>,
    enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AutoMappingResult {
    created: i64,
    reprioritized: i64,
    already_existing: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ClientKey {
    id: String,
    name: String,
    key_prefix: String,
    key_value: Option<String>,
    enabled: bool,
    allowed_models: String,
    daily_quota: i64,
    monthly_quota: i64,
    request_limit: i64,
    token_limit: i64,
    expires_at: Option<String>,
    ip_allowlist: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GatewayStatus {
    running: bool,
    host: String,
    port: u16,
    base_url: String,
    model_count: i64,
    today_requests: i64,
    today_tokens: i64,
    latest_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CallLog {
    id: String,
    created_at: String,
    client_key_prefix: String,
    requested_model: String,
    upstream_model: String,
    input_tokens: i64,
    cached_input_tokens: i64,
    output_tokens: i64,
    latency_ms: i64,
    status: String,
    error_message: Option<String>,
    failover: bool,
    estimated_cost: f64,
    currency: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OfficialPrice {
    provider: String,
    model: String,
    cached_input_price: Option<f64>,
    input_price: f64,
    output_price: f64,
    cache_write_price: Option<f64>,
    cache_storage_price: Option<f64>,
    extra_charges: String,
    currency: String,
    context_length: i64,
    source_url: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PriceSyncResult {
    items: Vec<OfficialPrice>,
    updated_models: i64,
    failed_sources: Vec<String>,
    synced_at: String,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct CostBucket {
    label: String,
    requests: i64,
    input_tokens: i64,
    cached_input_tokens: i64,
    output_tokens: i64,
    cost: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CostAnalytics {
    today_cost: f64,
    month_cost: f64,
    total_cost: f64,
    total_requests: i64,
    currency: String,
    seconds: Vec<CostBucket>,
    minutes: Vec<CostBucket>,
    hours: Vec<CostBucket>,
    days: Vec<CostBucket>,
    models: Vec<CostBucket>,
}

fn init_database(path: &PathBuf) -> Result<(), String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL, base_url TEXT NOT NULL,
            models TEXT NOT NULL DEFAULT '', model_mapping TEXT NOT NULL DEFAULT '', priority INTEGER NOT NULL DEFAULT 100,
            weight INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1, timeout_seconds INTEGER NOT NULL DEFAULT 60,
            max_retries INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT '未测试'
        );
        CREATE TABLE IF NOT EXISTS model_mappings (
            id TEXT PRIMARY KEY, unified_name TEXT NOT NULL UNIQUE, channel_id TEXT NOT NULL, upstream_model TEXT NOT NULL,
            fallback_channel_id TEXT, channel_ids TEXT NOT NULL DEFAULT '', context_length INTEGER NOT NULL DEFAULT 128000, input_price REAL NOT NULL DEFAULT 0,
            output_price REAL NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS client_keys (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, key_prefix TEXT NOT NULL, key_hash TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1, allowed_models TEXT NOT NULL DEFAULT '*', daily_quota INTEGER NOT NULL DEFAULT 0,
            monthly_quota INTEGER NOT NULL DEFAULT 0, request_limit INTEGER NOT NULL DEFAULT 0, token_limit INTEGER NOT NULL DEFAULT 0,
            expires_at TEXT, ip_allowlist TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS call_logs (
            id TEXT PRIMARY KEY, created_at TEXT NOT NULL, client_key_prefix TEXT NOT NULL, requested_model TEXT NOT NULL,
            upstream_model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
            latency_ms INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_message TEXT, failover INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS official_prices (
            provider TEXT NOT NULL, model TEXT NOT NULL, cached_input_price REAL, input_price REAL NOT NULL,
            output_price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', context_length INTEGER NOT NULL DEFAULT 0,
            source_url TEXT NOT NULL, updated_at TEXT NOT NULL, cache_write_price REAL, cache_storage_price REAL,
            extra_charges TEXT NOT NULL DEFAULT '', PRIMARY KEY(provider, model)
        );
        ",
    ).map_err(|e| e.to_string())?;
    for migration in [
        "ALTER TABLE model_mappings ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'",
        "ALTER TABLE model_mappings ADD COLUMN price_source TEXT NOT NULL DEFAULT '手动'",
        "ALTER TABLE model_mappings ADD COLUMN price_updated_at TEXT",
        "ALTER TABLE model_mappings ADD COLUMN cached_input_price REAL",
        "ALTER TABLE model_mappings ADD COLUMN channel_ids TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE call_logs ADD COLUMN estimated_cost REAL NOT NULL DEFAULT 0",
        "ALTER TABLE call_logs ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'",
        "ALTER TABLE call_logs ADD COLUMN cached_input_tokens INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE official_prices ADD COLUMN cache_write_price REAL",
        "ALTER TABLE official_prices ADD COLUMN cache_storage_price REAL",
        "ALTER TABLE official_prices ADD COLUMN extra_charges TEXT NOT NULL DEFAULT ''",
    ] {
        let _ = conn.execute(migration, []);
    }
    // 进程启动后，数据库里遗留的“流式中”一定已经不再运行。旧版本未能
    // 保存它们的 usage，明确标记为未知，避免把 0 误解为真实 Token 用量。
    conn.execute(
        "UPDATE call_logs
         SET status = '已中断（用量未知）',
             error_message = COALESCE(error_message, '程序重启前流未正常结束，无法回溯 Token 用量')
         WHERE status = '流式中'",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE model_mappings
         SET unified_name = 'xhc-' || unified_name
         WHERE lower(unified_name) NOT LIKE 'xhc-%'
           AND NOT EXISTS (
             SELECT 1 FROM model_mappings AS existing
             WHERE lower(existing.unified_name) = lower('xhc-' || model_mappings.unified_name)
           )",
        [],
    )
    .map_err(|e| e.to_string())?;
    seed_reference_prices(&conn)?;
    Ok(())
}

fn seed_reference_prices(conn: &Connection) -> Result<(), String> {
    let updated = "2026-07-30";
    let deepseek_source = "https://api-docs.deepseek.com/quick_start/pricing";
    let kimi_k3_source = "https://platform.kimi.ai/docs/pricing/chat-k3";
    let kimi_k27_source = "https://platform.kimi.ai/docs/pricing/chat-k27-code";
    let kimi_k26_source = "https://platform.kimi.ai/docs/pricing/chat-k26";
    let rows = [
        (
            "DeepSeek 官方",
            "deepseek-v4-flash",
            0.0028,
            0.14,
            0.28,
            1_048_576,
            deepseek_source,
            "自动前缀缓存；官方未单列缓存写入费或存储费",
        ),
        (
            "DeepSeek 官方",
            "deepseek-v4-pro",
            0.003625,
            0.435,
            0.87,
            1_048_576,
            deepseek_source,
            "自动前缀缓存；官方未单列缓存写入费或存储费",
        ),
        (
            "Kimi 官方",
            "kimi-k3",
            0.30,
            3.00,
            15.00,
            1_048_576,
            kimi_k3_source,
            "自动上下文缓存；$web_search 成功调用另收 $0.005/次",
        ),
        (
            "Kimi 官方",
            "kimi-k2.7-code",
            0.19,
            0.95,
            4.00,
            262_144,
            kimi_k27_source,
            "自动上下文缓存；$web_search 成功调用另收 $0.005/次",
        ),
        (
            "Kimi 官方",
            "kimi-k2.7-code-highspeed",
            0.38,
            1.90,
            8.00,
            262_144,
            kimi_k27_source,
            "自动上下文缓存；$web_search 成功调用另收 $0.005/次",
        ),
        (
            "Kimi 官方",
            "kimi-k2.6",
            0.16,
            0.95,
            4.00,
            262_144,
            kimi_k26_source,
            "自动上下文缓存；$web_search 成功调用另收 $0.005/次",
        ),
    ];
    for (provider, model, cache_hit, cache_miss, output, context, source, notes) in rows {
        conn.execute(
            "INSERT INTO official_prices(provider,model,cached_input_price,input_price,output_price,currency,context_length,source_url,updated_at,cache_write_price,cache_storage_price,extra_charges)
             VALUES(?1,?2,?3,?4,?5,'USD',?6,?7,?8,NULL,NULL,?9)
             ON CONFLICT(provider,model) DO UPDATE SET cached_input_price=excluded.cached_input_price,input_price=excluded.input_price,output_price=excluded.output_price,currency=excluded.currency,context_length=excluded.context_length,source_url=excluded.source_url,updated_at=excluded.updated_at,cache_write_price=excluded.cache_write_price,cache_storage_price=excluded.cache_storage_price,extra_charges=excluded.extra_charges",
            params![provider, model, cache_hit, cache_miss, output, context, source, updated, notes],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn open_db(state: &AppState) -> Result<Connection, String> {
    Connection::open(&state.db_path).map_err(|e| e.to_string())
}

fn secret_entry(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_NAME, id).map_err(|e| e.to_string())
}

fn read_settings(state: &AppState) -> Result<GatewaySettings, String> {
    let conn = open_db(state)?;
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'gateway_settings'",
            [],
            |r| r.get(0),
        )
        .ok();
    value
        .map(|v| serde_json::from_str(&v).map_err(|e| e.to_string()))
        .unwrap_or_else(|| Ok(GatewaySettings::default()))
}

fn now() -> String {
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}
fn key_value() -> String {
    format!(
        "lmg_{}",
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(40)
            .map(char::from)
            .collect::<String>()
    )
}
fn normalize_base_url(value: &str) -> String {
    value
        .trim()
        .trim_end_matches('/')
        .trim_end_matches("/v1")
        .to_string()
}

fn save_call_log(
    state: &AppState,
    key_prefix: &str,
    model: &str,
    upstream: &str,
    input: i64,
    cached_input: i64,
    output: i64,
    latency: i64,
    status: &str,
    error: Option<&str>,
    failover: bool,
) -> String {
    let id = Uuid::new_v4().to_string();
    if let Ok(conn) = open_db(state) {
        let (cached_input_price, input_price, output_price, currency): (Option<f64>, f64, f64, String) = conn.query_row(
            "SELECT cached_input_price,input_price,output_price,currency FROM model_mappings WHERE unified_name=?1",
            [model],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        ).unwrap_or((None, 0.0, 0.0, "USD".into()));
        let cached = cached_input.max(0).min(input.max(0));
        let uncached = input.max(0) - cached;
        let cached_price = cached_input_price.unwrap_or(input_price);
        let estimated_cost = (uncached as f64 * input_price
            + cached as f64 * cached_price
            + output.max(0) as f64 * output_price)
            / 1_000_000.0;
        let _ = conn.execute(
            "INSERT INTO call_logs (id, created_at, client_key_prefix, requested_model, upstream_model, input_tokens, cached_input_tokens, output_tokens, latency_ms, status, error_message, failover, estimated_cost, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![&id, now(), key_prefix, model, upstream, input, cached, output, latency, status, error, failover as i64, estimated_cost, currency],
        );
    }
    id
}

fn update_call_log(
    state: &AppState,
    id: &str,
    input: i64,
    cached_input: i64,
    output: i64,
    latency: i64,
    status: &str,
    error: Option<&str>,
) {
    if let Ok(conn) = open_db(state) {
        let (cached_input_price, input_price, output_price): (Option<f64>, f64, f64) = conn
            .query_row(
                "SELECT cached_input_price,input_price,output_price FROM model_mappings WHERE unified_name=(SELECT requested_model FROM call_logs WHERE id=?1)",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap_or((None, 0.0, 0.0));
        let cached = cached_input.max(0).min(input.max(0));
        let uncached = input.max(0) - cached;
        let cost = (uncached as f64 * input_price
            + cached as f64 * cached_input_price.unwrap_or(input_price)
            + output.max(0) as f64 * output_price)
            / 1_000_000.0;
        let _ = conn.execute(
            "UPDATE call_logs SET input_tokens=?1,cached_input_tokens=?2,output_tokens=?3,latency_ms=?4,status=?5,error_message=?6,estimated_cost=?7 WHERE id=?8",
            params![input.max(0), cached, output.max(0), latency, status, error, cost, id],
        );
    }
}

fn token_count(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|v| i64::try_from(v).ok()))
        .or_else(|| value.as_f64().map(|v| v.round() as i64))
        .or_else(|| value.as_str().and_then(|v| v.parse::<i64>().ok()))
        .map(|v| v.max(0))
}

fn usage_cached_input_tokens(usage: &Value) -> i64 {
    usage
        .get("prompt_cache_hit_tokens")
        .or_else(|| usage.get("cached_input_tokens"))
        .or_else(|| usage.get("cache_read_input_tokens"))
        .and_then(token_count)
        .or_else(|| {
            usage
                .pointer("/prompt_tokens_details/cached_tokens")
                .and_then(token_count)
        })
        .or_else(|| {
            usage
                .pointer("/input_tokens_details/cached_tokens")
                .and_then(token_count)
        })
        .unwrap_or(0)
}

fn usage_counts(usage: &Value) -> Option<(i64, i64, i64, i64)> {
    let mut input = usage
        .get("prompt_tokens")
        .or_else(|| usage.get("input_tokens"))
        .and_then(token_count);
    let mut output = usage
        .get("completion_tokens")
        .or_else(|| usage.get("output_tokens"))
        .and_then(token_count);
    let total = usage.get("total_tokens").and_then(token_count);
    if input.is_none() && output.is_none() && total.is_none() {
        return None;
    }
    if input.is_none() {
        input = total.map(|total| (total - output.unwrap_or(0)).max(0));
    }
    if output.is_none() {
        output = total.map(|total| (total - input.unwrap_or(0)).max(0));
    }
    let input = input.unwrap_or(0);
    let output = output.unwrap_or(0);
    let total = total.unwrap_or(input + output);
    // 部分 OpenAI 兼容上游虽然返回 usage 字段，但会把所有计数固定写成 0。
    // 对一次成功的对话请求而言这不是有效用量，交给调用方走本地估算兜底。
    if input == 0 && output == 0 && total == 0 {
        return None;
    }
    Some((
        input,
        usage_cached_input_tokens(usage).min(input),
        output,
        total,
    ))
}

fn approximate_tokens(value: &Value) -> i64 {
    let text = value.to_string();
    if text.is_empty() {
        0
    } else {
        ((text.chars().count() as i64 + 3) / 4).max(1)
    }
}

fn estimated_request_tokens(body: &Value) -> i64 {
    approximate_tokens(body.get("messages").unwrap_or(body))
}

fn estimated_sse_output_tokens(line: &str) -> i64 {
    let Some(data) = line.strip_prefix("data:").map(str::trim) else {
        return 0;
    };
    if data.is_empty() || data == "[DONE]" {
        return 0;
    }
    let Ok(payload) = serde_json::from_str::<Value>(data) else {
        return 0;
    };
    payload
        .get("choices")
        .and_then(Value::as_array)
        .map(|choices| {
            choices
                .iter()
                .map(|choice| {
                    choice
                        .pointer("/delta/content")
                        .or_else(|| choice.pointer("/text"))
                        .map(approximate_tokens)
                        .unwrap_or(0)
                })
                .sum()
        })
        .unwrap_or(0)
}

fn update_usage_from_sse_line(
    line: &str,
    input: &mut i64,
    cached_input: &mut i64,
    output: &mut i64,
    total: &mut i64,
) -> bool {
    let Some(data) = line.strip_prefix("data:").map(str::trim) else {
        return false;
    };
    if data.is_empty() || data == "[DONE]" {
        return false;
    }
    let Ok(payload) = serde_json::from_str::<Value>(data) else {
        return false;
    };
    let usage = payload.get("usage").unwrap_or(&payload);
    let Some((new_input, new_cached, new_output, new_total)) = usage_counts(usage) else {
        return false;
    };
    *input = (*input).max(new_input);
    *cached_input = (*cached_input).max(new_cached);
    *output = (*output).max(new_output);
    *total = (*total).max(new_total);
    true
}

fn provider_error_message(payload: &Value) -> Option<String> {
    let error = payload.get("error").filter(|value| !value.is_null());
    if let Some(error) = error {
        return Some(
            error
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| error.as_str())
                .unwrap_or("上游返回错误")
                .to_string(),
        );
    }
    let explicitly_failed = payload.get("success").and_then(Value::as_bool) == Some(false)
        || payload
            .get("status")
            .and_then(Value::as_str)
            .is_some_and(|status| {
                matches!(status.to_ascii_lowercase().as_str(), "error" | "failed")
            });
    if explicitly_failed {
        return Some(
            payload
                .get("message")
                .or_else(|| payload.get("msg"))
                .and_then(Value::as_str)
                .unwrap_or("上游返回失败状态")
                .to_string(),
        );
    }
    None
}

fn stream_error_message(buffer: &str) -> Option<String> {
    for line in buffer.lines() {
        let data = line
            .strip_prefix("data:")
            .map(str::trim)
            .unwrap_or(line.trim());
        if data.is_empty() || data == "[DONE]" || !data.starts_with('{') {
            continue;
        }
        if let Ok(payload) = serde_json::from_str::<Value>(data) {
            if let Some(message) = provider_error_message(&payload) {
                return Some(message);
            }
        }
    }
    None
}

fn stream_has_valid_payload(buffer: &str) -> bool {
    buffer.lines().any(|line| {
        let data = line
            .strip_prefix("data:")
            .map(str::trim)
            .unwrap_or(line.trim());
        if data == "[DONE]" {
            return true;
        }
        let Ok(payload) = serde_json::from_str::<Value>(data) else {
            return false;
        };
        if provider_error_message(&payload).is_some() {
            return false;
        }
        // role、id、usage 等元数据还不算真正开始输出。继续在网关内缓冲，
        // 这样上游若紧接着返回 error，仍可无感切换渠道。
        payload
            .pointer("/choices/0/delta/content")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.is_empty())
            || payload
                .pointer("/choices/0/delta/reasoning_content")
                .and_then(Value::as_str)
                .is_some_and(|value| !value.is_empty())
            || payload
                .pointer("/choices/0/delta/tool_calls")
                .and_then(Value::as_array)
                .is_some_and(|value| !value.is_empty())
            || payload.pointer("/choices/0/delta/function_call").is_some()
            || payload
                .pointer("/choices/0/finish_reason")
                .is_some_and(|value| !value.is_null())
            || payload
                .get("delta")
                .and_then(Value::as_str)
                .is_some_and(|value| !value.is_empty())
    })
}

#[derive(Debug)]
struct RouteCandidate {
    id: String,
    name: String,
    base_url: String,
    timeout_seconds: i64,
    priority: i64,
}

fn route_candidates(
    state: &AppState,
    channel_ids: &[String],
    primary_id: &str,
    fallback_id: Option<&str>,
    upstream_model: &str,
) -> Result<Vec<RouteCandidate>, String> {
    let conn = open_db(state)?;
    let mut stmt = conn.prepare(
        "SELECT id,name,base_url,models,timeout_seconds,priority FROM channels WHERE enabled=1 ORDER BY priority ASC,name ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    let candidate = |row: &(String, String, String, String, i64, i64)| RouteCandidate {
        id: row.0.clone(),
        name: row.1.clone(),
        base_url: row.2.clone(),
        timeout_seconds: row.4,
        priority: row.5,
    };

    // 新版模型映射按每个模型保存的渠道顺序路由，不再受渠道全局优先级影响。
    if !channel_ids.is_empty() {
        return Ok(channel_ids
            .iter()
            .filter_map(|id| {
                rows.iter()
                    .find(|row| &row.0 == id)
                    .map(|row| candidate(row))
            })
            .collect());
    }

    // 兼容旧数据：首选、指定备用、其余支持同名模型的渠道。
    let mut primary = None;
    let mut explicit_fallback = None;
    let mut fallbacks = Vec::new();
    for row in &rows {
        let supports_model = row
            .3
            .split(',')
            .map(str::trim)
            .any(|m| m.eq_ignore_ascii_case(upstream_model));
        if row.0 == primary_id {
            primary = Some(candidate(row));
        } else if fallback_id == Some(row.0.as_str()) {
            explicit_fallback = Some(candidate(row));
        } else if supports_model {
            fallbacks.push(candidate(row));
        }
    }
    fallbacks.sort_by_key(|c| c.priority);
    let mut result = Vec::new();
    result.extend(primary);
    result.extend(explicit_fallback);
    result.extend(fallbacks);
    Ok(result)
}

async fn models_endpoint(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if authorize(&state, &headers).is_none() {
        return openai_error(StatusCode::UNAUTHORIZED, "无效的客户端 API Key");
    }
    let conn = match open_db(&state) {
        Ok(c) => c,
        Err(e) => return openai_error(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let mut stmt = match conn
        .prepare("SELECT unified_name FROM model_mappings WHERE enabled = 1 ORDER BY unified_name")
    {
        Ok(s) => s,
        Err(e) => return openai_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };
    let models = stmt.query_map([], |r| Ok(json!({"id": r.get::<_, String>(0)?, "object": "model", "owned_by": "local-gateway"}))).ok()
        .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>()).unwrap_or_default();
    Json(json!({"object": "list", "data": models})).into_response()
}

fn authorize(state: &AppState, headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?.trim();
    let key = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))?;
    let conn = open_db(state).ok()?;
    conn.query_row(
        "SELECT key_prefix FROM client_keys WHERE key_hash = ?1 AND enabled = 1",
        [key],
        |r| r.get(0),
    )
    .ok()
}

fn openai_error(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(json!({"error": {"message": message, "type": "gateway_error"}})),
    )
        .into_response()
}

async fn chat_completions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let key_prefix = match authorize(&state, &headers) {
        Some(v) => v,
        None => return openai_error(StatusCode::UNAUTHORIZED, "无效的客户端 API Key"),
    };
    let requested = body
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if requested.is_empty() {
        return openai_error(StatusCode::BAD_REQUEST, "缺少 model");
    }
    let conn = match open_db(&state) {
        Ok(c) => c,
        Err(e) => return openai_error(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let selected: Result<(String, Option<String>, String, String), _> = conn.query_row(
        "SELECT channel_id,fallback_channel_id,upstream_model,channel_ids FROM model_mappings WHERE unified_name=?1 AND enabled=1",
        [&requested],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    );
    let (channel_id, fallback_channel_id, upstream_model, channel_ids_json) = match selected {
        Ok(v) => v,
        Err(_) => return openai_error(StatusCode::NOT_FOUND, "未找到可用的模型映射"),
    };
    drop(conn);
    let channel_ids = serde_json::from_str::<Vec<String>>(&channel_ids_json).unwrap_or_default();
    let candidates = match route_candidates(
        &state,
        &channel_ids,
        &channel_id,
        fallback_channel_id.as_deref(),
        &upstream_model,
    ) {
        Ok(v) if !v.is_empty() => v,
        _ => return openai_error(StatusCode::NOT_FOUND, "未找到支持该模型的启用渠道"),
    };
    let mut request_body = body.clone();
    request_body["model"] = Value::String(upstream_model.clone());
    let is_stream = body.get("stream").and_then(Value::as_bool).unwrap_or(false);
    if is_stream {
        if let Some(options) = request_body
            .get_mut("stream_options")
            .and_then(Value::as_object_mut)
        {
            options.insert("include_usage".into(), Value::Bool(true));
        } else {
            request_body["stream_options"] = json!({"include_usage": true});
        }
    }
    let mut last_error = "所有可用渠道均请求失败".to_string();
    for candidate in &candidates {
        let api_key = match secret_entry(&format!("channel-{}", candidate.id))
            .and_then(|e| e.get_password().map_err(|x| x.to_string()))
        {
            Ok(v) => v,
            Err(_) => {
                last_error = format!("渠道“{}”缺少 API Key", candidate.name);
                continue;
            }
        };
        let started = Instant::now();
        let endpoint = format!(
            "{}/v1/chat/completions",
            normalize_base_url(&candidate.base_url)
        );
        match state
            .client
            .post(endpoint)
            .timeout(std::time::Duration::from_secs(
                candidate.timeout_seconds.max(1) as u64,
            ))
            .bearer_auth(api_key)
            .json(&request_body)
            .send()
            .await
        {
            Ok(upstream) => {
                let status = upstream.status();
                let latency = started.elapsed().as_millis() as i64;
                if is_stream && status.is_success() {
                    // 在把 HTTP 200 提交给客户端之前，先由网关读取并验证首个 SSE 事件。
                    // 很多兼容上游会用 200 + error 事件表示失败；如果直接转发，客户端
                    // 已经收到响应头，网关便再也无法无感切换到下一个渠道。
                    let mut upstream_stream = upstream.bytes_stream();
                    let mut prefetched = Vec::new();
                    let mut preflight_text = String::new();
                    let preflight = tokio::time::timeout(
                        std::time::Duration::from_secs(candidate.timeout_seconds.max(1) as u64),
                        async {
                            while preflight_text.len() < 256 * 1024 {
                                match upstream_stream.next().await {
                                    Some(Ok(chunk)) => {
                                        preflight_text.push_str(&String::from_utf8_lossy(&chunk));
                                        prefetched.push(chunk);
                                        if let Some(message) = stream_error_message(&preflight_text)
                                        {
                                            return Err(message);
                                        }
                                        if stream_has_valid_payload(&preflight_text) {
                                            return Ok(());
                                        }
                                    }
                                    Some(Err(error)) => return Err(error.to_string()),
                                    None => return Err("上游返回了空的流式响应".to_string()),
                                }
                            }
                            Err("上游流式响应首批数据无法识别".to_string())
                        },
                    )
                    .await;
                    match preflight {
                        Ok(Ok(())) => {}
                        Ok(Err(message)) => {
                            last_error = format!("渠道“{}”：{}", candidate.name, message);
                            continue;
                        }
                        Err(_) => {
                            last_error =
                                format!("渠道“{}”：等待首个有效流式事件超时", candidate.name);
                            continue;
                        }
                    }

                    // 流响应可能很久才结束，甚至客户端会主动断开。记录创建时就写入
                    // 请求 Token 估算值，避免调用记录在整个流式期间错误显示为 0。
                    let estimated_input = estimated_request_tokens(&body);
                    let log_id = save_call_log(
                        &state,
                        &key_prefix,
                        &requested,
                        &upstream_model,
                        estimated_input,
                        0,
                        0,
                        latency,
                        "流式中",
                        None,
                        candidate.id != channel_id,
                    );
                    let stream_state = state.clone();
                    let stream_log_id = log_id.clone();
                    let mut upstream_stream = futures_util::stream::iter(
                        prefetched.into_iter().map(Ok::<_, reqwest::Error>),
                    )
                    .chain(upstream_stream);
                    let (sender, mut receiver) =
                        mpsc::unbounded_channel::<Result<Vec<u8>, std::io::Error>>();
                    tokio::spawn(async move {
                        let mut pending = String::new();
                        let mut input = 0_i64;
                        let mut cached_input = 0_i64;
                        let mut output = 0_i64;
                        let mut total = 0_i64;
                        let mut estimated_output = 0_i64;
                        let mut usage_seen = false;
                        let mut last_saved_output = 0_i64;
                        let mut forwarding = true;
                        while let Some(item) = upstream_stream.next().await {
                            let chunk = match item {
                                Ok(chunk) => chunk,
                                Err(error) => {
                                    let message = error.to_string();
                                    let final_input = input.max(estimated_input);
                                    let final_output = output.max(estimated_output);
                                    update_call_log(
                                        &stream_state,
                                        &stream_log_id,
                                        final_input,
                                        cached_input,
                                        final_output,
                                        started.elapsed().as_millis() as i64,
                                        "失败",
                                        Some(&message),
                                    );
                                    if forwarding {
                                        let _ = sender.send(Err(std::io::Error::other(message)));
                                    }
                                    return;
                                }
                            };
                            pending.push_str(&String::from_utf8_lossy(&chunk));
                            while let Some(newline) = pending.find('\n') {
                                let line = pending[..newline].trim_end_matches('\r').to_string();
                                pending.drain(..=newline);
                                if update_usage_from_sse_line(
                                    &line,
                                    &mut input,
                                    &mut cached_input,
                                    &mut output,
                                    &mut total,
                                ) {
                                    usage_seen = true;
                                } else if !usage_seen {
                                    estimated_output += estimated_sse_output_tokens(&line);
                                }
                            }
                            // 首批输出到达后立即回填，此后分批更新，刷新页面时不再看到
                            // 正在生成内容的请求仍然长期保持“输出 0”。
                            let current_output = output.max(estimated_output);
                            if current_output > last_saved_output
                                && (last_saved_output == 0
                                    || current_output - last_saved_output >= 16
                                    || usage_seen)
                            {
                                update_call_log(
                                    &stream_state,
                                    &stream_log_id,
                                    if input > 0 { input } else { estimated_input },
                                    cached_input,
                                    current_output,
                                    started.elapsed().as_millis() as i64,
                                    "流式中",
                                    None,
                                );
                                last_saved_output = current_output;
                            }
                            if forwarding && sender.send(Ok(chunk.to_vec())).is_err() {
                                forwarding = false;
                            }
                        }
                        if !pending.trim().is_empty() {
                            if update_usage_from_sse_line(
                                pending.trim(),
                                &mut input,
                                &mut cached_input,
                                &mut output,
                                &mut total,
                            ) {
                                usage_seen = true;
                            } else if !usage_seen {
                                estimated_output += estimated_sse_output_tokens(pending.trim());
                            }
                        }
                        let final_input = input.max(estimated_input);
                        let final_output = output.max(estimated_output);
                        let final_status = if usage_seen {
                            "成功"
                        } else {
                            "成功（估算）"
                        };
                        update_call_log(
                            &stream_state,
                            &stream_log_id,
                            final_input,
                            cached_input,
                            final_output,
                            started.elapsed().as_millis() as i64,
                            final_status,
                            None,
                        );
                    });
                    let stream = async_stream::stream! {
                        while let Some(item) = receiver.recv().await {
                            yield item;
                        }
                    };
                    return Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "text/event-stream; charset=utf-8")
                        .body(Body::from_stream(stream))
                        .unwrap();
                }
                let payload = upstream
                    .json::<Value>()
                    .await
                    .unwrap_or_else(|_| json!({"error": {"message": "上游返回了无法解析的响应"}}));
                if status.is_success() {
                    if let Some(message) = provider_error_message(&payload) {
                        last_error = format!("渠道“{}”：{}", candidate.name, message);
                        continue;
                    }
                }
                let usage = payload.get("usage").cloned().unwrap_or_default();
                let (input, cached_input, output) = usage_counts(&usage)
                    .map(|(input, cached, output, _)| (input, cached, output))
                    .unwrap_or_else(|| {
                        (
                            estimated_request_tokens(&body),
                            0,
                            approximate_tokens(payload.get("choices").unwrap_or(&payload)),
                        )
                    });
                if status.is_success() {
                    save_call_log(
                        &state,
                        &key_prefix,
                        &requested,
                        &upstream_model,
                        input,
                        cached_input,
                        output,
                        latency,
                        "成功",
                        None,
                        candidate.id != channel_id,
                    );
                    return (StatusCode::OK, Json(payload)).into_response();
                }
                last_error = payload
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .unwrap_or("上游请求失败")
                    .to_string();
            }
            Err(e) => {
                last_error = format!("渠道“{}”：{}", candidate.name, e);
            }
        }
    }
    save_call_log(
        &state,
        &key_prefix,
        &requested,
        &upstream_model,
        0,
        0,
        0,
        0,
        "失败",
        Some(&last_error),
        candidates
            .iter()
            .any(|candidate| candidate.id != channel_id),
    );
    openai_error(StatusCode::BAD_GATEWAY, &last_error)
}

async fn start_server(state: AppState, handle: AppHandle) -> Result<(), String> {
    let mut guard = state.server.lock().await;
    if guard.is_some() {
        return Ok(());
    }
    let settings = read_settings(&state)?;
    let addr: SocketAddr = format!("{}:{}", settings.listen_host, settings.port)
        .parse()
        .map_err(|_| "监听地址或端口无效".to_string())?;
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|_| format!("端口 {} 已被占用，请在设置中更换端口", settings.port))?;
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    *guard = Some(shutdown_tx);
    let app = Router::new()
        .route("/v1/models", get(models_endpoint))
        .route("/v1/chat/completions", post(chat_completions))
        .route("/health", get(|| async { Json(json!({"status":"ok"})) }))
        .layer(CorsLayer::permissive())
        .with_state(state.clone());
    tauri::async_runtime::spawn(async move {
        let _ = handle.emit("gateway-status-changed", true);
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await;
        let _ = handle.emit("gateway-status-changed", false);
    });
    Ok(())
}

async fn stop_server(state: &AppState) {
    if let Some(tx) = state.server.lock().await.take() {
        let _ = tx.send(());
    }
}

#[tauri::command]
async fn get_gateway_status(state: tauri::State<'_, AppState>) -> Result<GatewayStatus, String> {
    let settings = read_settings(&state)?;
    let conn = open_db(&state)?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    let model_count = conn
        .query_row(
            "SELECT COUNT(*) FROM model_mappings WHERE enabled = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let (requests, tokens): (i64, i64) = conn.query_row("SELECT COUNT(*), COALESCE(SUM(input_tokens + output_tokens), 0) FROM call_logs WHERE created_at LIKE ?1", [format!("{today}%")], |r| Ok((r.get(0)?, r.get(1)?))).unwrap_or((0, 0));
    let error = conn.query_row("SELECT error_message FROM call_logs WHERE status = '失败' ORDER BY created_at DESC LIMIT 1", [], |r| r.get(0)).ok();
    Ok(GatewayStatus {
        running: state.server.lock().await.is_some(),
        host: settings.listen_host.clone(),
        port: settings.port,
        base_url: format!("http://{}:{}/v1", settings.listen_host, settings.port),
        model_count,
        today_requests: requests,
        today_tokens: tokens,
        latest_error: error,
    })
}

#[tauri::command]
async fn start_gateway(state: tauri::State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    start_server(state.inner().clone(), app).await
}
#[tauri::command]
async fn stop_gateway(state: tauri::State<'_, AppState>) -> Result<(), String> {
    stop_server(&state).await;
    Ok(())
}
#[tauri::command]
async fn restart_gateway(state: tauri::State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    stop_server(&state).await;
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    start_server(state.inner().clone(), app).await
}

#[tauri::command]
fn list_channels(state: tauri::State<AppState>) -> Result<Vec<Channel>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn.prepare("SELECT id,name,provider,base_url,models,model_mapping,priority,weight,enabled,timeout_seconds,max_retries,status FROM channels ORDER BY priority,name").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Channel {
                id: r.get(0)?,
                name: r.get(1)?,
                provider: r.get(2)?,
                base_url: r.get(3)?,
                models: r.get(4)?,
                model_mapping: r.get(5)?,
                priority: r.get(6)?,
                weight: r.get(7)?,
                enabled: r.get::<_, i64>(8)? != 0,
                timeout_seconds: r.get(9)?,
                max_retries: r.get(10)?,
                status: r.get(11)?,
                has_api_key: secret_entry(&format!("channel-{}", r.get::<_, String>(0)?))
                    .ok()
                    .and_then(|e| e.get_password().ok())
                    .is_some(),
            })
        })
        .map_err(|e| e.to_string())?;
    let items = rows.filter_map(Result::ok).collect();
    Ok(items)
}

#[tauri::command]
fn save_channel(
    state: tauri::State<AppState>,
    mut channel: Channel,
    api_key: Option<String>,
    auto_create_mappings: Option<bool>,
) -> Result<AutoMappingResult, String> {
    let is_new = channel.id.is_empty();
    if channel.name.trim().is_empty() {
        return Err("渠道名称为必填项".into());
    }
    if channel.provider.trim().is_empty() {
        return Err("服务商类型为必填项".into());
    }
    if channel.base_url.trim().is_empty() {
        return Err("上游 Base URL 为必填项".into());
    }
    let parsed_url = reqwest::Url::parse(channel.base_url.trim())
        .map_err(|_| "上游 Base URL 格式不正确".to_string())?;
    if !matches!(parsed_url.scheme(), "http" | "https") {
        return Err("上游 Base URL 必须以 http:// 或 https:// 开头".into());
    }
    if is_new && api_key.as_deref().unwrap_or_default().trim().is_empty() {
        return Err("新建渠道时 API Key 为必填项".into());
    }
    if channel.id.is_empty() {
        channel.id = Uuid::new_v4().to_string();
    }
    let conn = open_db(&state)?;
    conn.execute("INSERT INTO channels(id,name,provider,base_url,models,model_mapping,priority,weight,enabled,timeout_seconds,max_retries,status) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(id) DO UPDATE SET name=excluded.name,provider=excluded.provider,base_url=excluded.base_url,models=excluded.models,model_mapping=excluded.model_mapping,priority=excluded.priority,weight=excluded.weight,enabled=excluded.enabled,timeout_seconds=excluded.timeout_seconds,max_retries=excluded.max_retries,status=excluded.status", params![channel.id,channel.name,channel.provider,normalize_base_url(&channel.base_url),channel.models,channel.model_mapping,channel.priority,channel.weight,channel.enabled as i64,channel.timeout_seconds,channel.max_retries,channel.status]).map_err(|e| e.to_string())?;
    if let Some(key) = api_key.filter(|v| !v.trim().is_empty()) {
        secret_entry(&format!("channel-{}", channel.id))?
            .set_password(&key)
            .map_err(|e| e.to_string())?;
    }
    if auto_create_mappings.unwrap_or(true) {
        auto_create_model_mappings_inner(&state, &channel.id)
    } else {
        Ok(AutoMappingResult {
            created: 0,
            reprioritized: 0,
            already_existing: 0,
        })
    }
}

#[tauri::command]
fn delete_channel(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute("DELETE FROM channels WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    let _ = secret_entry(&format!("channel-{id}"))
        .and_then(|e| e.delete_credential().map_err(|x| x.to_string()));
    Ok(())
}

#[tauri::command]
async fn test_channel(state: tauri::State<'_, AppState>, id: String) -> Result<String, String> {
    let conn = open_db(&state)?;
    let (base_url,): (String,) = conn
        .query_row("SELECT base_url FROM channels WHERE id=?1", [&id], |r| {
            Ok((r.get(0)?,))
        })
        .map_err(|_| "未找到渠道".to_string())?;
    let key = secret_entry(&format!("channel-{id}"))?
        .get_password()
        .map_err(|_| "请先保存 API Key".to_string())?;
    let result = state
        .client
        .get(format!("{}/v1/models", normalize_base_url(&base_url)))
        .bearer_auth(key)
        .send()
        .await;
    let (status, message) = match result {
        Ok(response) if response.status().is_success() => (
            "正常",
            format!("正常（HTTP {}）", response.status().as_u16()),
        ),
        Ok(response) => {
            let code = response.status().as_u16();
            let hint = match code {
                401 => "API Key 不正确，或 Kimi 中国版/国际版地址与 Key 不匹配",
                403 => "当前 API Key 没有访问权限",
                404 => "接口地址不正确",
                429 => "额度不足或触发限速",
                _ => "上游返回了错误",
            };
            ("失败", format!("失败（HTTP {code}：{hint}）"))
        }
        Err(error) => ("失败", format!("失败（连接错误：{error}）")),
    };
    let conn = open_db(&state)?;
    conn.execute(
        "UPDATE channels SET status=?1 WHERE id=?2",
        params![status, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(message)
}

fn auto_create_model_mappings_inner(
    state: &AppState,
    channel_id: &str,
) -> Result<AutoMappingResult, String> {
    let mut conn = open_db(state)?;
    let (channel_name, models, priority): (String, String, i64) = conn
        .query_row(
            "SELECT name,models,priority FROM channels WHERE id=?1",
            [channel_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|_| "未找到渠道".to_string())?;
    let model_names: Vec<String> = models
        .split(',')
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut result = AutoMappingResult {
        created: 0,
        reprioritized: 0,
        already_existing: 0,
    };
    for model in model_names {
        let unified_name = prefixed_unified_name(&model);
        let existing: Option<(String, i64)> = tx
            .query_row(
                "SELECT m.channel_id, COALESCE(c.priority, 999999) FROM model_mappings m LEFT JOIN channels c ON c.id=m.channel_id WHERE lower(m.unified_name)=lower(?1)",
                [&unified_name],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        if let Some((existing_channel, existing_priority)) = existing {
            if existing_channel != channel_id && priority < existing_priority {
                tx.execute(
                    "UPDATE model_mappings SET channel_id=?1,upstream_model=?2 WHERE lower(unified_name)=lower(?3)",
                    params![channel_id, model, unified_name],
                )
                .map_err(|e| e.to_string())?;
                result.reprioritized += 1;
            } else {
                result.already_existing += 1;
            }
            continue;
        }
        let prices: Vec<(Option<f64>, f64, f64, String, String, String)> = {
            let mut stmt = tx
                .prepare(
                    "SELECT cached_input_price,input_price,output_price,currency,source_url,updated_at FROM official_prices WHERE lower(model)=lower(?1) AND (provider=?2 OR provider LIKE ?3)",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(
                    params![model, channel_name, format!("{channel_name} · %")],
                    |r| {
                        Ok((
                            r.get(0)?,
                            r.get(1)?,
                            r.get(2)?,
                            r.get(3)?,
                            r.get(4)?,
                            r.get(5)?,
                        ))
                    },
                )
                .map_err(|e| e.to_string())?;
            rows.filter_map(Result::ok).collect()
        };
        let (cached, input, output, currency, source, updated) = if prices.len() == 1 {
            let price = &prices[0];
            (
                price.0,
                price.1,
                price.2,
                price.3.clone(),
                price.4.clone(),
                Some(price.5.clone()),
            )
        } else {
            (
                None,
                0.0,
                0.0,
                "USD".to_string(),
                if prices.is_empty() {
                    "自动同名映射；尚未同步到价格".to_string()
                } else {
                    "自动同名映射；存在多个计费分组，请手动选择价格".to_string()
                },
                None,
            )
        };
        tx.execute(
            "INSERT INTO model_mappings(id,unified_name,channel_id,upstream_model,fallback_channel_id,context_length,cached_input_price,input_price,output_price,currency,price_source,price_updated_at,enabled) VALUES(?1,?2,?3,?4,NULL,128000,?5,?6,?7,?8,?9,?10,1)",
            params![Uuid::new_v4().to_string(),unified_name,channel_id,model,cached,input,output,currency,source,updated],
        )
        .map_err(|e| e.to_string())?;
        result.created += 1;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn auto_create_model_mappings(
    state: tauri::State<AppState>,
    channel_id: String,
) -> Result<AutoMappingResult, String> {
    auto_create_model_mappings_inner(&state, &channel_id)
}

#[tauri::command]
fn list_model_mappings(state: tauri::State<AppState>) -> Result<Vec<ModelMapping>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn.prepare("SELECT id,unified_name,channel_id,upstream_model,fallback_channel_id,channel_ids,context_length,cached_input_price,input_price,output_price,currency,price_source,price_updated_at,enabled FROM model_mappings ORDER BY unified_name").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ModelMapping {
                id: r.get(0)?,
                unified_name: r.get(1)?,
                channel_id: r.get(2)?,
                upstream_model: r.get(3)?,
                fallback_channel_id: r.get(4)?,
                channel_ids: serde_json::from_str(&r.get::<_, String>(5)?).unwrap_or_default(),
                context_length: r.get(6)?,
                cached_input_price: r.get(7)?,
                input_price: r.get(8)?,
                output_price: r.get(9)?,
                currency: r.get(10)?,
                price_source: r.get(11)?,
                price_updated_at: r.get(12)?,
                enabled: r.get::<_, i64>(13)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}
#[tauri::command]
fn save_model_mapping(
    state: tauri::State<AppState>,
    mut model: ModelMapping,
) -> Result<(), String> {
    if model.id.is_empty() {
        model.id = Uuid::new_v4().to_string()
    }
    model.unified_name = prefixed_unified_name(&model.unified_name);
    model.channel_ids.retain(|id| !id.trim().is_empty());
    model.channel_ids.dedup();
    if model.channel_ids.is_empty() {
        model.channel_ids.push(model.channel_id.clone());
        if let Some(id) = model.fallback_channel_id.clone() {
            if id != model.channel_id {
                model.channel_ids.push(id);
            }
        }
    }
    if model.channel_ids.is_empty() || model.channel_ids[0].is_empty() {
        return Err("请至少为模型选择一个渠道".into());
    }
    model.channel_id = model.channel_ids[0].clone();
    model.fallback_channel_id = model.channel_ids.get(1).cloned();
    let channel_ids_json = serde_json::to_string(&model.channel_ids).map_err(|e| e.to_string())?;
    let c = open_db(&state)?;
    if model.input_price <= 0.0 && model.output_price <= 0.0 {
        if let Ok((cached, input, output, currency, source, updated)) = c.query_row(
            "SELECT cached_input_price,input_price,output_price,currency,source_url,updated_at FROM official_prices WHERE lower(model)=lower(?1) ORDER BY CASE WHEN provider LIKE '%官方%' THEN 0 ELSE 1 END LIMIT 1",
            [&model.upstream_model],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        ) {
            model.cached_input_price = cached;
            model.input_price = input;
            model.output_price = output;
            model.currency = currency;
            model.price_source = source;
            model.price_updated_at = Some(updated);
        }
    }
    c.execute(
        "INSERT INTO model_mappings(id,unified_name,channel_id,upstream_model,fallback_channel_id,channel_ids,context_length,cached_input_price,input_price,output_price,currency,price_source,price_updated_at,enabled) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14) ON CONFLICT(id) DO UPDATE SET unified_name=excluded.unified_name,channel_id=excluded.channel_id,upstream_model=excluded.upstream_model,fallback_channel_id=excluded.fallback_channel_id,channel_ids=excluded.channel_ids,context_length=excluded.context_length,cached_input_price=excluded.cached_input_price,input_price=excluded.input_price,output_price=excluded.output_price,currency=excluded.currency,price_source=excluded.price_source,price_updated_at=excluded.price_updated_at,enabled=excluded.enabled",
        params![model.id,model.unified_name,model.channel_id,model.upstream_model,model.fallback_channel_id,channel_ids_json,model.context_length,model.cached_input_price,model.input_price,model.output_price,model.currency,model.price_source,model.price_updated_at,model.enabled as i64]
    ).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
fn delete_model_mapping(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    open_db(&state)?
        .execute("DELETE FROM model_mappings WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn number_at(value: &Value, key: &str, default: f64) -> f64 {
    value.get(key).and_then(Value::as_f64).unwrap_or(default)
}

fn parse_pricing_response(payload: &Value, provider: &str, source_url: &str) -> Vec<OfficialPrice> {
    let list = payload
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| payload.pointer("/data/data").and_then(Value::as_array));
    let group_ratios = payload
        .get("group_ratio")
        .or_else(|| payload.pointer("/data/group_ratio"))
        .and_then(Value::as_object);
    let updated_at = now();
    let Some(rows) = list else { return Vec::new() };
    rows.iter()
        .flat_map(|row| {
            let model = row
                .get("model_name")
                .or_else(|| row.get("model"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let quota_type = row.get("quota_type").and_then(Value::as_i64).unwrap_or(0);
            if model.is_empty() || quota_type != 0 {
                return Vec::new();
            }
            let ratio = number_at(row, "model_ratio", 0.0);
            if ratio <= 0.0 {
                return Vec::new();
            }
            let completion_ratio = number_at(row, "completion_ratio", 1.0);
            let cache_ratio = row.get("cache_ratio").and_then(Value::as_f64);
            let cache_create_ratio = row.get("create_cache_ratio").and_then(Value::as_f64);
            let enabled_groups = row.get("enable_groups").and_then(Value::as_array);
            let groups: Vec<(String, f64)> = match (group_ratios, enabled_groups) {
                (Some(ratios), Some(enabled)) => enabled
                    .iter()
                    .filter_map(Value::as_str)
                    .filter_map(|group| {
                        if group == "default" {
                            Some((group.to_string(), 1.0))
                        } else {
                            ratios
                                .get(group)
                                .and_then(Value::as_f64)
                                .map(|ratio| (group.to_string(), ratio))
                        }
                    })
                    .collect(),
                _ => vec![(
                    String::new(),
                    group_ratios
                        .and_then(|ratios| ratios.get("default"))
                        .and_then(Value::as_f64)
                        .unwrap_or(1.0),
                )],
            };
            groups
                .into_iter()
                .map(|(group, multiplier)| {
                    let input_price = ratio * 2.0 * multiplier;
                    OfficialPrice {
                        provider: if group.is_empty() {
                            provider.into()
                        } else {
                            format!("{provider} · {group}")
                        },
                        model: model.clone(),
                        cached_input_price: cache_ratio.map(|value| input_price * value),
                        input_price,
                        output_price: input_price * completion_ratio,
                        cache_write_price: cache_create_ratio.map(|value| input_price * value),
                        cache_storage_price: None,
                        extra_charges: String::new(),
                        currency: "USD".into(),
                        context_length: 0,
                        source_url: source_url.into(),
                        updated_at: updated_at.clone(),
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect()
}

fn parse_provider_pricing_response(
    payload: &Value,
    provider: &str,
    source_url: &str,
) -> Vec<OfficialPrice> {
    let Some(rows) = payload.pointer("/data/models").and_then(Value::as_array) else {
        return Vec::new();
    };
    let currency = payload
        .pointer("/data/currency")
        .and_then(Value::as_str)
        .unwrap_or("USD");
    let updated_at = payload
        .pointer("/data/updated_at")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(now);
    rows.iter()
        .filter_map(|row| {
            if !row.get("enabled").and_then(Value::as_bool).unwrap_or(true) {
                return None;
            }
            let model = row.get("model_name").and_then(Value::as_str)?.to_string();
            let group = row
                .get("group_name")
                .and_then(Value::as_str)
                .unwrap_or("默认分组");
            let input_price = row.get("input_price").and_then(Value::as_f64)?;
            let output_price = row.get("output_price").and_then(Value::as_f64)?;
            Some(OfficialPrice {
                provider: format!("{provider} · {group}"),
                model,
                cached_input_price: row.get("cache_input_price").and_then(Value::as_f64),
                input_price,
                output_price,
                cache_write_price: row.get("cache_create_price").and_then(Value::as_f64),
                cache_storage_price: None,
                extra_charges: row
                    .get("note")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                currency: currency.into(),
                context_length: 0,
                source_url: source_url.into(),
                updated_at: updated_at.clone(),
            })
        })
        .collect()
}

fn parse_ratio_response(payload: &Value, provider: &str, source_url: &str) -> Vec<OfficialPrice> {
    let data = payload.get("data").unwrap_or(payload);
    let Some(model_ratios) = data.get("model_ratio").and_then(Value::as_object) else {
        return Vec::new();
    };
    let completion = data.get("completion_ratio").and_then(Value::as_object);
    let updated_at = now();
    model_ratios
        .iter()
        .filter_map(|(model, ratio_value)| {
            let ratio = ratio_value.as_f64()?;
            let completion_ratio = completion
                .and_then(|m| m.get(model))
                .and_then(Value::as_f64)
                .unwrap_or(1.0);
            let input_price = ratio * 2.0;
            Some(OfficialPrice {
                provider: provider.into(),
                model: model.clone(),
                cached_input_price: None,
                input_price,
                output_price: input_price * completion_ratio,
                cache_write_price: None,
                cache_storage_price: None,
                extra_charges: String::new(),
                currency: "USD".into(),
                context_length: 0,
                source_url: source_url.into(),
                updated_at: updated_at.clone(),
            })
        })
        .collect()
}

fn persist_prices(
    state: &AppState,
    channel_id: Option<&str>,
    items: &[OfficialPrice],
) -> Result<i64, String> {
    let mut conn = open_db(state)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut updated_models = 0;
    let model_counts = items.iter().fold(
        std::collections::HashMap::<String, usize>::new(),
        |mut counts, item| {
            *counts.entry(item.model.to_lowercase()).or_default() += 1;
            counts
        },
    );
    for item in items {
        tx.execute(
            "INSERT INTO official_prices(provider,model,cached_input_price,input_price,output_price,currency,context_length,source_url,updated_at,cache_write_price,cache_storage_price,extra_charges) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(provider,model) DO UPDATE SET cached_input_price=excluded.cached_input_price,input_price=excluded.input_price,output_price=excluded.output_price,currency=excluded.currency,context_length=excluded.context_length,source_url=excluded.source_url,updated_at=excluded.updated_at,cache_write_price=excluded.cache_write_price,cache_storage_price=excluded.cache_storage_price,extra_charges=excluded.extra_charges",
            params![item.provider,item.model,item.cached_input_price,item.input_price,item.output_price,item.currency,item.context_length,item.source_url,item.updated_at,item.cache_write_price,item.cache_storage_price,item.extra_charges],
        ).map_err(|e| e.to_string())?;
        let changed = if model_counts.get(&item.model.to_lowercase()).copied().unwrap_or(0) > 1 {
            Ok::<usize, rusqlite::Error>(0)
        } else if let Some(id) = channel_id {
            tx.execute(
                "UPDATE model_mappings SET cached_input_price=?1,input_price=?2,output_price=?3,currency=?4,price_source=?5,price_updated_at=?6 WHERE channel_id=?7 AND lower(upstream_model)=lower(?8)",
                params![item.cached_input_price,item.input_price,item.output_price,item.currency,item.source_url,item.updated_at,id,item.model],
            )
        } else {
            tx.execute(
                "UPDATE model_mappings SET cached_input_price=?1,input_price=?2,output_price=?3,currency=?4,price_source=?5,price_updated_at=?6 WHERE lower(upstream_model)=lower(?7)",
                params![item.cached_input_price,item.input_price,item.output_price,item.currency,item.source_url,item.updated_at,item.model],
            )
        }.map_err(|e| e.to_string())?;
        updated_models += changed as i64;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(updated_models)
}

fn clear_channel_prices(state: &AppState, channel_name: &str) -> Result<(), String> {
    let conn = open_db(state)?;
    conn.execute(
        "DELETE FROM official_prices WHERE provider=?1 OR provider LIKE ?2",
        params![channel_name, format!("{channel_name} · %")],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn reference_prices_for_provider(
    state: &AppState,
    provider: &str,
) -> Result<Vec<OfficialPrice>, String> {
    let label = match provider {
        "DeepSeek" => "DeepSeek 官方",
        "Kimi / Moonshot" => "Kimi 官方",
        _ => return Ok(Vec::new()),
    };
    let conn = open_db(state)?;
    let mut stmt = conn.prepare("SELECT provider,model,cached_input_price,input_price,output_price,currency,context_length,source_url,updated_at,cache_write_price,cache_storage_price,extra_charges FROM official_prices WHERE provider=?1 ORDER BY model").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([label], |r| {
            Ok(OfficialPrice {
                provider: r.get(0)?,
                model: r.get(1)?,
                cached_input_price: r.get(2)?,
                input_price: r.get(3)?,
                output_price: r.get(4)?,
                currency: r.get(5)?,
                context_length: r.get(6)?,
                source_url: r.get(7)?,
                updated_at: r.get(8)?,
                cache_write_price: r.get(9)?,
                cache_storage_price: r.get(10)?,
                extra_charges: r.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
async fn sync_channel_pricing(
    state: tauri::State<'_, AppState>,
    channel_id: String,
) -> Result<PriceSyncResult, String> {
    let conn = open_db(&state)?;
    let (name, base_url, provider): (String, String, String) = conn
        .query_row(
            "SELECT name,base_url,provider FROM channels WHERE id=?1",
            [&channel_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|_| "未找到渠道".to_string())?;
    drop(conn);
    let root = normalize_base_url(&base_url);
    let key = secret_entry(&format!("channel-{channel_id}"))
        .ok()
        .and_then(|e| e.get_password().ok());
    let provider_pricing_url = format!("{root}/api/provider/pricing");
    let mut provider_request = state.client.get(&provider_pricing_url);
    if let Some(ref value) = key {
        provider_request = provider_request.bearer_auth(value);
    }
    let mut failed_sources = Vec::new();
    let mut items = match provider_request.send().await {
        Ok(response) if response.status().is_success() => response
            .json::<Value>()
            .await
            .ok()
            .map(|v| parse_provider_pricing_response(&v, &name, &provider_pricing_url))
            .unwrap_or_default(),
        Ok(response) => {
            failed_sources.push(format!("{provider_pricing_url} ({})", response.status()));
            Vec::new()
        }
        Err(e) => {
            failed_sources.push(format!("{provider_pricing_url} ({e})"));
            Vec::new()
        }
    };
    let pricing_url = format!("{root}/api/pricing");
    if items.is_empty() {
        let mut pricing_request = state.client.get(&pricing_url);
        if let Some(ref value) = key {
            pricing_request = pricing_request.bearer_auth(value);
        }
        items = match pricing_request.send().await {
            Ok(response) if response.status().is_success() => response
                .json::<Value>()
                .await
                .ok()
                .map(|v| parse_pricing_response(&v, &name, &pricing_url))
                .unwrap_or_default(),
            Ok(response) => {
                failed_sources.push(format!("{pricing_url} ({})", response.status()));
                Vec::new()
            }
            Err(e) => {
                failed_sources.push(format!("{pricing_url} ({e})"));
                Vec::new()
            }
        };
    }
    if items.is_empty() {
        let ratio_url = format!("{root}/api/ratio_config");
        let mut ratio_request = state.client.get(&ratio_url);
        if let Some(ref value) = key {
            ratio_request = ratio_request.bearer_auth(value);
        }
        items = match ratio_request.send().await {
            Ok(response) if response.status().is_success() => response
                .json::<Value>()
                .await
                .ok()
                .map(|v| parse_ratio_response(&v, &name, &ratio_url))
                .unwrap_or_default(),
            Ok(response) => {
                failed_sources.push(format!("{ratio_url} ({})", response.status()));
                Vec::new()
            }
            Err(e) => {
                failed_sources.push(format!("{ratio_url} ({e})"));
                Vec::new()
            }
        };
    }
    if items.is_empty() {
        items = reference_prices_for_provider(&state, &provider)?;
    }
    if items.is_empty() {
        return Err(format!(
            "该渠道未提供可识别的公开价格接口。{}",
            failed_sources.join("；")
        ));
    }
    clear_channel_prices(&state, &name)?;
    let updated_models = persist_prices(&state, Some(&channel_id), &items)?;
    Ok(PriceSyncResult {
        items,
        updated_models,
        failed_sources,
        synced_at: now(),
    })
}

#[tauri::command]
fn list_price_catalog(state: tauri::State<AppState>) -> Result<Vec<OfficialPrice>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn.prepare("SELECT provider,model,cached_input_price,input_price,output_price,currency,context_length,source_url,updated_at,cache_write_price,cache_storage_price,extra_charges FROM official_prices ORDER BY provider,model").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(OfficialPrice {
                provider: r.get(0)?,
                model: r.get(1)?,
                cached_input_price: r.get(2)?,
                input_price: r.get(3)?,
                output_price: r.get(4)?,
                cache_write_price: r.get(9)?,
                cache_storage_price: r.get(10)?,
                extra_charges: r.get(11)?,
                currency: r.get(5)?,
                context_length: r.get(6)?,
                source_url: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
fn list_client_keys(state: tauri::State<AppState>) -> Result<Vec<ClientKey>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn.prepare("SELECT id,name,key_prefix,enabled,allowed_models,daily_quota,monthly_quota,request_limit,token_limit,expires_at,ip_allowlist,created_at FROM client_keys ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ClientKey {
                id: r.get(0)?,
                name: r.get(1)?,
                key_prefix: r.get(2)?,
                key_value: None,
                enabled: r.get::<_, i64>(3)? != 0,
                allowed_models: r.get(4)?,
                daily_quota: r.get(5)?,
                monthly_quota: r.get(6)?,
                request_limit: r.get(7)?,
                token_limit: r.get(8)?,
                expires_at: r.get(9)?,
                ip_allowlist: r.get(10)?,
                created_at: r.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}
#[tauri::command]
fn create_client_key(state: tauri::State<AppState>, name: String) -> Result<ClientKey, String> {
    let id = Uuid::new_v4().to_string();
    let raw = key_value();
    let prefix = raw.chars().take(12).collect::<String>();
    let created = now();
    open_db(&state)?.execute("INSERT INTO client_keys(id,name,key_prefix,key_hash,created_at) VALUES(?1,?2,?3,?4,?5)",params![id,name,prefix,raw,created]).map_err(|e|e.to_string())?;
    Ok(ClientKey {
        id,
        name,
        key_prefix: prefix,
        key_value: Some(raw),
        enabled: true,
        allowed_models: "*".into(),
        daily_quota: 0,
        monthly_quota: 0,
        request_limit: 0,
        token_limit: 0,
        expires_at: None,
        ip_allowlist: String::new(),
        created_at: created,
    })
}
#[tauri::command]
fn delete_client_key(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    open_db(&state)?
        .execute("DELETE FROM client_keys WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_call_logs(state: tauri::State<AppState>) -> Result<Vec<CallLog>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn.prepare("SELECT id,created_at,client_key_prefix,requested_model,upstream_model,input_tokens,cached_input_tokens,output_tokens,latency_ms,status,error_message,failover,estimated_cost,currency FROM call_logs ORDER BY created_at DESC LIMIT 500").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CallLog {
                id: r.get(0)?,
                created_at: r.get(1)?,
                client_key_prefix: r.get(2)?,
                requested_model: r.get(3)?,
                upstream_model: r.get(4)?,
                input_tokens: r.get(5)?,
                cached_input_tokens: r.get(6)?,
                output_tokens: r.get(7)?,
                latency_ms: r.get(8)?,
                status: r.get(9)?,
                error_message: r.get(10)?,
                failover: r.get::<_, i64>(11)? != 0,
                estimated_cost: r.get(12)?,
                currency: r.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

fn add_cost_bucket(
    buckets: &mut BTreeMap<String, CostBucket>,
    label: String,
    input: i64,
    cached_input: i64,
    output: i64,
    cost: f64,
) {
    let bucket = buckets.entry(label.clone()).or_insert_with(|| CostBucket {
        label,
        ..Default::default()
    });
    bucket.requests += 1;
    bucket.input_tokens += input;
    bucket.cached_input_tokens += cached_input;
    bucket.output_tokens += output;
    bucket.cost += cost;
}

fn latest_buckets(buckets: BTreeMap<String, CostBucket>, limit: usize) -> Vec<CostBucket> {
    let mut items = buckets.into_values().collect::<Vec<_>>();
    if items.len() > limit {
        items = items.split_off(items.len() - limit);
    }
    items
}

#[tauri::command]
fn get_cost_analytics(state: tauri::State<AppState>) -> Result<CostAnalytics, String> {
    let conn = open_db(&state)?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    let month = Local::now().format("%Y-%m").to_string();
    let mut stmt = conn.prepare(
        "SELECT l.created_at,l.requested_model,l.input_tokens,l.cached_input_tokens,l.output_tokens,l.estimated_cost,m.input_price,m.output_price FROM call_logs l LEFT JOIN model_mappings m ON m.unified_name=l.requested_model WHERE l.status IN ('成功','流式中') ORDER BY l.created_at"
    ).map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, f64>(5)?,
                r.get::<_, Option<f64>>(6)?.unwrap_or(0.0),
                r.get::<_, Option<f64>>(7)?.unwrap_or(0.0),
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut seconds: BTreeMap<String, CostBucket> = BTreeMap::new();
    let mut minutes: BTreeMap<String, CostBucket> = BTreeMap::new();
    let mut hours: BTreeMap<String, CostBucket> = BTreeMap::new();
    let mut days: BTreeMap<String, CostBucket> = BTreeMap::new();
    let mut models: BTreeMap<String, CostBucket> = BTreeMap::new();
    let mut today_cost = 0.0;
    let mut month_cost = 0.0;
    let mut total_cost = 0.0;
    let mut total_requests = 0;
    for (created, model, input, cached_input, output, stored_cost, input_price, output_price) in
        rows.filter_map(Result::ok)
    {
        let cost = if stored_cost > 0.0 {
            stored_cost
        } else {
            (input as f64 * input_price + output as f64 * output_price) / 1_000_000.0
        };
        add_cost_bucket(
            &mut seconds,
            created.chars().take(19).collect(),
            input,
            cached_input,
            output,
            cost,
        );
        add_cost_bucket(
            &mut minutes,
            created.chars().take(16).collect(),
            input,
            cached_input,
            output,
            cost,
        );
        add_cost_bucket(
            &mut hours,
            created.chars().take(13).collect(),
            input,
            cached_input,
            output,
            cost,
        );
        add_cost_bucket(
            &mut days,
            created.chars().take(10).collect(),
            input,
            cached_input,
            output,
            cost,
        );
        add_cost_bucket(&mut models, model, input, cached_input, output, cost);
        if created.starts_with(&today) {
            today_cost += cost;
        }
        if created.starts_with(&month) {
            month_cost += cost;
        }
        total_cost += cost;
        total_requests += 1;
    }
    let mut model_items = models.into_values().collect::<Vec<_>>();
    model_items.sort_by(|a, b| b.cost.total_cmp(&a.cost));
    Ok(CostAnalytics {
        today_cost,
        month_cost,
        total_cost,
        total_requests,
        currency: "USD".into(),
        seconds: latest_buckets(seconds, 120),
        minutes: latest_buckets(minutes, 120),
        hours: latest_buckets(hours, 72),
        days: latest_buckets(days, 30),
        models: model_items,
    })
}
#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> Result<GatewaySettings, String> {
    read_settings(&state)
}
#[tauri::command]
fn save_settings(state: tauri::State<AppState>, settings: GatewaySettings) -> Result<(), String> {
    let serialized = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    open_db(&state)?.execute("INSERT INTO settings(key,value) VALUES('gateway_settings',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[serialized]).map_err(|e|e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("LocalModelGateway");
    let _ = std::fs::create_dir_all(&data_dir);
    let state = AppState {
        db_path: data_dir.join("gateway.db"),
        client: Client::new(),
        server: Arc::new(Mutex::new(None)),
    };
    init_database(&state.db_path).expect("无法初始化本地数据库");
    let app = tauri::Builder::default()
        .manage(state.clone())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { .. } = event {
                let minimize_to_tray =
                    read_settings(window.app_handle().state::<AppState>().inner())
                        .map(|settings| settings.minimize_to_tray)
                        .unwrap_or(true);
                if minimize_to_tray {
                    let _ = window.destroy();
                } else {
                    QUIT_REQUESTED.store(true, Ordering::SeqCst);
                    let state = window.app_handle().state::<AppState>().inner().clone();
                    tauri::async_runtime::block_on(stop_server(&state));
                }
            }
        })
        .setup(move |app| {
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "完全退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let handle = app.handle().clone();
            let tray_icon = app.default_window_icon().cloned().expect("应用图标未配置");
            TrayIconBuilder::with_id("gateway-tray")
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("大模型统一 API 网关 · 后台运行中")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let _ = show_main_window(tray.app_handle());
                    }
                })
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        let _ = show_main_window(app);
                    }
                    "quit" => {
                        QUIT_REQUESTED.store(true, Ordering::SeqCst);
                        let state = app.state::<AppState>().inner().clone();
                        tauri::async_runtime::block_on(stop_server(&state));
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            let runtime_state = state.clone();
            let handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                if read_settings(&runtime_state)
                    .map(|s| s.auto_start_gateway)
                    .unwrap_or(true)
                {
                    let _ = start_server(runtime_state, handle).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_gateway_status,
            start_gateway,
            stop_gateway,
            restart_gateway,
            list_channels,
            save_channel,
            delete_channel,
            test_channel,
            list_model_mappings,
            auto_create_model_mappings,
            save_model_mapping,
            delete_model_mapping,
            list_client_keys,
            create_client_key,
            delete_client_key,
            list_call_logs,
            sync_channel_pricing,
            list_price_catalog,
            get_cost_analytics,
            get_settings,
            save_settings
        ])
        .build(tauri::generate_context!())
        .expect("构建桌面程序失败");

    app.run(|_app, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            if !QUIT_REQUESTED.load(Ordering::SeqCst) {
                api.prevent_exit();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_unified_model_names_once() {
        assert_eq!(
            prefixed_unified_name("deepseek-v4-flash"),
            "xhc-deepseek-v4-flash"
        );
        assert_eq!(prefixed_unified_name("xhc-kimi-k3"), "xhc-kimi-k3");
        assert_eq!(
            prefixed_unified_name(" XHC-gpt-5.6-sol "),
            "xhc-gpt-5.6-sol"
        );
    }

    #[test]
    fn parses_new_api_pricing_with_default_group_ratio() {
        let payload = json!({
            "success": true,
            "data": [{
                "model_name": "deepseek-v4-flash",
                "model_ratio": 0.5,
                "completion_ratio": 2.0,
                "quota_type": 0
            }],
            "group_ratio": {"default": 0.8}
        });
        let items = parse_pricing_response(&payload, "测试渠道", "https://example.com/api/pricing");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].model, "deepseek-v4-flash");
        assert!((items[0].input_price - 0.8).abs() < 1e-9);
        assert!((items[0].output_price - 1.6).abs() < 1e-9);
    }

    #[test]
    fn parses_ratio_config_using_two_dollar_base() {
        let payload = json!({
            "success": true,
            "data": {
                "model_ratio": {"kimi-k3": 1.5},
                "completion_ratio": {"kimi-k3": 5.0}
            }
        });
        let items =
            parse_ratio_response(&payload, "测试渠道", "https://example.com/api/ratio_config");
        assert_eq!(items.len(), 1);
        assert!((items[0].input_price - 3.0).abs() < 1e-9);
        assert!((items[0].output_price - 15.0).abs() < 1e-9);
    }

    #[test]
    fn expands_group_prices_and_cache_ratios() {
        let payload = json!({
            "data": [{
                "model_name": "gpt-5.6-sol",
                "model_ratio": 2.5,
                "completion_ratio": 6.0,
                "cache_ratio": 0.1,
                "create_cache_ratio": 1.25,
                "quota_type": 0,
                "enable_groups": ["Codex-Plus", "Codex-Pro"]
            }],
            "group_ratio": {"Codex-Plus": 0.3, "Codex-Pro": 0.4}
        });
        let items = parse_pricing_response(&payload, "x-llm", "https://x-llm.net/api/pricing");
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].provider, "x-llm · Codex-Plus");
        assert!((items[0].input_price - 1.5).abs() < 1e-9);
        assert!((items[0].cached_input_price.unwrap() - 0.15).abs() < 1e-9);
        assert!((items[0].cache_write_price.unwrap() - 1.875).abs() < 1e-9);
    }

    #[test]
    fn parses_wawapi_provider_pricing() {
        let payload = json!({
            "data": {
                "currency": "CNY",
                "updated_at": "2026-07-30T12:11:36Z",
                "models": [{
                    "model_name": "gpt-5.6-sol",
                    "group_name": "gpt-plus",
                    "input_price": 0.3,
                    "output_price": 1.8,
                    "cache_input_price": 0.03,
                    "cache_create_price": 0.375,
                    "enabled": true
                }]
            }
        });
        let items = parse_provider_pricing_response(
            &payload,
            "wawapii",
            "https://wawapii.com/api/provider/pricing",
        );
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].provider, "wawapii · gpt-plus");
        assert_eq!(items[0].currency, "CNY");
        assert!((items[0].output_price - 1.8).abs() < 1e-9);
    }

    #[test]
    fn skips_fixed_per_request_prices_in_token_catalog() {
        let payload = json!({
            "data": [{
                "model_name": "image-model",
                "model_price": 0.02,
                "quota_type": 1
            }]
        });
        assert!(
            parse_pricing_response(&payload, "测试渠道", "https://example.com/api/pricing")
                .is_empty()
        );
    }

    #[test]
    fn reads_cached_input_tokens_from_common_usage_shapes() {
        assert_eq!(
            usage_cached_input_tokens(&json!({"prompt_cache_hit_tokens": 321})),
            321
        );
        assert_eq!(
            usage_cached_input_tokens(&json!({"prompt_tokens_details": {"cached_tokens": 654}})),
            654
        );
    }

    #[test]
    fn parses_usage_counts_from_compatible_provider_shapes() {
        assert_eq!(
            usage_counts(&json!({
                "input_tokens": "120",
                "output_tokens": 30.0,
                "input_tokens_details": {"cached_tokens": "20"}
            })),
            Some((120, 20, 30, 150))
        );
        assert_eq!(
            usage_counts(&json!({"completion_tokens": 25, "total_tokens": 125})),
            Some((100, 0, 25, 125))
        );
    }

    #[test]
    fn rejects_provider_usage_that_is_only_zeroes() {
        assert_eq!(
            usage_counts(&json!({
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            })),
            None
        );
    }

    #[test]
    fn recognizes_semantic_errors_from_successful_http_responses() {
        assert_eq!(
            provider_error_message(&json!({"error": {"message": "额度不足"}})),
            Some("额度不足".to_string())
        );
        assert_eq!(
            provider_error_message(&json!({"success": false, "message": "模型不可用"})),
            Some("模型不可用".to_string())
        );
        assert_eq!(provider_error_message(&json!({"choices": []})), None);
    }

    #[test]
    fn validates_stream_before_committing_response_to_client() {
        let failed = "data: {\"error\":{\"message\":\"上游繁忙\"}}\n\n";
        assert_eq!(stream_error_message(failed), Some("上游繁忙".to_string()));
        assert!(!stream_has_valid_payload(failed));

        let metadata_then_error = concat!(
            "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\n",
            "data: {\"error\":{\"message\":\"首选渠道失败\"}}\n\n"
        );
        assert_eq!(
            stream_error_message(metadata_then_error),
            Some("首选渠道失败".to_string())
        );
        assert!(!stream_has_valid_payload(metadata_then_error));

        let valid = "data: {\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}\n\n";
        assert_eq!(stream_error_message(valid), None);
        assert!(stream_has_valid_payload(valid));
    }

    #[test]
    fn uses_the_channel_order_saved_for_each_model() {
        let path = std::env::temp_dir().join(format!("lmg-route-test-{}.db", Uuid::new_v4()));
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE channels (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL,
                models TEXT NOT NULL, timeout_seconds INTEGER NOT NULL,
                priority INTEGER NOT NULL, enabled INTEGER NOT NULL
            );
            INSERT INTO channels VALUES
                ('a','渠道 A','https://a.example','gpt-5.6',60,1,1),
                ('b','渠道 B','https://b.example','gpt-5.6',60,2,1),
                ('c','渠道 C','https://c.example','gpt-5.6',60,3,1);",
        )
        .unwrap();
        drop(conn);
        let state = AppState {
            db_path: path.clone(),
            client: Client::new(),
            server: Arc::new(Mutex::new(None)),
        };
        let saved_order = vec!["c".to_string(), "a".to_string(), "b".to_string()];
        let candidates = route_candidates(&state, &saved_order, "a", None, "gpt-5.6").unwrap();
        assert_eq!(
            candidates
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            vec!["c", "a", "b"]
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn seeds_deepseek_and_kimi_reference_prices() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE official_prices (
                provider TEXT NOT NULL, model TEXT NOT NULL, cached_input_price REAL,
                input_price REAL NOT NULL, output_price REAL NOT NULL,
                currency TEXT NOT NULL, context_length INTEGER NOT NULL,
                source_url TEXT NOT NULL, updated_at TEXT NOT NULL,
                cache_write_price REAL, cache_storage_price REAL,
                extra_charges TEXT NOT NULL DEFAULT '',
                PRIMARY KEY(provider, model)
            );",
        )
        .unwrap();
        seed_reference_prices(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM official_prices", [], |r| r.get(0))
            .unwrap();
        let cache_hit: f64 = conn
            .query_row(
                "SELECT cached_input_price FROM official_prices WHERE model='deepseek-v4-flash'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 6);
        assert!((cache_hit - 0.0028).abs() < 1e-9);
    }
}
