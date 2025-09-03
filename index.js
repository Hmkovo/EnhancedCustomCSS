// Enhanced Custom CSS Extension for SillyTavern
// 允许在自定义CSS框中执行JavaScript代码和动态修改DOM

(function () {
  'use strict';

  // 扩展名称和设置
  const extensionName = "EnhancedCustomCSS";
  const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
  const settingsKey = `${extensionName}_settings`;

  // 默认设置
  let settings = {
    enabled: true,
    autoAddClass: true,
    debugMode: false,
    realTimeUpdate: true  // 新增实时更新选项
  };

  // 存储已添加的内容
  let addedStyles = [];
  let addedScripts = [];
  let addedElements = [];
  let addedClasses = new Map();
  let currentCSSContent = '';  // 记录当前CSS内容

  // 初始化扩展
  async function initExtension() {
    console.log(`[${extensionName}] 初始化中...`);

    // 加载设置
    loadSettings();

    // 创建设置UI
    createSettingsUI();

    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupExtension);
    } else {
      setupExtension();
    }
  }

  // 创建设置UI
  function createSettingsUI() {
    // 等待扩展面板加载
    const checkPanel = setInterval(() => {
      const extensionsPanel = document.querySelector('#extensions_settings');
      if (extensionsPanel) {
        clearInterval(checkPanel);
        addSettingsPanel(extensionsPanel);
      }
    }, 100);
  }

  // 添加设置面板
  function addSettingsPanel(container) {
    // 检查是否已存在
    if (document.querySelector(`#${extensionName}_settings`)) return;

    // 创建设置区域
    const settingsHtml = `
            <div id="${extensionName}_settings" class="extension_settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Enhanced Custom CSS</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="enhanced-css-settings">
                            <div class="flex-container">
                                <label class="checkbox_label">
                                    <input type="checkbox" id="enhanced-css-enabled" ${settings.enabled ? 'checked' : ''}>
                                    <span>启用扩展</span>
                                </label>
                            </div>
                            
                            <div class="flex-container">
                                <label class="checkbox_label">
                                    <input type="checkbox" id="enhanced-css-realtime" ${settings.realTimeUpdate ? 'checked' : ''}>
                                    <span>实时更新（立即应用更改）</span>
                                </label>
                            </div>
                            
                            <div class="flex-container">
                                <label class="checkbox_label">
                                    <input type="checkbox" id="enhanced-css-debug" ${settings.debugMode ? 'checked' : ''}>
                                    <span>调试模式（控制台输出）</span>
                                </label>
                            </div>
                            
                            <hr>
                            
                            <div class="flex-container">
                                <h4>使用说明</h4>
                                <div style="font-size: 0.9em; line-height: 1.5;">
                                    <p><strong>@add 增强语法：</strong></p>
                                    <code style="display: block; padding: 5px; margin: 5px 0; background: rgba(0,0,0,0.1); border-radius: 3px;">
/* 基础用法 */
.selector {
  @add: className "内容" top-10px left-20px;
  @add: image "url(图片地址)" 100x100 bottom-0 right-0;
}
                                    </code>
                                    
                                    <p style="margin-top: 10px;"><strong>JavaScript 功能：</strong></p>
                                    <code style="display: block; padding: 5px; margin: 5px 0; background: rgba(0,0,0,0.1); border-radius: 3px;">
&lt;script&gt;
// 使用 EnhancedCSS API
EnhancedCSS.addElement('.selector', 'div', {
  class: 'my-decoration',
  html: '内容',
  style: { position: 'absolute', top: '10px' }
});
&lt;/script&gt;
                                    </code>
                                    
                                    <p style="margin-top: 10px;"><strong>高级定位选项：</strong></p>
                                    <ul style="margin: 5px 0; padding-left: 20px;">
                                        <li>支持px单位: top-10px, left-20px</li>
                                        <li>支持%单位: top-50%, left-50%</li>
                                        <li>支持负值: top--10px, left--20px</li>
                                        <li>图片尺寸: 100x100, 50x50</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    // 添加到扩展面板
    const wrapper = document.createElement('div');
    wrapper.innerHTML = settingsHtml;
    container.appendChild(wrapper.firstElementChild);

    // 绑定事件
    bindSettingsEvents();

    // 使用SillyTavern原生的折叠功能
    initNativeDrawer();
  }

  // 使用原生折叠功能
  function initNativeDrawer() {
    const drawer = document.querySelector(`#${extensionName}_settings .inline-drawer`);
    if (!drawer) return;

    const header = drawer.querySelector('.inline-drawer-toggle');
    const content = drawer.querySelector('.inline-drawer-content');

    if (!header || !content) return;

    if (!drawer.classList.contains('inline-drawer-ready')) {
      drawer.classList.add('inline-drawer-ready');
    }
  }

  // 绑定设置事件
  function bindSettingsEvents() {
    // 启用开关
    const enabledCheckbox = document.getElementById('enhanced-css-enabled');
    if (enabledCheckbox) {
      enabledCheckbox.addEventListener('change', (e) => {
        settings.enabled = e.target.checked;
        saveSettings();
        if (!settings.enabled) {
          clearAddedContent();
        } else {
          const textarea = document.getElementById('customCSS');
          if (textarea) {
            handleCustomCSSChange({ target: textarea });
          }
        }
      });
    }

    // 实时更新开关
    const realtimeCheckbox = document.getElementById('enhanced-css-realtime');
    if (realtimeCheckbox) {
      realtimeCheckbox.addEventListener('change', (e) => {
        settings.realTimeUpdate = e.target.checked;
        saveSettings();
      });
    }

    // 调试模式开关
    const debugCheckbox = document.getElementById('enhanced-css-debug');
    if (debugCheckbox) {
      debugCheckbox.addEventListener('change', (e) => {
        settings.debugMode = e.target.checked;
        saveSettings();
      });
    }
  }

  // 设置扩展
  function setupExtension() {
    // 查找自定义CSS输入框
    const customCSSTextarea = document.getElementById('customCSS');

    if (!customCSSTextarea) {
      if (settings.debugMode) console.error(`[${extensionName}] 找不到自定义CSS输入框`);
      setTimeout(setupExtension, 1000);
      return;
    }

    console.log(`[${extensionName}] 找到自定义CSS输入框，开始监听...`);

    // 添加提示信息
    addHintMessage(customCSSTextarea);

    // 监听输入框变化 - 根据设置决定是否使用防抖
    if (settings.realTimeUpdate) {
      customCSSTextarea.addEventListener('input', handleCustomCSSChange);
    } else {
      customCSSTextarea.addEventListener('input', debounce(handleCustomCSSChange, 500));
    }

    // 监听主题切换
    observeThemeChanges(customCSSTextarea);

    // 初始加载已有内容
    if (settings.enabled) {
      handleCustomCSSChange({ target: customCSSTextarea });
    }

    // 监听设置变化
    observeSettingsChanges();
  }

  // 监听主题切换
  function observeThemeChanges(textarea) {
    // 监听textarea的value变化（主题切换会改变其内容）
    let lastValue = textarea.value;

    // 使用MutationObserver监听属性变化
    const observer = new MutationObserver(() => {
      if (textarea.value !== lastValue) {
        lastValue = textarea.value;
        // 主题切换时，清除之前的内容并应用新内容
        if (settings.enabled) {
          clearAddedContent();
          handleCustomCSSChange({ target: textarea });
        }
      }
    });

    observer.observe(textarea, {
      attributes: true,
      attributeFilter: ['value']
    });

    // 也监听其他可能的主题切换方式
    setInterval(() => {
      if (textarea.value !== currentCSSContent) {
        currentCSSContent = textarea.value;
        if (settings.enabled) {
          clearAddedContent();
          handleCustomCSSChange({ target: textarea });
        }
      }
    }, 100);
  }

  // 添加提示信息
  function addHintMessage(textarea) {
    const existingHint = textarea.parentElement?.querySelector('.enhanced-css-hint');
    if (existingHint) return;

    const hint = document.createElement('div');
    hint.className = 'enhanced-css-hint';
    hint.style.cssText = `
            font-size: 0.9em;
            color: var(--SmartThemeBodyColor);
            margin-top: 5px;
            padding: 8px;
            background: var(--SmartThemeBlurTintColor);
            border-radius: 4px;
            opacity: 0.8;
        `;
    hint.innerHTML = `
            <strong>🎨 Enhanced CSS 已启用</strong> - 
            支持JavaScript (&lt;script&gt;标签) 和 @add 增强语法
        `;

    const parent = textarea.parentElement;
    if (parent) {
      parent.appendChild(hint);
    }
  }

  // 处理自定义CSS变化
  function handleCustomCSSChange(event) {
    if (!settings.enabled) return;

    const content = event.target.value;
    currentCSSContent = content;  // 更新当前内容

    // 总是清除之前的内容，确保实时更新
    clearAddedContent();

    if (!content) {
      return;
    }

    // 解析内容
    const { css, javascript } = parseContent(content);

    // 应用CSS（包括@add语法处理）
    if (css) {
      const processedCSS = processCSSAddSyntax(css);
      applyCSS(processedCSS.css);

      // 执行@add创建的元素
      if (processedCSS.addCommands.length > 0) {
        executeAddCommands(processedCSS.addCommands);
      }
    }

    // 执行JavaScript
    if (javascript) {
      executeJavaScript(javascript);
    }
  }

  // 增强的@add语法处理
  function processCSSAddSyntax(css) {
    const addCommands = [];

    // 更强大的@add语法匹配
    const ruleRegex = /([^{]+)\s*\{([^}]*)\}/g;
    let processedCSS = css;

    let match;
    while ((match = ruleRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const content = match[2];

      // 增强的@add正则，支持更多格式
      const addRegex = /@add:\s*([a-zA-Z0-9_-]+)\s+"([^"]*)"(?:\s+([^\s;]+))?(?:\s+([^\s;]+))?(?:\s+([^\s;]+))?(?:\s+([^\s;]+))?[;]?/g;
      let addMatch;

      while ((addMatch = addRegex.exec(content)) !== null) {
        const className = addMatch[1];
        const contentValue = addMatch[2];

        // 解析额外参数
        const params = [addMatch[3], addMatch[4], addMatch[5], addMatch[6]].filter(Boolean);

        // 判断内容类型
        if (contentValue.startsWith('url(')) {
          // 图片类型
          const imageUrl = contentValue.slice(4, -1);
          let size = null;
          let position = {};

          params.forEach(param => {
            if (param && param.includes('x')) {
              // 尺寸参数 (如 100x100)
              size = param;
            } else if (param) {
              // 位置参数
              Object.assign(position, parseAdvancedPosition(param));
            }
          });

          addCommands.push({
            type: 'image',
            selector: selector,
            className: className,
            url: imageUrl,
            size: size,
            position: position
          });
        } else {
          // 文本类型
          let position = {};
          params.forEach(param => {
            if (param) {
              Object.assign(position, parseAdvancedPosition(param));
            }
          });

          addCommands.push({
            type: 'text',
            selector: selector,
            className: className,
            text: contentValue,
            position: position
          });
        }

        // 从CSS中移除@add命令
        processedCSS = processedCSS.replace(addMatch[0], '');
      }
    }

    return { css: processedCSS, addCommands: addCommands };
  }

  // 增强的位置解析
  function parseAdvancedPosition(pos) {
    if (!pos) return {};

    const style = {};

    // 支持负值（使用双减号表示）
    pos = pos.replace('--', 'NEG');

    // 匹配各种格式
    if (pos.includes('top')) {
      const value = pos.replace('top-', '').replace('top', '0');
      style.top = value.replace('NEG', '-');
    } else if (pos.includes('bottom')) {
      const value = pos.replace('bottom-', '').replace('bottom', '0');
      style.bottom = value.replace('NEG', '-');
    } else if (pos.includes('left')) {
      const value = pos.replace('left-', '').replace('left', '0');
      style.left = value.replace('NEG', '-');
    } else if (pos.includes('right')) {
      const value = pos.replace('right-', '').replace('right', '0');
      style.right = value.replace('NEG', '-');
    }

    return style;
  }

  // 执行增强的@add命令
  function executeAddCommands(commands) {
    commands.forEach(cmd => {
      const elements = document.querySelectorAll(cmd.selector);
      elements.forEach(el => {
        let newEl;

        if (cmd.type === 'image') {
          // 创建图片元素
          newEl = document.createElement('div');
          newEl.className = `enhanced-add-${cmd.className}`;
          newEl.style.backgroundImage = `url(${cmd.url})`;
          newEl.style.backgroundSize = 'contain';
          newEl.style.backgroundRepeat = 'no-repeat';
          newEl.style.backgroundPosition = 'center';

          if (cmd.size) {
            const [width, height] = cmd.size.split('x');
            newEl.style.width = width + 'px';
            newEl.style.height = height + 'px';
          }
        } else {
          // 创建文本元素
          newEl = document.createElement('span');
          newEl.className = `enhanced-add-${cmd.className}`;
          newEl.textContent = cmd.text;
        }

        // 应用位置
        newEl.style.position = 'absolute';
        Object.assign(newEl.style, cmd.position);

        // 添加标记
        newEl.setAttribute('data-enhanced-css-element', 'true');

        // 确保父元素有相对定位
        if (getComputedStyle(el).position === 'static') {
          el.style.position = 'relative';
        }

        el.appendChild(newEl);
        addedElements.push(newEl);
      });
    });

    if (settings.debugMode) {
      console.log(`[${extensionName}] 执行了 ${commands.length} 个@add命令`);
    }
  }

  // 解析内容，分离CSS和JavaScript
  function parseContent(content) {
    let css = content;
    let javascript = '';

    // 提取 <script> 标签中的内容
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatches;
    while ((scriptMatches = scriptRegex.exec(content)) !== null) {
      javascript += scriptMatches[1] + '\n';
      css = css.replace(scriptMatches[0], '');
    }

    return { css: css.trim(), javascript: javascript.trim() };
  }

  // 应用CSS样式
  function applyCSS(css) {
    try {
      const style = document.createElement('style');
      style.setAttribute('data-enhanced-css', 'true');
      style.textContent = css;
      document.head.appendChild(style);
      addedStyles.push(style);
      if (settings.debugMode) console.log(`[${extensionName}] CSS应用成功`);
    } catch (error) {
      console.error(`[${extensionName}] CSS应用失败:`, error);
    }
  }

  // 执行JavaScript代码
  function executeJavaScript(code) {
    try {
      // 创建一个更安全的执行环境
      const safeExecute = new Function('document', 'window', 'EnhancedCSS', `
        'use strict';
        ${code}
      `);
      safeExecute(document, window, window.EnhancedCSS);
      if (settings.debugMode) console.log(`[${extensionName}] JavaScript执行成功`);
      addedScripts.push(code);
    } catch (error) {
      console.error(`[${extensionName}] JavaScript执行失败:`, error);
      showError(error.message);
    }
  }

  // 清除已添加的内容
  function clearAddedContent() {
    // 清除样式
    addedStyles.forEach(style => {
      if (style && style.parentNode) {
        style.parentNode.removeChild(style);
      }
    });
    addedStyles = [];

    // 清除动态元素
    document.querySelectorAll('[data-enhanced-css-element]').forEach(el => {
      el.remove();
    });
    addedElements = [];

    // 清除添加的类名
    addedClasses.forEach((classes, selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        classes.forEach(className => {
          el.classList.remove(className);
        });
      });
    });
    addedClasses.clear();

    if (settings.debugMode) {
      console.log(`[${extensionName}] 清除了所有添加的内容`);
    }
  }

  // 显示错误提示
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
    errorDiv.textContent = `Enhanced CSS Error: ${message}`;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  // 监听设置变化
  function observeSettingsChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const newCustomCSS = document.getElementById('customCSS');
          if (newCustomCSS && !newCustomCSS.hasAttribute('data-enhanced-css-initialized')) {
            newCustomCSS.setAttribute('data-enhanced-css-initialized', 'true');
            setupExtension();
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 防抖函数
  function debounce(func, wait) {
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

  // 保存设置
  function saveSettings() {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  }

  // 加载设置
  function loadSettings() {
    const saved = localStorage.getItem(settingsKey);
    if (saved) {
      try {
        settings = { ...settings, ...JSON.parse(saved) };
      } catch (e) {
        console.error(`[${extensionName}] 加载设置失败:`, e);
      }
    }
  }

  // 增强的全局API
  window.EnhancedCSS = {
    // 创建任意元素
    createElement: function (tag, options = {}) {
      const element = document.createElement(tag);

      if (options.class) element.className = options.class;
      if (options.id) element.id = options.id;
      if (options.text) element.textContent = options.text;
      if (options.html) element.innerHTML = options.html;
      if (options.style) Object.assign(element.style, options.style);
      if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
      if (options.parent) {
        const parent = typeof options.parent === 'string'
          ? document.querySelector(options.parent)
          : options.parent;
        if (parent) parent.appendChild(element);
      }

      element.setAttribute('data-enhanced-css-element', 'true');
      addedElements.push(element);

      return element;
    },

    // 批量添加元素
    addElements: function (parentSelector, elements) {
      const parents = document.querySelectorAll(parentSelector);
      const created = [];

      parents.forEach(parent => {
        // 确保父元素有相对定位
        if (getComputedStyle(parent).position === 'static') {
          parent.style.position = 'relative';
        }

        elements.forEach(config => {
          const el = this.createElement(config.tag || 'div', {
            ...config,
            parent: parent
          });
          created.push(el);
        });
      });

      return created;
    },

    // 添加装饰图片
    addImage: function (parentSelector, url, options = {}) {
      // 支持选择器字符串和DOM元素
      let parents;
      if (typeof parentSelector === 'string') {
        parents = document.querySelectorAll(parentSelector);
      } else if (parentSelector instanceof NodeList) {
        parents = parentSelector;
      } else if (parentSelector instanceof HTMLElement) {
        parents = [parentSelector];
      } else {
        console.error('Invalid selector type');
        return [];
      }

      const images = [];

      parents.forEach(parent => {
        const img = document.createElement('div');
        img.className = options.class || 'enhanced-image';
        img.style.position = 'absolute';
        img.style.backgroundImage = `url(${url})`;
        img.style.backgroundSize = options.size || 'contain';
        img.style.backgroundRepeat = 'no-repeat';
        img.style.backgroundPosition = 'center';

        if (options.width) img.style.width = options.width;
        if (options.height) img.style.height = options.height;
        if (options.top !== undefined) img.style.top = options.top;
        if (options.bottom !== undefined) img.style.bottom = options.bottom;
        if (options.left !== undefined) img.style.left = options.left;
        if (options.right !== undefined) img.style.right = options.right;
        if (options.zIndex !== undefined) img.style.zIndex = options.zIndex;
        if (options.opacity !== undefined) img.style.opacity = options.opacity;

        img.setAttribute('data-enhanced-css-element', 'true');

        // 确保父元素有相对定位
        if (getComputedStyle(parent).position === 'static') {
          parent.style.position = 'relative';
        }

        parent.appendChild(img);
        addedElements.push(img);
        images.push(img);
      });

      return images;
    },

    // 添加类名到已有元素
    addClass: function (selector, className) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        className.split(' ').forEach(cls => {
          el.classList.add(cls);

          if (!addedClasses.has(selector)) {
            addedClasses.set(selector, new Set());
          }
          addedClasses.get(selector).add(cls);
        });
      });

      if (settings.debugMode) {
        console.log(`[${extensionName}] 添加类名 "${className}" 到 ${elements.length} 个元素`);
      }
    },

    // 为已有元素添加子元素（简化版）
    addElement: function (parentSelector, tag, options = {}) {
      return this.createElement(tag, {
        ...options,
        parent: parentSelector
      });
    },

    // 修改已有元素样式
    modifyStyle: function (selector, styles) {
      // 支持选择器字符串和DOM元素
      const elements = typeof selector === 'string'
        ? document.querySelectorAll(selector)
        : (selector instanceof NodeList ? selector : [selector]);
      elements.forEach(el => {
        Object.assign(el.style, styles);
      });
    },

    // 查询选择器简写
    $: (selector) => document.querySelector(selector),
    $$: (selector) => document.querySelectorAll(selector),

    // 添加CSS
    addCSS: function (css) {
      applyCSS(css);
    },

    // 监听新消息
    onNewMessage: function (callback) {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.classList && (node.classList.contains('mes') || node.classList.contains('mes_block'))) {
              callback(node);
            }
          });
        });
      });

      const chat = document.querySelector('#chat');
      if (chat) {
        observer.observe(chat, { childList: true, subtree: true });
      }
    },

    // 获取当前主题
    getCurrentTheme: function () {
      const themeSelect = document.querySelector('#themes');
      return themeSelect ? themeSelect.value : null;
    },

    // 清除所有添加的内容
    clear: function () {
      clearAddedContent();
    }
  };

  // 启动扩展
  initExtension();

})();