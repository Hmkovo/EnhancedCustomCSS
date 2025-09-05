/**
 * 字体管理模块 - 管理字体的添加、删除、切换、标签分类
 * 支持从zeoseven.com解析字体链接，批量管理，导入导出
 * 
 * 修改记录：
 * - 2025-09-05: 添加字体功能启用/禁用状态管理
 * - 2025-09-05: 添加删除标签功能
 * - 2025-09-05: 修复字体功能开关逻辑，禁用时不允许设置当前字体
 */

export class FontManager {
  constructor(storage, core) {
    this.storage = storage;
    this.core = core;

    // 字体列表
    this.fonts = new Map(); // key: fontName, value: font object
    this.currentFont = null;

    // 标签系统
    this.tags = new Set();
    this.currentTag = 'all'; // 当前筛选的标签

    // 字体功能启用状态 - 新增
    this.fontEnabled = true;

    // 事件监听器
    this.listeners = new Map();
  }

  /**
   * 初始化字体管理器
   */
  async init() {
    // 加载保存的字体
    await this.loadFonts();

    // 加载字体启用状态 - 新增
    const savedFontEnabled = await this.storage.get('fontEnabled');
    if (savedFontEnabled !== undefined) {
      this.fontEnabled = savedFontEnabled;
    }

    // 加载当前字体设置
    const currentFontName = await this.storage.get('currentFont');
    if (currentFontName && this.fonts.has(currentFontName)) {
      this.currentFont = currentFontName;

      // 如果字体功能启用，应用字体 - 新增
      if (this.fontEnabled) {
        const currentFont = this.fonts.get(currentFontName);
        if (currentFont) {
          this.applyFont(currentFont);
        }
      }
    }

    console.log('[FontManager] 字体管理器初始化完成，已加载', this.fonts.size, '个字体，字体功能', this.fontEnabled ? '已启用' : '已禁用');
  }

  /**
   * 设置字体功能启用状态 - 修改：2025-09-05 增加状态切换时的处理逻辑
   * @param {boolean} enabled - 是否启用字体功能
   */
  async setFontEnabled(enabled) {
    this.fontEnabled = enabled;
    await this.storage.set('fontEnabled', enabled);

    // 如果禁用字体功能，清除应用的字体
    if (!enabled) {
      this.clearAppliedFont();
    } else if (this.currentFont) {
      // 如果启用字体功能，且有当前选中的字体，重新应用
      const font = this.fonts.get(this.currentFont);
      if (font) {
        this.applyFont(font);
      }
    }

    // 触发事件
    this.emit('fontEnabledChanged', enabled);

    console.log('[FontManager] 字体功能', enabled ? '已启用' : '已禁用');
  }

  /**
   * 应用字体到页面 - 新增方法
   * @param {Object} font - 字体对象
   */
  applyFont(font) {
    // 只有在字体功能启用时才应用
    if (!this.fontEnabled) {
      console.log('[FontManager] 字体功能已禁用，跳过应用字体');
      return;
    }

    // 清除之前的字体样式
    this.clearAppliedFont();

    // 创建新的字体样式
    const styleId = 'enhanced-font-style';
    const style = document.createElement('style');
    style.id = styleId;

    // 如果有CSS内容，直接使用
    if (font.css) {
      style.textContent = font.css;
    } else {
      // 否则生成基本的字体样式
      let css = '';
      if (font.url) {
        css += `@import url("${font.url}");\n`;
      }
      if (font.fontFamily) {
        css += `body { font-family: "${font.fontFamily}" !important; }`;
      }
      style.textContent = css;
    }

    document.head.appendChild(style);
    console.log('[FontManager] 已应用字体:', font.name);
  }

  /**
   * 清除应用的字体 - 新增方法
   */
  clearAppliedFont() {
    const existingStyle = document.getElementById('enhanced-font-style');
    if (existingStyle) {
      existingStyle.remove();
      console.log('[FontManager] 已清除应用的字体');
    }
  }

  /**
   * 删除标签 - 新增方法
   * @param {string} tagToDelete - 要删除的标签
   */
  async deleteTag(tagToDelete) {
    if (!this.tags.has(tagToDelete)) {
      console.warn('[FontManager] 标签不存在:', tagToDelete);
      return false;
    }

    // 从所有字体中移除该标签
    let modified = false;
    this.fonts.forEach((font, fontName) => {
      if (font.tags && font.tags.includes(tagToDelete)) {
        font.tags = font.tags.filter(tag => tag !== tagToDelete);
        modified = true;
        console.log(`[FontManager] 从字体 "${fontName}" 中移除标签 "${tagToDelete}"`);
      }
    });

    // 从标签集合中删除
    this.tags.delete(tagToDelete);

    // 如果当前筛选的是被删除的标签，重置为all
    if (this.currentTag === tagToDelete) {
      this.currentTag = 'all';
    }

    // 保存更改
    if (modified) {
      await this.saveFonts();
    }

    // 触发事件
    this.emit('tagsChanged', { action: 'deleted', tag: tagToDelete });

    console.log('[FontManager] 已删除标签:', tagToDelete);
    return true;
  }

  /**
   * 解析字体链接（支持zeoseven.com格式）
   * @param {string} input - 输入的字体代码
   * @returns {Object|null} 解析后的字体对象
   */
  parseFont(input) {
    // 匹配 @import url 格式
    const importMatch = input.match(/@import\s+url\(["']([^"']+)["']\)/);
    if (!importMatch) {
      console.warn('[FontManager] 无法解析字体链接');
      return null;
    }

    const url = importMatch[1];

    // 匹配 font-family
    const familyMatch = input.match(/font-family:\s*["']?([^"';]+)["']?/);
    const fontFamily = familyMatch ? familyMatch[1].trim() : 'Unknown Font';

    // 从URL中提取字体ID（如果是zeoseven链接）
    let fontId = null;
    const idMatch = url.match(/fontsapi\.zeoseven\.com\/(\d+)\//);
    if (idMatch) {
      fontId = idMatch[1];
    }

    // 生成默认名称
    const defaultName = fontFamily || `Font-${Date.now()}`;

    return {
      name: defaultName,
      displayName: defaultName, // 用户可编辑的显示名称
      url: url,
      fontFamily: fontFamily,
      fontId: fontId,
      css: input, // 保存原始CSS - 新增
      tags: [],
      order: Date.now(), // 排序顺序
      addedAt: new Date().toISOString(),
      custom: {} // 用户自定义数据
    };
  }

  /**
   * 添加字体
   * @param {Object} fontData - 字体数据
   * @returns {boolean} 是否添加成功
   */
  async addFont(fontData) {
    // 如果是字符串，先解析
    if (typeof fontData === 'string') {
      fontData = this.parseFont(fontData);
      if (!fontData) return false;
    }

    // 检查重复
    if (this.fonts.has(fontData.name)) {
      console.warn('[FontManager] 字体已存在:', fontData.name);
      return false;
    }

    // 添加到集合
    this.fonts.set(fontData.name, fontData);

    // 更新标签
    if (fontData.tags && fontData.tags.length > 0) {
      fontData.tags.forEach(tag => this.tags.add(tag));
    }

    // 保存
    await this.saveFonts();

    // 触发事件
    this.emit('fontAdded', fontData);

    console.log('[FontManager] 添加字体:', fontData.name);
    return true;
  }

  /**
   * 更新字体信息
   * @param {string} fontName - 原字体名称
   * @param {Object} updates - 更新的数据
   */
  async updateFont(fontName, updates) {
    const font = this.fonts.get(fontName);
    if (!font) return false;

    // 如果更改了名称，需要更新Map的key
    if (updates.name && updates.name !== fontName) {
      this.fonts.delete(fontName);
      this.fonts.set(updates.name, { ...font, ...updates });

      // 如果是当前字体，更新引用
      if (this.currentFont === fontName) {
        this.currentFont = updates.name;
      }
    } else {
      this.fonts.set(fontName, { ...font, ...updates });
    }

    // 更新标签集合
    if (updates.tags) {
      this.updateTagsList();
      // 触发标签变化事件 - 新增
      this.emit('tagsChanged', { action: 'updated', font: fontName });
    }

    // 保存
    await this.saveFonts();

    // 触发事件
    this.emit('fontUpdated', { oldName: fontName, font: this.fonts.get(updates.name || fontName) });

    return true;
  }

  /**
   * 删除字体
   * @param {string} fontName - 字体名称
   */
  async removeFont(fontName) {
    if (!this.fonts.has(fontName)) return false;

    const font = this.fonts.get(fontName);
    this.fonts.delete(fontName);

    // 如果删除的是当前字体，清除选择和应用的样式
    if (this.currentFont === fontName) {
      this.currentFont = null;
      this.clearAppliedFont(); // 清除应用的字体 - 新增
      this.emit('fontChanged', null);
    }

    // 更新标签列表
    this.updateTagsList();

    // 保存
    await this.saveFonts();

    // 触发事件
    this.emit('fontRemoved', font);

    return true;
  }

  /**
   * 设置当前字体 - 修改：2025-09-05 增加字体功能启用状态检查
   * @param {string} fontName - 字体名称
   */
  async setCurrentFont(fontName) {
    // 检查字体功能是否启用
    if (!this.fontEnabled) {
      console.warn('[FontManager] 字体功能已禁用，无法设置当前字体');
      // 可以选择性地触发一个事件通知UI
      this.emit('fontSelectionBlocked', { reason: 'disabled', fontName });
      return false;
    }

    if (!this.fonts.has(fontName)) {
      console.warn('[FontManager] 字体不存在:', fontName);
      return false;
    }

    // 设置当前字体
    this.currentFont = fontName;
    await this.storage.set('currentFont', fontName);

    // 应用字体（applyFont内部会再次检查fontEnabled）
    const font = this.fonts.get(fontName);
    if (font) {
      this.applyFont(font);
    }

    // 触发事件
    this.emit('fontChanged', fontName);

    return true;
  }

  /**
   * 获取当前字体
   */
  getCurrentFont() {
    return this.currentFont ? this.fonts.get(this.currentFont) : null;
  }

  /**
   * 获取字体
   * @param {string} fontName - 字体名称
   */
  getFont(fontName) {
    return this.fonts.get(fontName);
  }

  /**
   * 获取所有字体
   * @param {string} tag - 标签筛选（可选）
   */
  getAllFonts(tag = null) {
    const fontsArray = Array.from(this.fonts.values());

    // 标签筛选
    if (tag && tag !== 'all') {
      if (tag === 'untagged') { // 添加未分类筛选支持
        return fontsArray.filter(font =>
          !font.tags || font.tags.length === 0
        );
      }
      return fontsArray.filter(font =>
        font.tags && font.tags.includes(tag)
      );
    }

    return fontsArray;
  }

  /**
   * 按标签分组获取字体
   */
  getFontsByTags() {
    const grouped = {
      all: this.getAllFonts(),
      untagged: []
    };

    // 初始化标签组
    this.tags.forEach(tag => {
      grouped[tag] = [];
    });

    // 分组
    this.fonts.forEach(font => {
      if (!font.tags || font.tags.length === 0) {
        grouped.untagged.push(font);
      } else {
        font.tags.forEach(tag => {
          if (grouped[tag]) {
            grouped[tag].push(font);
          }
        });
      }
    });

    return grouped;
  }

  /**
   * 更新字体排序
   * @param {Array} sortedNames - 排序后的字体名称数组
   */
  async updateOrder(sortedNames) {
    sortedNames.forEach((name, index) => {
      const font = this.fonts.get(name);
      if (font) {
        font.order = index;
      }
    });

    await this.saveFonts();
    this.emit('orderChanged', sortedNames);
  }

  /**
   * 导出字体配置
   * @returns {string} JSON字符串
   */
  exportFonts() {
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      fonts: Array.from(this.fonts.values()),
      currentFont: this.currentFont,
      fontEnabled: this.fontEnabled, // 导出字体启用状态 - 新增
      tags: Array.from(this.tags)
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入字体配置
   * @param {string} jsonData - JSON数据
   * @param {boolean} merge - 是否合并（true）或替换（false）
   */
  async importFonts(jsonData, merge = true) {
    try {
      const data = JSON.parse(jsonData);

      if (!data.fonts || !Array.isArray(data.fonts)) {
        throw new Error('无效的导入数据格式');
      }

      // 如果不合并，先清空
      if (!merge) {
        this.fonts.clear();
        this.tags.clear();
      }

      // 导入字体
      let imported = 0;
      data.fonts.forEach(font => {
        // 如果合并模式且字体已存在，跳过
        if (merge && this.fonts.has(font.name)) {
          console.log('[FontManager] 跳过已存在的字体:', font.name);
          return;
        }

        this.fonts.set(font.name, font);

        // 更新标签
        if (font.tags && font.tags.length > 0) {
          font.tags.forEach(tag => this.tags.add(tag));
        }

        imported++;
      });

      // 设置当前字体
      if (data.currentFont && this.fonts.has(data.currentFont)) {
        this.currentFont = data.currentFont;
      }

      // 导入字体启用状态 - 新增
      if (data.fontEnabled !== undefined) {
        this.fontEnabled = data.fontEnabled;
        await this.storage.set('fontEnabled', this.fontEnabled);
      }

      // 保存
      await this.saveFonts();

      // 触发事件
      this.emit('fontsImported', { count: imported, total: data.fonts.length });
      this.emit('tagsChanged', { action: 'imported' }); // 新增

      console.log(`[FontManager] 导入完成，成功导入 ${imported}/${data.fonts.length} 个字体`);
      return imported;
    } catch (error) {
      console.error('[FontManager] 导入失败:', error);
      throw error;
    }
  }

  /**
   * 批量添加字体
   * @param {Array} fontsData - 字体数据数组
   */
  async addFontsBatch(fontsData) {
    let added = 0;

    for (const fontData of fontsData) {
      if (await this.addFont(fontData)) {
        added++;
      }
    }

    return added;
  }

  /**
   * 更新标签列表
   */
  updateTagsList() {
    this.tags.clear();
    this.fonts.forEach(font => {
      if (font.tags && font.tags.length > 0) {
        font.tags.forEach(tag => this.tags.add(tag));
      }
    });

    // 触发标签变化事件 - 新增
    this.emit('tagsChanged', { action: 'refresh' });
  }

  /**
   * 保存字体到存储
   */
  async saveFonts() {
    const data = {
      fonts: Array.from(this.fonts.entries()),
      tags: Array.from(this.tags),
      currentFont: this.currentFont
    };

    await this.storage.set('fonts', data);
  }

  /**
   * 从存储加载字体
   */
  async loadFonts() {
    const data = await this.storage.get('fonts');

    if (data) {
      // 恢复字体Map
      if (data.fonts && Array.isArray(data.fonts)) {
        this.fonts = new Map(data.fonts);
      }

      // 恢复标签Set
      if (data.tags && Array.isArray(data.tags)) {
        this.tags = new Set(data.tags);
      }

      // 恢复当前字体
      if (data.currentFont) {
        this.currentFont = data.currentFont;
      }
    }
  }

  /**
   * 事件监听
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[FontManager] 事件处理器错误 (${event}):`, error);
        }
      });
    }
  }
}
