/**
 * WeatherAgent — 天气/日期查询（独立模块，零侵入）
 *
 * 职责: 检测用户输入 → 获取数据 → 拼接到 AI prompt
 * 失败策略: 任何环节失败都静默透传，不影响正常对话
 *
 * 数据源:
 *   - wttr.in (天气，免费无需 Key)
 *   - new Date() (本地时间)
 */

const WeatherAgent = {

  /**
   * 预处理用户输入，检测是否需要注入天气/日期数据
   * @param {string} text 用户原始输入
   * @returns {string|null} 增强后的 prompt，或 null 表示无需处理
   */
  async augment(text) {
    if (!text) return null;

    const q = text.trim();

    // ── 天气检测 ──
    const weatherMatch = this._detectWeather(q);
    if (weatherMatch) {
      try {
        const data = await this._fetchWeather(weatherMatch.city);
        if (data) {
          console.log('[WeatherAgent] 天气数据已注入:', data.slice(0, 80));
          return `【系统注入：实时天气数据】\n${data}\n\n【用户问题】\n${q}`;
        }
      } catch (e) {
        console.warn('[WeatherAgent] 天气获取失败:', e.message);
      }
    }

    return null; // 不处理，透传
  },

  /** 检测天气查询 → {city} 或 null */
  _detectWeather(text) {
    // 模式: "xx天气" "xx今天天气" "天气怎么样" "xx多少度" "xx会不会下雨"
    const patterns = [
      /(?:今天|明天|现在|帮我查|查一下|看看?)?(.{1,8}?)(?:的)?天气(?:怎么样|如何|好吗|怎样)?[?？]?$/,
      /(.{1,8}?)(?:今天|明天)天气/,
      /(.{1,8}?)(?:多少度|几度|会不会下雨|下雨吗|冷不冷|热不热)/,
      /天气(?:怎么样|如何|预报)/,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const city = (m[1] || '').replace(/[?？，。！!喵~～]/g, '').trim();
        // 有城市名就用，否则默认北京
        return { city: city || 'Beijing' };
      }
    }
    return null;
  },



  /**
   * 从 wttr.in 获取天气 (免费, 无需 API Key)
   * @param {string} city 城市名(中文或英文)，如 "Beijing" "上海"
   * @returns {string|null} 格式化天气文本
   */
  async _fetchWeather(city) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    try {
      // wttr.in 支持中文城市名，返回纯文本格式
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+(%f)+%w+%h&lang=zh`;
      const resp = await fetch(url, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      // wttr.in 格式: "晴 +22°C (+18°C) 北风3km/h 湿度45%"
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned || cleaned.length < 3) return null;

      return [
        `城市: ${city}`,
        `天气: ${cleaned}`,
        `(数据来源: wttr.in, 更新时间: ${new Date().toLocaleTimeString()})`,
      ].join('\n');
    } finally {
      clearTimeout(timer);
    }
  },
};
