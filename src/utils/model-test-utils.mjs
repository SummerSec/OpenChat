export function buildModelTestPrompt(language = "zh-CN") {
  return language === "zh-CN"
    ? "请只回复：连接测试成功"
    : "Reply with: connection test ok";
}

export function describeNonJsonModelResponse(text = "", status = 200, contentType = "") {
  const normalized = String(text || "").trim().toLowerCase();
  if (normalized.startsWith("<!doctype") || normalized.startsWith("<html")) {
    return {
      ok: false,
      message: `HTTP ${status}: returned HTML instead of JSON. Check whether Base URL points to the site homepage instead of the API path.`
    };
  }
  return {
    ok: false,
    message: `HTTP ${status}: unexpected non-JSON response${contentType ? ` (${contentType})` : ""}.`
  };
}

export function describeModelTestFailure({ message = "", language = "zh-CN", mode = "frontend" } = {}) {
  const normalized = String(message || "").trim();
  if (normalized === "Failed to fetch") {
    return {
      ok: false,
      message:
        language === "zh-CN"
          ? `浏览器请求失败，通常是 CORS 或目标站点拒绝前端直连。建议切换到后端模式测试或运行。`
          : `Browser request failed, usually because of CORS or browser-side access restrictions. Try backend mode for testing or execution.`
    };
  }
  if (/^HTTP\s+5\d\d/i.test(normalized)) {
    return {
      ok: false,
      message:
        language === "zh-CN"
          ? `${normalized}，这是上游服务异常或网关错误，不是当前表单填写问题。`
          : `${normalized}. This points to an upstream service or gateway failure rather than a form input issue.`
    };
  }
  if (/^HTTP\s+4\d\d/i.test(normalized)) {
    return {
      ok: false,
      message:
        language === "zh-CN"
          ? `${normalized}，请检查 API key、模型名和接口权限。`
          : `${normalized}. Check the API key, model name, and endpoint permissions.`
    };
  }
  return { ok: false, message: normalized || (mode === "backend" ? "Request failed" : "Browser request failed") };
}
