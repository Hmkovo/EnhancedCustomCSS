/**
 * Enhanced Custom CSS Plus - 主入口文件
 * 功能：协调各个模块，初始化扩展
 * 9.4修复：智能检测主题切换，防止CSS残留
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
    this.version = '2.0.1';

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
      currentTab: 'css',
      fontSize: 'medium',
      autoCleanOnThemeChange: true // 新增：主题切换时自动清理
    };

    // 存储当前CSS内容和主题信息
    this.currentCSSContent = '';
    this.currentTheme = null;
    this.currentTextarea = null;
    this.lastProcessedContent = null; // 记录上次处理的内容
    
    // 观察器
    this.themeObserver = null;
    this.textareaObserver = null;
    
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

    // 设置智能主题监听
    this.setupSmartThemeWatcher();
  }

  /**
   * 设置智能主题监听器
   */
  setupSmartThemeWatcher() {
    let checkInterval = null;
    
    // 方法1：监听主题选择器的变化（最直接）
    const watchThemeSelector = () => {
      const themeSelect = document.querySelector('#themes');
      if (!themeSelect) {
        // 如果还没找到，稍后重试
        setTimeout(watchThemeSelector, 500);
        return;
      }
      
      // 记录初始主题
      this.currentTheme = themeSelect.value;
      
      // 监听change事件
      themeSelect.addEventListener('change', (e) => {
        this.handleThemeChange(e.target.value);
      });
      
      // 额外监听value属性变化（有些情况下可能通过代码改变）
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
            const newTheme = themeSelect.value;
            if (newTheme !== this.currentTheme) {
              this.handleThemeChange(newTheme);
            }
          }
        });
      });
      
      observer.observe(themeSelect, {
        attributes: true,
        attributeFilter: ['value']
      });
      
      this.themeObserver = observer;
    };
    
    // 方法2：监听CSS输入框的变化（作为备份检测）
    const watchTextareaChanges = () => {
      // 使用MutationObserver监听textarea的替换
      const container = document.querySelector('#customCSS-holder, .customCSS-container');
      if (!container) {
        setTimeout(watchTextareaChanges, 500);
        return;
      }
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          // 检查是否有新的textarea被添加
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.id === 'customCSS') {
              console.log(`[${this.extensionName}] 检测到CSS输入框变化，可能是主题切换`);
              this.handleTextareaChange(node);
            }
          });
        });
      });
      
      observer.observe(container.parentElement || document.body, {
        childList: true,
        subtree: true
      });
      
      this.textareaObserver = observer;
    };
    
    // 方法3：监听自定义CSS文件的加载（通过link标签）
    const watchStylesheets = () => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.tagName === 'LINK' && 
                node.rel === 'stylesheet' && node.href && 
                node.href.includes('css')) {
              // 检测到新的样式表加载
              console.log(`[${this.extensionName}] 检测到新样式表加载`);
              this.handlePossibleThemeChange();
            }
          });
          
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.tagName === 'LINK' && 
                node.rel === 'stylesheet') {
              // 检测到样式表移除
              console.log(`[${this.extensionName}] 检测到样式表移除`);
              this.handlePossibleThemeChange();
            }
          });
        });
      });
      
      observer.observe(document.head, {
        childList: true
      });
    };
    
    // 启动所有监听方法
    watchThemeSelector();
    watchTextareaChanges();
    watchStylesheets();
  }

  /**
   * 处理主题变化
   */
  handleThemeChange(newTheme) {
    if (newTheme === this.currentTheme) return;
    
    console.log(`[${this.extensionName}] 主题切换检测: ${this.currentTheme} -> ${newTheme}`);
    
    const oldTheme = this.currentTheme;
    this.currentTheme = newTheme;
    
    if (this.settings.autoCleanOnThemeChange && this.settings.enabled) {
      // 清理旧内容
      console.log(`[${this.extensionName}] 清理旧主题内容...`);
      this.core.clearAll();
      
      // 重置处理记录
      this.lastProcessedContent = null;
      
      // 等待DOM更新
      setTimeout(() => {
        // 重新查找并监听新的textarea
        this.watchCustomCSSTextarea();
        
        // 重新应用配置
        this.applyCurrentConfiguration();
      }, 100);
    }
  }

  /**
   * 处理textarea变化（可能的主题切换）
   */
  handleTextareaChange(newTextarea) {
    const oldContent = this.currentCSSContent;
    const newContent = newTextarea.value;
    
    // 如果内容完全不同，可能是主题切换
    if (oldContent && newContent && oldContent !== newContent) {
      const similarity = this.calculateSimilarity(oldContent, newContent);
      
      // 如果相似度很低，认为是主题切换
      if (similarity < 0.3) {
        console.log(`[${this.extensionName}] 检测到内容大幅变化，可能是主题切换`);
        this.handlePossibleThemeChange();
      }
    }
    
    // 更新引用
    this.currentTextarea = newTextarea;
    this.currentCSSContent = newContent;
  }

  /**
   * 处理可能的主题变化
   */
  handlePossibleThemeChange() {
    // 防抖处理，避免频繁触发
    if (this.themeChangeTimeout) {
      clearTimeout(this.themeChangeTimeout);
    }
    
    this.themeChangeTimeout = setTimeout(() => {
      if (this.settings.autoCleanOnThemeChange && this.settings.enabled) {
        console.log(`[${this.extensionName}] 执行主题切换清理`);
        
        // 清理所有添加的内容
        this.core.clearAll();
        
        // 重置状态
        this.lastProcessedContent = null;
        
        // 重新应用
        setTimeout(() => {
          this.applyCurrentConfiguration();
        }, 200);
      }
    }, 300);
  }

  /**
   * 计算字符串相似度
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 计算编辑距离
   */
  getEditDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * 监听自定义CSS输入框
   */
  watchCustomCSSTextarea() {
    const checkTextarea = setInterval(() => {
      const textarea = document.getElementById('customCSS');
      
      if (textarea && textarea !== this.currentTextarea) {
        // 发现新的textarea
        console.log(`[${this.extensionName}] 找到CSS输入框`);
        
        this.currentTextarea = textarea;
        this.currentCSSContent = textarea.value;
        
        // 移除可能存在的旧监听器
        if (this.textareaHandler) {
          textarea.removeEventListener('input', this.textareaHandler);
        }
        
        // 添加新的事件监听
        this.textareaHandler = this.settings.realTimeUpdate
          ? (e) => this.handleCSSChange(e.target.value)
          : this.debounce((e) => this.handleCSSChange(e.target.value), 500);
        
        textarea.addEventListener('input', this.textareaHandler);
        
        // 标记已初始化
        textarea.setAttribute('data-enhanced-initialized', 'true');
        
        // 初始处理
        if (this.settings.enabled && textarea.value) {
          this.handleCSSChange(textarea.value);
        }
        
        clearInterval(checkTextarea);
      }
    }, 100);
    
    // 10秒后停止检查
    setTimeout(() => clearInterval(checkTextarea), 10000);
  }

  /**
   * 处理CSS内容变化
   */
  handleCSSChange(content) {
    if (!this.settings.enabled) return;
    
    // 如果内容没有实质变化，跳过处理
    if (content === this.lastProcessedContent) {
      return;
    }
    
    this.currentCSSContent = content;
    this.lastProcessedContent = content;
    
    // 使用CSS处理器处理内容
    const result = this.cssProcessor.process(content);
    
    // 应用处理结果
    if (result.css) {
      this.core.applyCSS(result.css, 'main-custom-css');
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
   * 应用当前配置
   */
  applyCurrentConfiguration() {
    // 应用CSS
    const textarea = document.getElementById('customCSS');
    if (textarea && textarea.value) {
      // 强制重新处理
      this.lastProcessedContent = null;
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
      clear: () => this.core.clearAll(),
      
      // 手动触发主题切换清理
      cleanTheme: () => {
        console.log('[EnhancedCSS] 手动清理主题');
        this.core.clearAll();
        setTimeout(() => this.applyCurrentConfiguration(), 100);
      },
      
      // 完全卸载（清理所有云端数据）
      uninstall: async () => {
        if (confirm('⚠️ 警告：这将永久删除所有字体和设置数据！\n\n确定要完全卸载吗？')) {
          if (confirm('再次确认：所有云端保存的字体和设置都将被永久删除，无法恢复！')) {
            await this.completeUninstall();
          }
        }
      }
    };
  }

  /**
   * 完全卸载 - 清理所有数据
   */
  async completeUninstall() {
    console.log(`[${this.extensionName}] 开始完全卸载...`);
    
    try {
      // 1. 清理所有DOM元素和样式
      this.core.clearAll();
      
      // 2. 清理所有本地和云端存储的数据
      await this.storage.clear();
      
      // 3. 如果在SillyTavern环境，确保云端数据被完全清除
      if (window.extension_settings && window.extension_settings[this.extensionName]) {
        // 完全删除扩展的设置对象
        delete window.extension_settings[this.extensionName];
        
        // 立即保存到服务器
        if (typeof saveSettingsDebounced === 'function') {
          saveSettingsDebounced();
          console.log(`[${this.extensionName}] 云端数据已完全清除`);
        }
      }
      
      // 4. 清理所有localStorage中可能的残留
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes(this.extensionName) || key.includes('EnhancedCSS'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 5. 停止所有监听器
      if (this.themeObserver) this.themeObserver.disconnect();
      if (this.textareaObserver) this.textareaObserver.disconnect();
      if (this.currentTextarea && this.textareaHandler) {
        this.currentTextarea.removeEventListener('input', this.textareaHandler);
      }
      
      // 6. 移除UI
      const uiContainer = document.querySelector('#EnhancedCustomCSSPlus_settings');
      if (uiContainer) {
        uiContainer.remove();
      }
      
      alert('✅ Enhanced Custom CSS Plus 已完全卸载！\n\n所有数据已从云端和本地清除。\n\n如需重新使用，安装后将是全新开始。');
      
      console.log(`[${this.extensionName}] 完全卸载成功`);
      
      // 7. 清理全局对象
      delete window.EnhancedCSS;
      delete window.EnhancedCustomCSSPlus;
      
    } catch (error) {
      console.error(`[${this.extensionName}] 卸载失败:`, error);
      alert('❌ 卸载过程中出现错误，请查看控制台。');
    }
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

  /**
   * 清理函数（卸载时调用）
   */
  cleanup() {
    // 停止所有观察器
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
    if (this.textareaObserver) {
      this.textareaObserver.disconnect();
    }
    
    // 清理所有添加的内容
    this.core.clearAll();
    
    // 移除事件监听器
    if (this.currentTextarea && this.textareaHandler) {
      this.currentTextarea.removeEventListener('input', this.textareaHandler);
    }
    
    console.log(`[${this.extensionName}] 清理完成`);
  }
}

// 启动扩展
(function () {
  'use strict';
  
  let extension = null;
  
  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
  } else {
    initExtension();
  }
  
  async function initExtension() {
    // 如果已存在实例，先清理
    if (window.EnhancedCustomCSSPlus) {
      console.log('[EnhancedCustomCSSPlus] 清理旧实例');
      if (window.EnhancedCustomCSSPlus.cleanup) {
        window.EnhancedCustomCSSPlus.cleanup();
      }
    }
    
    // 创建扩展实例
    extension = new EnhancedCustomCSSPlus();
    
    // 初始化扩展
    await extension.init();
    
    // 保存到全局以便调试和手动控制
    window.EnhancedCustomCSSPlus = extension;
  }
  
  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    if (extension && extension.cleanup) {
      extension.cleanup();
    }
  });
})();

// ES6模块导出
export { EnhancedCustomCSSPlus };
