/**
 * Enhanced Custom CSS Plus - 主入口文件
 * 功能：协调各个模块，初始化扩展
 * 作者：SGTY
 * 版本：2.0.0
 */

// 导入所有功能模块
import { CoreModule } from './core.js';
import { CSSProcessor } from './cssProcessor.js';
import { FontManager } from './fontManager.js';
import { Storage } from './storage.js';
import { UI } from './ui.js';

// 扩展主类
class EnhancedCustomCSSPlus {
  constructor() {
    // 扩展基础配置
    this.extensionName = 'EnhancedCustomCSSPlus';
    this.version = '2.0.0';

    // 初始化各个模块
    this.storage = new Storage(this.extensionName);
    this.core = new CoreModule(this.storage);
    this.cssProcessor = new CSSProcessor(this.core);
    this.fontManager = new FontManager(this.storage, this.core);
    this.ui = new UI(this);

    // 全局设置
    this.settings = {
      enabled: true,
      debugMode: false,
      realTimeUpdate: true,
      currentTab: 'css', // 当前选中的标签页
      fontSize: 'medium' // 字体大小设置
    };

    // 存储当前CSS内容
    this.currentCSSContent = '';

    console.log(`[${this.extensionName}] v${this.version} 初始化中...`);
  }

  /**
   * 初始化扩展
   */
  async init() {
    try {
      // 1. 加载设置
      await this.loadSettings();

      // 2. 初始化各模块
      await this.core.init();
      await this.fontManager.init();

      // 3. 创建UI界面
      await this.ui.init();

      // 4. 设置事件监听
      this.setupEventListeners();

      // 5. 应用初始配置
      if (this.settings.enabled) {
        this.applyCurrentConfiguration();
      }

      // 6. 暴露全局API
      this.exposeGlobalAPI();

      console.log(`[${this.extensionName}] 初始化完成`);
    } catch (error) {
      console.error(`[${this.extensionName}] 初始化失败:`, error);
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听自定义CSS输入框
    this.watchCustomCSSTextarea();

    // 监听设置变化
    this.storage.on('settingsChanged', (newSettings) => {
      this.settings = { ...this.settings, ...newSettings };
      this.applyCurrentConfiguration();
    });

    // 监听字体变化
    this.fontManager.on('fontChanged', (fontName) => {
      this.applyFont(fontName);
    });

    // 监听主题切换
    this.watchThemeChanges();
  }

  /**
   * 监听自定义CSS输入框
   */
  watchCustomCSSTextarea() {
    const checkTextarea = setInterval(() => {
      const textarea = document.getElementById('customCSS');
      if (textarea && !textarea.hasAttribute('data-enhanced-initialized')) {
        textarea.setAttribute('data-enhanced-initialized', 'true');

        // 添加事件监听
        const handler = this.settings.realTimeUpdate
          ? (e) => this.handleCSSChange(e.target.value)
          : this.debounce((e) => this.handleCSSChange(e.target.value), 500);

        textarea.addEventListener('input', handler);

        // 初始处理
        if (this.settings.enabled && textarea.value) {
          this.handleCSSChange(textarea.value);
        }

        clearInterval(checkTextarea);
      }
    }, 100);
  }

  /**
   * 处理CSS内容变化
   * @param {string} content - CSS内容
   */
  handleCSSChange(content) {
    if (!this.settings.enabled) return;

    this.currentCSSContent = content;

    // 使用CSS处理器处理内容
    const result = this.cssProcessor.process(content);

    // 应用处理结果
    if (result.css) {
      this.core.applyCSS(result.css);
    }

    if (result.javascript) {
      this.core.executeScript(result.javascript);
    }

    if (result.addCommands && result.addCommands.length > 0) {
      this.cssProcessor.executeAddCommands(result.addCommands);
    }

    if (this.settings.debugMode) {
      console.log(`[${this.extensionName}] 处理CSS完成`, result);
    }
  }

  /**
   * 监听主题变化
   */
  watchThemeChanges() {
    // 使用MutationObserver监听主题选择器
    const themeSelect = document.querySelector('#themes');
    if (!themeSelect) return;

    const observer = new MutationObserver(() => {
      // 主题切换时重新应用配置
      if (this.settings.enabled) {
        this.core.clearAll();
        this.applyCurrentConfiguration();
      }
    });

    observer.observe(themeSelect, {
      attributes: true,
      attributeFilter: ['value']
    });
  }

  /**
   * 应用当前配置
   */
  applyCurrentConfiguration() {
    // 应用CSS
    const textarea = document.getElementById('customCSS');
    if (textarea && textarea.value) {
      this.handleCSSChange(textarea.value);
    }

    // 应用字体
    const currentFont = this.fontManager.getCurrentFont();
    if (currentFont) {
      this.applyFont(currentFont.name);
    }
  }

  /**
   * 应用字体
   * @param {string} fontName - 字体名称
   */
  applyFont(fontName) {
    const font = this.fontManager.getFont(fontName);
    if (!font) return;

    // 应用字体CSS
    const fontCSS = `
            @import url("${font.url}");
            
            body, input, textarea, select, button, .mes_text, .mes_block, 
            pre, code, h1, h2, h3, h4, h5, h6, .title_restorable,
            .font-family-reset, #options span, 
            #completion_prompt_manager_list span:not([class*="fa-"]), 
            .text_pole span:not([class*="fa-"]),
            .flex-container, .swipes-counter {
                font-family: '${font.fontFamily}', sans-serif !important;
            }
        `;

    this.core.applyCSS(fontCSS, 'enhanced-font-style');
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    const saved = await this.storage.get('settings');
    if (saved) {
      this.settings = { ...this.settings, ...saved };
    }
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    await this.storage.set('settings', this.settings);
  }

  /**
   * 暴露全局API
   */
  exposeGlobalAPI() {
    window.EnhancedCSS = {
      // 核心功能
      addClass: (selector, className) => this.core.addClass(selector, className),
      addElement: (parent, tag, options) => this.core.addElement(parent, tag, options),
      createElement: (tag, options) => this.core.createElement(tag, options),
      addCSS: (css) => this.core.applyCSS(css),

      // 字体管理
      addFont: (font) => this.fontManager.addFont(font),
      removeFont: (fontName) => this.fontManager.removeFont(fontName),
      setFont: (fontName) => this.fontManager.setCurrentFont(fontName),
      getFonts: () => this.fontManager.getAllFonts(),

      // 工具函数
      $: (selector) => document.querySelector(selector),
      $$: (selector) => document.querySelectorAll(selector),

      // 设置管理
      getSettings: () => this.settings,
      updateSettings: (newSettings) => {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
      },

      // 清理功能
      clear: () => this.core.clearAll()
    };
  }

  /**
   * 防抖函数
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// 启动扩展
(function () {
  'use strict';

  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
  } else {
    initExtension();
  }

  async function initExtension() {
    // 创建扩展实例
    const extension = new EnhancedCustomCSSPlus();

    // 初始化扩展
    await extension.init();

    // 保存到全局以便调试
    window.EnhancedCustomCSSPlus = extension;
  }
})();

// ES6模块导出
export { EnhancedCustomCSSPlus };
