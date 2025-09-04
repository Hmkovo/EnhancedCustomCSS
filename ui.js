/**
 * UI界面模块 - 创建和管理扩展的用户界面
 * 实现分页式设置面板，字体管理界面，拖拽排序等功能
 */

export class UI {
  constructor(extension) {
    this.extension = extension;
    this.currentTab = 'css'; // 当前标签页
    this.fontListElement = null;
    this.initialized = false;

    // UI状态
    this.uiState = {
      fontSearchQuery: '',
      fontFilterTag: 'all',
      fontSortBy: 'name', // name, date, custom
      fontViewMode: 'list', // list, grid
      fontAddExpanded: false, // 字体添加区域展开状态
      expandedFonts: new Set(), // 展开的字体项
      importMergeMode: true // 导入模式：true=合并，false=覆盖
    };
  }

  /**
   * 初始化UI
   */
  async init() {
    // 等待扩展设置面板出现
    await this.waitForExtensionPanel();

    // 创建UI
    this.createUI();

    // 绑定事件
    this.bindEvents();

    this.initialized = true;
    console.log('[UI] 界面初始化完成');
  }

  /**
   * 等待扩展面板加载
   */
  waitForExtensionPanel() {
    return new Promise((resolve) => {
      const checkPanel = setInterval(() => {
        const extensionsPanel = document.querySelector('#extensions_settings');
        if (extensionsPanel) {
          clearInterval(checkPanel);
          resolve(extensionsPanel);
        }
      }, 100);
    });
  }

  /**
   * 创建完整UI界面
   */
  createUI() {
    const extensionsPanel = document.querySelector('#extensions_settings');
    if (!extensionsPanel) return;

    // 检查是否已创建
    if (document.querySelector('#EnhancedCustomCSSPlus_settings')) return;

    // 创建主容器
    const container = document.createElement('div');
    container.id = 'EnhancedCustomCSSPlus_settings';
    container.className = 'extension_settings';

    // 创建HTML结构
    container.innerHTML = `
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Enhanced Custom CSS Plus</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <!-- 顶部控制栏 -->
                    <div class="enhanced-top-controls">
                        <div class="flex-container">
                            <label class="checkbox_label">
                                <input type="checkbox" id="enhanced-enabled" checked>
                                <span>启用扩展</span>
                            </label>
                            <label class="checkbox_label">
                                <input type="checkbox" id="enhanced-realtime" checked>
                                <span>实时更新</span>
                            </label>
                            <label class="checkbox_label">
                                <input type="checkbox" id="enhanced-debug">
                                <span>调试模式</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- 标签页导航 -->
                    <div class="enhanced-tabs-nav">
                        <button class="tab-button active" data-tab="css">
                            <i class="fa fa-code"></i> CSS增强
                        </button>
                        <button class="tab-button" data-tab="fonts">
                            <i class="fa fa-font"></i> 字体管理
                        </button>
                        <button class="tab-button" data-tab="tools">
                            <i class="fa fa-tools"></i> 工具箱
                        </button>
                        <button class="tab-button" data-tab="about">
                            <i class="fa fa-info-circle"></i> 关于
                        </button>
                    </div>
                    
                    <!-- 标签页内容区域 -->
                    <div class="enhanced-tabs-content">
                        <!-- CSS增强标签页 -->
                        <div class="tab-content active" id="tab-css">
                            ${this.createCSSTabContent()}
                        </div>
                        
                        <!-- 字体管理标签页 -->
                        <div class="tab-content" id="tab-fonts">
                            ${this.createFontsTabContent()}
                        </div>
                        
                        <!-- 工具箱标签页 -->
                        <div class="tab-content" id="tab-tools">
                            ${this.createToolsTabContent()}
                        </div>
                        
                        <!-- 关于标签页 -->
                        <div class="tab-content" id="tab-about">
                            ${this.createAboutTabContent()}
                        </div>
                    </div>
                </div>
            </div>
        `;

    // 添加到扩展面板
    extensionsPanel.appendChild(container);
  }

  /**
   * 创建CSS标签页内容
   */
  createCSSTabContent() {
    return `
            <div class="enhanced-section">
                <h4>使用说明</h4>
                <div class="enhanced-help-content">
                    <div class="help-section">
                        <strong>@add 增强语法：</strong>
                        <pre class="code-block">
.selector {
  @add: className "内容" top-10px left-20px;
  @add: image "url(图片)" 100x100 bottom-0 right-0;
}</pre>
                    </div>
                    
                    <div class="help-section">
                        <strong>JavaScript 功能：</strong>
                        <pre class="code-block">
&lt;script&gt;
// 使用 EnhancedCSS API
EnhancedCSS.addElement('.selector', 'div', {
  class: 'decoration',
  html: '内容',
  style: { position: 'absolute' }
});
&lt;/script&gt;</pre>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * 创建字体管理标签页内容
   */
  createFontsTabContent() {
    return `
            <div class="enhanced-section">
                <!-- 字体添加区域（可折叠） -->
                <div class="font-add-section">
                    <div class="font-add-header" id="font-add-toggle">
                        <h4>+ 添加新字体</h4>
                        <i class="fa fa-chevron-down" id="font-add-icon"></i>
                    </div>
                    <div class="font-add-content" id="font-add-content" style="display: none;">
                        <textarea id="font-input" placeholder='支持多种格式：
1. 完整字体代码：
@import url("https://fontsapi.zeoseven.com/256/main/result.css");
body {
    font-family: "Huiwen-mincho";
}

2. 仅@import链接（需填写自定义名称）：
@import url("https://fontsapi.zeoseven.com/119/main/result.css");' rows="5"></textarea>
                        <div class="font-add-controls">
                            <input type="text" id="font-name-input" placeholder="自定义字体名称（某些格式必填）" class="text_pole">
                            <button id="add-font-btn" class="menu_button compact-btn">
                                + 添加
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 字体筛选工具栏 -->
                <div class="font-toolbar">
                    <div class="toolbar-left">
                        <input type="text" id="font-search" placeholder="搜索..." class="text_pole compact">
                        <select id="font-tag-filter" class="text_pole compact">
                            <option value="all">所有标签</option>
                            <option value="untagged">未分类</option>
                        </select>
                    </div>
                    <div class="toolbar-right">
                        <label class="checkbox_label compact-checkbox">
                            <input type="checkbox" id="import-merge" checked>
                            <span>合并</span>
                        </label>
                        <button id="font-import-btn" class="menu_button compact icon-only" title="导入">
                            <i class="fa fa-upload"></i>
                        </button>
                        <button id="font-export-btn" class="menu_button compact icon-only" title="导出">
                            <i class="fa fa-download"></i>
                        </button>
                    </div>
                </div>
                
                <!-- 字体列表 -->
                <div class="font-list-container">
                    <div id="font-list" class="font-list">
                        <!-- 动态生成的字体项 -->
                    </div>
                    
                    <!-- 空状态提示 -->
                    <div class="font-empty-state" style="display: none;">
                        <i class="fa fa-font fa-2x"></i>
                        <p>还没有添加任何字体</p>
                        <p class="hint">点击上方"添加新字体"开始使用</p>
                    </div>
                </div>
                
                <!-- 隐藏的文件输入 -->
                <input type="file" id="font-import-file" accept=".json" style="display: none;">
            </div>
        `;
  }

  /**
   * 创建工具箱标签页内容
   */
  createToolsTabContent() {
    return `
            <div class="enhanced-section">
                <div class="tool-item">
                    <h5>清理工具</h5>
                    <div class="tool-actions">
                        <button id="clear-all-btn" class="menu_button danger">
                            <i class="fa fa-broom"></i> 清除所有自定义内容
                        </button>
                        <p class="hint">清除所有通过扩展添加的元素和样式</p>
                    </div>
                </div>
                
                <div class="tool-item">
                    <h5>性能监控</h5>
                    <div id="performance-stats">
                        <div class="stat-item">
                            <span class="stat-label">添加的元素</span>
                            <span class="stat-value" id="element-count">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">添加的样式</span>
                            <span class="stat-value" id="style-count">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">字体数量</span>
                            <span class="stat-value" id="font-count">0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * 创建关于标签页内容
   */
  createAboutTabContent() {
    return `
            <div class="enhanced-section">
                <h4><i class="fa fa-info-circle"></i> 关于 Enhanced Custom CSS Plus</h4>
                
                <div class="about-content">
                    <p><strong>版本：</strong> 2.0.0</p>
                    <p><strong>作者：</strong> SGTY</p>
                    <p><strong>功能：</strong></p>
                    <ul>
                        <li>» JavaScript代码执行</li>
                        <li>» 动态DOM元素添加</li>
                        <li>» @add增强语法</li>
                        <li>» 字体管理系统</li>
                        <li>» 标签分类</li>
                        <li>» 导入/导出配置</li>
                        <li>» 拖拽排序</li>
                    </ul>
                    
                    <div class="about-actions">
                        <a href="https://github.com/Hmkovo/enhanced-custom-css" target="_blank" class="menu_button">
                            <i class="fab fa-github"></i> GitHub
                        </a>
                        <button id="reset-settings" class="menu_button danger">
                            <i class="fa fa-undo"></i> 重置所有设置
                        </button>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // 设置开关
    this.bindSettingsEvents();

    // 字体管理事件
    this.bindFontEvents();

    // 工具箱事件
    this.bindToolsEvents();
  }

  /**
   * 切换标签页
   */
  switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    this.currentTab = tabName;

    // 如果切换到字体标签页，刷新字体列表
    if (tabName === 'fonts') {
      this.refreshFontList();
    }
  }

  /**
   * 绑定设置相关事件
   */
  bindSettingsEvents() {
    // 启用开关
    const enabledCheckbox = document.getElementById('enhanced-enabled');
    if (enabledCheckbox) {
      enabledCheckbox.checked = this.extension.settings.enabled;
      enabledCheckbox.addEventListener('change', (e) => {
        this.extension.settings.enabled = e.target.checked;
        this.extension.saveSettings();

        if (!e.target.checked) {
          this.extension.core.clearAll();
        } else {
          this.extension.applyCurrentConfiguration();
        }
      });
    }

    // 实时更新开关
    const realtimeCheckbox = document.getElementById('enhanced-realtime');
    if (realtimeCheckbox) {
      realtimeCheckbox.checked = this.extension.settings.realTimeUpdate;
      realtimeCheckbox.addEventListener('change', (e) => {
        this.extension.settings.realTimeUpdate = e.target.checked;
        this.extension.saveSettings();
      });
    }

    // 调试模式开关
    const debugCheckbox = document.getElementById('enhanced-debug');
    if (debugCheckbox) {
      debugCheckbox.checked = this.extension.settings.debugMode;
      debugCheckbox.addEventListener('change', (e) => {
        this.extension.settings.debugMode = e.target.checked;
        this.extension.core.setDebugMode(e.target.checked);
        this.extension.saveSettings();
      });
    }

    // 重置设置按钮
    const resetBtn = document.getElementById('reset-settings');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('确定要重置所有设置吗？这将清除所有字体和配置。')) {
          this.extension.storage.clear();
          location.reload();
        }
      });
    }
  }

  /**
   * 绑定字体管理事件
   */
  bindFontEvents() {
    // 折叠/展开添加字体区域
    const toggleBtn = document.getElementById('font-add-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const content = document.getElementById('font-add-content');
        const icon = document.getElementById('font-add-icon');

        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.className = 'fa fa-chevron-up';
          this.uiState.fontAddExpanded = true;
        } else {
          content.style.display = 'none';
          icon.className = 'fa fa-chevron-down';
          this.uiState.fontAddExpanded = false;
        }
      });
    }

    // 添加字体按钮
    const addFontBtn = document.getElementById('add-font-btn');
    if (addFontBtn) {
      addFontBtn.addEventListener('click', () => {
        this.handleAddFont();
      });
    }

    // 搜索框
    const searchInput = document.getElementById('font-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.uiState.fontSearchQuery = e.target.value;
        this.refreshFontList();
      });
    }

    // 标签筛选
    const tagFilter = document.getElementById('font-tag-filter');
    if (tagFilter) {
      tagFilter.addEventListener('change', (e) => {
        this.uiState.fontFilterTag = e.target.value;
        this.refreshFontList();
      });
    }

    // 导入按钮和文件选择
    const importBtn = document.getElementById('font-import-btn');
    const importFile = document.getElementById('font-import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => {
        // 直接触发文件选择
        importFile.click();
      });

      // 文件选择事件
      importFile.addEventListener('change', (e) => {
        this.handleImportFile(e);
      });
    }

    // 导出按钮
    const exportBtn = document.getElementById('font-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.handleExportFonts();
      });
    }

    // 监听字体变化
    this.extension.fontManager.on('fontAdded', () => this.refreshFontList());
    this.extension.fontManager.on('fontRemoved', () => this.refreshFontList());
    this.extension.fontManager.on('fontUpdated', () => this.refreshFontList());
  }

  /**
   * 绑定工具箱事件
   */
  bindToolsEvents() {
    // 清除所有按钮
    const clearBtn = document.getElementById('clear-all-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('确定要清除所有自定义内容吗？')) {
          this.extension.core.clearAll();
          this.updateStats();
        }
      });
    }

    // 更新统计信息
    this.updateStats();
    setInterval(() => this.updateStats(), 5000);
  }

  /**
   * 处理添加字体
   */
  async handleAddFont() {
    const input = document.getElementById('font-input').value.trim();
    const customName = document.getElementById('font-name-input').value.trim();

    if (!input) {
      alert('请输入字体代码');
      return;
    }

    // 解析字体 - 增强版支持多种格式
    let fontData = null;

    // 检查是否只是@import语句
    if (input.includes('@import') && !input.includes('font-family')) {
      // 只有@import，需要自定义名称
      if (!customName) {
        alert('检测到仅包含@import链接，请输入自定义字体名称');
        return;
      }

      // 提取URL
      const urlMatch = input.match(/@import\s+url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        fontData = {
          name: customName,
          displayName: customName,
          css: `${input}\nbody { font-family: "${customName}"; }`,
          url: urlMatch[1],
          addedAt: new Date().toISOString()
        };
      }
    } else {
      // 尝试原有的解析方法
      fontData = this.extension.fontManager.parseFont(input);

      // 如果有自定义名称，覆盖解析出的名称
      if (fontData && customName) {
        fontData.name = customName;
        fontData.displayName = customName;
      }
    }

    if (!fontData) {
      alert('无法解析字体代码，请检查格式');
      return;
    }

    // 添加字体
    const success = await this.extension.fontManager.addFont(fontData);

    if (success) {
      // 清空输入
      document.getElementById('font-input').value = '';
      document.getElementById('font-name-input').value = '';

      // 自动设置为当前字体
      await this.extension.fontManager.setCurrentFont(fontData.name);

      // 刷新列表
      this.refreshFontList();

      console.log('[UI] 字体添加成功:', fontData.name);
    } else {
      alert('字体添加失败，可能已存在同名字体');
    }
  }

  /**
   * 处理导入字体文件
   */
  async handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 获取合并模式复选框状态
    const mergeCheckbox = document.getElementById('import-merge');
    const merge = mergeCheckbox ? mergeCheckbox.checked : true;

    try {
      // 读取文件内容
      const text = await file.text();

      // 导入字体
      const count = await this.extension.fontManager.importFonts(text, merge);

      const modeText = merge ? '增加' : '覆盖';
      alert(`成功导入 ${count} 个字体（${modeText}模式）`);

      // 清空文件选择
      event.target.value = '';

      // 刷新列表
      this.refreshFontList();
    } catch (error) {
      alert('导入失败: ' + error.message);
      event.target.value = '';
    }
  }

  /**
   * 刷新字体列表
   */
  refreshFontList() {
    const fontList = document.getElementById('font-list');
    const emptyState = document.querySelector('.font-empty-state');

    if (!fontList) return;

    // 获取字体列表
    let fonts = this.extension.fontManager.getAllFonts(this.uiState.fontFilterTag);

    // 搜索过滤
    if (this.uiState.fontSearchQuery) {
      const query = this.uiState.fontSearchQuery.toLowerCase();
      fonts = fonts.filter(font =>
        font.name.toLowerCase().includes(query) ||
        font.displayName.toLowerCase().includes(query) ||
        (font.tags && font.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // 排序
    fonts.sort((a, b) => {
      switch (this.uiState.fontSortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'date':
          return new Date(b.addedAt) - new Date(a.addedAt);
        case 'custom':
          return (a.order || 0) - (b.order || 0);
        default:
          return 0;
      }
    });

    // 显示空状态或字体列表
    if (fonts.length === 0) {
      fontList.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
    } else {
      if (emptyState) emptyState.style.display = 'none';

      // 渲染字体列表
      fontList.innerHTML = fonts.map(font => this.createFontItem(font)).join('');

      // 添加拖拽功能
      this.initDragAndDrop();

      // 绑定字体项事件
      this.bindFontItemEvents();
    }

    // 更新标签筛选选项
    this.updateTagFilter();

    // 更新统计
    this.updateStats();
  }

  /**
   * 创建字体项HTML
   */
  createFontItem(font) {
    const isCurrent = this.extension.fontManager.currentFont === font.name;
    const isExpanded = this.uiState.expandedFonts.has(font.name);

    const tagsHtml = font.tags && font.tags.length > 0
      ? font.tags.map(tag => `<span class="font-tag">${tag}</span>`).join('')
      : '<span class="font-tag-empty">无标签</span>';

    // 获取现有的所有标签
    const allTags = Array.from(this.extension.fontManager.tags);
    const tagCheckboxes = allTags.map(tag => `
            <label class="tag-checkbox">
                <input type="checkbox" value="${tag}" ${font.tags && font.tags.includes(tag) ? 'checked' : ''}>
                <span>${tag}</span>
            </label>
        `).join('');

    // 现有标签的删除列表
    const currentTagsList = font.tags && font.tags.length > 0
      ? font.tags.map(tag => `
                <div class="tag-item">
                    <span>${tag}</span>
                    <button class="remove-tag-btn" data-font="${font.name}" data-tag="${tag}">×</button>
                </div>
            `).join('')
      : '<div class="no-tags">暂无标签</div>';

    return `
            <div class="font-item ${isCurrent ? 'current' : ''} ${isExpanded ? 'expanded' : ''}" 
                 data-font-name="${font.name}" 
                 draggable="true">
                
                <!-- 字体主信息行 -->
                <div class="font-item-main">
                    <div class="font-item-header" data-font="${font.name}">
                        <i class="fa fa-chevron-${isExpanded ? 'up' : 'down'} expand-icon"></i>
                        <span class="font-item-name">
                            ${font.displayName || font.name}
                            ${isCurrent ? ' <span class="current-badge">✓</span>' : ''}
                        </span>
                        <div class="font-item-tags">
                            ${tagsHtml}
                        </div>
                    </div>
                    
                    <div class="font-item-actions">
                        <button class="font-action-btn font-use-btn" data-font="${font.name}" title="使用">
                            <i class="fa fa-check"></i>
                        </button>
                        <button class="font-action-btn font-edit-btn" data-font="${font.name}" title="编辑名称">
                            <i class="fa fa-edit"></i>
                        </button>
                        <button class="font-action-btn font-delete-btn" data-font="${font.name}" title="删除">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <!-- 展开的编辑区域 -->
                <div class="font-item-details" style="display: ${isExpanded ? 'block' : 'none'};">
                    <div class="tag-editor">
                        <div class="tag-section">
                            <h6>当前标签</h6>
                            <div class="current-tags">
                                ${currentTagsList}
                            </div>
                        </div>
                        
                        <div class="tag-section">
                            <h6>添加标签</h6>
                            <div class="tag-input-group">
                                <input type="text" class="tag-new-input" placeholder="输入新标签" data-font="${font.name}">
                                <button class="add-new-tag-btn" data-font="${font.name}">添加</button>
                            </div>
                            
                            ${allTags.length > 0 ? `
                                <div class="existing-tags">
                                    ${tagCheckboxes}
                                </div>
                                <button class="apply-tags-btn" data-font="${font.name}">应用选中标签</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * 绑定字体项事件
   */
  bindFontItemEvents() {
    // 折叠/展开字体详情
    document.querySelectorAll('.font-item-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const fontName = e.currentTarget.dataset.font;
        const fontItem = document.querySelector(`.font-item[data-font-name="${fontName}"]`);
        const details = fontItem.querySelector('.font-item-details');
        const icon = fontItem.querySelector('.expand-icon');

        if (this.uiState.expandedFonts.has(fontName)) {
          this.uiState.expandedFonts.delete(fontName);
          details.style.display = 'none';
          fontItem.classList.remove('expanded');
          icon.className = 'fa fa-chevron-down expand-icon';
        } else {
          this.uiState.expandedFonts.add(fontName);
          details.style.display = 'block';
          fontItem.classList.add('expanded');
          icon.className = 'fa fa-chevron-up expand-icon';
        }
      });
    });

    // 使用字体
    document.querySelectorAll('.font-use-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fontName = e.currentTarget.dataset.font;
        await this.extension.fontManager.setCurrentFont(fontName);
        this.refreshFontList();
      });
    });

    // 编辑字体名称
    document.querySelectorAll('.font-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fontName = e.currentTarget.dataset.font;
        const font = this.extension.fontManager.getFont(fontName);
        if (!font) return;

        const newName = prompt('编辑字体名称:', font.displayName || font.name);
        if (newName && newName !== font.displayName) {
          this.extension.fontManager.updateFont(fontName, {
            displayName: newName
          });
          this.refreshFontList();
        }
      });
    });

    // 删除字体
    document.querySelectorAll('.font-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fontName = e.currentTarget.dataset.font;
        if (confirm(`确定要删除字体 "${fontName}" 吗？`)) {
          await this.extension.fontManager.removeFont(fontName);
          this.refreshFontList();
        }
      });
    });

    // 删除单个标签
    document.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const fontName = e.currentTarget.dataset.font;
        const tagToRemove = e.currentTarget.dataset.tag;
        const font = this.extension.fontManager.getFont(fontName);

        if (font && font.tags) {
          const updatedTags = font.tags.filter(tag => tag !== tagToRemove);
          await this.extension.fontManager.updateFont(fontName, {
            tags: updatedTags
          });

          // 保持展开状态
          this.uiState.expandedFonts.add(fontName);
          this.refreshFontList();
        }
      });
    });

    // 添加新标签
    document.querySelectorAll('.add-new-tag-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const fontName = e.currentTarget.dataset.font;
        const input = document.querySelector(`.tag-new-input[data-font="${fontName}"]`);
        const newTag = input.value.trim();

        if (newTag) {
          const font = this.extension.fontManager.getFont(fontName);
          const updatedTags = [...new Set([...(font.tags || []), newTag])];

          await this.extension.fontManager.updateFont(fontName, {
            tags: updatedTags
          });

          input.value = '';
          // 保持展开状态
          this.uiState.expandedFonts.add(fontName);
          this.refreshFontList();
        }
      });
    });

    // 应用选中的标签
    document.querySelectorAll('.apply-tags-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const fontName = e.currentTarget.dataset.font;
        const fontItem = document.querySelector(`.font-item[data-font-name="${fontName}"]`);
        const checkboxes = fontItem.querySelectorAll('.tag-checkbox input:checked');

        const selectedTags = Array.from(checkboxes).map(cb => cb.value);

        if (selectedTags.length > 0) {
          const font = this.extension.fontManager.getFont(fontName);
          const updatedTags = [...new Set([...(font.tags || []), ...selectedTags])];

          await this.extension.fontManager.updateFont(fontName, {
            tags: updatedTags
          });

          // 保持展开状态
          this.uiState.expandedFonts.add(fontName);
          this.refreshFontList();
        }
      });
    });

    // Enter键添加标签
    document.querySelectorAll('.tag-new-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const fontName = e.currentTarget.dataset.font;
          const addBtn = document.querySelector(`.add-new-tag-btn[data-font="${fontName}"]`);
          if (addBtn) addBtn.click();
        }
      });
    });
  }

  /**
   * 初始化拖拽排序
   */
  initDragAndDrop() {
    const fontItems = document.querySelectorAll('.font-item');
    let draggedElement = null;

    fontItems.forEach(item => {
      // 拖拽开始
      item.addEventListener('dragstart', (e) => {
        draggedElement = e.currentTarget;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
      });

      // 拖拽结束
      item.addEventListener('dragend', (e) => {
        e.currentTarget.classList.remove('dragging');
      });

      // 拖拽经过
      item.addEventListener('dragover', (e) => {
        if (e.preventDefault) {
          e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';

        const afterElement = getDragAfterElement(item.parentNode, e.clientY);
        if (afterElement == null) {
          item.parentNode.appendChild(draggedElement);
        } else {
          item.parentNode.insertBefore(draggedElement, afterElement);
        }

        return false;
      });
    });

    // 获取拖拽后的位置
    function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.font-item:not(.dragging)')];

      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
  }

  /**
   * 处理导出字体
   */
  handleExportFonts() {
    const data = this.extension.fontManager.exportFonts();

    // 创建下载
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced-css-fonts-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('[UI] 字体配置已导出');
  }

  /**
   * 更新标签筛选器
   */
  updateTagFilter() {
    const filter = document.getElementById('font-tag-filter');
    if (!filter) return;

    const currentValue = filter.value;
    const tags = Array.from(this.extension.fontManager.tags);

    // 重建选项
    filter.innerHTML = `
            <option value="all">所有标签</option>
            <option value="untagged">未分类</option>
            ${tags.map(tag => `<option value="${tag}">${tag}</option>`).join('')}
        `;

    // 恢复选择
    filter.value = currentValue;
  }

  /**
   * 更新统计信息
   */
  updateStats() {
    const elementCount = document.getElementById('element-count');
    const styleCount = document.getElementById('style-count');
    const fontCount = document.getElementById('font-count');

    if (elementCount) {
      elementCount.textContent = this.extension.core.addedElements.size;
    }

    if (styleCount) {
      styleCount.textContent = this.extension.core.addedStyles.size;
    }

    if (fontCount) {
      fontCount.textContent = this.extension.fontManager.fonts.size;
    }
  }
}
